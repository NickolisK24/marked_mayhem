import { FALLBACK_TEAM_COLOR, TEAM_COLORS } from "@/config/event";

export interface TeamColor {
  name: string;
  hex: string;
  soft: string;
}

export function teamColor(colorIndex: number): TeamColor {
  return TEAM_COLORS[colorIndex] ?? FALLBACK_TEAM_COLOR;
}

/**
 * Team name -> colour, so components that only know a name (the drop feed, the
 * player leaderboard) render the same colour as the leaderboard.
 */
export function teamColorMap(
  teams: Array<{ name: string; colorIndex: number }>,
): Map<string, TeamColor> {
  return new Map(teams.map((team) => [team.name, teamColor(team.colorIndex)]));
}
