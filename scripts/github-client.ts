import { Octokit } from "@octokit/rest";

export interface PRSearchResult {
  number: number;
  title: string;
  html_url: string;
  merged_at: string | null;
  body: string | null;
  user: {
    login: string;
    html_url: string;
  } | null;
}

export interface PRFile {
  filename?: string;
  additions: number;
  deletions: number;
}

export interface PRDetails {
  pr: {
    number: number;
    title: string;
    html_url: string;
    merged_at: string | null;
    body: string | null;
    additions: number;
    deletions: number;
    user: {
      login: string;
      html_url: string;
    } | null;
  };
  files: PRFile[];
}

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Fetch merged PRs from the last 24 hours
   */
  async fetchRecentPRs(): Promise<PRSearchResult[]> {
    console.log(`Fetching recently merged PRs from ${this.owner}/${this.repo}...`);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    try {
      const { data: pullRequests } = await this.octokit.search.issuesAndPullRequests({
        q: `repo:${this.owner}/${this.repo} is:pr is:merged merged:>=${yesterday.toISOString().split("T")[0]}`,
        sort: "updated",
        order: "desc",
        per_page: 100,
      });

      console.log(`Found ${pullRequests.items.length} merged PRs`);
      return pullRequests.items.map(
        (item): PRSearchResult => ({
          number: item.number,
          title: item.title,
          html_url: item.html_url,
          merged_at: "merged_at" in item ? (item.merged_at as string | null) : null,
          body: item.body || null,
          user: item.user,
        }),
      );
    } catch (error) {
      console.error("Error fetching PRs:", error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Get PR details including diff
   */
  async getPRDetails(prNumber: number): Promise<PRDetails | null> {
    try {
      const { data: pr } = await this.octokit.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      const { data: files } = await this.octokit.pulls.listFiles({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        per_page: 100,
      });

      return {
        pr: {
          number: pr.number,
          title: pr.title,
          html_url: pr.html_url,
          merged_at: pr.merged_at,
          body: pr.body,
          additions: pr.additions,
          deletions: pr.deletions,
          user: pr.user,
        },
        files: files as PRFile[],
      };
    } catch (error) {
      console.error(
        `Error fetching PR #${prNumber} details:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }
}
