/**
 * The TEAMS tab: four teams, thirteen players each, with an EHB bracket per
 * player.
 *
 * Two layouts are supported, because clan sheets are built either way and the
 * site should not break if the tab is rebuilt in the other shape:
 *
 *   Long  — one row per player, with Team / Player / EHB columns.
 *   Wide  — one column pair per team: the team name is the header of the player
 *           column, and the column immediately to its right holds the EHB
 *           bracket. This is the layout SHEET_FORMAT.md documents as the default.
 *
 * Long is tried first because its header is unambiguous.
 */

import { TEAM_COLORS } from "@/config/event";
import type { SheetTable } from "./csv";
import { buildAliasIndex, splitRsns } from "./aliases";
import { normalize, tidy } from "./text";
import type { Player, Roster, Team, Warning } from "./types";

const EHB_HEADER = /\b(ehb|bracket|tier)\b/i;
const TEAM_PREFIX = /^team\s*[:\-]?\s*/i;

export interface RosterResult {
  roster: Roster;
  warnings: Warning[];
  layout: "long" | "wide" | "none";
}

function makePlayer(
  cell: string,
  ehb: string,
  team: string,
  row: number,
): Player | null {
  const rsns = splitRsns(cell);
  if (rsns.length === 0) return null;

  const displayName = rsns[0]!;

  return {
    id: `${normalize(team)}::${normalize(displayName)}`,
    displayName,
    rsns,
    team,
    ehb: tidy(ehb),
    // Set once the team is assembled — the captain is whoever is listed first.
    isCaptain: false,
    row,
  };
}

function parseLong(table: SheetTable): Player[] | null {
  const teamCol = table.header.find((h) => normalize(h) === "team");
  const playerCol = table.header.find((h) =>
    ["player", "rsn", "name", "players", "username", "user"].includes(
      normalize(h),
    ),
  );
  if (!teamCol || !playerCol) return null;

  const ehbCol = table.header.find((h) => EHB_HEADER.test(h));
  const players: Player[] = [];

  for (const row of table.rows) {
    const team = tidy(row.get(teamCol)).replace(TEAM_PREFIX, "");
    const cell = row.get(playerCol);
    if (team === "" || tidy(cell) === "") continue;

    const player = makePlayer(
      cell,
      ehbCol ? row.get(ehbCol) : "",
      team,
      row.row,
    );
    if (player) players.push(player);
  }

  return players.length > 0 ? players : null;
}

function parseWide(table: SheetTable): Player[] | null {
  // Find the player columns: any non-empty header that is not itself an EHB
  // column. The column to its right is its EHB column when so labelled.
  const columns: Array<{ team: string; at: number; ehbAt: number | null }> = [];

  table.header.forEach((raw, at) => {
    const name = tidy(raw);
    if (name === "" || EHB_HEADER.test(name)) return;

    const nextHeader = table.header[at + 1] ?? "";
    const ehbAt = EHB_HEADER.test(nextHeader) ? at + 1 : null;
    columns.push({ team: name.replace(TEAM_PREFIX, ""), at, ehbAt });
  });

  if (columns.length === 0) return null;

  const players: Player[] = [];
  for (const row of table.rows) {
    for (const column of columns) {
      const cell = row.cells[column.at] ?? "";
      if (tidy(cell) === "") continue;

      const ehb = column.ehbAt === null ? "" : (row.cells[column.ehbAt] ?? "");
      const player = makePlayer(cell, ehb, column.team, row.row);
      if (player) players.push(player);
    }
  }

  return players.length > 0 ? players : null;
}

export function buildRoster(table: SheetTable, tab: string): RosterResult {
  const warnings: Warning[] = [];

  let layout: RosterResult["layout"] = "long";
  let players = parseLong(table);
  if (!players) {
    layout = "wide";
    players = parseWide(table);
  }
  if (!players) {
    layout = "none";
    players = [];
  }

  // Group into teams, preserving first-seen order so colour assignment is
  // stable across refreshes.
  const teamsByKey = new Map<string, Team>();
  for (const player of players) {
    const key = normalize(player.team);
    let team = teamsByKey.get(key);
    if (!team) {
      team = {
        name: player.team,
        captain: null,
        players: [],
        colorIndex: teamsByKey.size,
      };
      teamsByKey.set(key, team);
    }
    team.players.push(player);
  }

  // The captain is the first player listed under each team in the sheet. The
  // team's name is not a reliable signal — "Team Lauren" is captained by
  // "smol tiddies" — and neither is a hard-coded list of captain names, which
  // silently stops matching the moment someone changes their RSN.
  const teams = [...teamsByKey.values()];
  for (const team of teams) {
    const captain = team.players[0];
    if (!captain) continue;
    captain.isCaptain = true;
    team.captain = captain.displayName;
  }

  if (teams.length > TEAM_COLORS.length) {
    warnings.push({
      kind: "unknownTeam",
      tab,
      message: `Found ${teams.length} teams but only ${TEAM_COLORS.length} team colours are defined. Extra teams render in grey.`,
    });
  }

  const aliases = buildAliasIndex(players, tab);
  warnings.push(...aliases.warnings);

  const teamNames = new Map<string, string>();
  for (const team of teams) teamNames.set(normalize(team.name), team.name);

  return {
    layout,
    warnings,
    roster: {
      teams,
      players,
      resolve: aliases.resolve,
      resolveTeam: (team: string) => teamNames.get(normalize(team)) ?? null,
    },
  };
}
