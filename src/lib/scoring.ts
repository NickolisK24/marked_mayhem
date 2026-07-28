/**
 * Scoring. One pure function, no I/O, no clock, no globals.
 *
 * The rules, in full:
 *
 *   - A drop scores `catalog points × multiplier`.
 *   - The multiplier is 1.0 for the first N of a given item **per team**, where
 *     N is that item's `Full pts qty limit` (default 1).
 *   - Every drop past that limit scores 0.5×. Duplicates are intentional and
 *     unlimited — a team can keep banking half points indefinitely.
 *   - A few items carry a per-team cap instead, written into the catalog name as
 *     "(Limit N)". All N score **full** points — there is no half tier for these
 *     — and past N they score nothing at all. Over-cap drops are still listed,
 *     because the team did receive them.
 *   - Order therefore matters: each team's drops are processed oldest-first so
 *     the first N are the ones that get full credit.
 *   - Bonus points come from the drop log's `Bonus` column, and from rows in the
 *     `Misc.` / `Team Challenges` categories, which are awarded to a team rather
 *     than to a person and so carry no User. Those are priced from the row's
 *     `Bonus` cell when it has one and from the catalog when it does not. Bonus
 *     points are kept separate from drop points so the leaderboard can show the
 *     split, and both add into the team total.
 *   - Player totals use the same arithmetic, attributed to the individual. The
 *     quantity limit is a team-level resource, so a player's drop inherits
 *     whatever multiplier the team-level sequence gave it.
 *
 * Nothing here reads the sheet's own Points Earned or Multiplier columns.
 */

import { TEAM_COLORS } from "@/config/event";
import { isBonusCategory } from "./catalog";
import { catalogKey } from "./text";
import type {
  Catalog,
  PlayerDrop,
  PlayerScore,
  RawDrop,
  Roster,
  ScoreResult,
  TeamScore,
  Warning,
} from "./types";

export interface ScoreInput {
  drops: RawDrop[];
  catalog: Catalog;
  roster: Roster;
  /** Tab name, so warnings can name the tab a staff member must open. */
  dropsTab: string;
  /** True when the drop log has usable timestamps. */
  hasTimestamps: boolean;
}

/**
 * Order drops oldest-first.
 *
 * With timestamps, sort by them and break ties on row order. Without, fall back
 * to row order alone, which is chronological in practice because rows are
 * appended as drops happen. Both are stable, so the same input always produces
 * the same multipliers.
 */
function orderDrops(drops: RawDrop[], hasTimestamps: boolean): RawDrop[] {
  const ordered = [...drops];
  if (!hasTimestamps) {
    ordered.sort((a, b) => a.row - b.row);
    return ordered;
  }
  ordered.sort((a, b) => {
    const at = a.timestamp;
    const bt = b.timestamp;
    // Rows without a timestamp keep their row-order position relative to the rest.
    if (at === null && bt === null) return a.row - b.row;
    if (at === null) return -1;
    if (bt === null) return 1;
    return at === bt ? a.row - b.row : at - bt;
  });
  return ordered;
}

