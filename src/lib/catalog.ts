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

import { BONUS_CATEGORIES } from "@/config/event";
import type { SheetRow, SheetTable } from "./csv";
import { parseLimit, parseNumber } from "./numbers";
import { catalogKey, normalize, squash, tidy } from "./text";
import type { Catalog, CatalogEntry, Warning } from "./types";

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
  "Price",
  "Points",
  "Full pts qty limit",
] as const;

const bonusCategorySet = new Set(BONUS_CATEGORIES.map(normalize));

/** True for the manually-awarded categories that never appear in the drop log. */
export function isBonusCategory(category: string): boolean {
  return bonusCategorySet.has(normalize(category));
}

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

export function buildCatalog(table: SheetTable, tab: string): CatalogResult {
  const warnings: Warning[] = [];
  const byKey = new Map<string, CatalogEntry>();
  const entries: CatalogEntry[] = [];
  const byCategory = new Map<string, CatalogEntry[]>();
  const bonusEntries: CatalogEntry[] = [];

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
    const category = tidy(row.get("Category")) || section;
    const item = tidy(row.get("Item"));

    if (item === "") continue;

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

    const price = parseNumber(row.get("Price"));
    const points = parseNumber(row.get("Points"));
    const limit = parseLimit(row.get("Full pts qty limit"), 1);

    const entry: CatalogEntry = {
      key: catalogKey(category, item),
      category,
      item,
      price,
      // Points is required to score. Bonus-category rows are reference-only, so
      // a missing value there is harmless and defaults to 0.
      points: points ?? 0,
      fullPointsLimit: limit,
      row: row.row,
    };

    if (isBonusCategory(category)) {
      bonusEntries.push(entry);
      continue;
    }

    if (points === null) {
      warnings.push({
        kind: "catalogRowSkipped",
        tab,
        row: row.row,
        value: `${category} — ${item}`,
        message: `Points could not be read ("${row.get("Points")}"), so this item cannot be scored and was skipped.`,
      });
      continue;
    }

    if (price === null && row.get("Price") !== "") {
      warnings.push({
        kind: "unparsedNumber",
        tab,
        row: row.row,
        value: row.get("Price"),
        message: `Price for ${category} — ${item} could not be read; it counts as 0 GP.`,
      });
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
    const sheetKey = row.get("Key");
    if (sheetKey !== "" && squash(sheetKey) !== squash(category + item)) {
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
    catalog: { byKey, entries, byCategory, bonusEntries },
    warnings,
  };
}
