/**
 * The BONUS tab: manually-awarded points that never appear in the drop log.
 *
 * Flat and deliberately dumb — one row per award, no formulas — because it is
 * edited by hand mid-event under time pressure.
 */

import type { SheetTable } from "./csv";
import { parseNumber, parseTimestamp } from "./numbers";
import { tidy } from "./text";
import type { BonusRow } from "./types";

export const BONUS_COLUMNS = [
  "team",
  "bonus_type",
  "points",
  "awarded_at",
  "notes",
] as const;

export function parseBonuses(table: SheetTable): BonusRow[] {
  const rows: BonusRow[] = [];

  for (const row of table.rows) {
    const team = tidy(row.get("team"));
    const bonusType = tidy(row.get("bonus_type"));
    const rawPoints = row.get("points");

    if (team === "" && bonusType === "" && tidy(rawPoints) === "") continue;

    rows.push({
      row: row.row,
      team,
      bonusType,
      points: parseNumber(rawPoints),
      awardedAt: parseTimestamp(row.get("awarded_at")),
      notes: tidy(row.get("notes")),
    });
  }

  return rows;
}
