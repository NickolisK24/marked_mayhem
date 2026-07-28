/**
 * Assembles the single JSON payload the client renders.
 *
 * Pure: it takes already-fetched tab text and returns the payload, so the whole
 * pipeline can be exercised in tests without a network. `route.ts` does the
 * fetching and the stale-snapshot bookkeeping.
 */

import {
  BONUS_TYPES,
  EVENT_END,
  EVENT_NAME,
  FEED_LIMIT,
  type TabConfig,
} from "@/config/event";
import { BONUS_COLUMNS, parseBonuses } from "./bonus";
import { BINGO_COLUMNS, buildCatalog } from "./catalog";
import { parseTable } from "./csv";
import { DROPS_COLUMNS, parseDrops } from "./drops";
import { buildRoster } from "./roster";
import { parseRules } from "./rules";
import { scoreEvent } from "./scoring";
import type {
  BossProgress,
  EventPayload,
  RosterTeam,
  TabError,
  Warning,
} from "./types";

export interface TabTexts {
  drops: string | null;
  bingo: string | null;
  teams: string | null;
  rules: string | null;
  bonus: string | null;
}

export function buildPayload(
  texts: TabTexts,
  tabs: TabConfig,
  tabErrors: TabError[],
  now: number,
): EventPayload {
  const warnings: Warning[] = [];
  const errors: TabError[] = [...tabErrors];

  /* --- catalog (BINGO) --------------------------------------------------- */

  const bingoTable = parseTable(texts.bingo ?? "", BINGO_COLUMNS);
  // A headerless catalog is read by column position instead, so its columns are
  // not "missing" — reporting them would be a permanent false alarm.
  if (
    texts.bingo !== null &&
    bingoTable.headerFound &&
    bingoTable.missingColumns.length > 0
  ) {
    errors.push({
      tab: tabs.bingo,
      problem: `Missing required column${bingoTable.missingColumns.length > 1 ? "s" : ""}: ${bingoTable.missingColumns.join(", ")}.`,
    });
  }
  const { catalog, warnings: catalogWarnings } = buildCatalog(
    bingoTable,
    tabs.bingo,
  );
  warnings.push(...catalogWarnings);

  if (texts.bingo !== null && catalog.entries.length === 0) {
    errors.push({
      tab: tabs.bingo,
      problem:
        "No scoreable items could be read. Expected a boss name on its own row, then that boss's items beneath it with their points.",
    });
  }

  // The live catalog carries no prices, so the GP columns are hidden rather
  // than showing a confident 0 for every team.
  const hasPrices = catalog.entries.some(
    (entry) => entry.price !== null && entry.price > 0,
  );

  /* --- roster (TEAMS) ---------------------------------------------------- */

  const teamsTable = parseTable(texts.teams ?? "");
  const {
    roster,
    warnings: rosterWarnings,
    layout,
  } = buildRoster(teamsTable, tabs.teams);
  warnings.push(...rosterWarnings);

  if (texts.teams !== null && layout === "none") {
    errors.push({
      tab: tabs.teams,
      problem:
        "No players could be read. Expected either a Team / Player / EHB column layout, or one column per team with an EHB column beside each.",
    });
  }

  /* --- drops ------------------------------------------------------------- */

  const dropsTable = parseTable(texts.drops ?? "", DROPS_COLUMNS);
  if (texts.drops !== null && dropsTable.missingColumns.length > 0) {
    errors.push({
      tab: tabs.drops,
      problem: `Missing required column${dropsTable.missingColumns.length > 1 ? "s" : ""}: ${dropsTable.missingColumns.join(", ")}.`,
    });
  }
  const {
    drops,
    warnings: dropWarnings,
    hasTimestamps,
  } = parseDrops(dropsTable, tabs.drops);
  warnings.push(...dropWarnings);

  /* --- bonuses ----------------------------------------------------------- */

  const bonusTable = parseTable(texts.bonus ?? "", BONUS_COLUMNS);
  if (texts.bonus !== null && bonusTable.missingColumns.length > 0) {
    errors.push({
      tab: tabs.bonus,
      problem: `Missing required column${bonusTable.missingColumns.length > 1 ? "s" : ""}: ${bonusTable.missingColumns.join(", ")}.`,
    });
  }
  const bonuses = parseBonuses(bonusTable);

  /* --- score ------------------------------------------------------------- */

  const scores = scoreEvent({
    drops,
    catalog,
    roster,
    bonuses,
    bonusTypes: BONUS_TYPES,
    tabs: { drops: tabs.drops, bonus: tabs.bonus },
    hasTimestamps,
  });
  warnings.push(...scores.warnings);

  /* --- presentation shapes ----------------------------------------------- */

  const bosses: BossProgress[] = [...catalog.byCategory.entries()]
    .map(([boss, entries]) => {
      const items = entries.map((entry) => ({
        key: entry.key,
        item: entry.item,
        points: entry.points,
        price: entry.price,
        fullPointsLimit: entry.fullPointsLimit,
        claimedBy: scores.claims.get(entry.key) ?? [],
      }));

      return {
        boss,
        items,
        totalPoints: items.reduce((sum, item) => sum + item.points, 0),
        claimedCount: items.filter((item) => item.claimedBy.length > 0).length,
      };
    })
    .sort((a, b) => a.boss.localeCompare(b.boss));

  const rosters: RosterTeam[] = roster.teams.map((team) => ({
    name: team.name,
    captain: team.captain,
    colorIndex: team.colorIndex,
    players: team.players.map((player) => ({
      displayName: player.displayName,
      rsns: player.rsns,
      ehb: player.ehb,
      isCaptain: player.isCaptain,
    })),
  }));

  return {
    generatedAt: now,
    eventName: EVENT_NAME,
    eventEnd: EVENT_END,
    teams: scores.teams,
    players: scores.players,
    feed: scores.feed.slice(0, FEED_LIMIT),
    bosses,
    bonusCatalog: catalog.bonusEntries.map((entry) => ({
      category: entry.category,
      item: entry.item,
      points: entry.points,
    })),
    rules: texts.rules === null ? [] : parseRules(texts.rules),
    rosters,
    warnings,
    tabErrors: errors,
    ordering: scores.ordering,
    hasPrices,
    stale: false,
  };
}
