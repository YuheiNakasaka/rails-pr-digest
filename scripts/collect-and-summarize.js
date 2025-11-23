#!/usr/bin/env node

import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const RAILS_OWNER = 'rails';
const RAILS_REPO = 'rails';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DOCS_DIR = join(__dirname, '..', 'docs', 'weekly');
const INDEX_FILE = join(__dirname, '..', 'docs', 'weekly-index.json');

// Initialize clients
const octokit = new Octokit({ auth: GITHUB_TOKEN });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Get ISO week number and year for a given date
 */
function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNum };
}

/**
 * Get filename for the current week
 */
function getWeeklyFilename() {
  const { year, week } = getISOWeek();
  const weekStr = String(week).padStart(2, '0');
  return `${year}-W${weekStr}.md`;
}

/**
 * Fetch merged PRs from the last 24 hours
 */
async function fetchRecentPRs() {
  console.log('Fetching recently merged PRs from rails/rails...');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  try {
    const { data: pullRequests } = await octokit.search.issuesAndPullRequests({
      q: `repo:${RAILS_OWNER}/${RAILS_REPO} is:pr is:merged merged:>=${yesterday.toISOString().split('T')[0]}`,
      sort: 'updated',
      order: 'desc',
      per_page: 100
    });

    console.log(`Found ${pullRequests.items.length} merged PRs`);
    return pullRequests.items;
  } catch (error) {
    console.error('Error fetching PRs:', error.message);
    return [];
  }
}

/**
 * Get PR details including diff
 */
async function getPRDetails(prNumber) {
  try {
    const { data: pr } = await octokit.pulls.get({
      owner: RAILS_OWNER,
      repo: RAILS_REPO,
      pull_number: prNumber
    });

    const { data: files } = await octokit.pulls.listFiles({
      owner: RAILS_OWNER,
      repo: RAILS_REPO,
      pull_number: prNumber,
      per_page: 100
    });

    return { pr, files };
  } catch (error) {
    console.error(`Error fetching PR #${prNumber} details:`, error.message);
    return null;
  }
}

/**
 * Summarize PR using OpenAI
 */
async function summarizePR(prData) {
  const { pr, files } = prData;

  // Prepare file changes summary
  const fileChanges = files.slice(0, 20).map(f =>
    `- ${f.filename} (+${f.additions}/-${f.deletions})`
  ).join('\n');

  const prompt = `以下のRuby on Rails PRを日本語で要約・解説してください。

PR情報:
- タイトル: ${pr.title}
- 番号: #${pr.number}
- 作成者: ${pr.user.login}
- マージ日時: ${pr.merged_at}
- 説明:
${pr.body || '説明なし'}

変更されたファイル (最大20件):
${fileChanges}
${files.length > 20 ? `\n... 他 ${files.length - 20} ファイル` : ''}

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
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error(`Error summarizing PR #${pr.number}:`, error.message);
    return `要約エラー: ${error.message}`;
  }
}

/**
 * Format PR entry for markdown
 */
function formatPREntry(pr, summary) {
  const date = new Date(pr.merged_at).toLocaleDateString('ja-JP');
  return `
## [#${pr.number}](${pr.html_url}) ${pr.title}

**マージ日**: ${date} | **作成者**: [@${pr.user.login}](${pr.user.html_url})

${summary}

---
`;
}

/**
 * Get existing PR numbers from weekly file
 */
function getExistingPRNumbers() {
  const filename = getWeeklyFilename();
  const filepath = join(DOCS_DIR, filename);

  if (!existsSync(filepath)) {
    return new Set();
  }

  const content = readFileSync(filepath, 'utf-8');

  // Extract PR numbers using regex: ## [#123](url) Title
  const prNumberRegex = /## \[#(\d+)\]/g;
  const existingPRs = new Set();

  let match;
  while ((match = prNumberRegex.exec(content)) !== null) {
    existingPRs.add(parseInt(match[1]));
  }

  return existingPRs;
}

/**
 * Update weekly markdown file
 */
function updateWeeklyFile(entries) {
  if (entries.length === 0) {
    console.log('No new PRs to add');
    return;
  }

  // Ensure docs/weekly directory exists
  if (!existsSync(DOCS_DIR)) {
    mkdirSync(DOCS_DIR, { recursive: true });
  }

  const filename = getWeeklyFilename();
  const filepath = join(DOCS_DIR, filename);
  const { year, week } = getISOWeek();

  let content = '';

  // Read existing content or create new file
  if (existsSync(filepath)) {
    content = readFileSync(filepath, 'utf-8');
    console.log(`Updating existing file: ${filename}`);
  } else {
    content = `# Ruby on Rails PR Digest - ${year}年 第${week}週

> このページは [rails/rails](https://github.com/rails/rails) リポジトリにマージされたPull Requestを自動的に収集し、AIで要約したものです。

最終更新: ${new Date().toLocaleString('ja-JP')}

`;
    console.log(`Creating new file: ${filename}`);
  }

  // Append new entries
  content += '\n' + entries.join('\n');

  // Update last modified timestamp
  content = content.replace(
    /最終更新: .*/,
    `最終更新: ${new Date().toLocaleString('ja-JP')}`
  );

  writeFileSync(filepath, content, 'utf-8');
  console.log(`Updated: ${filepath}`);
}

/**
 * Generate index of weekly files
 */
function generateWeeklyIndex() {
  console.log('Generating weekly file index...');

  if (!existsSync(DOCS_DIR)) {
    console.log('No weekly directory found');
    return;
  }

  // Read all .md files from weekly directory
  const files = readdirSync(DOCS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse(); // Most recent first

  // Generate index data
  const indexData = files.map(filename => {
    const match = filename.match(/(\d{4})-W(\d{2})\.md/);
    if (match) {
      const year = match[1];
      const week = parseInt(match[2]);
      return {
        filename,
        year,
        week,
        title: `${year}年 第${week}週`,
        url: `weekly/${filename}`
      };
    }
    return null;
  }).filter(Boolean);

  // Write index file
  writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf-8');
  console.log(`Generated index with ${indexData.length} entries: ${INDEX_FILE}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting Rails PR Digest collection...\n');

  // Validate environment variables
  if (!GITHUB_TOKEN) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  if (!OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Fetch recent PRs
  const prs = await fetchRecentPRs();

  if (prs.length === 0) {
    console.log('No merged PRs found in the last 24 hours');
    return;
  }

  // Get existing PR numbers to avoid duplicates
  const existingPRs = getExistingPRNumbers();
  console.log(`Found ${existingPRs.size} existing PRs in the current week's file`);

  // Filter out already processed PRs
  const newPRs = prs.filter(pr => !existingPRs.has(pr.number));
  console.log(`${newPRs.length} new PRs to process (${prs.length - newPRs.length} already exist)`);

  if (newPRs.length === 0) {
    console.log('No new PRs to add');
    return;
  }

  // Process each PR
  const entries = [];
  for (const pr of newPRs) {
    console.log(`\nProcessing PR #${pr.number}: ${pr.title}`);

    const prDetails = await getPRDetails(pr.number);
    if (!prDetails) continue;

    const summary = await summarizePR(prDetails);
    const entry = formatPREntry(prDetails.pr, summary);
    entries.push(entry);

    // Rate limiting: wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Update weekly file
  updateWeeklyFile(entries);

  // Generate weekly index
  generateWeeklyIndex();

  console.log('\n✓ Rails PR Digest collection completed!');
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
