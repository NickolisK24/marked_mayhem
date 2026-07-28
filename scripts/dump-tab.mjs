/**
 * Print the raw rows of a tab, cell by cell.
 *
 *   npm run dump-tab BINGO
 *   npm run dump-tab BINGO 60        # first 60 rows (default 40)
 *   npm run dump-tab TEAMS
 *
 * Shows exactly what the site sees, with column letters and empty cells made
 * visible, so a layout question can be settled by pasting the output rather
 * than describing the sheet.
 *
 * Dependency-free and independent of the app's own parsing code.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RESET = "[0m";
const dim = (text) => `[2m${text}${RESET}`;
const cyan = (text) => `[36m${text}${RESET}`;

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

/** Minimal RFC 4180 parser — the app has its own; this stays standalone. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const columnLetter = (index) => {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
};

const env = loadEnvLocal();
const sheetId = env.SHEET_ID?.trim();
const base = (env.SHEET_BASE_URL?.trim() || "https://docs.google.com").replace(/\/+$/, "");

const tab = process.argv[2];
const limit = Number(process.argv[3] ?? 40);

if (!sheetId) {
  console.error("SHEET_ID is not set. Add it to .env.local.");
  process.exit(1);
}
if (!tab) {
  console.error("Usage: npm run dump-tab <TAB NAME> [rows]");
  console.error("   eg: npm run dump-tab BINGO 60");
  process.exit(1);
}

const url =
  `${base}/spreadsheets/d/${encodeURIComponent(sheetId)}` +
  `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

const response = await fetch(url, { headers: { accept: "text/csv,*/*" } });

if (!response.ok) {
  console.error(`HTTP ${response.status} fetching "${tab}".`);
  if (response.status === 401 || response.status === 403) {
    console.error('Set Share → General access → "Anyone with the link" → Viewer.');
  }
  process.exit(1);
}

const text = await response.text();
if (text.trimStart().startsWith("<")) {
  console.error(`"${tab}" returned HTML, not CSV — there is probably no tab with that exact name.`);
  process.exit(1);
}

const rows = parseCsv(text);
console.log(`${tab}: ${rows.length} row(s) total, showing first ${Math.min(limit, rows.length)}\n`);

rows.slice(0, limit).forEach((row, index) => {
  const label = cyan(String(index + 1).padStart(4));
  const cells = row
    .map((cell, at) => {
      const value = cell.trim();
      return value === "" ? dim(`${columnLetter(at)}:·`) : `${dim(columnLetter(at) + ":")}${value}`;
    })
    .join("  ");
  console.log(`${label}  ${cells}`);
});
