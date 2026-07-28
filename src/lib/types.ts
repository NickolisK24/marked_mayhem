/**
 * Shared types for the parse -> score -> present pipeline.
 *
 * Nothing in `src/lib` imports React or performs I/O except `sheet.ts`; the
 * scoring path is a pure function over these types so it can be tested without
 * a network or a DOM.
 */

/* -------------------------------------------------------------------------- */
/* Warnings                                                                    */
/* -------------------------------------------------------------------------- */

export type WarningKind =
  | "unknownPlayer"
  | "unknownItem"
  | "unknownTeam"
  | "incompleteRow"
  | "teamMismatch"
  | "catalogRowSkipped"
  | "catalogDuplicate"
  | "catalogKeyMismatch"
  | "unparsedNumber"
  | "pendingPrice"
  | "rosterAmbiguousAlias"
  | "bossNotInCatalog";

export interface Warning {
  kind: WarningKind;
  /** Which tab the problem came from. */
  tab: string;
  /** 1-based row number in that tab, as a staff member would see it. */
  row?: number;
  message: string;
  /** Short quoted value that caused the problem, for copy-pasting into the sheet. */
  value?: string;
}

/** A tab that could not be read at all, or was missing required columns. */
export interface TabError {
  tab: string;
  problem: string;
}

/* -------------------------------------------------------------------------- */
/* Catalog (BINGO tab)                                                         */
/* -------------------------------------------------------------------------- */

export interface CatalogEntry {
  /** `${normalize(category)}|${normalize(item)}` — the join key against DROPS. */
  key: string;
  /** Boss name as typed in the sheet, used for display. */
  category: string;
  /** Item name as typed in the sheet, used for display. */
  item: string;
  /** Base points before any multiplier. */
  points: number;
  /** How many of this item, per team, score full points. Defaults to 1. */
  fullPointsLimit: number;
  /**
   * How many of this item, per team, score at all. Null when uncapped, which is
   * the norm — only a handful of items have a ceiling.
   */
  scoringCap: number | null;
  row: number;
}

export interface Catalog {
  /** Scoreable entries only — bonus categories are excluded. */
  byKey: Map<string, CatalogEntry>;
  /** Every scoreable entry, in sheet order. */
  entries: CatalogEntry[];
  /** Boss name (as typed) -> its entries, in sheet order. Bonus categories excluded. */
  byCategory: Map<string, CatalogEntry[]>;
  /** Entries under Misc. / Team Challenges, shown for reference only. */
  bonusEntries: CatalogEntry[];
}

/* -------------------------------------------------------------------------- */
/* Roster (TEAMS tab)                                                          */
/* -------------------------------------------------------------------------- */

export interface Player {
  id: string;
  /** Preferred display name — the first RSN listed in the roster cell. */
  displayName: string;
  /** Every RSN this player may log drops under. */
  rsns: string[];
  /**
   * The roster cell verbatim, e.g. "Charzbtw/scuffdcharz". Drop-log dropdowns
   * are often sourced from the roster, so the whole cell turns up in the User
   * column and has to resolve as well as the individual RSNs do.
   */
  rosterCell: string;
  team: string;
  /** EHB bracket exactly as typed in the sheet. Empty string when absent. */
  ehb: string;
  isCaptain: boolean;
  row: number;
}

export interface Team {
  name: string;
  captain: string | null;
  players: Player[];
  colorIndex: number;
}

export interface Roster {
  teams: Team[];
  players: Player[];
  /** Normalized RSN -> player. Built by `buildAliasIndex`. */
  resolve: (rsn: string) => Player | null;
  /** Normalized team name -> team name as typed. */
  resolveTeam: (team: string) => string | null;
}

/* -------------------------------------------------------------------------- */
/* Drops (DROPS tab)                                                           */
/* -------------------------------------------------------------------------- */

export interface RawDrop {
  row: number;
  team: string;
  user: string;
  boss: string;
  drop: string;
  /** GP value from the drop log's own Price column. Null when blank or broken. */
  price: number | null;
  /** Hand-entered bonus points on this row. Null on ordinary drop rows. */
  bonus: number | null;
  /**
   * Epoch ms, when the DROPS tab has a Timestamp column. Null otherwise — the
   * scorer then falls back to sheet row order, which is chronological because
   * rows are appended live.
   */
  timestamp: number | null;
}

/* -------------------------------------------------------------------------- */
/* Scoring output                                                              */
/* -------------------------------------------------------------------------- */

export interface TeamScore {
  name: string;
  captain: string | null;
  colorIndex: number;
  dropPoints: number;
  bonusPoints: number;
  totalPoints: number;
  /** Distinct catalog entries claimed at least once. */
  uniques: number;
  dropCount: number;
}

/** One scored item, as listed in a player's drop breakdown. */
export interface PlayerDrop {
  id: string;
  /** 1-based row in the drop log, so a listing can be traced back to the sheet. */
  row: number;
  boss: string;
  item: string;
  points: number;
  /**
   * True when this was the team's **first** of that catalog item — a genuine
   * unique — and false when the team already had one.
   */
  unique: boolean;
  /** GP value from the drop log's Price column. Null when blank or broken. */
  price: number | null;
  /**
   * True when this drop was past the item's per-team cap and so scored nothing.
   * It is still listed, because the team did receive it.
   */
  overCap: boolean;
  timestamp: number | null;
}

export interface PlayerScore {
  id: string;
  displayName: string;
  rsns: string[];
  team: string;
  ehb: string;
  isCaptain: boolean;
  points: number;
  dropCount: number;
  /** Summed Price across this player's drops. */
  gpValue: number;
  /** Every item this player logged, oldest first. */
  drops: PlayerDrop[];
}

export interface ScoreResult {
  teams: TeamScore[];
  players: PlayerScore[];
  warnings: Warning[];
  /** How drops were ordered for the multiplier. */
  ordering: "timestamp" | "rowOrder";
}

/* -------------------------------------------------------------------------- */
/* API payload                                                                 */
/* -------------------------------------------------------------------------- */

export interface RosterTeam {
  name: string;
  captain: string | null;
  colorIndex: number;
  players: Array<{
    displayName: string;
    rsns: string[];
    ehb: string;
    isCaptain: boolean;
  }>;
}

export interface EventPayload {
  /** Epoch ms this payload was computed. */
  generatedAt: number;
  eventName: string;
  eventStart: string | null;
  eventEnd: string | null;
  teams: TeamScore[];
  players: PlayerScore[];
  rules: string[];
  rosters: RosterTeam[];
  warnings: Warning[];
  tabErrors: TabError[];
  ordering: "timestamp" | "rowOrder";
  /** True when this payload is a cached snapshot because a refresh failed. */
  stale: boolean;
}
