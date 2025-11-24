import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatPREntry,
  getExistingPRNumbers,
  getMonthlyFilename,
  getYearMonth,
} from "./collect-and-summarize";

// Mock modules
vi.mock("node:fs");
vi.mock("@octokit/rest");
vi.mock("openai");

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
});
