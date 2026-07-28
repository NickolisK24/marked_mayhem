/**
 * Assembles the single JSON payload the client renders.
 *
 * Pure: it takes already-fetched tab text and returns the payload, so the whole
 * pipeline can be exercised in tests without a network. `route.ts` does the
 * fetching and the stale-snapshot bookkeeping.
 */

import {
  EVENT_END,
  EVENT_NAME,
  EVENT_START,
  type TabConfig,
} from "@/config/event";
import { BINGO_COLUMNS, buildCatalog } from "./catalog";
import { parseTable } from "./csv";
import { DROPS_COLUMNS, parseDrops } from "./drops";
import { buildRoster } from "./roster";
import { parseRules } from "./rules";
import { scoreEvent } from "./scoring";
import type { EventPayload, RosterTeam, TabError, Warning } from "./types";

export interface TabTexts {
  drops: string | null;
  bingo: string | null;
  teams: string | null;
  rules: string | null;
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

  /* --- score ------------------------------------------------------------- */

  const scores = scoreEvent({
    drops,
    catalog,
    roster,
    dropsTab: tabs.drops,
    hasTimestamps,
  });
  warnings.push(...scores.warnings);

  /* --- presentation shapes ----------------------------------------------- */

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
    eventStart: EVENT_START,
    eventEnd: EVENT_END,
    teams: scores.teams,
    players: scores.players,
    rules: texts.rules === null ? [] : parseRules(texts.rules),
    rosters,
    warnings,
    tabErrors: errors,
    ordering: scores.ordering,
    stale: false,
  };
}
