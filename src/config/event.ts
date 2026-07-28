/**
 * Event-wide configuration. Everything a clan admin might need to change
 * between events lives here or in the environment, not scattered through the UI.
 */

export const EVENT_NAME = "Marked Mayhem";

/**
 * The event window.
 *
 * Both times are US Eastern, the timezone the event is run on.
 *
 * ISO 8601 with an explicit offset — never a bare local time, which would mean
 * something different to every phone that opens the site. `-04:00` is Eastern
 * *daylight* time, which both of these dates fall inside.
 *
 * Reusing this file for a later event: the offset is part of the date, not a
 * fixed property of Eastern time. An event between early November and mid-March
 * is on `-05:00`, and leaving it at `-04:00` puts the countdown an hour out.
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
 * Per-team caps on how many of an item score at all.
 *
 * All N score **full** points — there is no half tier for a capped item — and
 * past N they score nothing.
 *
 * These live here rather than being read out of the catalog because they are an
 * event rule, not a property of the sheet. The catalog can also write a cap into
 * an item's name as "(Limit 5)", and that still works, but it cannot be relied
 * on: it is ordinary cell text that anybody tidying the sheet may remove without
 * realising it is load-bearing, and when that happens the cap silently reverts
 * to full-then-half. A cap listed here holds whatever the sheet says.
 *
 * Matched on the item name alone, after normalization, so it applies wherever
 * the item appears and does not care how the boss is spelled.
 */
export const ITEM_CAPS: ReadonlyArray<{ item: string; limit: number }> = [
  { item: "Infernal Cape", limit: 5 },
  { item: "Dizana's quiver", limit: 5 },
];

/**
 * Catalog categories holding awards rather than boss drops.
 *
 * This is a presentation distinction, not a scoring one — an award scores
 * exactly like any other catalog entry. It keeps awards out of the item
 * statistics, since a team challenge is neither a unique item nor a drop, and
 * it lets a whole-team award be listed on the team card, which is the only
 * place it can appear: with no player named, no drop breakdown would show it.
 */
export const AWARD_CATEGORIES = ["Misc.", "Misc", "Team Challenges"];

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
