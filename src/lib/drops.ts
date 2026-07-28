/**
 * The DROPS tab: rows appended live during the event.
 *
 * Five columns are read — Team, User, Boss, Drop and Price — plus an optional
 * Timestamp. The sheet's own Points Earned / Multiplier / Full Points / # Seen /
 * # from Team / # for Full Points columns are deliberately ignored and
 * recomputed from the catalog: their formulas are already partly broken, and a
 * scoring path that reads them cannot be tested.
 *
 * `Price` is the exception, being the drop log's own accumulated GP value
 * rather than a score, so there is nothing to recompute it from.
 *
 * The `Bonus` column (column M) is not read: it is a leftover from the sheet
 * this one's layout was copied from, is unused, and is hidden in the sheet.
 */

import type { SheetTable } from "./csv";
import { isPendingCell, parseNumber, parseTimestamp } from "./numbers";
import { tidy } from "./text";
import type { RawDrop, Warning } from "./types";

export const DROPS_COLUMNS = ["Team", "User", "Boss", "Drop"] as const;

/**
 * The drop log's own GP value for the item, which the sheet accumulates.
 *
 * Read by name when the header exists, and otherwise from column H, where the
 * live sheet keeps it. Unlike the scoring columns this is data rather than a
 * derived score, so there is nothing to recompute it from.
 */
export const DROPS_PRICE_COLUMN = "Price";
const DROPS_PRICE_FALLBACK_INDEX = 7; // column H

/** Optional; when present it orders the multiplier. */
export const DROPS_TIMESTAMP_COLUMN = "Timestamp";

export interface DropsResult {
  drops: RawDrop[];
  warnings: Warning[];
  /** True when the tab has a usable Timestamp column. */
  hasTimestamps: boolean;
}

export function parseDrops(table: SheetTable, tab: string): DropsResult {
  const warnings: Warning[] = [];
  const drops: RawDrop[] = [];
  const hasTimestampColumn = table.header.some(
    (h) => h.trim().toLowerCase() === DROPS_TIMESTAMP_COLUMN.toLowerCase(),
  );
  let timestampsSeen = 0;
  let pendingPrices = 0;

  for (const row of table.rows) {
    const team = tidy(row.get("Team"));
    const user = tidy(row.get("User"));
    const boss = tidy(row.get("Boss"));
    const drop = tidy(row.get("Drop"));
    // Try the named column first, then column H. A fallback rather than an
    // either/or, so a row whose named cell exports blank can still be read
    // positionally.
    const priceCells = [
      row.get(DROPS_PRICE_COLUMN),
      row.cells[DROPS_PRICE_FALLBACK_INDEX] ?? "",
    ];
    const price = priceCells.reduce<number | null>(
      (found, cell) => found ?? parseNumber(cell),
      null,
    );
    if (price === null && priceCells.some(isPendingCell)) pendingPrices += 1;

    // The drop log is pre-padded with empty rows whose formula columns still
    // evaluate to something, so blankness is judged on these fields only —
    // otherwise every unused row would raise a warning.
    if (team === "" && user === "" && boss === "" && drop === "") {
      continue;
    }

    if (boss === "" || drop === "") {
      const missing = [
        user === "" ? "User" : null,
        boss === "" ? "Boss" : null,
        drop === "" ? "Drop" : null,
      ]
        .filter(Boolean)
        .join(", ");

      warnings.push({
        kind: "incompleteRow",
        tab,
        row: row.row,
        value: [team, user, boss, drop].filter(Boolean).join(" / "),
        message: `Row is missing ${missing}, so it was not scored.`,
      });
      continue;
    }


    const timestamp = hasTimestampColumn
      ? parseTimestamp(row.get(DROPS_TIMESTAMP_COLUMN))
      : null;
    if (timestamp !== null) timestampsSeen += 1;

    drops.push({
      row: row.row,
      team,
      user,
      boss,
      drop,
      price,
      timestamp,
    });
  }

  // One warning for the lot rather than one per row: a sheet-wide condition
  // reported hundreds of times would bury everything else in the panel.
  if (pendingPrices > 0) {
    warnings.push({
      kind: "pendingPrice",
      tab,
      value: String(pendingPrices),
      message: `${pendingPrices} row${pendingPrices === 1 ? "'s" : "s'"} Price is still "Loading…" and shows as — on the site. Custom formulas do not run when the sheet is read, so only values the sheet has already cached come through. Select column H, copy it, then Paste special → Values only to freeze the prices.`,
    });
  }

  return {
    drops,
    warnings,
    hasTimestamps: hasTimestampColumn && timestampsSeen > 0,
  };
}
