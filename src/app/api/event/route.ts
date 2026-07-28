/**
 * GET /api/event — the whole site's data in one typed payload.
 *
 * Failure policy, in priority order:
 *
 *   1. Never throw. A 500 here is a white screen on someone's phone.
 *   2. Never show wrong data. If the catalog or the roster cannot be read, the
 *      last good snapshot is served with `stale: true` rather than a leaderboard
 *      computed from half a sheet.
 *   3. Always name the tab. Every failure carries the tab name and what is wrong
 *      with it, so a non-technical clan member can go fix it.
 */

import { REVALIDATE_SECONDS, tabConfig } from "@/config/event";
import { buildPayload } from "@/lib/payload";
import { fetchTab } from "@/lib/sheet";
import type { EventPayload, TabError } from "@/lib/types";

/**
 * Next.js requires this to be a literal it can read statically, so it cannot be
 * `REVALIDATE_SECONDS` directly. The assignment below fails to compile if the
 * two ever drift apart.
 */
export const revalidate = 30;

const _revalidateMatchesConfig: typeof revalidate = REVALIDATE_SECONDS;
void _revalidateMatchesConfig;

/**
 * Last successfully-computed payload, kept in module scope so a failed refresh
 * can still answer with something. This is a best-effort cache: serverless
 * instances come and go, and losing it only means the next request rebuilds.
 */
let lastGood: EventPayload | null = null;

export async function GET() {
  const sheetId = process.env.SHEET_ID?.trim();
  const tabs = tabConfig();
  const now = Date.now();

  if (!sheetId) {
    return json(
      staleOr({
        tab: "configuration",
        problem:
          "SHEET_ID is not set. Add it to .env.local locally, or to the project's environment variables in Vercel.",
      }),
    );
  }

  const [drops, bingo, teams, rules] = await Promise.all([
    fetchTab(sheetId, tabs.drops),
    fetchTab(sheetId, tabs.bingo),
    fetchTab(sheetId, tabs.teams),
    fetchTab(sheetId, tabs.rules),
  ]);

  const tabErrors: TabError[] = [];
  for (const result of [drops, bingo, teams, rules]) {
    if (!result.ok) tabErrors.push({ tab: result.tab, problem: result.problem });
  }

  // The catalog and the roster are load-bearing: without them every drop is
  // unscoreable and every team is unknown, which would render as a site-wide
  // zero rather than as an error. Stale data is the honest answer there.
  if (!bingo.ok || !teams.ok) {
    return json(staleOr(...tabErrors));
  }

  try {
    const payload = buildPayload(
      {
        drops: drops.ok ? drops.text : null,
        bingo: bingo.text,
        teams: teams.text,
        rules: rules.ok ? rules.text : null,
      },
      tabs,
      tabErrors,
      now,
    );

    lastGood = payload;
    return json(payload);
  } catch (error) {
    // Defensive: the parsers are written not to throw, but a payload built from
    // a sheet nobody has seen yet is exactly where an unexpected shape shows up.
    return json(
      staleOr(...tabErrors, {
        tab: "scoring",
        problem: `Unexpected error while scoring: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  }
}

/** Serve the last good payload with the new errors attached, or an empty one. */
function staleOr(...tabErrors: TabError[]): EventPayload {
  if (lastGood) {
    return { ...lastGood, tabErrors, stale: true };
  }
  return {
    generatedAt: Date.now(),
    eventName: "Marked Mayhem",
    eventStart: null,
    eventEnd: null,
    teams: [],
    players: [],
    rules: [],
    rosters: [],
    warnings: [],
    tabErrors,
    ordering: "rowOrder",
    stale: true,
  };
}

function json(payload: EventPayload) {
  return Response.json(payload, {
    headers: {
      // The client polls on its own schedule; let the CDN hold a copy for the
      // same window the server cache uses.
      "cache-control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=300`,
    },
  });
}
