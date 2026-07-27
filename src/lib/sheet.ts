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
    return {
      ok: false,
      tab,
      problem:
        response.status === 404
          ? `Tab not found (HTTP 404). Check the tab is named exactly "${tab}".`
          : `Google Sheets returned HTTP ${response.status}. Check the sheet is published to the web.`,
    };
  }

  const text = await response.text();

  // gviz answers an unknown tab or an unpublished sheet with 200 and an HTML
  // page or a JS callback, so the status code alone is not enough.
  if (!looksLikeCsv(text)) {
    return {
      ok: false,
      tab,
      problem: `Response was not CSV. The tab "${tab}" probably does not exist, or the sheet is not published to the web (File → Share → Publish to web).`,
    };
  }

  if (text.trim() === "") {
    return { ok: false, tab, problem: "Tab is empty." };
  }

  return { ok: true, tab, text };
}
