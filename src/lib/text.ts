/**
 * Text normalization used for every key comparison in the app.
 *
 * Two levels, deliberately:
 *
 *   normalize() — trim, collapse internal whitespace, casefold. This is the ONLY
 *   normalization applied when joining a drop log row to the item catalog. The
 *   Boss and Drop columns are dropdown-validated against the catalog, so an
 *   exact match after normalization is the correct expectation; anything looser
 *   risks silently crediting the wrong item, which costs a team points nobody
 *   notices. Unmatched rows are surfaced loudly instead.
 *
 *   squash() — additionally removes ALL internal whitespace. Used ONLY for
 *   repairing roster typos ("harmon y" -> "harmony", "Cambrid ge" -> "Cambridge")
 *   where the sheet has a stray space the drop log will not have. It is applied
 *   as a secondary lookup and is dropped entirely when it would make two
 *   different players collide (see aliases.ts).
 */

/** Trim, collapse runs of internal whitespace to one space, casefold. */
export function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** As `normalize`, but with all whitespace removed. */
export function squash(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, "").toLowerCase();
}

/** Trim and collapse internal whitespace, preserving case. For display. */
export function tidy(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

/**
 * A per-team cap written into the item name, e.g. "Infernal Cape (Limit 5)".
 *
 * The catalog encodes caps this way rather than in a column of their own. The
 * suffix is a note to the reader, not part of the item's name — the drop log
 * records the plain "Infernal Cape" — so it is stripped from the name and read
 * as the cap.
 */
const LIMIT_SUFFIX = /\s*\(\s*limit\s*(\d+)\s*\)\s*$/i;

export interface NamedLimit {
  /** The item name with any "(Limit N)" suffix removed. */
  name: string;
  /** N, or null when the name carried no suffix. */
  limit: number | null;
}

export function stripLimitSuffix(item: string): NamedLimit {
  const match = LIMIT_SUFFIX.exec(item);
  if (!match) return { name: tidy(item), limit: null };

  const limit = Number(match[1]);
  return {
    name: tidy(item.slice(0, match.index)),
    limit: Number.isFinite(limit) && limit >= 1 ? limit : null,
  };
}

/**
 * The composite catalog key: normalized boss + normalized item.
 *
 * The "(Limit N)" suffix is stripped from both sides, so the catalog's
 * "Infernal Cape (Limit 5)" and the drop log's "Infernal Cape" are the same
 * item however each was written.
 */
export function catalogKey(boss: string, item: string): string {
  return `${normalize(boss)}|${normalize(stripLimitSuffix(item).name)}`;
}

/** True when every cell in the row is blank after trimming. */
export function isBlankRow(cells: readonly string[]): boolean {
  return cells.every((cell) => tidy(cell) === "");
}
