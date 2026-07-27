import { BONUS_COLUMNS, parseBonuses } from "@/lib/bonus";
import { BINGO_COLUMNS, buildCatalog } from "@/lib/catalog";
import { parseTable } from "@/lib/csv";
import { DROPS_COLUMNS, parseDrops } from "@/lib/drops";
import { buildRoster } from "@/lib/roster";
import { scoreEvent } from "@/lib/scoring";
import type { ScoreResult } from "@/lib/types";

export const TABS = { drops: "DROPS", bonus: "BONUS" };

export const BONUS_TYPES = [
  "Boss Pets",
  "Jars",
  "Bounty 1st",
  "Team Participation",
];

/**
 * A minimal but realistic catalog. Note the composite key: Dragon 2h sword is
 * worth different points at Callisto and Chaos Elemental, and "Any Shard"
 * repeats across categories — both cases the item-only join would get wrong.
 */
export const BINGO_CSV = [
  BINGO_COLUMNS.join(","),
  "Callisto,Dragon 2h sword,CallistoDragon 2h sword,\"40,331,957\",60,1",
  "Callisto,Voidwaker hilt,CallistoVoidwaker hilt,\"120,000,000\",80,1",
  "Callisto,Any Shard,CallistoAny Shard,\"1,000,000\",5,3",
  "Chaos Elemental,Dragon 2h sword,Chaos ElementalDragon 2h sword,\"40,331,957\",25,1",
  "Chaos Elemental,Any Shard,Chaos ElementalAny Shard,\"1,000,000\",5,3",
  "Venenatis,Dragon 2h sword,VenenatisDragon 2h sword,\"40,331,957\",50,1",
  "Venenatis,Treasonous ring,VenenatisTreasonous ring,$0,10,5",
  "Misc.,Boss Pets,Misc.Boss Pets,,50,1",
  "Team Challenges,Team Challenge 1st,Team ChallengesTeam Challenge 1st,,100,1",
].join("\n");

/**
 * Wide roster layout: one column per team, EHB immediately to its right.
 * Includes every real-world alias shape from the clan roster — two accounts
 * split on "/", split on ",", spaces around the separator, and the stray
 * internal spaces ("harmon y", "Cambrid ge") the drop log will not have.
 */
export const TEAMS_CSV = [
  "Team Lauren,EHB,Team Faedaa,EHB,Team Oops,EHB,Team harmony,EHB",
  "Lauren,1000+,Faedaa,1000+,Oops,1000+,harmon y,1000+",
  "Charzbtw/scuffdcharz,500-999,MarylandRat,500-999,Haxoonie / Maxoonie,500-999,Cambrid ge,500-999",
  '"canofeesh, can o fish",100-499,MarylandFlag,100-499,Zezima,100-499,Woox,100-499',
].join("\n");

/**
 * Runs the same parse -> score path the API route does, and merges the
 * parse-stage warnings into the result so `result.warnings` is what the
 * warnings panel would actually show.
 */
export function buildFixture(options: {
  bingo?: string;
  teams?: string;
  drops?: string;
  bonus?: string;
}): ScoreResult {
  const bingoTable = parseTable(options.bingo ?? BINGO_CSV, BINGO_COLUMNS);
  const { catalog, warnings: catalogWarnings } = buildCatalog(
    bingoTable,
    "BINGO",
  );

  const teamsTable = parseTable(options.teams ?? TEAMS_CSV);
  const { roster, warnings: rosterWarnings } = buildRoster(teamsTable, "TEAMS");

  const dropsTable = parseTable(
    options.drops ?? DROPS_COLUMNS.join(","),
    DROPS_COLUMNS,
  );
  const {
    drops,
    warnings: dropWarnings,
    hasTimestamps,
  } = parseDrops(dropsTable, "DROPS");

  const bonusTable = parseTable(
    options.bonus ?? BONUS_COLUMNS.join(","),
    BONUS_COLUMNS,
  );

  const result = scoreEvent({
    drops,
    catalog,
    roster,
    bonuses: parseBonuses(bonusTable),
    bonusTypes: BONUS_TYPES,
    tabs: TABS,
    hasTimestamps,
  });

  return {
    ...result,
    warnings: [
      ...catalogWarnings,
      ...rosterWarnings,
      ...dropWarnings,
      ...result.warnings,
    ],
  };
}

/** Build a DROPS csv from `[team, user, boss, drop]` tuples. */
export function dropsCsv(
  rows: Array<[string, string, string, string]>,
  extraHeader: string[] = [],
): string {
  const header = [...DROPS_COLUMNS, ...extraHeader].join(",");
  const body = rows.map((row) => row.map(quote).join(","));
  return [header, ...body].join("\n");
}

function quote(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function team(result: ScoreResult, name: string) {
  const found = result.teams.find((t) => t.name === name);
  if (!found) throw new Error(`no team ${name} in ${result.teams.map((t) => t.name).join(", ")}`);
  return found;
}

export function player(result: ScoreResult, displayName: string) {
  const found = result.players.find((p) => p.displayName === displayName);
  if (!found) throw new Error(`no player ${displayName}`);
  return found;
}