export function scoreEvent(input: ScoreInput): ScoreResult {
  const { drops, catalog, roster, dropsTab, hasTimestamps } = input;
  const warnings: Warning[] = [];

  /* --- accumulators, seeded from the roster so a team with zero drops still
         appears on the leaderboard rather than vanishing ------------------- */

  const teamScores = new Map<string, TeamScore>();
  const teamUniques = new Map<string, Set<string>>();
  for (const team of roster.teams) {
    teamScores.set(team.name, {
      name: team.name,
      captain: team.captain,
      colorIndex: team.colorIndex < TEAM_COLORS.length ? team.colorIndex : -1,
      dropPoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
      uniques: 0,
      dropCount: 0,
    });
    teamUniques.set(team.name, new Set());
  }

  const playerScores = new Map<string, PlayerScore>();
  for (const player of roster.players) {
    playerScores.set(player.id, {
      id: player.id,
      displayName: player.displayName,
      rsns: player.rsns,
      team: player.team,
      ehb: player.ehb,
      isCaptain: player.isCaptain,
      points: 0,
      dropCount: 0,
      gpValue: 0,
      drops: [],
    });
  }

  /** How many of each item a team has logged so far: `${team}::${itemKey}`. */
  const seenCount = new Map<string, number>();

  for (const drop of orderDrops(drops, hasTimestamps)) {
    /* --- which team does this row belong to? --------------------------- */

    // The roster is authoritative when the RSN resolves: it is edited once,
    // before the event, while the drop log's Team column is typed on every row.
    // A bonus row may carry only a team name, with no player at all.
    const player = drop.user === "" ? null : roster.resolve(drop.user);
    const rowTeam = drop.team === "" ? null : roster.resolveTeam(drop.team);
    const team = player?.team ?? rowTeam;

    if (team === null) {
      warnings.push({
        kind: drop.user === "" ? "unknownTeam" : "unknownPlayer",
        tab: dropsTab,
        row: drop.row,
        value: drop.user || drop.team,
        message:
          drop.user === ""
            ? `"${drop.team}" does not match any team on the roster, so this row was not scored.`
            : `"${drop.user}" is not on any roster, and no recognised team was given either, so this row was not scored.`,
      });
      continue;
    }

    const teamScore = teamScores.get(team);
    if (!teamScore) {
      // Only reachable if the roster is internally inconsistent.
      warnings.push({
        kind: "unknownTeam",
        tab: dropsTab,
        row: drop.row,
        value: team,
        message: `Team "${team}" is on the roster but has no leaderboard entry; this row was not scored.`,
      });
      continue;
    }

    if (player && rowTeam !== null && rowTeam !== team) {
      warnings.push({
        kind: "teamMismatch",
        tab: dropsTab,
        row: drop.row,
        value: drop.team,
        message: `Row says team "${drop.team}" but ${player.displayName} is on ${team} in the roster. Scored for ${team}.`,
      });
    }

    /* --- Misc. / Team Challenges: a team award, not a drop --------------- */

    // These categories are won by a team, not by a person, so the row has no
    // User to credit and must not be held to the player requirement below.
    // Points come from the row's own Bonus cell when it has one — the sheet
    // fills that in from the catalog — and from the catalog directly when it
    // does not, so the award scores either way.
    if (isBonusCategory(drop.boss)) {
      const entry = catalog.bonusByKey.get(catalogKey(drop.boss, drop.drop));
      const award = drop.bonus ?? entry?.points ?? null;

      if (award === null) {
        warnings.push({
          kind: "unknownItem",
          tab: dropsTab,
          row: drop.row,
          value: `${drop.boss} — ${drop.drop}`,
          message: `"${drop.drop}" is not listed under ${drop.boss} in the item catalog and the row has no Bonus value, so nothing was awarded. Add it to the catalog or type the points into the Bonus column.`,
        });
        continue;
      }

      teamScore.bonusPoints += award;
      continue;
    }

    /* --- hand-entered bonus points -------------------------------------- */

    if (drop.bonus !== null) {
      teamScore.bonusPoints += drop.bonus;
    }

    /* --- the item, when the row has one --------------------------------- */

    if (drop.boss === "" && drop.drop === "") continue;

    // A bonus can be awarded from the Team column alone, but an item drop
    // cannot: crediting one to whichever team the row happens to name would
    // silently move points on the strength of a hand-typed cell.
    if (!player) {
      warnings.push({
        kind: "unknownPlayer",
        tab: dropsTab,
        row: drop.row,
        value: drop.user,
        message:
          drop.user === ""
            ? `"${drop.drop}" has no User, so it could not be credited to a player and was not scored.`
            : `"${drop.user}" is not on any roster. Add the RSN to the roster cell for that player (separated by a "/") and this drop will score.`,
      });
      continue;
    }

    const entry = catalog.byKey.get(catalogKey(drop.boss, drop.drop));
    if (!entry) {
      const known = catalog.byCategory.has(drop.boss);
      warnings.push({
        kind: known ? "unknownItem" : "bossNotInCatalog",
        tab: dropsTab,
        row: drop.row,
        value: `${drop.boss} — ${drop.drop}`,
        message: known
          ? `"${drop.drop}" is not a scoreable item at ${drop.boss}. Check the spelling against the item catalog.`
          : `"${drop.boss}" is not a category in the item catalog, so "${drop.drop}" could not be scored.`,
      });
      continue;
    }

    const playerScore = playerScores.get(player.id);

    const countKey = `${team}::${entry.key}`;
    const already = seenCount.get(countKey) ?? 0;
    seenCount.set(countKey, already + 1);

    const overCap = entry.scoringCap !== null && already >= entry.scoringCap;
    const multiplier = overCap ? 0 : already < entry.fullPointsLimit ? 1 : 0.5;
    const points = entry.points * multiplier;
    // "Unique" means the team had never logged this item before, which is what
    // the Uniques figure on the leaderboard counts. With a quantity limit above
    // 1 a duplicate can still score full points, so this is not the same thing
    // as the multiplier.
    const isUnique = already === 0;

    teamScore.dropPoints += points;
    teamScore.dropCount += 1;
    teamUniques.get(team)?.add(entry.key);

    if (playerScore) {
      playerScore.points += points;
      playerScore.dropCount += 1;
      playerScore.gpValue += drop.price ?? 0;
      playerScore.drops.push({
        id: `${drop.row}-${entry.key}`,
        row: drop.row,
        boss: entry.category,
        item: entry.item,
        points,
        unique: isUnique,
        price: drop.price,
        cap: entry.scoringCap,
        overCap,
        timestamp: drop.timestamp,
      });
    }
  }

  /* --- totals and ordering -------------------------------------------- */

  const teams = [...teamScores.values()];
  for (const team of teams) {
    team.uniques = teamUniques.get(team.name)?.size ?? 0;
    team.totalPoints = team.dropPoints + team.bonusPoints;
  }

  teams.sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      b.uniques - a.uniques ||
      b.dropCount - a.dropCount ||
      a.name.localeCompare(b.name),
  );

  const players = [...playerScores.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.dropCount - a.dropCount ||
      a.displayName.localeCompare(b.displayName),
  );

  return {
    teams,
    players,
    warnings,
    ordering: hasTimestamps ? "timestamp" : "rowOrder",
  };
}
