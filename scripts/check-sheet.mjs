/**
 * Sheet connectivity check.
 *
 *   npm run check-sheet
 *
 * Reads .env.local, fetches every tab the site needs, and reports exactly what
 * came back — status, whether it was CSV, the header row, and a row count. Use
 * it to confirm the sheet is reachable before wondering why the site is empty.
 *
 * Deliberately dependency-free and independent of the app's own code, so it
 * still works when the app does not.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_TABS = {
  TAB_DROPS: "DROPS",
  TAB_BINGO: "BINGO",
  TAB_TEAMS: "TEAMS",
  TAB_RULES: "RULES",
};

const RESET = "[0m";
const paint = (code, text) => `[${code}m${text}${RESET}`;
const red = (text) => paint("31", text);
const green = (text) => paint("32", text);
const yellow = (text) => paint("33", text);
const dim = (text) => paint("2", text);

function loadEnvLocal() {
  const env = {};
  for (const file of [".env.local", ".env"]) {
    let contents;
    try {
      contents = readFileSync(resolve(process.cwd(), file), "utf8");
    } catch {
      continue;
    }
    for (const line of contents.split(/\r?\n/)) {
      const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i.exec(line);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (!(match[1] in env)) env[match[1]] = value;
    }
  }
  return { ...env, ...process.env };
}

const env = loadEnvLocal();
const sheetId = env.SHEET_ID?.trim();
const base = (env.SHEET_BASE_URL?.trim() || "https://docs.google.com").replace(
  /\/+$/,
  "",
);

if (!sheetId) {
  console.error(red("SHEET_ID is not set."));
  console.error("Add it to .env.local:\n\n  SHEET_ID=<the id from the sheet URL>\n");
  process.exit(1);
}

console.log(`Sheet ${dim(sheetId)}`);
if (base !== "https://docs.google.com") console.log(`Base  ${dim(base)}`);
console.log("");

let failures = 0;
let sawAuthFailure = false;

for (const [key, fallback] of Object.entries(DEFAULT_TABS)) {
  const tab = env[key]?.trim() || fallback;
  const url =
    `${base}/spreadsheets/d/${encodeURIComponent(sheetId)}` +
    `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

  let response;
  try {
    response = await fetch(url, { headers: { accept: "text/csv,*/*" } });
  } catch (error) {
    failures += 1;
    console.log(`${red("FAIL")} ${tab.padEnd(8)} could not reach ${base} (${error.message})`);
    continue;
  }

  if (!response.ok) {
    failures += 1;
    if (response.status === 401 || response.status === 403) sawAuthFailure = true;
    console.log(`${red("FAIL")} ${tab.padEnd(8)} HTTP ${response.status}`);
    continue;
  }

  const text = await response.text();
  const head = text.slice(0, 200).trimStart().toLowerCase();

  if (head.startsWith("<") || head.startsWith("/*o_o*/") || head.startsWith("google.visualization")) {
    failures += 1;
    console.log(
      `${red("FAIL")} ${tab.padEnd(8)} responded with HTML/JS, not CSV — there is probably no tab named exactly "${tab}"`,
    );
    continue;
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const header = (lines[0] ?? "").slice(0, 110);
  const label = lines.length <= 1 ? yellow("EMPTY") : green(" OK ");

  console.log(`${label} ${tab.padEnd(8)} ${lines.length - 1} data row(s)`);
  console.log(`       ${dim(header)}`);
}

console.log("");

if (sawAuthFailure) {
  console.log(red("The sheet is not readable without signing in."));
  console.log("");
  console.log("Publishing to the web is a separate setting and does not fix this on its own.");
  console.log("In the sheet: Share → General access → " + yellow('"Anyone with the link"') + " → Viewer.");
  console.log("");
  process.exit(1);
}

if (failures > 0) {
  console.log(red(`${failures} tab(s) could not be read.`));
  console.log("Tab names are case-sensitive. Override them in .env.local with TAB_DROPS, TAB_BINGO, and so on.");
  process.exit(1);
}

console.log(green("All tabs readable."));
