/**
 * The DROPS tab: rows appended live during the event.
 *
 * Five columns are read — Team, User, Boss, Drop and Bonus — plus an optional
 * Timestamp. The sheet's own Points Earned / Multiplier / Full Points / # Seen /
 * # from Team / # for Full Points columns are deliberately ignored and
 * recomputed from the catalog: their formulas are already partly broken, and a
 * scoring path that reads them cannot be tested.
 *
 * `Bonus` is the exception. It is not a formula — event managers type bonus
 * points into it by hand — so it is the source of truth for bonuses and is read
 * as given.
 */

import type { SheetTable } from "./csv";
import { parseNumber, parseTimestamp } from "./numbers";
import { tidy } from "./text";
import type { RawDrop, Warning } from "./types";

export const DROPS_COLUMNS = ["Team", "User", "Boss", "Drop"] as const;

/** Manually-entered bonus points. Optional; blank on ordinary drop rows. */
export const DROPS_BONUS_COLUMN = "Bonus";

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

  for (const row of table.rows) {
    const team = tidy(row.get("Team"));
    const user = tidy(row.get("User"));
    const boss = tidy(row.get("Boss"));
    const drop = tidy(row.get("Drop"));
    const bonus = parseNumber(row.get(DROPS_BONUS_COLUMN));

    // The drop log is pre-padded with empty rows whose formula columns still
    // evaluate to something, so blankness is judged on these fields only —
    // otherwise every unused row would raise a warning.
    if (
      team === "" &&
      user === "" &&
      boss === "" &&
      drop === "" &&
      (bonus === null || bonus === 0)
    ) {
      continue;
    }

    const hasItem = boss !== "" && drop !== "";
    const hasBonus = bonus !== null && bonus !== 0;

    // A row may be an item drop, a hand-entered bonus, or both. Only a row that
    // is neither is a mistake.
    if (!hasItem && !hasBonus) {
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
        message: `Row is missing ${missing} and has no bonus points, so it was not scored.`,
      });
      continue;
    }

    // A bonus needs a team to award it to, from the row or from the player.
    if (hasBonus && team === "" && user === "") {
      warnings.push({
        kind: "incompleteRow",
        tab,
        row: row.row,
        value: String(bonus),
        message: `Bonus of ${bonus} has no Team or User, so there is nobody to award it to.`,
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
      bonus: hasBonus ? bonus : null,
      timestamp,
    });
  }

  return {
    drops,
    warnings,
    hasTimestamps: hasTimestampColumn && timestampsSeen > 0,
  };
}
