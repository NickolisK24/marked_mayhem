/**
 * Alias resolution.
 *
 * Rule 2 lets a player sign up on two accounts, so a roster cell may hold more
 * than one RSN. The roster uses several conventions for this, all of which have
 * turned up in the live sheet:
 *
 *   Charzbtw/scuffdcharz         -> two RSNs, separated by a slash
 *   Haxoonie / Maxoonie          -> two RSNs, spaces around the slash
 *   canofeesh, can o fish        -> two RSNs, separated by a comma
 *   Weh & Cnr                    -> two RSNs, separated by an ampersand
 *   "NiceExample" "Dragon Sword" -> two RSNs, each quoted
 *   MarylandRat                  -> one RSN
 *
 * Quotes are a grouping device, not part of the name: they are there so a name
 * containing a space survives as one RSN. They are stripped, never displayed.
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

/**
 * Quote marks used to group a multi-word RSN. Straight and curly are treated
 * interchangeably, since a sheet will silently turn one into the other and the
 * pair can end up mismatched.
 */
const QUOTES = new Set(['"', "“", "”", "‟", "«", "»"]);

/** Characters that separate one RSN from the next. */
const SEPARATORS = new Set(["/", ",", "&"]);

/**
 * Split a roster cell into its individual RSNs.
 *
 * A single left-to-right pass, so the order in the cell is preserved — the
 * first RSN is the one the site displays.
 */
export function splitRsns(cell: string): string[] {
  const rsns: string[] = [];
  let current = "";

  const flush = () => {
    const value = tidy(current);
    if (value !== "") rsns.push(value);
    current = "";
  };

  for (let i = 0; i < cell.length; i += 1) {
    const char = cell[i]!;

    if (QUOTES.has(char)) {
      // Everything up to the closing quote is one RSN, so a separator or a
      // space inside the quotes does not split it.
      flush();
      let j = i + 1;
      while (j < cell.length && !QUOTES.has(cell[j]!)) {
        current += cell[j];
        j += 1;
      }
      flush();
      i = j; // skip the closing quote
      continue;
    }

    if (SEPARATORS.has(char)) {
      flush();
      continue;
    }

    current += char;
  }

  flush();
  return rsns;
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
    // The roster cell as a whole counts as an alias, not just the RSNs inside
    // it. The drop log's User column is typically a dropdown sourced from the
    // roster, so a two-account player arrives as the literal cell text —
    // "Charzbtw/scuffdcharz" — which is nobody's RSN.
    //
    // Deduped, because a single-name player's cell *is* their only RSN and
    // registering it twice would report them as clashing with themselves.
    const seen = new Set<string>();
    const aliases = [...player.rsns, player.rosterCell].filter((alias) => {
      const key = normalize(alias);
      if (key === "" || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    for (const rsn of aliases) {
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
