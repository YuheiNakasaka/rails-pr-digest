import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchRecentPRs,
  formatPREntry,
  generateMonthlyIndex,
  getExistingPRNumbers,
  getMonthlyFilename,
  getPRDetails,
  getYearMonth,
  octokit,
  openai,
  summarizePR,
  updateMonthlyFile,
} from "./collect-and-summarize";

// Mock modules
vi.mock("node:fs");
vi.mock("dotenv/config", () => ({}));

describe("collect-and-summarize", () => {
  describe("getYearMonth", () => {
    it("should return current year and month when no date is provided", () => {
      const now = new Date();
      const result = getYearMonth();

      expect(result.year).toBe(now.getFullYear());
      expect(result.month).toBe(now.getMonth() + 1);
    });

    it("should return correct year and month for specific date", () => {
      const testDate = new Date("2025-03-15");
      const result = getYearMonth(testDate);

      expect(result.year).toBe(2025);
      expect(result.month).toBe(3);
    });

    it("should return correct month for January", () => {
      const testDate = new Date("2025-01-01");
      const result = getYearMonth(testDate);

      expect(result.year).toBe(2025);
      expect(result.month).toBe(1);
    });

    it("should return correct month for December", () => {
      const testDate = new Date("2024-12-31");
      const result = getYearMonth(testDate);

      expect(result.year).toBe(2024);
      expect(result.month).toBe(12);
    });
  });

  describe("getMonthlyFilename", () => {
    it("should return correctly formatted filename for current month", () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const expected = `${year}-${month}.md`;

      const result = getMonthlyFilename();

      expect(result).toBe(expected);
    });
  });

  describe("formatPREntry", () => {
    it("should format PR entry correctly with all fields", () => {
      const mockPR = {
        number: 12345,
        title: "Fix bug in authentication",
        html_url: "https://github.com/rails/rails/pull/12345",
        merged_at: "2025-11-24T10:00:00Z",
        user: {
          login: "testuser",
          html_url: "https://github.com/testuser",
        },
      };
      const summary = "This PR fixes a critical bug in authentication.";

      const result = formatPREntry(mockPR as any, summary);

      expect(result).toContain("## [#12345](https://github.com/rails/rails/pull/12345)");
      expect(result).toContain("Fix bug in authentication");
      expect(result).toContain("[@testuser](https://github.com/testuser)");
      expect(result).toContain("This PR fixes a critical bug in authentication.");
      expect(result).toContain("---");
    });

    it("should handle PR with null merged_at", () => {
      const mockPR = {
        number: 12345,
        title: "Test PR",
        html_url: "https://github.com/rails/rails/pull/12345",
        merged_at: null,
        user: {
          login: "testuser",
          html_url: "https://github.com/testuser",
        },
      };
      const summary = "Test summary";

      const result = formatPREntry(mockPR as any, summary);

      expect(result).toContain("## [#12345]");
      expect(result).toContain("Test PR");
    });

    it("should handle PR with null user", () => {
      const mockPR = {
        number: 12345,
        title: "Test PR",
        html_url: "https://github.com/rails/rails/pull/12345",
        merged_at: "2025-11-24T10:00:00Z",
        user: null,
      };
      const summary = "Test summary";

      const result = formatPREntry(mockPR as any, summary);

      expect(result).toContain("[@unknown]");
    });
  });

  describe("getExistingPRNumbers", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should return empty set when file does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = getExistingPRNumbers();

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

      const result = getExistingPRNumbers();

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

      const result = getExistingPRNumbers();

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

      const result = getExistingPRNumbers();

      expect(result.size).toBe(3);
      expect(result.has(111)).toBe(true);
      expect(result.has(222)).toBe(true);
      expect(result.has(333)).toBe(true);
    });
  });

  describe("updateMonthlyFile", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should do nothing when entries array is empty", () => {
      updateMonthlyFile([]);

      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it("should create new file when it does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const entries = ["## PR 1\nContent 1\n---"];

      updateMonthlyFile(entries);

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

      updateMonthlyFile(newEntries);

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

      updateMonthlyFile(newEntries);

      const writtenContent = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain("lastUpdated:");
      expect(writtenContent).not.toContain("lastUpdated: 2025-11-20");
    });
  });

  describe("generateMonthlyIndex", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should do nothing when docs directory does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      generateMonthlyIndex();

      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it("should generate index with sorted monthly files", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        "2025-01.md",
        "2025-03.md",
        "2025-02.md",
        "index.md",
      ] as any);

      generateMonthlyIndex();

      expect(writeFileSync).toHaveBeenCalled();
      const writtenData = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      const indexData = JSON.parse(writtenData);

      expect(indexData).toHaveLength(3);
      expect(indexData[0].filename).toBe("2025-03.md");
      expect(indexData[1].filename).toBe("2025-02.md");
      expect(indexData[2].filename).toBe("2025-01.md");
    });

    it("should include correct metadata for each file", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(["2025-11.md"] as any);

      generateMonthlyIndex();

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
  });

  describe("summarizePR", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return summary from OpenAI API", async () => {
      // Mock OpenAI chat completions
      vi.spyOn(openai.chat.completions, "create").mockResolvedValue({
        choices: [
          {
            message: {
              content: "AI generated summary of the PR",
            },
          },
        ],
      } as any);

      const mockPRData = {
        pr: {
          number: 12345,
          title: "Fix authentication bug",
          body: "This PR fixes a critical authentication bug",
          user: { login: "testuser" },
          merged_at: "2025-11-24T10:00:00Z",
          additions: 10,
          deletions: 5,
        },
        files: [
          {
            filename: "auth.ts",
            additions: 10,
            deletions: 5,
          },
        ],
      };

      const result = await summarizePR(mockPRData as any);

      expect(typeof result).toBe("string");
      expect(result).toContain("AI generated summary");
      expect(openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o",
        }),
      );
    });

    it("should handle OpenAI API error gracefully", async () => {
      // Mock OpenAI to throw an error
      vi.spyOn(openai.chat.completions, "create").mockRejectedValue(new Error("API Error"));

      const mockPRData = {
        pr: {
          number: 12345,
          title: "Test PR",
          body: "Test body",
          user: { login: "testuser" },
          merged_at: "2025-11-24T10:00:00Z",
          additions: 10,
          deletions: 5,
        },
        files: [],
      };

      const result = await summarizePR(mockPRData as any);

      expect(result).toContain("要約エラー");
    });
  });

  describe("getPRDetails", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return PR details with files", async () => {
      // Mock Octokit pulls.get
      vi.spyOn(octokit.pulls, "get").mockResolvedValue({
        data: {
          number: 12345,
          title: "Test PR",
          body: "Test description",
        },
      } as any);

      // Mock Octokit pulls.listFiles
      vi.spyOn(octokit.pulls, "listFiles").mockResolvedValue({
        data: [
          { filename: "file1.ts", additions: 10, deletions: 5 },
          { filename: "file2.ts", additions: 20, deletions: 10 },
        ],
      } as any);

      const result = await getPRDetails(12345);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.pr.number).toBe(12345);
        expect(result.files).toHaveLength(2);
      }
    });

    it("should return null when API call fails", async () => {
      vi.spyOn(octokit.pulls, "get").mockRejectedValue(new Error("API Error"));

      const result = await getPRDetails(12345);

      expect(result).toBeNull();
    });
  });

  describe("fetchRecentPRs", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return list of merged PRs", async () => {
      vi.spyOn(octokit.search, "issuesAndPullRequests").mockResolvedValue({
        data: {
          items: [
            { number: 1, title: "PR 1" },
            { number: 2, title: "PR 2" },
          ],
        },
      } as any);

      const result = await fetchRecentPRs();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].number).toBe(1);
      expect(result[1].number).toBe(2);
    });

    it("should return empty array when API call fails", async () => {
      vi.spyOn(octokit.search, "issuesAndPullRequests").mockRejectedValue(new Error("API Error"));

      const result = await fetchRecentPRs();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});
