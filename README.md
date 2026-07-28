# Marked Mayhem

Live team standings for the Marked Mayhem OSRS clan event — a points-based drop
competition between four teams, driven directly from the event's Google Sheet.

Next.js (App Router) + TypeScript + Tailwind. No database, no auth, no build
step beyond `next build`. One server-side API route reads the sheet, recomputes
every score from the item catalog, and returns a single typed payload that the
page polls every 30 seconds.

- **Staff documentation:** [`SHEET_FORMAT.md`](./SHEET_FORMAT.md) — the exact
  tab and column expectations, written to be handed to whoever maintains the
  sheet.

---

## Local setup

Windows / PowerShell. Node 20 or newer.

```powershell
git clone https://github.com/NickolisK24/marked_mayhem.git
cd marked_mayhem
npm install
```

Create `.env.local` in the project root:

```
SHEET_ID=1rCXkWU1UkD8c43_X7bJf77go8yjUuitK9pYc-ASJLBE
```

Then:

```powershell
npm run dev
```

Open http://localhost:3000.

### Optional environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `SHEET_ID` | — | **Required.** The sheet's ID, from its URL. |
| `TAB_DROPS` | `DROPS` | Tab name for the live drop log. |
| `TAB_BINGO` | `BINGO` | Tab name for the item catalog. |
| `TAB_TEAMS` | `TEAMS` | Tab name for the rosters. |
| `TAB_RULES` | `RULES` | Tab name for the rules text. |
| `SHEET_BASE_URL` | `https://docs.google.com` | Override for testing against a local fixture server. Leave unset in production. |

The tab names are environment variables so that a tab renamed mid-event can be
fixed by changing a Vercel setting and redeploying, rather than editing code.

`.env.example` has all of these ready to copy.

---

## Making the sheet readable

The site reads the sheet as CSV over the `gviz` endpoint, which serves any
sheet that is **viewable without signing in**.

**Share → General access → "Anyone with the link" → Viewer.**

That is the setting that matters. **"Publish to web" is a different switch and
does not replace it** — publishing enables the `/pub?output=csv` URLs, while
`/gviz/tq` still answers `HTTP 401` until link sharing is on. If every tab is
failing with 401, this is why. Publishing as well does no harm and is not
required.

### Checking it

```powershell
npm run check-sheet
```

Reads `.env.local`, fetches every tab, and reports the status, the header row
and a row count for each — plus what to do about anything that failed. Run it
before wondering why the site is empty.

