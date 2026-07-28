/**
 * Event-wide configuration. Everything a clan admin might need to change
 * between events lives here or in the environment, not scattered through the UI.
 */

export const EVENT_NAME = "Marked Mayhem";

/**
 * Event end, used for the countdown in the header.
 *
 * TODO(nickolis): set the real end date. Until this is a valid future date the
 * header shows "end date TBD" instead of a countdown — it never renders a
 * negative or NaN timer.
 *
 * Format: ISO 8601 with an explicit offset, e.g. "2026-08-15T23:59:59-04:00".
 */
export const EVENT_END: string | null = null;

/**
 * Team colours are defined here, never read from the sheet — a staff member
 * editing a cell must not be able to change the site's palette.
 *
 * Assigned to teams by their order in the TEAMS tab. Four distinct hues chosen
 * for contrast against the near-black background.
 */
export const TEAM_COLORS = [
  { name: "gold", hex: "#f0b429", soft: "rgba(240, 180, 41, 0.16)" },
  { name: "cyan", hex: "#38bdf8", soft: "rgba(56, 189, 248, 0.16)" },
  { name: "rose", hex: "#fb7185", soft: "rgba(251, 113, 133, 0.16)" },
  { name: "emerald", hex: "#34d399", soft: "rgba(52, 211, 153, 0.16)" },
] as const;

export const FALLBACK_TEAM_COLOR = {
  name: "slate",
  hex: "#94a3b8",
  soft: "rgba(148, 163, 184, 0.16)",
};

/**
 * BINGO categories that are NOT bosses. These hold manually-awarded bonuses and
 * are excluded from the drop-join path entirely — a DROPS row referencing one is
 * a mistake and gets surfaced as a warning.
 */
export const BONUS_CATEGORIES = ["Misc.", "Misc", "Team Challenges"];

/** How many entries the live feed shows. */
export const FEED_LIMIT = 50;

/** Seconds between client polls, and the server-side cache window. */
export const REVALIDATE_SECONDS = 30;

/**
 * Recognised values for the bonus tab's `bonus_type` column. An unrecognised
 * type still awards its points — it is flagged, not dropped, so a typo can
 * never silently zero a team's bonus.
 */
export const BONUS_TYPES = [
  "Boss Pets",
  "Jars",
  "Bounty 1st",
  "Bounty 2nd",
  "Bounty 3rd",
  "Most Team Profit",
  "Most Team Uniques",
  "Team Challenge 1st",
  "Team Challenge 2nd",
  "Team Challenge 3rd",
  "Team Participation",
];

export interface TabConfig {
  drops: string;
  bingo: string;
  teams: string;
  rules: string;
  bonus: string;
}

export function tabConfig(env: NodeJS.ProcessEnv = process.env): TabConfig {
  return {
    drops: env.TAB_DROPS?.trim() || "DROPS",
    bingo: env.TAB_BINGO?.trim() || "BINGO",
    teams: env.TAB_TEAMS?.trim() || "TEAMS",
    rules: env.TAB_RULES?.trim() || "RULES",
    bonus: env.TAB_BONUS?.trim() || "BONUS",
  };
}
