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
  | "bonusCategoryInDrops"
  | "incompleteRow"
  | "teamMismatch"
  | "catalogRowSkipped"
  | "catalogDuplicate"
  | "catalogKeyMismatch"
  | "unparsedNumber"
  | "unknownBonusType"
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
  /** GP value from the catalog. Null when the cell was blank or broken. */
  price: number | null;
  /** Base points before any multiplier. */
  points: number;
  /** How many of this item, per team, score full points. Defaults to 1. */
  fullPointsLimit: number;
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
  /**
   * Epoch ms, when the DROPS tab has a Timestamp column. Null otherwise — the
   * scorer then falls back to sheet row order, which is chronological because
   * rows are appended live.
   */
  timestamp: number | null;
}

/* -------------------------------------------------------------------------- */
/* Bonuses (BONUS tab)                                                         */
/* -------------------------------------------------------------------------- */

export interface BonusRow {
  row: number;
  team: string;
  bonusType: string;
  points: number | null;
  awardedAt: number | null;
  notes: string;
}

export interface AwardedBonus {
  team: string;
  bonusType: string;
  points: number;
  awardedAt: number | null;
  notes: string;
  recognisedType: boolean;
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
  /** Summed catalog price across every drop, duplicates included. */
  gpValue: number;
  dropCount: number;
  bonuses: AwardedBonus[];
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
  gpValue: number;
}

export interface FeedEntry {
  id: string;
  row: number;
  team: string;
  player: string;
  /** The RSN as it appeared in the drop log, when it differs from the display name. */
  rsn: string;
  boss: string;
  item: string;
  basePoints: number;
  multiplier: number;
  points: number;
  /** True when this drop was past its team's full-points quantity limit. */
  halfPoints: boolean;
  gpValue: number;
  timestamp: number | null;
}

/** Which teams have claimed a given catalog entry. */
export type ClaimMap = Map<string, string[]>;

export interface ScoreResult {
  teams: TeamScore[];
  players: PlayerScore[];
  feed: FeedEntry[];
  claims: ClaimMap;
  warnings: Warning[];
  /** How drops were ordered for the multiplier. */
  ordering: "timestamp" | "rowOrder";
}

/* -------------------------------------------------------------------------- */
/* API payload                                                                 */
/* -------------------------------------------------------------------------- */

export interface BossProgressItem {
  key: string;
  item: string;
  points: number;
  price: number | null;
  fullPointsLimit: number;
  claimedBy: string[];
}

export interface BossProgress {
  boss: string;
  items: BossProgressItem[];
  totalPoints: number;
  claimedCount: number;
}

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
  eventEnd: string | null;
  teams: TeamScore[];
  players: PlayerScore[];
  feed: FeedEntry[];
  bosses: BossProgress[];
  bonusCatalog: Array<{ category: string; item: string; points: number }>;
  rules: string[];
  rosters: RosterTeam[];
  warnings: Warning[];
  tabErrors: TabError[];
  ordering: "timestamp" | "rowOrder";
  /** True when this payload is a cached snapshot because a refresh failed. */
  stale: boolean;
}
