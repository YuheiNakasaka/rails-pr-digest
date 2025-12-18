import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Feed } from "feed";
import type { PRDataStore } from "./file-manager";

export class RSSGenerator {
  private dataFile: string;
  private outputFile: string;
  private baseUrl: string;

  constructor(dataFile: string, outputFile: string, baseUrl: string) {
    this.dataFile = dataFile;
    this.outputFile = outputFile;
    this.baseUrl = baseUrl;
  }

  /**
   * Generate RSS 2.0 feed from PR data
   */
  generate(): void {
    console.log("Generating RSS feed...");

    try {
      const prData = this.loadPRData();

      if (prData.items.length === 0) {
        console.log("No PR data available, skipping RSS generation");
        return;
      }

      const feed = this.createFeed(prData);
      this.writeRSSFile(feed.rss2());

      console.log(`RSS feed generated with ${prData.items.length} items`);
    } catch (error) {
      console.error(
        `Error generating RSS feed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Load PR data from JSON file
   */
  private loadPRData(): PRDataStore {
    if (!existsSync(this.dataFile)) {
      throw new Error(`PR data file not found: ${this.dataFile}`);
    }

    try {
      const content = readFileSync(this.dataFile, "utf-8");
      return JSON.parse(content) as PRDataStore;
    } catch (error) {
      throw new Error(
        `Failed to parse PR data file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create Feed instance with PR items
   */
  private createFeed(prData: PRDataStore): Feed {
    const feed = new Feed({
      title: "Ruby on Rails PR Digest",
      description:
        "rails/railsリポジトリにマージされたPull RequestをAIで要約した日本語ダイジェスト",
      id: this.baseUrl,
      link: this.baseUrl,
      language: "ja",
      favicon: `${this.baseUrl}/favicon.ico`,
      copyright: "Copyright © 2025 Yuhei Nakasaka",
      updated: new Date(prData.lastUpdated),
      generator: "Rails PR Digest RSS Generator",
      feedLinks: {
        rss2: `${this.baseUrl}/feed.xml`,
      },
    });

    // Add PR items to feed
    for (const pr of prData.items) {
      this.addPRItem(feed, pr);
    }

    return feed;
  }

  /**
   * Add a single PR item to the feed
   */
  private addPRItem(feed: Feed, pr: PRDataStore["items"][0]): void {
    const yearMonth = pr.mergedAt.substring(0, 7); // "2025-12"
    const itemLink = `${this.baseUrl}/monthly/${yearMonth}#pr-${pr.number}`;

    // Convert summary to HTML (preserve line breaks and structure)
    const htmlContent = this.convertSummaryToHTML(pr.summary);

    feed.addItem({
      title: `[#${pr.number}] ${pr.title}`,
      id: pr.url,
      link: itemLink,
      description: pr.summary,
      content: htmlContent,
      author: [
        {
          name: `@${pr.author}`,
          link: pr.authorUrl,
        },
      ],
      date: new Date(pr.mergedAt),
      published: new Date(pr.mergedAt),
    });
  }

  /**
   * Convert markdown-style summary to HTML
   */
  private convertSummaryToHTML(summary: string): string {
    // Simple markdown-like conversion for better RSS reader display
    let html = summary
      // Headers
      .replace(/^### (.*?)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*?)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*?)$/gm, "<h1>$1</h1>")
      // Code blocks
      .replace(/```(\w+)?\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
      // Inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      // Bullet lists
      .replace(/^- (.*?)$/gm, "<li>$1</li>")
      // Line breaks
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");

    // Wrap in paragraph tags
    html = `<p>${html}</p>`;

    // Wrap consecutive <li> tags in <ul>
    html = html.replace(/(<li>.*?<\/li>)+/gs, (match) => `<ul>${match}</ul>`);

    return html;
  }

  /**
   * Write RSS XML to file
   */
  private writeRSSFile(xml: string): void {
    // Ensure output directory exists
    const outputDir = dirname(this.outputFile);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    try {
      writeFileSync(this.outputFile, xml, "utf-8");
      console.log(`RSS feed written to: ${this.outputFile}`);
    } catch (error) {
      throw new Error(
        `Failed to write RSS file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
