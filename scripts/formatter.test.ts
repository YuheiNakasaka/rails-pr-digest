import { describe, expect, it } from "vitest";
import { formatPREntry, getMonthlyFilename, getYearMonth } from "./formatter";

describe("formatter", () => {
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

    it("should return correctly formatted filename for specific date", () => {
      const testDate = new Date("2025-03-15");
      const result = getMonthlyFilename(testDate);

      expect(result).toBe("2025-03.md");
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

      const result = formatPREntry(mockPR, summary);

      expect(result).toContain("## [#12345](https://github.com/rails/rails/pull/12345)");
      expect(result).toContain("Fix bug in authentication {#pr-12345}");
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

      const result = formatPREntry(mockPR, summary);

      expect(result).toContain("## [#12345]");
      expect(result).toContain("Test PR {#pr-12345}");
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

      const result = formatPREntry(mockPR, summary);

      expect(result).toContain("[@unknown]");
      expect(result).toContain("{#pr-12345}");
    });
  });
});
