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

/** Opening/closing fence of a code block, e.g. ```html */
const FENCE_PATTERN = /^[ \t]*(`{3,}|~{3,})/;

/**
 * Find a run of exactly `length` backticks at or after `from`.
 * Returns its start index, or -1 when the line has no such run.
 */
function findClosingBackticks(line: string, from: number, length: number): number {
  let i = from;
  while (i < line.length) {
    if (line[i] !== "`") {
      i++;
      continue;
    }
    const start = i;
    while (line[i] === "`") i++;
    if (i - start === length) return start;
  }
  return -1;
}

/**
 * Escape `<` in a single line, leaving inline code spans untouched.
 */
function escapeOutsideCodeSpans(line: string): string {
  let result = "";
  let i = 0;

  while (i < line.length) {
    if (line[i] !== "`") {
      result += line[i] === "<" ? "&lt;" : line[i];
      i++;
      continue;
    }

    const runStart = i;
    while (line[i] === "`") i++;
    const closing = findClosingBackticks(line, i, i - runStart);

    // No matching run: the backticks are literal text, so keep scanning after them
    if (closing === -1) {
      result += line.slice(runStart, i);
      continue;
    }

    const spanEnd = closing + (i - runStart);
    result += line.slice(runStart, spanEnd);
    i = spanEnd;
  }

  return result;
}

/**
 * Escape `<` so Vue's template compiler does not read it as an element or component.
 *
 * VitePress compiles every markdown file into a Vue SFC, so a bare tag such as
 * `<p>` or `Array<String>` fails the build with "Element is missing end tag".
 * Fenced code blocks and inline code spans are left alone: markdown-it escapes
 * their contents itself, and escaping here would render a literal `&lt;`.
 */
export function sanitizeForVitePress(text: string): string {
  let fence: string | null = null;

  return text
    .split("\n")
    .map((line) => {
      const match = FENCE_PATTERN.exec(line);
      const rest = match ? line.slice(match[0].length) : "";

      if (fence !== null) {
        // A closing fence is the same character, at least as long, and carries no info string
        if (match && match[1][0] === fence[0] && match[1].length >= fence.length && !rest.trim()) {
          fence = null;
        }
        return line;
      }

      // A backtick fence cannot have backticks in its info string (CommonMark)
      if (match && !(match[1][0] === "`" && rest.includes("`"))) {
        fence = match[1];
        return line;
      }

      return escapeOutsideCodeSpans(line);
    })
    .join("\n");
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
## [#${pr.number}](${pr.html_url}) ${sanitizeForVitePress(pr.title)} {#pr-${pr.number}}

**マージ日**: ${date} | **作成者**: [@${pr.user?.login ?? "unknown"}](${pr.user?.html_url ?? "#"})

${sanitizeForVitePress(summary)}

---
`;
}
