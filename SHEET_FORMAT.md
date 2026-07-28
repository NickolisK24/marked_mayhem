# Marked Mayhem — sheet format

This document is for clan staff maintaining the event spreadsheet. The website
reads the sheet directly, so the shapes below are what it expects.

**The short version:** the site will not break if you make a mistake. A bad row
is skipped and listed in the warnings panel; a broken tab shows an error banner
naming that tab while the rest of the site keeps working from the last good
data. But a skipped row is a row that scored nobody any points, so it is worth
checking the warnings panel now and then.

---

## Rules that apply everywhere

- **Tab names are case-sensitive and must match exactly.** They are configured
  in the site's environment (see `README.md`). If you rename a tab, tell whoever
  maintains the site.
- **Column headers must match exactly**, apart from capitalisation and extra
  spaces — `Full pts qty limit`, `FULL PTS QTY LIMIT` and `  full  pts qty limit`
  are all read as the same column. The *order* of columns does not matter, and
  extra columns are ignored.
- **Blank rows are fine.** Leave as many as you like; they are skipped silently.
- **`#REF!`, `#N/A`, `#VALUE!`, `#DIV/0!` are handled.** A broken number is
  treated as missing, never as zero.
- **Number formatting is handled.** `1,250`, `$0` and `40,331,957` all read
  correctly.
- **The sheet must be viewable by anyone with the link.** Share → General
  access → "Anyone with the link" → Viewer. *Publish to web is a separate
  setting and is not a substitute* — with publishing on but link sharing off,
  the site cannot read any tab.

---

## `BINGO` — the item catalog

This is the authoritative list of every scoreable item. If an item is not in
this tab, it cannot score.

| Column | Required | Notes |
| --- | --- | --- |
| `Category` | no | The boss name. Usually only filled on the section heading row — see below. |
| `Item` | **yes** | The item name. Must match the drop log exactly. |
| `Key` | no | `Category` + `Item`. **Not used for scoring** — see below. |
| `Points` | **yes** | Base points. **A row with an unreadable `Points` cannot be scored and is skipped.** |
| `Full pts qty limit` | no | How many of this item, per team, score full points. Defaults to 1. |

### There is no header row

The live tab has no `Category` / `Item` / `Points` header. Row 1 is the sheet
title plus the per-team scoreboard columns, rows 2-4 are running totals, and the
item data below is read **by column position**:

| Column | Holds |
| --- | --- |
| **A** | the boss name, on its own row, introducing a section |
| **B** | the item name |
| **C** | the item's points |
| D onward | the sheet's own per-team counters — **not read by the site** |

No price column is needed here — GP values come from the `Price` column of
the `DROPS` tab instead.

If a header row is added later it will be found and used instead, so either
layout works.

### The tab is read in sections

The catalog is organised as a row holding just the boss name, followed by that
boss's items:

|  | Category | Item | Points | Full pts qty limit |
| --- | --- | --- | --- | --- |
| | **Armadyl** | | | |
| | | Armadyl Chestplate | 40 | 1 |
| | | Armadyl Hilt | 80 | 1 |
| | | Any Shard | 5 | 3 |
| | | All Uniques (not shard) | 100 | 1 |
| | **Callisto** | | | |
| | | Dragon 2h sword | 60 | 1 |

Every item **inherits the boss from the heading above it**. A heading row is
recognised by having exactly one filled cell — a real item row always has at
least an item name and a points value, so a heading can never be mistaken for
an item or vice versa. It does not matter which column the boss name sits in.

A flat layout, with the boss repeated in `Category` on every row, also works.
If a row has its own `Category`, that wins over the heading above it.

An item that sits above the first heading and has no `Category` of its own
cannot be placed under a boss, so it is skipped and flagged.

The header row does not have to be row 1 — a title or a note above it is fine.

### The join key is `Category` + `Item`, not `Item`

The same item is worth different points at different bosses:

| Category | Item | Points |
| --- | --- | --- |
| Callisto | Dragon 2h sword | 60 |
| Venenatis | Dragon 2h sword | 50 |
| Vet'ion | Dragon 2h sword | 50 |
| Chaos Elemental | Dragon 2h sword | 25 |

