/**
 * Numeric parsing that never throws and never invents a value.
 *
 * A spreadsheet maintained live by a dozen people produces `#REF!`, `#N/A`,
 * `$0`, `40,331,957`, empty strings and stray spaces in the same column. Every
 * one of those must resolve to either a real number or `null` — never `NaN`, and
 * never a silent `0`, because a silent zero is indistinguishable from a
 * legitimately free item and hides the breakage.
 */

/** Spreadsheet error literals. Any of these means "no value", not "zero". */
const ERROR_CELLS = new Set([
  "#ref!",
  "#n/a",
  "#na",
  "#name?",
  "#value!",
  "#div/0!",
  "#null!",
  "#num!",
  "#error!",
  "n/a",
  "na",
  "-",
  "--",
  "",
]);

const SUFFIXES: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
};

/**
 * True when a cell is still computing.
 *
 * Custom Apps Script functions (the drop log prices its items with one) render
 * as "Loading..." until they resolve, and they do **not** run at all for an
 * anonymous CSV export — so this text, not a number, is what the site receives
 * for any row whose result Sheets has not already cached.
 */
export function isPendingCell(raw: string | null | undefined): boolean {
  // Three dots or a single ellipsis character, depending on how the sheet
  // renders it.
  return /^loading\s*(\.{0,3}|…)$/i.test((raw ?? "").trim());
}

/** True when the raw cell is a spreadsheet error or an explicit blank. */
export function isErrorCell(raw: string | null | undefined): boolean {
  return ERROR_CELLS.has((raw ?? "").trim().toLowerCase());
}

/**
 * Parse a numeric cell.
 *
 * Handles: thousands separators (`40,331,957`), currency (`$0`, `1,000 gp`),
 * k/m/b shorthand (`1.4b`), parenthesised negatives (`(500)`), stray whitespace,
 * and a leading `+`.
 *
 * Returns null for blanks, spreadsheet errors, and anything else unparseable.
 */
export function parseNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;

  const trimmed = raw.trim();
  if (isErrorCell(trimmed)) return null;

  let text = trimmed.toLowerCase();

  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1);
  }

  // Strip currency, separators, whitespace and a trailing "gp".
  text = text
    .replace(/gp\b/g, "")
    .replace(/[$,\s]/g, "")
    .replace(/^\+/, "");

  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  }

  if (text === "") return null;

  let multiplier = 1;
  const lastChar = text.at(-1);
  if (lastChar && lastChar in SUFFIXES) {
    multiplier = SUFFIXES[lastChar]!;
    text = text.slice(0, -1);
  }

  if (text === "" || !/^\d*\.?\d+$/.test(text)) return null;

  const value = Number(text);
  if (!Number.isFinite(value)) return null;

  return (negative ? -value : value) * multiplier;
}

/**
 * Parse a quantity limit: a positive integer, defaulting when absent or broken.
 * Fractional and non-positive values fall back to the default rather than
 * producing a limit that would make every drop score half.
 */
export function parseLimit(
  raw: string | null | undefined,
  fallback = 1,
): number {
  const value = parseNumber(raw);
  if (value === null || !Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value);
  return rounded >= 1 ? rounded : fallback;
}

/**
 * Parse a timestamp cell into epoch ms. Accepts ISO 8601 and the formats Google
 * Sheets emits for date columns. Returns null for anything unrecognised — the
 * caller falls back to row order rather than guessing.
 */
export function parseTimestamp(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (isErrorCell(trimmed)) return null;

  // gviz serialises dates as Date(2026,6,27,14,3,0) — month is 0-based.
  const gviz = /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/.exec(
    trimmed,
  );
  if (gviz) {
    const [, y, mo, d, h, mi, s] = gviz;
    return Date.UTC(
      Number(y),
      Number(mo),
      Number(d),
      Number(h ?? 0),
      Number(mi ?? 0),
      Number(s ?? 0),
    );
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}
