import { Octokit } from "@octokit/rest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubClient } from "./github-client";

vi.mock("@octokit/rest");

describe("GitHubClient", () => {
  let client: GitHubClient;
  let mockOctokit: {
    search: {
      issuesAndPullRequests: ReturnType<typeof vi.fn>;
    };
    pulls: {
      get: ReturnType<typeof vi.fn>;
      listFiles: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockOctokit = {
      search: {
        issuesAndPullRequests: vi.fn(),
      },
      pulls: {
        get: vi.fn(),
        listFiles: vi.fn(),
      },
    };

    vi.mocked(Octokit).mockImplementation(() => mockOctokit as any);

    client = new GitHubClient("test-token", "rails", "rails");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchRecentPRs", () => {
    it("should return list of merged PRs", async () => {
      mockOctokit.search.issuesAndPullRequests.mockResolvedValue({
        data: {
          items: [
            { number: 1, title: "PR 1" },
            { number: 2, title: "PR 2" },
          ],
        },
      });

      const result = await client.fetchRecentPRs();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].number).toBe(1);
      expect(result[1].number).toBe(2);
    });

    it("should return empty array when API call fails", async () => {
      mockOctokit.search.issuesAndPullRequests.mockRejectedValue(new Error("API Error"));

      const result = await client.fetchRecentPRs();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe("getPRDetails", () => {
    it("should return PR details with files", async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 12345,
          title: "Test PR",
          body: "Test description",
          html_url: "https://github.com/rails/rails/pull/12345",
          merged_at: "2025-11-24T10:00:00Z",
          additions: 10,
          deletions: 5,
          user: {
            login: "testuser",
            html_url: "https://github.com/testuser",
          },
        },
      });

      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [
          { filename: "file1.ts", additions: 10, deletions: 5 },
          { filename: "file2.ts", additions: 20, deletions: 10 },
        ],
      });

      const result = await client.getPRDetails(12345);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.pr.number).toBe(12345);
        expect(result.files).toHaveLength(2);
      }
    });

    it("should return null when API call fails", async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error("API Error"));

      const result = await client.getPRDetails(12345);

      expect(result).toBeNull();
    });
  });
});