Names like `Any Shard` and `All Uniques` also repeat across nearly every
category. So a drop is matched on **both** its boss and its item. A drop logged
at the wrong boss will not score, and will appear in the warnings panel.

### The `Key` column is not used

The site checks that `Key` equals `Category` + `Item` and warns if it does not,
but it never scores from it. Scoring always uses `Category` and `Item` directly.
This is deliberate: the concatenation format is not guaranteed stable, and a
formula error in `Key` should not be able to break scoring.

### Bonus categories

Two categories are **not** bosses:

- `Misc.` — Boss Pets, Jars, Bounty placements, Most Team Profit, Most Team
  Uniques
- `Team Challenges` — Team Challenge placements, Team Participation

These are not scoreable items. They are awarded by typing the points into the
`Bonus` column of the `DROPS` tab (see below). Their rows in `BINGO` are there
as a reference list of what each bonus is worth.

---

## `DROPS` — the live drop log

Rows are appended during the event. Only these columns are read:

| Column | Required | Notes |
| --- | --- | --- |
| `Team` | no | Cross-checked against the roster. The **roster wins** if they disagree, and the row is flagged. |
| `User` | yes | The RSN that got the drop. Any RSN on the roster works — see aliases below. |
| `Boss` | yes | Must match a `Category` in `BINGO`. |
| `Drop` | yes | Must match an `Item` in `BINGO`, **for that boss**. |
| `Price` | no | GP value of the item, column **H**. See below. |
| `Bonus` | no | Manually-awarded points. See below. |
| `Timestamp` | no | Optional. See below. |

### Bonus points

`Bonus` is the one number the site takes from this tab as written, because it is
typed in by an event manager rather than calculated. Whatever is in it is added
to that row's team, on top of anything the row's item scores.

A bonus row does **not** need a boss or an item — a row with just a team and a
bonus is perfectly valid:

| Team | User | Boss | Drop | Bonus |
| --- | --- | --- | --- | --- |
| Lauren | smol tiddies | Callisto | Dragon 2h sword | |
| Lauren | | | | 250 |
| Oops | Oops Im Main | | | 400 |

Bonus points show separately from drop points on the team leaderboard and both
add into the team total. They are **not** added to individual player totals — a
bonus belongs to the team.

A bonus row needs either a `Team` or a `User` so the site knows who to award it
to; a row with neither is flagged. A blank, zero or `#REF!` bonus is simply
ignored, not warned about.

Note that an **item** drop still needs a `User` that is on the roster — a team
name alone is not enough for one. That is deliberate: crediting an item on the
strength of a hand-typed team cell would move points without anyone noticing.

### The `Price` column

The GP value the sheet accumulates in column **H** is shown against each item in
a player's drop breakdown, and summed into that player's total value. It is read
by the header name `Price` when one exists, and otherwise from column H by
position.

A blank or broken `Price` shows as a dash rather than as 0 GP, so an unpriced
item is never mistaken for a worthless one.

#### Prices from a custom formula need freezing

Column H is filled by `=OSRSPRICE(...)`, a **custom Apps Script function**.
Custom functions only run inside an open, signed-in browser session — they do
**not** run when the site reads the sheet. What the site receives is whatever
value Sheets happens to have cached, and for anything uncached it receives the
literal text `Loading...`.

That is why a price can look perfectly fine in the sheet and still show as a
dash on the site: those two things are reading different results.

The site never guesses a number here, and it says so — the warnings panel
reports how many rows are still `Loading...`.

**To fix it permanently:** select column H → copy → **Paste special → Values
only**. That turns each formula into the number it produced, which exports
reliably from then on. Worth doing once the prices have all filled in, and again
after a batch of new drops.

### Everything else in this tab is ignored

`Points Earned`, `# from Team`, `# Seen`, `# for Full Points`, `Full Points` and
`Multiplier` are **not read**. The site recomputes all of it
from `BINGO`. You can leave those columns broken, empty, or delete them
entirely — it makes no difference to the website.

This is intentional. It means the site's numbers are testable and cannot be
thrown off by a formula that got dragged wrong.

### Boss and Drop should be dropdowns

