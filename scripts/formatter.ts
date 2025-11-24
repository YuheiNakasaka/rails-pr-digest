export interface YearMonth {
  year: number;
  month: number;
}

/**
 * Get year and month for a given date
 */
export function getYearMonth(date = new Date()): YearMonth {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

/**
 * Get filename for the current month
 */
export function getMonthlyFilename(date = new Date()): string {
  const { year, month } = getYearMonth(date);
  const monthStr = String(month).padStart(2, "0");
  return `${year}-${monthStr}.md`;
}

/**
 * Format PR entry for markdown
 */
export function formatPREntry(
  pr: {
    number: number;
    title: string;
    html_url: string;
    merged_at: string | null;
    user: {
      login: string;
      html_url: string;
    } | null;
  },
  summary: string,
): string {
  const date = new Date(pr.merged_at ?? "").toLocaleDateString("ja-JP");
  return `
## [#${pr.number}](${pr.html_url}) ${pr.title}

**マージ日**: ${date} | **作成者**: [@${pr.user?.login ?? "unknown"}](${pr.user?.html_url ?? "#"})

${summary}

---
`;
}
