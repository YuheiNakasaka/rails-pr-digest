import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getMonthlyFilename, getYearMonth } from "./formatter";

export interface MonthlyIndexEntry {
  filename: string;
  year: string;
  month: number;
  title: string;
  url: string;
}

export interface PRData {
  number: number;
  title: string;
  url: string;
  mergedAt: string;
  author: string;
  authorUrl: string;
  summary: string;
}

export interface PRDataStore {
  lastUpdated: string;
  totalCount: number;
  items: PRData[];
}

export class FileManager {
  private docsDir: string;
  private indexFile: string;
  private prDataFile: string;

  constructor(docsDir: string, indexFile: string) {
    this.docsDir = docsDir;
    this.indexFile = indexFile;
    this.prDataFile = join(docsDir, "..", "pr-data.json");
  }

  /**
   * Get existing PR numbers from monthly file
   */
  getExistingPRNumbers(): Set<number> {
    const filename = getMonthlyFilename();
    const filepath = join(this.docsDir, filename);

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
  updateMonthlyFile(entries: string[]): void {
    if (entries.length === 0) {
      console.log("No new PRs to add");
      return;
    }

    // Ensure docs/monthly directory exists
    if (!existsSync(this.docsDir)) {
      mkdirSync(this.docsDir, { recursive: true });
    }

    const filename = getMonthlyFilename();
    const filepath = join(this.docsDir, filename);
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
  generateMonthlyIndex(): void {
    console.log("Generating monthly file index...");

    if (!existsSync(this.docsDir)) {
      console.log("No monthly directory found");
      return;
    }

    // Read all .md files from monthly directory
    const files = readdirSync(this.docsDir)
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
    writeFileSync(this.indexFile, JSON.stringify(indexData, null, 2), "utf-8");
    console.log(`Generated index with ${indexData.length} entries: ${this.indexFile}`);

    // Update home page with latest month link
    if (indexData.length > 0) {
      this.updateHomePage(indexData[0]);
    }
  }

  /**
   * Update home page (docs/index.md) with latest month link
   */
  private updateHomePage(latestMonth: MonthlyIndexEntry): void {
    const homePagePath = join(this.docsDir, "..", "index.md");

    if (!existsSync(homePagePath)) {
      console.log("Home page not found, skipping update");
      return;
    }

    const content = readFileSync(homePagePath, "utf-8");

    // Update the hero action link to point to the latest month
    const updatedContent = content.replace(
      /(text: 最新のPRを見る[\s\S]*?link: )\/monthly\/[\w-]+\.md/,
      `$1/${latestMonth.url}`,
    );

    if (content !== updatedContent) {
      writeFileSync(homePagePath, updatedContent, "utf-8");
      console.log(`Updated home page link to: ${latestMonth.url}`);
    }
  }

  /**
   * Extract PR data from all monthly markdown files and save to JSON
   */
  extractAndSavePRsFromMonthlyFiles(): void {
    console.log("Extracting PR data from monthly markdown files...");

    if (!existsSync(this.docsDir)) {
      console.log("Monthly directory not found, skipping PR extraction");
      return;
    }

    try {
      const files = readdirSync(this.docsDir)
        .filter((f) => f.endsWith(".md") && f !== "index.md")
        .sort()
        .reverse(); // Most recent first

      const allPRs: PRData[] = [];

      for (const filename of files) {
        const filepath = join(this.docsDir, filename);
        const content = readFileSync(filepath, "utf-8");
        const prs = this.extractPRsFromMarkdown(content, filename);
        allPRs.push(...prs);
      }

      // Sort by merged date (newest first) and limit to 50
      const sortedPRs = allPRs
        .sort((a, b) => {
          const dateA = new Date(a.mergedAt).getTime();
          const dateB = new Date(b.mergedAt).getTime();
          return dateB - dateA;
        })
        .slice(0, 50);

      const dataStore: PRDataStore = {
        lastUpdated: new Date().toISOString(),
        totalCount: sortedPRs.length,
        items: sortedPRs,
      };

      writeFileSync(this.prDataFile, JSON.stringify(dataStore, null, 2), "utf-8");
      console.log(`Extracted and saved ${sortedPRs.length} PRs from monthly files`);
    } catch (error) {
      console.error(
        `Error extracting PRs from monthly files: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Extract PR entries from markdown content
   */
  private extractPRsFromMarkdown(content: string, filename: string): PRData[] {
    const prs: PRData[] = [];

    // Split content by PR entries (## [#...] header pattern)
    const prPattern = /## \[#(\d+)\]\((https:\/\/github\.com\/rails\/rails\/pull\/\d+)\) (.+?)$/gm;
    const matches = Array.from(content.matchAll(prPattern));

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const prNumber = Number.parseInt(match[1], 10);
      const prUrl = match[2];
      const prTitle = match[3].trim();

      // Get the content between this PR and the next PR (or end of file)
      const startIndex = match.index || 0;
      const endIndex =
        i < matches.length - 1 ? matches[i + 1].index || content.length : content.length;
      const prContent = content.substring(startIndex, endIndex);

      // Extract metadata line
      const metadataPattern = /\*\*マージ日\*\*: (.+?) \| \*\*作成者\*\*: \[@(.+?)\]\((.+?)\)/;
      const metadataMatch = prContent.match(metadataPattern);

      if (!metadataMatch) {
        console.warn(`Could not extract metadata for PR #${prNumber} in ${filename}`);
        continue;
      }

      const mergedDateStr = metadataMatch[1].trim(); // e.g., "2025/12/17"
      const author = metadataMatch[2].trim();
      const authorUrl = metadataMatch[3].trim();

      // Convert Japanese date format to ISO 8601
      const mergedAt = this.convertJapaneseDateToISO(mergedDateStr);

      // Extract summary (content after metadata line until ----)
      const summaryStart = prContent.indexOf("\n\n", prContent.indexOf("**作成者**"));
      const summaryEnd = prContent.indexOf("\n---", summaryStart);

      if (summaryStart === -1 || summaryEnd === -1) {
        console.warn(`Could not extract summary for PR #${prNumber} in ${filename}`);
        continue;
      }

      const summary = prContent.substring(summaryStart, summaryEnd).trim();

      prs.push({
        number: prNumber,
        title: prTitle,
        url: prUrl,
        mergedAt,
        author,
        authorUrl,
        summary,
      });
    }

    return prs;
  }

  /**
   * Convert Japanese date format (2025/12/17) to ISO 8601
   */
  private convertJapaneseDateToISO(dateStr: string): string {
    try {
      // Parse Japanese format: "2025/12/17" or "2025/12/17 10:30"
      const parts = dateStr.split(/[/\s:]/);
      const year = Number.parseInt(parts[0], 10);
      const month = Number.parseInt(parts[1], 10);
      const day = Number.parseInt(parts[2], 10);

      // Create date object (assume UTC)
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.toISOString();
    } catch (error) {
      console.error(`Error converting date "${dateStr}": ${error}`);
      return new Date().toISOString();
    }
  }
}
