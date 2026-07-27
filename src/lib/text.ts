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

/** The composite catalog key: normalized boss + normalized item. */
export function catalogKey(boss: string, item: string): string {
  return `${normalize(boss)}|${normalize(item)}`;
}

/** True when every cell in the row is blank after trimming. */
export function isBlankRow(cells: readonly string[]): boolean {
  return cells.every((cell) => tidy(cell) === "");
}
