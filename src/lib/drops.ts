/**
 * The DROPS tab: rows appended live during the event.
 *
 * Only four columns are read — Team, User, Boss, Drop — plus an optional
 * Timestamp. The sheet's own Points Earned / Multiplier / Full Points / # Seen /
 * # from Team / # for Full Points / Bonus / Price columns are deliberately
 * ignored and recomputed from the catalog: their formulas are already partly
 * broken, and a scoring path that reads them cannot be tested.
 */

import type { SheetTable } from "./csv";
import { parseTimestamp } from "./numbers";
import { tidy } from "./text";
import type { RawDrop, Warning } from "./types";

export const DROPS_COLUMNS = ["Team", "User", "Boss", "Drop"] as const;

/** Optional; when present it orders the multiplier and drives the feed's clock. */
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

  for (const row of table.rows) {
    const team = tidy(row.get("Team"));
    const user = tidy(row.get("User"));
    const boss = tidy(row.get("Boss"));
    const drop = tidy(row.get("Drop"));

    // The drop log is pre-padded with empty rows whose formula columns still
    // evaluate to something, so blankness is judged on these four fields only —
    // otherwise every unused row would raise a warning.
    if (team === "" && user === "" && boss === "" && drop === "") continue;

    if (user === "" || boss === "" || drop === "") {
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
        message: `Row is missing ${missing} and was not scored.`,
      });
      continue;
    }

    const timestamp = hasTimestampColumn
      ? parseTimestamp(row.get(DROPS_TIMESTAMP_COLUMN))
      : null;
    if (timestamp !== null) timestampsSeen += 1;

    drops.push({ row: row.row, team, user, boss, drop, timestamp });
  }

  return {
    drops,
    warnings,
    hasTimestamps: hasTimestampColumn && timestampsSeen > 0,
  };
}
