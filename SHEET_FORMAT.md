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
- **Number formatting is handled.** `40,331,957`, `$0`, `1.4b` and `315m` all
  read correctly.
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
| `Price` | no | GP value. Missing or broken counts as 0 GP; the points still score. |
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

If a header row is added later it will be found and used instead, so either
layout works.

### The tab is read in sections

The catalog is organised as a row holding just the boss name, followed by that
boss's items:

|  | Category | Item | Price | Points | Full pts qty limit |
| --- | --- | --- | --- | --- | --- |
| | **Armadyl** | | | | |
| | | Armadyl Chestplate | 27,000,000 | 40 | 1 |
| | | Armadyl Hilt | 120,000,000 | 80 | 1 |
| | | Any Shard | 1,000,000 | 5 | 3 |
| | | All Uniques (not shard) | 190,000,000 | 100 | 1 |
| | **Callisto** | | | | |
| | | Dragon 2h sword | 40,331,957 | 60 | 1 |

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

These are awarded by hand on the `BONUS` tab. They are excluded from the boss
progress view and from drop scoring entirely. **Do not log them in `DROPS`** — a
row that does will be skipped and flagged.

---

## `DROPS` — the live drop log

Rows are appended during the event. Only these columns are read:

| Column | Required | Notes |
| --- | --- | --- |
| `Team` | no | Cross-checked against the roster. The **roster wins** if they disagree, and the row is flagged. |
| `User` | yes | The RSN that got the drop. Any RSN on the roster works — see aliases below. |
| `Boss` | yes | Must match a `Category` in `BINGO`. |
| `Drop` | yes | Must match an `Item` in `BINGO`, **for that boss**. |
| `Timestamp` | no | Optional. See below. |

### Everything else in this tab is ignored

`Points Earned`, `# from Team`, `Price`, `# Seen`, `# for Full Points`,
`Full Points`, `Multiplier` and `Bonus` are **not read**. The site recomputes
all of it from `BINGO`. You can leave those columns broken, empty, or delete
them entirely — it makes no difference to the website.

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
cell, separated by `/` or `,`:

- `Charzbtw/scuffdcharz`
- `Haxoonie / Maxoonie`
- `canofeesh, can o fish`

A drop logged under **either** name is credited to that one player, and their
points are combined. The first name listed is what the site displays.

### Stray spaces

Names like `harmon y` and `Cambrid ge` — with an accidental space inside them —
still resolve correctly against a drop log entry of `harmony` or `Cambridge`.
It is still worth fixing them, because the site displays the name as written.

The one case that will not resolve is two **different** players whose names
differ only by spacing (say `Iron Man` on one team and `IronMan` on another). In
that situation the site refuses to guess and flags the drop instead.

---

## `BONUS` — manually-awarded points

A new flat tab. Paste this as row 1:

```
team	bonus_type	points	awarded_at	notes
```

(That is five cells, A1 to E1, tab-separated — pasting the line above into A1
will fill all five.)

| Column | Required | Notes |
| --- | --- | --- |
| `team` | yes | Must match a team name from `TEAMS`. Capitalisation does not matter. |
| `bonus_type` | yes | One of the list below. |
| `points` | yes | A plain number. Commas are fine. |
| `awarded_at` | no | Any date, or leave blank. |
| `notes` | no | Free text, shown on the site. |

Recognised `bonus_type` values:

```
Boss Pets
Jars
Bounty 1st
Bounty 2nd
Bounty 3rd
Most Team Profit
Most Team Uniques
Team Challenge 1st
Team Challenge 2nd
Team Challenge 3rd
Team Participation
```

A `bonus_type` outside this list **still awards its points** — it is only
flagged as a warning. A typo must never silently cost a team points that staff
already decided to give them.

A row whose `team` does not match any roster team, or whose `points` cannot be
read, is skipped and flagged.

Bonus points are shown separately from drop points on the team leaderboard, and
do **not** count toward individual player totals.

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
   its full `Points`. Otherwise it scores **half**.
4. The item's `Price` is added to the team's GP total either way — duplicates
   are intentional and still count, they just score less.

Team totals are drop points plus bonus points, tracked separately. Uniques
counts distinct catalog items claimed. Player totals use the same arithmetic,
attributed to whoever logged the drop; because the quantity limit is a
team-level resource, a player who is second for their team gets the half.
