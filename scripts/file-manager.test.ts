import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileManager } from "./file-manager";

vi.mock("node:fs");

describe("FileManager", () => {
  let fileManager: FileManager;
  const docsDir = "/test/docs/monthly";
  const indexFile = "/test/docs/monthly-index.json";

  beforeEach(() => {
    vi.resetAllMocks();
    fileManager = new FileManager(docsDir, indexFile);
  });

  describe("getExistingPRNumbers", () => {
    it("should return empty set when file does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = fileManager.getExistingPRNumbers();

      expect(result.size).toBe(0);
    });

    it("should extract PR numbers from file content", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const fileContent = `---
title: 2025年 11月
---

# Ruby on Rails PR Digest - 2025年 11月

## [#12345](https://github.com/rails/rails/pull/12345) First PR

## [#67890](https://github.com/rails/rails/pull/67890) Second PR
`;
      vi.mocked(readFileSync).mockReturnValue(fileContent);

      const result = fileManager.getExistingPRNumbers();

      expect(result.size).toBe(2);
      expect(result.has(12345)).toBe(true);
      expect(result.has(67890)).toBe(true);
    });

    it("should handle file with no PR entries", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const fileContent = `---
title: 2025年 11月
---

# Ruby on Rails PR Digest - 2025年 11月

> No PRs yet
`;
      vi.mocked(readFileSync).mockReturnValue(fileContent);

      const result = fileManager.getExistingPRNumbers();

      expect(result.size).toBe(0);
    });

    it("should handle multiple PR numbers on same line", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const fileContent = `
## [#111](url) First
## [#222](url) Second
## [#333](url) Third
`;
      vi.mocked(readFileSync).mockReturnValue(fileContent);

      const result = fileManager.getExistingPRNumbers();

      expect(result.size).toBe(3);
      expect(result.has(111)).toBe(true);
      expect(result.has(222)).toBe(true);
      expect(result.has(333)).toBe(true);
    });
  });

  describe("updateMonthlyFile", () => {
    it("should do nothing when entries array is empty", () => {
      fileManager.updateMonthlyFile([]);

      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it("should create new file when it does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const entries = ["## PR 1\nContent 1\n---"];

      fileManager.updateMonthlyFile(entries);

      expect(mkdirSync).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining(".md"),
        expect.stringContaining("## PR 1"),
        "utf-8",
      );
    });

    it("should update existing file with new entries prepended", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const existingContent = `---
title: 2025年 11月
lastUpdated: 2025-11-23
---

# Ruby on Rails PR Digest - 2025年 11月

> このページは [rails/rails](https://github.com/rails/rails) リポジトリにマージされたPull Requestを自動的に収集し、AIで要約したものです。

## [#100](url) Old PR
Old content
`;
      vi.mocked(readFileSync).mockReturnValue(existingContent);
      const newEntries = ["## [#200](url) New PR\nNew content\n---"];

      fileManager.updateMonthlyFile(newEntries);

      expect(writeFileSync).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain("## [#200](url) New PR");
      expect(writtenContent).toContain("## [#100](url) Old PR");
      expect(writtenContent.indexOf("## [#200]")).toBeLessThan(writtenContent.indexOf("## [#100]"));
    });

    it("should update lastUpdated date in frontmatter", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const existingContent = `---
title: 2025年 11月
lastUpdated: 2025-11-20
---

# Ruby on Rails PR Digest - 2025年 11月

> このページは [rails/rails](https://github.com/rails/rails) リポジトリにマージされたPull Requestを自動的に収集し、AIで要約したものです。

`;
      vi.mocked(readFileSync).mockReturnValue(existingContent);
      const newEntries = ["## [#200](url) New PR\n"];

      fileManager.updateMonthlyFile(newEntries);

      const writtenContent = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain("lastUpdated:");
      expect(writtenContent).not.toContain("lastUpdated: 2025-11-20");
    });
  });

  describe("generateMonthlyIndex", () => {
    it("should do nothing when docs directory does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      fileManager.generateMonthlyIndex();

      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it("should generate index with sorted monthly files", () => {
      const homePageContent = `---
layout: home
hero:
  actions:
    - theme: brand
      text: 最新のPRを見る
      link: /monthly/2025-01.md
---`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        "2025-01.md",
        "2025-03.md",
        "2025-02.md",
        "index.md",
      ] as any);
      vi.mocked(readFileSync).mockReturnValue(homePageContent);

      fileManager.generateMonthlyIndex();

      expect(writeFileSync).toHaveBeenCalled();
      const writtenData = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      const indexData = JSON.parse(writtenData);

      expect(indexData).toHaveLength(3);
      expect(indexData[0].filename).toBe("2025-03.md");
      expect(indexData[1].filename).toBe("2025-02.md");
      expect(indexData[2].filename).toBe("2025-01.md");
    });

    it("should include correct metadata for each file", () => {
      const homePageContent = `---
layout: home
hero:
  actions:
    - theme: brand
      text: 最新のPRを見る
      link: /monthly/2025-10.md
---`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(["2025-11.md"] as any);
      vi.mocked(readFileSync).mockReturnValue(homePageContent);

      fileManager.generateMonthlyIndex();

      const writtenData = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      const indexData = JSON.parse(writtenData);

      expect(indexData[0]).toEqual({
        filename: "2025-11.md",
        year: "2025",
        month: 11,
        title: "2025年 11月",
        url: "monthly/2025-11.md",
      });
    });

    it("should update home page with latest month link", () => {
      const homePageContent = `---
layout: home

hero:
  name: Rails PR Digest
  actions:
    - theme: brand
      text: 最新のPRを見る
      link: /monthly/2025-10.md
    - theme: alt
      text: 月別アーカイブ
      link: /monthly/
---`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(["2025-11.md"] as any);
      vi.mocked(readFileSync).mockReturnValue(homePageContent);

      fileManager.generateMonthlyIndex();

      // Check that writeFileSync was called for both index.json and index.md
      const calls = vi.mocked(writeFileSync).mock.calls;
      expect(calls.length).toBe(2);

      // First call should be for monthly-index.json
      expect(calls[0][0]).toBe(indexFile);

      // Second call should be for index.md
      expect(String(calls[1][0])).toContain("index.md");
      const updatedContent = calls[1][1] as string;
      expect(updatedContent).toContain("link: /monthly/2025-11.md");
      expect(updatedContent).not.toContain("link: /monthly/2025-10.md");
    });
  });
});
