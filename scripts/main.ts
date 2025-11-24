#!/usr/bin/env tsx

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vitepress";
import { FileManager } from "./file-manager";
import { formatPREntry } from "./formatter";
import { GitHubClient } from "./github-client";
import { OpenAIClient } from "./openai-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const env = loadEnv("", process.cwd(), "");
const RAILS_OWNER = "rails";
const RAILS_REPO = "rails";
const GITHUB_TOKEN = env.GITHUB_TOKEN;
const OPENAI_API_KEY = env.OPENAI_API_KEY;
const DOCS_DIR = join(__dirname, "..", "docs", "monthly");
const INDEX_FILE = join(__dirname, "..", "docs", "monthly-index.json");

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

  // Initialize clients
  const githubClient = new GitHubClient(GITHUB_TOKEN, RAILS_OWNER, RAILS_REPO);
  const openaiClient = new OpenAIClient(OPENAI_API_KEY);
  const fileManager = new FileManager(DOCS_DIR, INDEX_FILE);

  // Fetch recent PRs
  const prs = await githubClient.fetchRecentPRs();

  if (prs.length === 0) {
    console.log("No merged PRs found in the last 24 hours");
    return;
  }

  // Get existing PR numbers to avoid duplicates
  const existingPRs = fileManager.getExistingPRNumbers();
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

    const prDetails = await githubClient.getPRDetails(pr.number);
    if (!prDetails) continue;

    const summary = await openaiClient.summarizePR(prDetails);
    const entry = formatPREntry(prDetails.pr, summary);
    entries.push(entry);

    // Rate limiting: wait 1 second between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Update monthly file
  fileManager.updateMonthlyFile(entries);

  // Generate monthly index
  fileManager.generateMonthlyIndex();

  console.log("\n✓ Rails PR Digest collection completed!");
}

// Run main function only when executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { main };
