import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PRDetails } from "./github-client";
import { OpenAIClient } from "./openai-client";

// Mock the entire openai module
vi.mock("openai", () => {
  const MockOpenAI = vi.fn();
  MockOpenAI.prototype.chat = {
    completions: {
      create: vi.fn(),
    },
  };
  return {
    default: MockOpenAI,
  };
});

describe("OpenAIClient", () => {
  let client: OpenAIClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OpenAIClient("test-api-key");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("summarizePR", () => {
    it("should return summary from OpenAI API", async () => {
      const mockCreate = vi.spyOn(OpenAI.prototype.chat.completions, "create") as any;

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "AI generated summary of the PR",
            },
          },
        ],
      });

      const mockPRData: PRDetails = {
        pr: {
          number: 12345,
          title: "Fix authentication bug",
          body: "This PR fixes a critical authentication bug",
          html_url: "https://github.com/rails/rails/pull/12345",
          merged_at: "2025-11-24T10:00:00Z",
          additions: 10,
          deletions: 5,
          user: {
            login: "testuser",
            html_url: "https://github.com/testuser",
          },
        },
        files: [
          {
            filename: "auth.ts",
            additions: 10,
            deletions: 5,
          },
        ],
      };

      const result = await client.summarizePR(mockPRData);

      expect(typeof result).toBe("string");
      expect(result).toContain("AI generated summary");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o",
        }),
      );
    });

    it("should handle OpenAI API error gracefully", async () => {
      const mockCreate = vi.spyOn(OpenAI.prototype.chat.completions, "create") as any;

      mockCreate.mockRejectedValue(new Error("API Error"));

      const mockPRData: PRDetails = {
        pr: {
          number: 12345,
          title: "Test PR",
          body: "Test body",
          html_url: "https://github.com/rails/rails/pull/12345",
          merged_at: "2025-11-24T10:00:00Z",
          additions: 10,
          deletions: 5,
          user: {
            login: "testuser",
            html_url: "https://github.com/testuser",
          },
        },
        files: [],
      };

      const result = await client.summarizePR(mockPRData);

      expect(result).toContain("要約エラー");
    });
  });
});
