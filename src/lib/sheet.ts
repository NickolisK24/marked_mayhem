/**
 * The only module that touches the network.
 *
 * Each tab is fetched independently so one broken or renamed tab degrades into a
 * named error banner instead of taking the whole payload down.
 */

import { REVALIDATE_SECONDS } from "@/config/event";
import { looksLikeCsv } from "./csv";

export type TabFetch =
  | { ok: true; tab: string; text: string }
  | { ok: false; tab: string; problem: string };

/**
 * Google's host, overridable via SHEET_BASE_URL so the site can be pointed at a
 * local fixture server for testing without publishing a sheet. Unset in
 * production, where it falls back to Google.
 */
export function sheetBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.SHEET_BASE_URL?.trim() || "https://docs.google.com").replace(
    /\/+$/,
    "",
  );
}

export function tabUrl(sheetId: string, tab: string, base?: string): string {
  return (
    `${base ?? sheetBaseUrl()}/spreadsheets/d/${encodeURIComponent(sheetId)}` +
    `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
  );
}

/**
 * Turn an HTTP status into something a clan admin can act on.
 *
 * The important one is 401/403. "Publish to web" and link sharing are two
 * separate switches in Google Sheets, and the gviz endpoint this app uses
 * checks the *sharing* one: publishing makes /pub?output=csv work while
 * /gviz/tq still answers 401. Saying "check the sheet is published" to someone
 * who has just published it sends them round in circles.
 */
export function describeHttpStatus(status: number, tab: string): string {
  if (status === 401 || status === 403) {
    return (
      "The sheet is not readable without signing in. Publishing to the web is " +
      "not enough on its own — open Share → General access and set " +
      '"Anyone with the link" to Viewer.'
    );
  }
  if (status === 404) {
    return `Not found (HTTP 404). Check the SHEET_ID, and that the tab is named exactly "${tab}".`;
  }
  if (status === 400) {
    return `Google Sheets rejected the request (HTTP 400). This usually means there is no tab named exactly "${tab}".`;
  }
  if (status === 429) {
    return "Google Sheets is rate limiting the site (HTTP 429). It should recover on its own.";
  }
  if (status >= 500) {
    return `Google Sheets is having trouble (HTTP ${status}). This is on their end and usually clears up.`;
  }
  return `Google Sheets returned HTTP ${status}.`;
}

export async function fetchTab(
  sheetId: string,
  tab: string,
): Promise<TabFetch> {
  let response: Response;

  try {
    response = await fetch(tabUrl(sheetId, tab), {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { accept: "text/csv,*/*" },
    });
  } catch (error) {
    return {
      ok: false,
      tab,
      problem: `Could not reach Google Sheets (${error instanceof Error ? error.message : "network error"}).`,
    };
  }

  if (!response.ok) {
    return { ok: false, tab, problem: describeHttpStatus(response.status, tab) };
  }

  const text = await response.text();

  // gviz answers an unknown tab with 200 and an HTML page or a JS callback, so
  // the status code alone is not enough.
  if (!looksLikeCsv(text)) {
    return {
      ok: false,
      tab,
      problem: `Response was not CSV. The tab "${tab}" probably does not exist — check it is named exactly "${tab}", including capitalisation.`,
    };
  }

  if (text.trim() === "") {
    return { ok: false, tab, problem: "Tab is empty." };
  }

  return { ok: true, tab, text };
}
