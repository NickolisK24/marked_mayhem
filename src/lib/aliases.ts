/**
 * Alias resolution.
 *
 * Rule 2 lets a player sign up on two accounts, so a roster cell may hold more
 * than one RSN separated by `/` or `,`:
 *
 *   "Charzbtw/scuffdcharz"      -> one player, two RSNs
 *   "Haxoonie / Maxoonie"       -> one player, two RSNs (spaces around the slash)
 *   "canofeesh, can o fish"     -> one player, two RSNs
 *   "MarylandRat"               -> one player, one RSN
 *
 * A drop is logged under whichever account got it, so every RSN must resolve
 * back to the same canonical player.
 *
 * Separately, some roster cells carry a stray internal space the drop log will
 * not have ("harmon y", "Cambrid ge"). Those resolve through a secondary
 * whitespace-stripped index, which is discarded for any key where it would make
 * two different players collide — an ambiguous match is reported, never guessed.
 */

import { normalize, squash, tidy } from "./text";
import type { Player, Warning } from "./types";

/** Split a roster cell into its individual RSNs. */
export function splitRsns(cell: string): string[] {
  return cell
    .split(/[/,]/)
    .map((part) => tidy(part))
    .filter((part) => part !== "");
}

export interface AliasIndex {
  resolve: (rsn: string) => Player | null;
  warnings: Warning[];
}

/**
 * Build the RSN -> player index.
 *
 * Lookup order is exact-after-normalization first, whitespace-stripped second.
 * There is deliberately no fuzzy third pass: a wrong silent match quietly moves
 * points between teams, whereas an unmatched row shows up in the warnings panel
 * and gets fixed in the sheet in thirty seconds.
 */
export function buildAliasIndex(players: Player[], tab: string): AliasIndex {
  const exact = new Map<string, Player>();
  const squashed = new Map<string, Player>();
  const ambiguousSquashed = new Set<string>();
  const warnings: Warning[] = [];

  for (const player of players) {
    for (const rsn of player.rsns) {
      const key = normalize(rsn);
      if (key === "") continue;

      const clash = exact.get(key);
      if (clash && clash.id !== player.id) {
        warnings.push({
          kind: "rosterAmbiguousAlias",
          tab,
          row: player.row,
          value: rsn,
          message: `RSN "${rsn}" is listed for both ${clash.displayName} (${clash.team}) and ${player.displayName} (${player.team}). Drops under it are credited to ${clash.displayName}.`,
        });
        continue;
      }
      if (!clash) exact.set(key, player);

      // Index the space-stripped form too, in both directions: it catches a
      // roster typo ("harmon y") against a clean drop log entry ("harmony")
      // and the reverse.
      const squashedKey = squash(rsn);
      const squashClash = squashed.get(squashedKey);
      if (squashClash && squashClash.id !== player.id) {
        // Two distinct players whose names differ only in spacing. Refuse to
        // guess between them: drop the key so both fall through to a warning.
        ambiguousSquashed.add(squashedKey);
      } else if (!squashClash) {
        squashed.set(squashedKey, player);
      }
    }
  }

  for (const key of ambiguousSquashed) squashed.delete(key);

  return {
    warnings,
    resolve(rsn: string): Player | null {
      const key = normalize(rsn);
      if (key === "") return null;
      const direct = exact.get(key);
      if (direct) return direct;
      return squashed.get(squash(rsn)) ?? null;
    },
  };
}
