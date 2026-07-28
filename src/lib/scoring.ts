/**
 * Scoring. One pure function, no I/O, no clock, no globals.
 *
 * The rules, in full:
 *
 *   - A drop scores `catalog points × multiplier`.
 *   - The multiplier is 1.0 for the first N of a given item **per team**, where
 *     N is that item's `Full pts qty limit` (default 1; some items are 3, 4 or 5).
 *   - Every drop past that limit scores 0.5×. Duplicates are intentional and
 *     still count — they are never discarded.
 *   - Order therefore matters: each team's drops are processed oldest-first so
 *     the first N are the ones that get full credit.
 *   - Team totals carry drop points and bonus points separately, plus the count
 *     of distinct items claimed.
 *   - Player totals use the same arithmetic, attributed to the individual. The
 *     quantity limit is a team-level resource, so a player's drop inherits
 *     whatever multiplier the team-level sequence gave it.
 *
 * Nothing here reads the sheet's own Points Earned or Multiplier columns.
 */

import { TEAM_COLORS } from "@/config/event";
import { catalogKey, normalize } from "./text";
import type {
  AwardedBonus,
  BonusRow,
  Catalog,
  ClaimMap,
  FeedEntry,
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
  bonuses: BonusRow[];
  /** Recognised bonus_type values; unrecognised ones still score but are flagged. */
  bonusTypes: readonly string[];
  /** Tab names, so warnings can name the tab a staff member must open. */
  tabs: { drops: string; bonus: string };
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
  const { drops, catalog, roster, bonuses, bonusTypes, tabs, hasTimestamps } =
    input;
  const warnings: Warning[] = [];

  /* --- accumulators, seeded from the roster so a team with zero drops still
         appears on the leaderboard rather than vanishing ------------------- */

  const teamScores = new Map<string, TeamScore>();
  const teamUniques = new Map<string, Set<string>>();
  for (const team of roster.teams) {
    teamScores.set(team.name, {
      name: team.name,
      captain: team.captain,
      colorIndex:
        team.colorIndex < TEAM_COLORS.length ? team.colorIndex : -1,
      dropPoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
      uniques: 0,
      dropCount: 0,
      bonuses: [],
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
    });
  }

  /** How many of each item a team has logged so far: `${team}::${itemKey}`. */
  const seenCount = new Map<string, number>();
  const claims: ClaimMap = new Map();
  const feed: FeedEntry[] = [];

  /* --- drops ---------------------------------------------------------------- */

  for (const drop of orderDrops(drops, hasTimestamps)) {
    const player = roster.resolve(drop.user);
    if (!player) {
      warnings.push({
        kind: "unknownPlayer",
        tab: tabs.drops,
        row: drop.row,
        value: drop.user,
        message: `"${drop.user}" is not on any roster. Add the RSN to the roster cell for that player (separated by a "/") and this drop will score.`,
      });
      continue;
    }

    // The roster is authoritative for team membership: it is edited once, before
    // the event, while the drop log's Team column is typed on every row.
    const team = player.team;
    if (drop.team !== "" && roster.resolveTeam(drop.team) !== team) {
      warnings.push({
        kind: "teamMismatch",
        tab: tabs.drops,
        row: drop.row,
        value: drop.team,
        message: `Row says team "${drop.team}" but ${player.displayName} is on ${team} in the roster. Scored for ${team}.`,
      });
    }

    const entry = catalog.byKey.get(catalogKey(drop.boss, drop.drop));
    if (!entry) {
      const known = catalog.byCategory.has(drop.boss);
      warnings.push({
        kind: known ? "unknownItem" : "bossNotInCatalog",
        tab: tabs.drops,
        row: drop.row,
        value: `${drop.boss} — ${drop.drop}`,
        message: known
          ? `"${drop.drop}" is not a scoreable item at ${drop.boss}. Check the spelling against the item catalog.`
          : `"${drop.boss}" is not a category in the item catalog, so "${drop.drop}" could not be scored.`,
      });
      continue;
    }

    const teamScore = teamScores.get(team);
    const playerScore = playerScores.get(player.id);
    if (!teamScore || !playerScore) {
      // Only reachable if the roster is internally inconsistent.
      warnings.push({
        kind: "unknownTeam",
        tab: tabs.drops,
        row: drop.row,
        value: team,
        message: `Team "${team}" is on the roster but has no leaderboard entry; this drop was not scored.`,
      });
      continue;
    }

    const countKey = `${team}::${entry.key}`;
    const already = seenCount.get(countKey) ?? 0;
    seenCount.set(countKey, already + 1);

    const multiplier = already < entry.fullPointsLimit ? 1 : 0.5;
    const points = entry.points * multiplier;

    teamScore.dropPoints += points;
    teamScore.dropCount += 1;
    teamUniques.get(team)?.add(entry.key);

    playerScore.points += points;
    playerScore.dropCount += 1;

    const claimed = claims.get(entry.key);
    if (claimed) {
      if (!claimed.includes(team)) claimed.push(team);
    } else {
      claims.set(entry.key, [team]);
    }

    feed.push({
      id: `${drop.row}-${entry.key}`,
      row: drop.row,
      team,
      player: player.displayName,
      rsn: drop.user,
      boss: entry.category,
      item: entry.item,
      basePoints: entry.points,
      multiplier,
      points,
      halfPoints: multiplier < 1,
      timestamp: drop.timestamp,
    });
  }

  /* --- bonuses -------------------------------------------------------------- */

  // The catalog's Misc. and Team Challenges sections already list every bonus
  // and what it is worth, so the bonus tab does not have to repeat the points —
  // a blank points cell falls back to the catalog value.
  const catalogBonusPoints = new Map<string, number>();
  for (const entry of catalog.bonusEntries) {
    catalogBonusPoints.set(normalize(entry.item), entry.points);
  }

  const recognised = new Set([
    ...catalogBonusPoints.keys(),
    ...bonusTypes.map(normalize),
  ]);

  for (const bonus of bonuses) {
    const teamName = roster.resolveTeam(bonus.team);
    const teamScore = teamName ? teamScores.get(teamName) : undefined;

    if (!teamScore) {
      warnings.push({
        kind: "unknownTeam",
        tab: tabs.bonus,
        row: bonus.row,
        value: bonus.team,
        message: `"${bonus.team}" does not match any team name on the roster, so this bonus was not awarded.`,
      });
      continue;
    }

    const typeKey = normalize(bonus.bonusType);
    const points = bonus.points ?? catalogBonusPoints.get(typeKey) ?? null;

    if (points === null) {
      warnings.push({
        kind: "unparsedNumber",
        tab: tabs.bonus,
        row: bonus.row,
        value: bonus.bonusType,
        message: `Bonus "${bonus.bonusType}" for ${teamScore.name} has no points value, and none could be found in the item catalog, so it was not awarded.`,
      });
      continue;
    }

    const isKnownType = recognised.has(typeKey);
    if (!isKnownType) {
      // Awarded anyway. A typo in bonus_type must never silently cost a team
      // points that were already decided by staff.
      warnings.push({
        kind: "unknownBonusType",
        tab: tabs.bonus,
        row: bonus.row,
        value: bonus.bonusType,
        message: `"${bonus.bonusType}" is not listed under Misc. or Team Challenges in the item catalog. The ${points} points were still awarded to ${teamScore.name}.`,
      });
    }

    const awarded: AwardedBonus = {
      team: teamScore.name,
      bonusType: bonus.bonusType,
      points,
      awardedAt: bonus.awardedAt,
      notes: bonus.notes,
      recognisedType: isKnownType,
    };
    teamScore.bonuses.push(awarded);
    teamScore.bonusPoints += points;
  }

  /* --- totals and ordering -------------------------------------------------- */

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

  // Newest first. Feed order mirrors the scoring order, so reversing it is
  // correct whether ordering came from timestamps or row order.
  feed.reverse();

  return {
    teams,
    players,
    feed,
    claims,
    warnings,
    ordering: hasTimestamps ? "timestamp" : "rowOrder",
  };
}
