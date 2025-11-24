#!/usr/bin/env tsx

import "dotenv/config";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const RAILS_OWNER = "rails";
const RAILS_REPO = "rails";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DOCS_DIR = join(__dirname, "..", "docs", "monthly");
const INDEX_FILE = join(__dirname, "..", "docs", "monthly-index.json");

// Initialize clients
export const octokit = new Octokit({ auth: GITHUB_TOKEN });
export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Type definitions
interface YearMonth {
  year: number;
  month: number;
}

interface PRDetails {
  pr: Awaited<ReturnType<typeof octokit.pulls.get>>["data"];
  files: Awaited<ReturnType<typeof octokit.pulls.listFiles>>["data"];
}

interface MonthlyIndexEntry {
  filename: string;
  year: string;
  month: number;
  title: string;
  url: string;
}

/**
 * Get year and month for a given date
 */
export function getYearMonth(date = new Date()): YearMonth {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

/**
 * Get filename for the current month
 */
export function getMonthlyFilename(): string {
  const { year, month } = getYearMonth();
  const monthStr = String(month).padStart(2, "0");
  return `${year}-${monthStr}.md`;
}

/**
 * Fetch merged PRs from the last 24 hours
 */
export async function fetchRecentPRs() {
  console.log("Fetching recently merged PRs from rails/rails...");

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  try {
    const { data: pullRequests } = await octokit.search.issuesAndPullRequests({
      q: `repo:${RAILS_OWNER}/${RAILS_REPO} is:pr is:merged merged:>=${yesterday.toISOString().split("T")[0]}`,
      sort: "updated",
      order: "desc",
      per_page: 100,
    });

    console.log(`Found ${pullRequests.items.length} merged PRs`);
    return pullRequests.items;
  } catch (error) {
    console.error("Error fetching PRs:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Get PR details including diff
 */
export async function getPRDetails(prNumber: number): Promise<PRDetails | null> {
  try {
    const { data: pr } = await octokit.pulls.get({
      owner: RAILS_OWNER,
      repo: RAILS_REPO,
      pull_number: prNumber,
    });

    const { data: files } = await octokit.pulls.listFiles({
      owner: RAILS_OWNER,
      repo: RAILS_REPO,
      pull_number: prNumber,
      per_page: 100,
    });

    return { pr, files };
  } catch (error) {
    console.error(
      `Error fetching PR #${prNumber} details:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * Summarize PR using OpenAI
 */
export async function summarizePR(prData: PRDetails): Promise<string> {
  const { pr, files } = prData;

  // Prepare file changes summary
  const fileChanges = files
    .slice(0, 20)
    .map(
      (f: { filename?: string; additions: number; deletions: number }) =>
        `- ${f.filename ?? "unknown"} (+${f.additions}/-${f.deletions})`,
    )
    .join("\n");

  const prompt = `以下のRuby on Rails PRを日本語で要約・解説してください。

PR情報:
- タイトル: ${pr.title}
- 番号: #${pr.number}
- 作成者: ${pr.user?.login ?? "unknown"}
- マージ日時: ${pr.merged_at}
- 説明:
${pr.body ?? "説明なし"}

変更されたファイル (最大20件):
${fileChanges}
${files.length > 20 ? `\n... 他 ${files.length - 20} ファイル` : ""}

統計:
- 変更ファイル数: ${files.length}
- 追加行数: ${pr.additions}
- 削除行数: ${pr.deletions}

以下の形式で出力してください:
1. 概要 (1-2文で)
2. 変更内容の詳細
3. 影響範囲・注意点
4. 参考情報 (あれば)

技術的に正確で、開発者にとって有益な情報を含めてください。`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return completion.choices[0]?.message.content ?? "要約を生成できませんでした";
  } catch (error) {
    console.error(
      `Error summarizing PR #${pr.number}:`,
      error instanceof Error ? error.message : String(error),
    );
    return `要約エラー: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Format PR entry for markdown
 */
export function formatPREntry(pr: PRDetails["pr"], summary: string): string {
  const date = new Date(pr.merged_at ?? "").toLocaleDateString("ja-JP");
  return `
## [#${pr.number}](${pr.html_url}) ${pr.title}

**マージ日**: ${date} | **作成者**: [@${pr.user?.login ?? "unknown"}](${pr.user?.html_url ?? "#"})

${summary}

---
`;
}

/**
 * Get existing PR numbers from monthly file
 */
export function getExistingPRNumbers(): Set<number> {
  const filename = getMonthlyFilename();
  const filepath = join(DOCS_DIR, filename);

  if (!existsSync(filepath)) {
    return new Set();
  }

  const content = readFileSync(filepath, "utf-8");

  // Extract PR numbers using regex: ## [#123](url) Title
  const prNumberRegex = /## \[#(\d+)\]/g;
  const existingPRs = new Set<number>();

  const matches = content.matchAll(prNumberRegex);
  for (const match of matches) {
    existingPRs.add(Number.parseInt(match[1], 10));
  }

  return existingPRs;
}

/**
 * Update monthly markdown file (VitePress format)
 */
export function updateMonthlyFile(entries: string[]): void {
  if (entries.length === 0) {
    console.log("No new PRs to add");
    return;
  }

  // Ensure docs/monthly directory exists
  if (!existsSync(DOCS_DIR)) {
    mkdirSync(DOCS_DIR, { recursive: true });
  }

  const filename = getMonthlyFilename();
  const filepath = join(DOCS_DIR, filename);
  const { year, month } = getYearMonth();

  let frontmatter = "";
  let header = "";
  let existingContent = "";

  // Read existing content or create new file
  if (existsSync(filepath)) {
    const content = readFileSync(filepath, "utf-8");
    console.log(`Updating existing file: ${filename}`);

    // Extract frontmatter if exists
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    if (frontmatterMatch) {
      // Update lastUpdated in frontmatter
      const existingFrontmatter = frontmatterMatch[1];
      const updatedFrontmatter = existingFrontmatter.replace(
        /lastUpdated: .*/,
        `lastUpdated: ${new Date().toISOString().split("T")[0]}`,
      );
      frontmatter = `---\n${updatedFrontmatter}\n---\n\n`;

      // Extract content after frontmatter
      const contentAfterFrontmatter = content.substring(frontmatterMatch[0].length);

      // Split header and existing content
      // Note: Skip leading whitespace before matching header
      const headerMatch = contentAfterFrontmatter.match(/^\s*(# .*?\n\n> .*?\n\n)/);
      if (headerMatch) {
        header = headerMatch[1];
        existingContent = contentAfterFrontmatter.substring(headerMatch[0].length);
      } else {
        existingContent = contentAfterFrontmatter;
      }
    } else {
      // No frontmatter, treat entire content as existing
      existingContent = content;
    }
  } else {
    // Create new file with frontmatter
    frontmatter = `---
title: ${year}年 ${month}月
description: Ruby on Rails PR Digest - ${year}年 ${month}月にマージされたPRの要約
lastUpdated: ${new Date().toISOString().split("T")[0]}
---

`;
    header = `# Ruby on Rails PR Digest - ${year}年 ${month}月

> このページは [rails/rails](https://github.com/rails/rails) リポジトリにマージされたPull Requestを自動的に収集し、AIで要約したものです。

`;
    console.log(`Creating new file: ${filename}`);
  }

  // Prepend new entries to existing content
  const newContent = `${frontmatter + header + entries.join("\n")}\n${existingContent}`;

  writeFileSync(filepath, newContent, "utf-8");
  console.log(`Updated: ${filepath}`);
}

/**
 * Generate index of monthly files
 */
export function generateMonthlyIndex(): void {
  console.log("Generating monthly file index...");

  if (!existsSync(DOCS_DIR)) {
    console.log("No monthly directory found");
    return;
  }

  // Read all .md files from monthly directory
  const files = readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse(); // Most recent first

  // Generate index data
  const indexData: MonthlyIndexEntry[] = files
    .map((filename) => {
      const match = filename.match(/(\d{4})-(\d{2})\.md/);
      if (match) {
        const year = match[1];
        const month = Number.parseInt(match[2], 10);
        return {
          filename,
          year,
          month,
          title: `${year}年 ${month}月`,
          url: `monthly/${filename}`,
        };
      }
      return null;
    })
    .filter((item): item is MonthlyIndexEntry => item !== null);

  // Write index file
  writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), "utf-8");
  console.log(`Generated index with ${indexData.length} entries: ${INDEX_FILE}`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log("Starting Rails PR Digest collection...\n");

  // Validate environment variables
  if (!GITHUB_TOKEN) {
    console.error("Error: GITHUB_TOKEN environment variable is required");
    process.exit(1);
  }

  if (!OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is required");
    process.exit(1);
  }

  // Fetch recent PRs
  const prs = await fetchRecentPRs();

  if (prs.length === 0) {
    console.log("No merged PRs found in the last 24 hours");
    return;
  }

  // Get existing PR numbers to avoid duplicates
  const existingPRs = getExistingPRNumbers();
  console.log(`Found ${existingPRs.size} existing PRs in the current month's file`);

  // Filter out already processed PRs
  const newPRs = prs.filter((pr) => !existingPRs.has(pr.number));
  console.log(`${newPRs.length} new PRs to process (${prs.length - newPRs.length} already exist)`);

  if (newPRs.length === 0) {
    console.log("No new PRs to add");
    return;
  }

  // Process each PR
  const entries: string[] = [];
  for (const pr of newPRs) {
    console.log(`\nProcessing PR #${pr.number}: ${pr.title}`);

    const prDetails = await getPRDetails(pr.number);
    if (!prDetails) continue;

    const summary = await summarizePR(prDetails);
    const entry = formatPREntry(prDetails.pr, summary);
    entries.push(entry);

    // Rate limiting: wait 1 second between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Update monthly file
  updateMonthlyFile(entries);

  // Generate monthly index
  generateMonthlyIndex();

  console.log("\n✓ Rails PR Digest collection completed!");
}

// Run main function only when executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