Both columns should use Data validation pointing at the `BINGO` tab, so staff
pick from the catalog rather than typing. Matching is exact (ignoring
capitalisation and extra spaces) — there is **no** fuzzy or best-guess matching,
because a wrong silent match would quietly move points between teams. A typo
produces a warning instead, which takes about thirty seconds to fix.

### The optional `Timestamp` column

Add a column named `Timestamp` and the site will:

- order drops by it when working out which are the first N of an item, and
- show "14m ago" style times in the live drop feed.

Without it, drops are ordered by their row position instead. That is correct as
long as rows are only ever **appended** to the bottom. If someone inserts a row
in the middle, the ordering — and therefore which drop got full points — will be
wrong. **Adding a `Timestamp` column is recommended.**

A `=NOW()` on entry, a Google Form, or a plain typed date all work.

---

## `TEAMS` — the rosters

Two layouts are supported. **Wide** is the default:

| Team Lauren | EHB | Team Faedaa | EHB | Team Oops | EHB | Team harmony | EHB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lauren | 1000+ | Faedaa | 1000+ | Oops | 1000+ | harmony | 1000+ |
| Charzbtw/scuffdcharz | 500-999 | MarylandRat | 500-999 | Haxoonie / Maxoonie | 500-999 | Cambridge | 500-999 |

- One column per team. The header is the team name; a leading `Team ` is stripped.
- The column immediately to the right holds that player's EHB bracket, and its
  header must contain `EHB`, `Bracket` or `Tier`.
- Team colours on the site are **not** read from the sheet. They are fixed in
  code and assigned by column order.

The **long** layout also works, and is detected automatically:

| Team | Player | EHB Bracket |
| --- | --- | --- |
| Lauren | Charzbtw/scuffdcharz | 500-999 |

### Two accounts per player

Rule 2 allows a player to sign up on two accounts. Put both RSNs in the same
cell. Any of these separators work:

- `Charzbtw/scuffdcharz` — a slash
- `Haxoonie / Maxoonie` — a slash with spaces
- `canofeesh, can o fish` — a comma
- `Weh & Cnr` — an ampersand
- `"NiceExample" "Dragon Sword"` — each name in quotes

Use **quotes** when a name contains a space, so it is not mistaken for two
names. The quotes group the name; they are not part of it and are never shown
on the site. A name with a space and no quotes, like `Ingot Chewer`, is read as
one name — the quotes only matter when there are two accounts in the cell.

A drop logged under **either** name is credited to that one player, and their
points are combined. The first name listed is what the site displays.

The **whole cell** also counts as a name. If the drop log's `User` column is a
dropdown sourced from the roster, it hands back the entire cell — `User` ends up
reading `Charzbtw/scuffdcharz` rather than one of the two RSNs — and that
resolves to the same player. So all three of these work:

- `Charzbtw`
- `scuffdcharz`
- `Charzbtw/scuffdcharz`

### Stray spaces

Names like `harmon y` and `Cambrid ge` — with an accidental space inside them —
still resolve correctly against a drop log entry of `harmony` or `Cambridge`.
It is still worth fixing them, because the site displays the name as written.

The one case that will not resolve is two **different** players whose names
differ only by spacing (say `Iron Man` on one team and `IronMan` on another). In
that situation the site refuses to guess and flags the drop instead.

---

## `RULES` — the rules text

Free text, one rule per row, read top to bottom. There is no header row — the
first row is treated as content.

Short lines are rendered as headings; lines starting with a number or a bullet
are rendered as rules. Cells across a row are joined into one line.

---

## How scoring works

For each drop, in chronological order within a team:

1. Look up the item in `BINGO` by `Boss` + `Drop`.
2. Count how many of that exact item the team has already logged.
3. If that count is **below** the item's `Full pts qty limit`, the drop scores
   its full `Points`. Otherwise it scores **half**. Duplicates are intentional
   and still count as drops, they just score less.
4. Anything in the row's `Bonus` column is added to that team's bonus points.

Team totals are drop points plus bonus points, tracked separately. Uniques
counts distinct catalog items claimed. Player totals use the same arithmetic,
attributed to whoever logged the drop; because the quantity limit is a
team-level resource, a player who is second for their team gets the half.

GP values are not tracked.