To check one tab by hand (note `curl.exe`, not PowerShell's `curl` alias):

```powershell
curl.exe -sS "https://docs.google.com/spreadsheets/d/$env:SHEET_ID/gviz/tq?tqx=out:csv&sheet=BINGO"
```

CSV means it worked. HTML means either the sheet needs link sharing or the tab
name is wrong; the site distinguishes the two in its error banner.

### Before the event starts

- The event window is set in `src/config/event.ts` (`EVENT_START` and
  `EVENT_END`), currently 30 July 2026 17:00 to 9 August 2026 17:00 US Eastern.
  The header counts down to the start before the event, to the end during it,
  and reads "event over" afterwards.

---

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project**, and import the repository. The framework
   is detected automatically; no build settings need changing.
3. Under **Settings → Environment Variables**, add `SHEET_ID` for the
   Production, Preview and Development environments. Add the `TAB_*` variables
   too if any tab is not named as above.
4. **Deploy**.

The API route revalidates every 30 seconds, so a sheet edit appears on the site
within about a minute regardless of how many people have it open — Google is hit
about twice a minute in total, not once per visitor.

Changing an environment variable requires a redeploy to take effect
(**Deployments → ⋯ → Redeploy**).

---

## How scoring works

Scoring is recomputed from scratch in `src/lib/scoring.ts`. The sheet's own
`Points Earned`, `Multiplier`, `Full Points`, `# Seen`, `# from Team` and
`# for Full Points` columns are **not read** — those formulas are partly broken,
and a scoring path that reads them cannot be tested.

`Bonus` and `Price` (column H) are the exceptions. Bonus points are typed in by
an event manager, and Price is the drop log's own accumulated GP value; neither
is a score to recompute, so both are read as given.

For each drop, in chronological order within a team:

1. The item is looked up in the catalog by **boss + item**, not item alone — the
   same item is worth different points at different bosses.
2. The team's first of that item scores full points; every later one scores
   **half**, with no ceiling.
3. An item whose catalog name ends in `(Limit N)` is capped per team instead:
   all N score **full** points — there is no half tier for these — and past N
   it scores nothing. A team's five `Infernal Cape (Limit 5)` drops are worth
   60 each, 300 in total, and cape six is worth 0. The suffix is stripped from
   the name before anything is matched or displayed, so the drop log's plain
   `Infernal Cape` still joins to it.
4. Anything in the row's `Bonus` column is added to that team's bonus points.
   That column is typed in by event managers, so it is read as given rather
   than recomputed.
5. `Misc.` and `Team Challenges` are ordinary catalog categories, scored from
   their catalog points like any boss drop. Because a team wins them rather
   than a person, their rows carry no `User` and are exempt from the
   rostered-player requirement; with nobody named, the team scores and no
   player does. They are unrelated to the `Bonus` column.

Team totals carry drop points and bonus points separately, and the leaderboard
shows the split. Player totals cover drops only — a bonus belongs to a team, not
to an individual. Because the quantity limit is a team-level resource, a player
who is second for their team gets the half.

### Drop ordering

`DROPS` has no `Timestamp` column — submissions are accepted by hand and nobody
is going to record when each one happened — so drops are ordered by row
position. That is chronological as long as rows are appended rather than
inserted.

Ordering is cheaper than it looks. Exactly N of an item score full points
whichever N they are, so **every team total is identical under any ordering**;
an inserted row cannot move the leaderboard. It can only change which player is
credited with the full points versus the half. `tests/scoring.test.ts` pins this
down by scoring every permutation of a mixed fixture and asserting the team
total never moves — and, separately, that player attribution does.

If a `Timestamp` column is ever added, ordering switches to it automatically.

---

## Robustness

The site is built on the assumption that the sheet will break mid-event.

| What breaks | What happens |
| --- | --- |
| A tab is renamed or deleted | Error banner naming that tab and the problem; last good data stays on screen |
| Sheet sharing is turned off | Error banner naming the exact sharing setting to restore |
| A required column is removed | Error banner naming the tab and the missing columns |
| A drop references an unknown item, boss, or RSN | That row is skipped and listed in the dismissible warnings panel |
| A cell contains `#REF!`, `#N/A`, `$0`, or `40,331,957` | Parsed correctly; broken numbers become "missing", never a silent zero |
| A drop has no `Price` | Shown as a dash in the breakdown, not as 0 GP |
| A `Price` cell is a custom formula still showing `Loading...` | Counted and reported once in the warnings panel, with the fix; never guessed at |
| The catalog has no price or quantity-limit column | Neither is required; GP is not tracked and limits default to 1 |
| Google is unreachable | Last loaded data stays on screen with a "couldn't refresh" indicator |
| Blank rows in the drop log | Skipped silently — they are the norm, not an error |
| First paint | Loading skeletons, never a blank page |

There is deliberately **no** fuzzy matching on item or player names. A wrong
silent match moves points between teams without anyone noticing; an unmatched
row appears in the warnings panel and gets fixed in the sheet in half a minute.

---

## Development

```powershell
npm run dev        # dev server
npm run build      # production build
npm test           # unit tests
npm run typecheck  # tsc --noEmit
```

### Tests

```
tests/csv.test.ts       CSV parsing, header mapping, numeric parsing
tests/aliases.test.ts   RSN alias resolution and roster parsing
tests/scoring.test.ts   the scoring function
tests/payload.test.ts   the assembled API payload
tests/format.test.ts    points, relative time and the event-window countdown
```

The negative fixtures matter as much as the positive ones: missing columns,
blank rows, `#REF!` cells, comma-formatted numbers, an unknown RSN, an unknown
item, a bonus with nobody to award it to, a team award in neither the catalog
nor the `Bonus` column, a team with zero drops, and a
duplicate item crossing its quantity limit mid-sequence.

### Testing without the real sheet

`SHEET_BASE_URL` points the fetch layer at any host that answers the gviz URL
shape, so the whole stack can be exercised against local fixture CSVs:

```powershell
$env:SHEET_ID = "mock"
$env:SHEET_BASE_URL = "http://127.0.0.1:4545"
npm run dev
```

### Code layout

```
src/config/event.ts    event name, event window, team colours, team-award categories, tab names
src/lib/               parsing and scoring — pure, no React, no I/O except sheet.ts
  csv.ts               CSV parsing and header mapping
  numbers.ts           numeric and timestamp parsing
  text.ts              normalization used for every key comparison
  aliases.ts           RSN -> player resolution
  catalog.ts           the BINGO tab
  roster.ts            the TEAMS tab
  drops.ts             the DROPS tab
  rules.ts             the RULES tab
  scoring.ts           the scoring function — pure, fully tested
  sheet.ts             the only module that fetches
  payload.ts           assembles the API payload
src/app/api/event/     the single API route
src/components/        presentation
```

Parsing, scoring and presentation are kept separate: `src/lib` never imports
React, and the components never do arithmetic.
