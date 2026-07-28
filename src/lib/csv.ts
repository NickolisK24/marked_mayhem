/**
 * CSV parsing for Google Sheets' gviz CSV export.
 *
 * Hand-rolled rather than pulled from npm for two reasons: the input format is
 * fixed and simple (RFC 4180 as Google emits it), and the failure behaviour
 * matters more than the feature set — this parser reports missing columns
 * instead of throwing, so one broken tab degrades into an error banner rather
 * than a white screen.
 */

import { isBlankRow, normalize } from "./text";

/** Split raw CSV text into rows of cells. Never throws. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Strip a UTF-8 BOM, which Google sometimes prefixes.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // Swallow; the \n that follows ends the row. A lone \r also ends a row.
      if (input[i + 1] !== "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
    } else {
      field += char;
    }
  }

  // A trailing field only counts as a row if there is something in it.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * A single data row, addressable by column name.
 *
 * `row` is the 1-based row number as a staff member sees it in the sheet, so a
 * warning can say "DROPS row 214" and be actionable.
 */
export interface SheetRow {
  row: number;
  cells: string[];
  get: (column: string) => string;
  has: (column: string) => boolean;
}

export interface SheetTable {
  header: string[];
  rows: SheetRow[];
  /** Requested columns that were not present in the header. */
  missingColumns: string[];
}

/**
 * gviz answers a request for a non-existent tab with an HTML page or a JS
 * callback rather than an HTTP error. Detect that here so the caller can report
 * "tab not found" instead of parsing a login page into nonsense rows.
 */
export function looksLikeCsv(text: string): boolean {
  const head = text.slice(0, 400).trimStart().toLowerCase();
  if (head.startsWith("<")) return false;
  if (head.startsWith("google.visualization")) return false;
  if (head.startsWith("/*o_o*/")) return false;
  if (head.startsWith("{") && head.includes('"status"')) return false;
  return true;
}

/** How far down a tab to look for the header row. */
const HEADER_SEARCH_DEPTH = 15;

/**
 * Find the header row.
 *
 * Usually row 1, but a tab with a title or a note above its headers is common
 * enough that assuming row 1 turns a cosmetic edit into a site-wide outage. The
 * row matching the most required columns wins; ties go to the earliest row, and
 * a tab with no required columns declared keeps the old row-1 behaviour.
 */
function findHeaderRow(
  rows: string[][],
  requiredColumns: readonly string[],
): number {
  if (requiredColumns.length === 0) return 0;

  const wanted = new Set(requiredColumns.map(normalize));
  let bestIndex = 0;
  let bestScore = 0;

  const depth = Math.min(rows.length, HEADER_SEARCH_DEPTH);
  for (let i = 0; i < depth; i += 1) {
    const seen = new Set<string>();
    for (const cell of rows[i]!) {
      const key = normalize(cell);
      if (wanted.has(key)) seen.add(key);
    }
    if (seen.size > bestScore) {
      bestScore = seen.size;
      bestIndex = i;
    }
  }

  // One incidental match is not a header — a data row can easily contain a word
  // that happens to be a column name.
  const threshold = Math.min(2, wanted.size);
  return bestScore >= threshold ? bestIndex : 0;
}

/**
 * Map parsed rows onto their header, matching column names after normalization
 * so "Full pts qty limit", "Full Pts Qty Limit" and " full pts qty limit " are
 * the same column.
 *
 * Fully blank rows are dropped here. In the drop log they are the norm — the
 * sheet is pre-padded with hundreds of empty rows — and warning on them would
 * bury the warnings that matter.
 */
export function toTable(
  rows: string[][],
  requiredColumns: readonly string[] = [],
): SheetTable {
  if (rows.length === 0) {
    return { header: [], rows: [], missingColumns: [...requiredColumns] };
  }

  const headerIndex = findHeaderRow(rows, requiredColumns);
  const header = rows[headerIndex]!.map((cell) => cell.trim());
  const index = new Map<string, number>();
  header.forEach((name, i) => {
    const key = normalize(name);
    // First occurrence wins, so a duplicated header doesn't shadow the real one.
    if (key !== "" && !index.has(key)) index.set(key, i);
  });

  const missingColumns = requiredColumns.filter(
    (column) => !index.has(normalize(column)),
  );

  const dataRows: SheetRow[] = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const cells = rows[i]!;
    if (isBlankRow(cells)) continue;

    dataRows.push({
      // Spreadsheet rows are 1-based, so a 0-based index is one lower.
      row: i + 1,
      cells,
      get(column: string) {
        const at = index.get(normalize(column));
        if (at === undefined) return "";
        return (cells[at] ?? "").trim();
      },
      has(column: string) {
        return index.has(normalize(column));
      },
    });
  }

  return { header, rows: dataRows, missingColumns };
}

/** Convenience: parse text straight into a table. */
export function parseTable(
  text: string,
  requiredColumns: readonly string[] = [],
): SheetTable {
  return toTable(parseCsv(text), requiredColumns);
}
