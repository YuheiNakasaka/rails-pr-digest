import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Feed } from "feed";
import { defineConfig } from "vitepress";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamically generate sidebar items from monthly directory
function getMonthlyItems() {
  try {
    const monthlyDir = join(__dirname, "../monthly");
    const files = readdirSync(monthlyDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse(); // Most recent first

    return files
      .map((filename) => {
        const match = filename.match(/(\d{4})-(\d{2})\.md/);
        if (match) {
          const year = match[1];
          const month = parseInt(match[2], 10);
          return {
            text: `${year}年 ${month}月`,
            link: `/monthly/${filename.replace(".md", "")}`,
          };
        }
        return null;
      })
      .filter(Boolean);
  } catch (error) {
    console.warn("Could not read monthly directory:", error);
    return [];
  }
}

export default defineConfig({
  title: "Ruby on Rails PR Digest",
  description: "Ruby on Railsの最新変更を追跡 - rails/railsのマージされたPRを自動要約",
  lang: "ja",

  // GitHub Pages deployment
  base: "/rails-pr-digest/",

  // Theme configuration
  themeConfig: {
    nav: [
      { text: "ホーム", link: "/" },
      { text: "月別アーカイブ", link: "/monthly/" },
    ],

    sidebar: [
      {
        text: "📅 月別ダイジェスト",
        items: getMonthlyItems(),
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/YuheiNakasaka/rails-pr-digest" }],

    footer: {
      copyright: "Copyright © 2025 Yuhei Nakasaka",
    },

    // Search configuration
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: "検索",
                buttonAriaLabel: "検索",
              },
              modal: {
                noResultsText: "結果が見つかりません",
                resetButtonTitle: "リセット",
                footer: {
                  selectText: "選択",
                  navigateText: "移動",
                  closeText: "閉じる",
                },
              },
            },
          },
        },
      },
    },

    // Page meta
    editLink: {
      pattern: "https://github.com/rails/rails/pulls",
      text: "rails/rails PRsを見る",
    },

    lastUpdated: {
      text: "最終更新",
      formatOptions: {
        dateStyle: "medium",
        timeStyle: "short",
      },
    },
  },

  // Markdown configuration
  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
    lineNumbers: true,
  },

  // Head tags
  head: [
    ["link", { rel: "icon", href: "/rails-pr-digest/favicon.ico" }],
    [
      "link",
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "Ruby on Rails PR Digest",
        href: "/rails-pr-digest/feed.xml",
      },
    ],
    ["meta", { name: "theme-color", content: "#cc0000" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:locale", content: "ja" }],
    ["meta", { property: "og:title", content: "Ruby on Rails PR Digest" }],
    ["meta", { property: "og:site_name", content: "Ruby on Rails PR Digest" }],
    ["meta", { property: "og:description", content: "rails/railsのマージされたPRを自動要約" }],
    [
      "meta",
      { property: "og:image", content: "https://yuheinakasaka.github.io/rails-pr-digest/ogp.png" },
    ],
    ["meta", { property: "og:site_name", content: "Rails PR Digest" }],
    ["meta", { property: "twitter:card", content: "summary" }],
  ],

  // Build hooks
  async buildEnd(config) {
    // Generate RSS feed at build time
    const baseUrl = process.env.BASE_URL || "https://yuheinakasaka.github.io/rails-pr-digest";
    const prDataFile = join(__dirname, "..", "pr-data.json");
    const outputFile = join(config.outDir, "feed.xml");

    if (!existsSync(prDataFile)) {
      console.warn("PR data file not found, skipping RSS generation");
      return;
    }

    try {
      const prData = JSON.parse(readFileSync(prDataFile, "utf-8"));

      if (!prData.items || prData.items.length === 0) {
        console.warn("No PR data available, skipping RSS generation");
        return;
      }

      const feed = new Feed({
        title: "Ruby on Rails PR Digest",
        description:
          "rails/railsリポジトリにマージされたPull RequestをAIで要約した日本語ダイジェスト",
        id: baseUrl,
        link: baseUrl,
        language: "ja",
        favicon: `${baseUrl}/favicon.ico`,
        copyright: "Copyright © 2025 Yuhei Nakasaka",
        updated: new Date(prData.lastUpdated),
        generator: "Rails PR Digest RSS Generator",
        feedLinks: {
          rss2: `${baseUrl}/feed.xml`,
        },
      });

      // Add PR items to feed
      for (const pr of prData.items) {
        const yearMonth = pr.mergedAt.substring(0, 7);
        const itemLink = `${baseUrl}/monthly/${yearMonth}#pr-${pr.number}`;

        // Convert summary to HTML
        let htmlContent = pr.summary
          .replace(/^### (.*?)$/gm, "<h3>$1</h3>")
          .replace(/^## (.*?)$/gm, "<h2>$1</h2>")
          .replace(/^# (.*?)$/gm, "<h1>$1</h1>")
          .replace(/```(\w+)?\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
          .replace(/`([^`]+)`/g, "<code>$1</code>")
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/^- (.*?)$/gm, "<li>$1</li>")
          .replace(/\n\n/g, "</p><p>")
          .replace(/\n/g, "<br>");

        htmlContent = `<p>${htmlContent}</p>`;
        htmlContent = htmlContent.replace(/(<li>.*?<\/li>)+/gs, (match) => `<ul>${match}</ul>`);

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

      writeFileSync(outputFile, feed.rss2(), "utf-8");
      console.log(`RSS feed generated: ${outputFile} (${prData.items.length} items)`);
    } catch (error) {
      console.error("Error generating RSS feed:", error);
    }
  },
});
