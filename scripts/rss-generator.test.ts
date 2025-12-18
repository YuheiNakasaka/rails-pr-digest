import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PRDataStore } from "./file-manager";
import { RSSGenerator } from "./rss-generator";

vi.mock("node:fs");

describe("RSSGenerator", () => {
  let rssGenerator: RSSGenerator;
  const dataFile = "/test/pr-data.json";
  const outputFile = "/test/public/feed.xml";
  const baseUrl = "https://example.com/rails-pr-digest";

  beforeEach(() => {
    vi.resetAllMocks();
    rssGenerator = new RSSGenerator(dataFile, outputFile, baseUrl);
  });

  describe("generate", () => {
    it("should generate RSS feed with PR data", () => {
      const mockData: PRDataStore = {
        lastUpdated: "2025-12-18T00:00:00.000Z",
        totalCount: 2,
        items: [
          {
            number: 12345,
            title: "Fix authentication bug",
            url: "https://github.com/rails/rails/pull/12345",
            mergedAt: "2025-12-17T10:00:00Z",
            author: "testuser",
            authorUrl: "https://github.com/testuser",
            summary: "This PR fixes a critical authentication bug.",
          },
          {
            number: 67890,
            title: "Add new feature",
            url: "https://github.com/rails/rails/pull/67890",
            mergedAt: "2025-12-16T10:00:00Z",
            author: "developer",
            authorUrl: "https://github.com/developer",
            summary: "This PR adds a new feature.",
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockData));

      rssGenerator.generate();

      expect(writeFileSync).toHaveBeenCalled();
      const writtenXML = vi.mocked(writeFileSync).mock.calls[0][1] as string;

      // Verify RSS 2.0 structure
      expect(writtenXML).toContain('<?xml version="1.0"');
      expect(writtenXML).toContain("<rss");
      expect(writtenXML).toContain("<channel>");
      expect(writtenXML).toContain("Ruby on Rails PR Digest");
      expect(writtenXML).toContain("[#12345] Fix authentication bug");
      expect(writtenXML).toContain("[#67890] Add new feature");
    });

    it("should skip generation when no PR data available", () => {
      const mockData: PRDataStore = {
        lastUpdated: "2025-12-18T00:00:00.000Z",
        totalCount: 0,
        items: [],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockData));

      rssGenerator.generate();

      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it("should throw error when data file does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      expect(() => rssGenerator.generate()).toThrow("PR data file not found");
    });

    it("should throw error when data file is invalid JSON", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("invalid json");

      expect(() => rssGenerator.generate()).toThrow("Failed to parse PR data file");
    });

    it("should create output directory if it does not exist", () => {
      const mockData: PRDataStore = {
        lastUpdated: "2025-12-18T00:00:00.000Z",
        totalCount: 1,
        items: [
          {
            number: 12345,
            title: "Test PR",
            url: "https://github.com/rails/rails/pull/12345",
            mergedAt: "2025-12-17T10:00:00Z",
            author: "testuser",
            authorUrl: "https://github.com/testuser",
            summary: "Test summary",
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockData));

      rssGenerator.generate();

      expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining("test"), {
        recursive: true,
      });
    });
  });

  describe("RSS 2.0 format validation", () => {
    it("should include all required RSS 2.0 channel elements", () => {
      const mockData: PRDataStore = {
        lastUpdated: "2025-12-18T00:00:00.000Z",
        totalCount: 1,
        items: [
          {
            number: 12345,
            title: "Test PR",
            url: "https://github.com/rails/rails/pull/12345",
            mergedAt: "2025-12-17T10:00:00Z",
            author: "testuser",
            authorUrl: "https://github.com/testuser",
            summary: "Test summary",
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockData));

      rssGenerator.generate();

      const writtenXML = vi.mocked(writeFileSync).mock.calls[0][1] as string;

      // Required channel elements
      expect(writtenXML).toContain("<title>Ruby on Rails PR Digest</title>");
      expect(writtenXML).toContain("<link>");
      expect(writtenXML).toContain("<description>");
      expect(writtenXML).toContain("<language>ja</language>");
    });

    it("should include all required RSS 2.0 item elements", () => {
      const mockData: PRDataStore = {
        lastUpdated: "2025-12-18T00:00:00.000Z",
        totalCount: 1,
        items: [
          {
            number: 12345,
            title: "Test PR",
            url: "https://github.com/rails/rails/pull/12345",
            mergedAt: "2025-12-17T10:00:00.000Z",
            author: "testuser",
            authorUrl: "https://github.com/testuser",
            summary: "Test summary",
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockData));

      rssGenerator.generate();

      const writtenXML = vi.mocked(writeFileSync).mock.calls[0][1] as string;

      // Required item elements (feed package uses CDATA sections)
      expect(writtenXML).toContain("<item>");
      expect(writtenXML).toContain("[#12345] Test PR");
      expect(writtenXML).toContain("<link>");
      expect(writtenXML).toContain("<guid>");
      expect(writtenXML).toContain("<pubDate>");
      expect(writtenXML).toContain("</item>");
    });
  });

  describe("XML escaping", () => {
    it("should handle special characters in title safely", () => {
      const mockData: PRDataStore = {
        lastUpdated: "2025-12-18T00:00:00.000Z",
        totalCount: 1,
        items: [
          {
            number: 12345,
            title: 'Test <script>alert("XSS")</script> & "quotes"',
            url: "https://github.com/rails/rails/pull/12345",
            mergedAt: "2025-12-17T10:00:00Z",
            author: "testuser",
            authorUrl: "https://github.com/testuser",
            summary: "Test summary",
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockData));

      rssGenerator.generate();

      const writtenXML = vi.mocked(writeFileSync).mock.calls[0][1] as string;

      // Feed package uses CDATA sections which safely encapsulate special characters
      expect(writtenXML).toContain("<![CDATA[");
      expect(writtenXML).toContain('Test <script>alert("XSS")</script> & "quotes"');
      expect(writtenXML).toContain("]]>");
    });

    it("should handle special characters in summary safely", () => {
      const mockData: PRDataStore = {
        lastUpdated: "2025-12-18T00:00:00.000Z",
        totalCount: 1,
        items: [
          {
            number: 12345,
            title: "Test PR",
            url: "https://github.com/rails/rails/pull/12345",
            mergedAt: "2025-12-17T10:00:00Z",
            author: "testuser",
            authorUrl: "https://github.com/testuser",
            summary: "Summary with <tags> & special characters",
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockData));

      rssGenerator.generate();

      const writtenXML = vi.mocked(writeFileSync).mock.calls[0][1] as string;

      // Feed package uses CDATA sections for safe character handling
      expect(writtenXML).toContain("<![CDATA[");
      expect(writtenXML).toContain("Summary with <tags> & special characters");
      expect(writtenXML).toContain("]]>");
    });
  });

  describe("50 item limit", () => {
    it("should include all items when less than 50", () => {
      const items = Array.from({ length: 30 }, (_, i) => ({
        number: i + 1,
        title: `PR ${i + 1}`,
        url: `https://github.com/rails/rails/pull/${i + 1}`,
        mergedAt: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
        author: "testuser",
        authorUrl: "https://github.com/testuser",
        summary: `Summary ${i + 1}`,
      }));

      const mockData: PRDataStore = {
        lastUpdated: "2025-12-18T00:00:00.000Z",
        totalCount: 30,
        items,
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockData));

      rssGenerator.generate();

      const writtenXML = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      const itemCount = (writtenXML.match(/<item>/g) || []).length;

      expect(itemCount).toBe(30);
    });

    it("should include all items when exactly 50", () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        number: i + 1,
        title: `PR ${i + 1}`,
        url: `https://github.com/rails/rails/pull/${i + 1}`,
        mergedAt: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
        author: "testuser",
        authorUrl: "https://github.com/testuser",
        summary: `Summary ${i + 1}`,
      }));

      const mockData: PRDataStore = {
        lastUpdated: "2025-12-18T00:00:00.000Z",
        totalCount: 50,
        items,
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockData));

      rssGenerator.generate();

      const writtenXML = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      const itemCount = (writtenXML.match(/<item>/g) || []).length;

      expect(itemCount).toBe(50);
    });
  });

  describe("URL generation", () => {
    it("should generate correct item link with year-month and PR number", () => {
      const mockData: PRDataStore = {
        lastUpdated: "2025-12-18T00:00:00.000Z",
        totalCount: 1,
        items: [
          {
            number: 12345,
            title: "Test PR",
            url: "https://github.com/rails/rails/pull/12345",
            mergedAt: "2025-11-25T10:00:00Z",
            author: "testuser",
            authorUrl: "https://github.com/testuser",
            summary: "Test summary",
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockData));

      rssGenerator.generate();

      const writtenXML = vi.mocked(writeFileSync).mock.calls[0][1] as string;

      // Should contain link to monthly page with PR anchor
      expect(writtenXML).toContain(`${baseUrl}/monthly/2025-11#pr-12345`);
    });

    it("should use GitHub PR URL as guid", () => {
      const mockData: PRDataStore = {
        lastUpdated: "2025-12-18T00:00:00.000Z",
        totalCount: 1,
        items: [
          {
            number: 12345,
            title: "Test PR",
            url: "https://github.com/rails/rails/pull/12345",
            mergedAt: "2025-12-17T10:00:00Z",
            author: "testuser",
            authorUrl: "https://github.com/testuser",
            summary: "Test summary",
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockData));

      rssGenerator.generate();

      const writtenXML = vi.mocked(writeFileSync).mock.calls[0][1] as string;

      expect(writtenXML).toContain("<guid>https://github.com/rails/rails/pull/12345</guid>");
    });
  });

  describe("HTML content conversion", () => {
    it("should convert summary to HTML with basic formatting", () => {
      const mockData: PRDataStore = {
        lastUpdated: "2025-12-18T00:00:00.000Z",
        totalCount: 1,
        items: [
          {
            number: 12345,
            title: "Test PR",
            url: "https://github.com/rails/rails/pull/12345",
            mergedAt: "2025-12-17T10:00:00Z",
            author: "testuser",
            authorUrl: "https://github.com/testuser",
            summary: "Summary with **bold** and `code` and line breaks\n\nNew paragraph",
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockData));

      rssGenerator.generate();

      const writtenXML = vi.mocked(writeFileSync).mock.calls[0][1] as string;

      // Should contain HTML formatted content
      expect(writtenXML).toContain("<strong>bold</strong>");
      expect(writtenXML).toContain("<code>code</code>");
    });
  });
});
