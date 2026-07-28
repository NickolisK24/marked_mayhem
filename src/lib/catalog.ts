/**
 * The BINGO tab: the authoritative list of scoreable items.
 *
 * The join key is composite — Category (the boss) plus Item — because the same
 * item is worth different points at different bosses: a Dragon 2h sword is 60 at
 * Callisto, 50 at Venenatis and Vet'ion, 25 at Chaos Elemental. Names like "Any
 * Shard" and "All Uniques" repeat across nearly every category. Joining on the
 * item alone would be wrong for most of the catalog.
 *
 * The sheet's own `Key` column is a Category+Item concatenation, but its exact
 * format is not guaranteed stable, so it is used only as a consistency check —
 * a mismatch is reported, never acted on.
 */

import { AWARD_CATEGORIES } from "@/config/event";
import type { SheetRow, SheetTable } from "./csv";
import { parseLimit, parseNumber } from "./numbers";
import { catalogKey, normalize, squash, stripLimitSuffix, tidy } from "./text";
import type { Catalog, CatalogEntry, Warning } from "./types";

const awardCategorySet = new Set(AWARD_CATEGORIES.map(normalize));

/**
 * True for a category holding awards rather than boss drops.
 *
 * Scoring does not consult this — awards score like anything else. It separates
 * them from the item statistics and routes whole-team ones onto the team card.
 */
export function isAwardCategory(category: string): boolean {
  return awardCategorySet.has(normalize(category));
}

/**
 * Columns the catalog cannot work without.
 *
 * `Category` is deliberately not required. The tab is laid out in sections — a
 * row holding just the boss name, then that boss's items beneath it — so most
 * item rows have no category of their own and inherit the section they sit
 * under. See `buildCatalog`.
 */
export const BINGO_COLUMNS = ["Item", "Points"] as const;

/** Every column the catalog reads, required or not. Used by the docs and tests. */
export const BINGO_ALL_COLUMNS = [
  "Category",
  "Item",
  "Key",
  "Points",
  "Full pts qty limit",
] as const;


export interface CatalogResult {
  catalog: Catalog;
  warnings: Warning[];
}

/**
 * True for a row that names a section rather than listing an item.
 *
 * The catalog is organised as `Armadyl` on its own row, then Armadyl
 * Chestplate / Chainskirt / Helmet / Hilt / Any Shard / All Uniques beneath it.
 * A section header therefore has exactly one non-empty cell, wherever in the
 * row it sits — a real item row always carries at least an item and a points
 * value, so this can never swallow one.
 */
function sectionHeading(row: SheetRow): string | null {
  const filled = row.cells.map(tidy).filter((cell) => cell !== "");
  return filled.length === 1 ? filled[0]! : null;
}

/**
 * Column positions used when the tab has no header row.
 *
 * The live catalog is laid out this way: a title row, per-team scoreboard
 * columns to the right, and the item data purely positional underneath —
 * A for the boss heading, B for the item, C for its points.
 */
const POSITIONAL = { category: 0, item: 1, points: 2 } as const;

export function buildCatalog(table: SheetTable, tab: string): CatalogResult {
  const warnings: Warning[] = [];

  const byKey = new Map<string, CatalogEntry>();
  const entries: CatalogEntry[] = [];
  const byCategory = new Map<string, CatalogEntry[]>();

  // Named columns when the tab has a header, column positions when it does not.
  const cell = (row: SheetRow, column: string, at: number | null): string => {
    if (table.headerFound && row.has(column)) return tidy(row.get(column));
    return at === null ? "" : tidy(row.cells[at] ?? "");
  };

  /** The boss whose section we are currently inside. */
  let section = "";

  for (const row of table.rows) {
    const heading = sectionHeading(row);
    if (heading !== null) {
      section = heading;
      continue;
    }

    // An explicit Category on the row wins; otherwise the row belongs to the
    // section it sits under.
    const category = cell(row, "Category", POSITIONAL.category) || section;
    const rawItem = cell(row, "Item", POSITIONAL.item);

    if (rawItem === "") continue;

    // "Infernal Cape (Limit 5)" is the item "Infernal Cape", capped at 5. The
    // suffix is how the catalog writes a cap; it is not part of the name and
    // the drop log does not carry it.
    const { name: item, limit: cap } = stripLimitSuffix(rawItem);

    if (category === "") {
      warnings.push({
        kind: "catalogRowSkipped",
        tab,
        row: row.row,
        value: item,
        message: `"${item}" does not sit under any boss heading and has no Category, so it cannot be scored.`,
      });
      continue;
    }

    const rawPoints = cell(row, "Points", POSITIONAL.points);

    const points = parseNumber(rawPoints);
    // Absent from the live catalog, so an uncapped item defaults to full points
    // for the first one per team and half for every one after.
    const columnLimit = parseLimit(cell(row, "Full pts qty limit", null), 1);

    // A "(Limit N)" item works differently: all N score full points and there
    // is no half tier — past N the item scores nothing. So N is both the
    // full-points run and the cap, and it overrides the column.
    const fullPointsLimit = cap ?? columnLimit;

    const entry: CatalogEntry = {
      key: catalogKey(category, item),
      category,
      item,
      points: points ?? 0,
      fullPointsLimit,
      scoringCap: cap,
      row: row.row,
    };

    if (points === null) {
      warnings.push({
        kind: "catalogRowSkipped",
        tab,
        row: row.row,
        value: `${category} — ${item}`,
        message: `Points could not be read ("${rawPoints}"), so this item cannot be scored and was skipped.`,
      });
      continue;
    }

    const existing = byKey.get(entry.key);
    if (existing) {
      warnings.push({
        kind: "catalogDuplicate",
        tab,
        row: row.row,
        value: `${category} — ${item}`,
        message: `Duplicate catalog entry; the first one (row ${existing.row}, ${existing.points} pts) is used.`,
      });
      continue;
    }

    // Verification only: the sheet's Key should be Category+Item, but its exact
    // formatting is not depended on.
    // Compared against the item as written, suffix included: the sheet builds
    // this column from its own cell, not from the name after stripping.
    const sheetKey = cell(row, "Key", null);
    if (sheetKey !== "" && squash(sheetKey) !== squash(category + rawItem)) {
      warnings.push({
        kind: "catalogKeyMismatch",
        tab,
        row: row.row,
        value: sheetKey,
        message: `Key does not match Category + Item ("${category}" + "${item}"). Scoring uses Category + Item; the Key column is not used.`,
      });
    }

    byKey.set(entry.key, entry);
    entries.push(entry);

    const bucket = byCategory.get(category);
    if (bucket) bucket.push(entry);
    else byCategory.set(category, [entry]);
  }

  return {
    catalog: { byKey, entries, byCategory },
    warnings,
  };
}
