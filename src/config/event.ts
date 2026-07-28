/**
 * Event-wide configuration. Everything a clan admin might need to change
 * between events lives here or in the environment, not scattered through the UI.
 */

export const EVENT_NAME = "Marked Mayhem";

/**
 * The event window.
 *
 * ISO 8601 with an explicit offset — never a bare local time, which would mean
 * something different to every phone that opens the site. `-04:00` is US
 * Eastern daylight time, which both dates fall inside.
 *
 * The header counts down to the start before the event, to the end during it,
 * and reads "event over" afterwards. Setting either to null degrades to a
 * "TBD" label rather than a negative or NaN timer.
 */
export const EVENT_START: string | null = "2026-07-30T17:00:00-04:00";
export const EVENT_END: string | null = "2026-08-09T17:00:00-04:00";

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

/**
 * Items whose scoring is capped per team.
 *
 * The general rule has no ceiling: a team's first of an item scores full points
 * and every later one scores half, however many they bring in. These items are
 * the exception — past the cap they score **nothing**.
 *
 * Matched on the item name after normalisation, across every boss, so a cap
 * does not have to name the boss the item drops from. A cap that matches no
 * catalog item is reported in the warnings panel rather than silently doing
 * nothing, since a typo here would let capped items keep scoring.
 */
export const ITEM_SCORING_CAPS: ReadonlyArray<{ item: string; cap: number }> = [
  // First cape scores full, capes 2-5 score half, capes 6+ score nothing.
  { item: "Infernal cape", cap: 5 },
];

/** Seconds between client polls, and the server-side cache window. */
export const REVALIDATE_SECONDS = 30;

export interface TabConfig {
  drops: string;
  bingo: string;
  teams: string;
  rules: string;
}

export function tabConfig(env: NodeJS.ProcessEnv = process.env): TabConfig {
  return {
    drops: env.TAB_DROPS?.trim() || "DROPS",
    bingo: env.TAB_BINGO?.trim() || "BINGO",
    teams: env.TAB_TEAMS?.trim() || "TEAMS",
    rules: env.TAB_RULES?.trim() || "RULES",
  };
}
