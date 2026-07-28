import { describe, expect, it } from "vitest";
import { BINGO_COLUMNS, buildCatalog } from "@/lib/catalog";
import { parseTable } from "@/lib/csv";

function build(csv: string) {
  return buildCatalog(parseTable(csv, BINGO_COLUMNS), "BINGO");
}

/**
 * The real catalog is sectioned: a row holding just the boss name, then that
 * boss's items beneath it, with no Category on the item rows.
 */
const SECTIONED = [
  "Category,Item,Key,Price,Points,Full pts qty limit",
  "Armadyl,,,,,",
  ",Armadyl Chestplate,,\"27,000,000\",40,1",
  ",Armadyl Chainskirt,,\"25,000,000\",40,1",
  ",Armadyl Helmet,,\"18,000,000\",35,1",
  ",Armadyl Hilt,,\"120,000,000\",80,1",
  ",Any Shard,,\"1,000,000\",5,3",
  ",All Uniques (not shard),,\"190,000,000\",100,1",
  "Callisto,,,,,",
  ",Dragon 2h sword,,\"40,331,957\",60,1",
  ",Any Shard,,\"1,000,000\",5,3",
  "Misc.,,,,,",
  ",Boss Pets,,,50,1",
  ",Jars,,,30,1",
  ",Bounty 1st,,,40,1",
].join("\n");

describe("sectioned catalog layout", () => {
  it("inherits the boss from the section heading above each item", () => {
    const { catalog, warnings } = build(SECTIONED);

    expect([...catalog.byCategory.keys()]).toEqual(["Armadyl", "Callisto"]);
    expect(catalog.byCategory.get("Armadyl")).toHaveLength(6);
    expect(catalog.byCategory.get("Callisto")).toHaveLength(2);
    expect(warnings).toEqual([]);
  });

  it("scores an item under its inherited boss", () => {
    const { catalog } = build(SECTIONED);

    const hilt = catalog.byKey.get("armadyl|armadyl hilt");
    expect(hilt?.points).toBe(80);
    expect(hilt?.price).toBe(120_000_000);
    expect(hilt?.category).toBe("Armadyl");
  });

  it("keeps repeated item names distinct per section", () => {
    const { catalog } = build(SECTIONED);

    // "Any Shard" appears under both bosses and must stay two entries.
    expect(catalog.byKey.get("armadyl|any shard")?.fullPointsLimit).toBe(3);
    expect(catalog.byKey.get("callisto|any shard")).toBeDefined();
    expect(catalog.byKey.size).toBe(8);
  });

  it("routes a Misc. section to bonuses, not to bosses", () => {
    const { catalog } = build(SECTIONED);

    expect([...catalog.byCategory.keys()]).not.toContain("Misc.");
    expect(catalog.bonusEntries.map((e) => e.item)).toEqual([
      "Boss Pets",
      "Jars",
      "Bounty 1st",
    ]);
  });

  it("reads a heading placed in the Item column instead of Category", () => {
    const csv = [
      "Category,Item,Key,Price,Points,Full pts qty limit",
      ",Armadyl,,,,",
      ",Armadyl Hilt,,\"120,000,000\",80,1",
    ].join("\n");

    const { catalog, warnings } = build(csv);
    expect(catalog.byKey.get("armadyl|armadyl hilt")?.points).toBe(80);
    expect(warnings).toEqual([]);
  });

  it("still reads a flat catalog with a Category on every row", () => {
    const csv = [
      "Category,Item,Key,Price,Points,Full pts qty limit",
      "Callisto,Dragon 2h sword,CallistoDragon 2h sword,\"40,331,957\",60,1",
      "Venenatis,Dragon 2h sword,VenenatisDragon 2h sword,\"40,331,957\",50,1",
    ].join("\n");

    const { catalog } = build(csv);
    expect(catalog.byKey.get("callisto|dragon 2h sword")?.points).toBe(60);
    expect(catalog.byKey.get("venenatis|dragon 2h sword")?.points).toBe(50);
  });

  it("lets an explicit Category override the section it sits under", () => {
    const csv = [
      "Category,Item,Key,Price,Points,Full pts qty limit",
      "Armadyl,,,,,",
      ",Armadyl Hilt,,0,80,1",
      "Callisto,Dragon 2h sword,,0,60,1",
      ",Any Shard,,0,5,3",
    ].join("\n");

    const { catalog } = build(csv);
    expect(catalog.byKey.get("callisto|dragon 2h sword")).toBeDefined();
    // The row after it inherits the section, which is still Armadyl.
    expect(catalog.byKey.get("armadyl|any shard")).toBeDefined();
  });

  it("flags an item that sits under no heading at all", () => {
    const csv = [
      "Category,Item,Key,Price,Points,Full pts qty limit",
      ",Armadyl Hilt,,0,80,1",
    ].join("\n");

    const { catalog, warnings } = build(csv);
    expect(catalog.entries).toHaveLength(0);
    expect(warnings[0]?.kind).toBe("catalogRowSkipped");
    expect(warnings[0]?.message).toContain("does not sit under any boss");
  });

  it("does not warn on the section headings themselves", () => {
    const { warnings } = build(SECTIONED);
    expect(warnings.filter((w) => w.kind === "catalogRowSkipped")).toEqual([]);
  });

  it("finds the header row when a title sits above it", () => {
    const csv = [
      "Marked Mayhem — item list,,,,,",
      "Updated 27 July,,,,,",
      "Category,Item,Key,Price,Points,Full pts qty limit",
      "Armadyl,,,,,",
      ",Armadyl Hilt,,\"120,000,000\",80,1",
    ].join("\n");

    const { catalog } = build(csv);
    expect(catalog.byKey.get("armadyl|armadyl hilt")?.points).toBe(80);
  });

  it("reports the true spreadsheet row number when the header is not row 1", () => {
    const csv = [
      "A title,,,,,",
      "Category,Item,Key,Price,Points,Full pts qty limit",
      ",Orphan Item,,0,#REF!,1",
    ].join("\n");

    const { warnings } = build(csv);
    // Title is row 1, header row 2, the bad row is row 3.
    expect(warnings[0]?.row).toBe(3);
  });
});

/**
 * The live tab as it actually is: no header row at all. Row 1 is a title with
 * per-team scoreboard columns, rows 2-4 are running totals, and the item data
 * below is purely positional — A for the boss heading, B for the item, C for
 * its points, D onward per-team counters.
 */
const HEADERLESS = [
  "Marked Mayhem,,,Team 1 Lauren,,Team 2 Faedaa,,Team 3 Oops,,Team 4 harmony,,Team 5,",
  "Total Points,,,,0,,0,,0,,0,,0",
  "Number Pts,,,,0,,0,,0,,0,,0",
  ",,,,$0,,$0,,$0,,$0,,$0",
  "Misc.,,,,,,,,,,,,",
  ",Boss Pets,250,0,0,0,0,0,0,0,0,0,0",
  ",Jars,100,0,0,0,0,0,0,0,0,0,0",
  ",Most Team Profit,350,0,0,0,0,0,0,0,0,0,0",
  ",,,0,0,0,0,0,0,0,0,0,0",
  "Team Challenges,,,,,,,,,,,,",
  ",Team 1st,400,0,0,0,0,0,0,0,0,0,0",
  ",Team Participation,50,0,0,0,0,0,0,0,0,0,0",
  ",,,0,0,0,0,0,0,0,0,0,0",
  "Armadyl,,,,,,,,,,,,",
  ",Armadyl Chestplate,100,0,0,0,0,0,0,0,0,0,0",
  ",Armadyl Hilt,140,0,0,0,0,0,0,0,0,0,0",
  ",Any Shard,50,0,0,0,0,0,0,0,0,0,0",
  ",All Uniques (Not Shard),300,0,0,0,0,0,0,0,0,0,0",
  ",,,0,0,0,0,0,0,0,0,0,0",
  "Bandos (General Graardor),,,,,,,,,,,,",
  ",Bandos Chestplate,80,0,0,0,0,0,0,0,0,0,0",
  ",Any Shard,50,0,0,0,0,0,0,0,0,0,0",
].join("\n");

describe("headerless catalog read by column position", () => {
  it("reads bosses and items with no header row present", () => {
    const { catalog } = build(HEADERLESS);

    expect([...catalog.byCategory.keys()]).toEqual([
      "Armadyl",
      "Bandos (General Graardor)",
    ]);
    expect(catalog.byKey.get("armadyl|armadyl hilt")?.points).toBe(140);
    expect(catalog.byKey.get("bandos (general graardor)|any shard")?.points).toBe(50);
  });

  it("does not mistake the title or the running totals for items", () => {
    const { catalog, warnings } = build(HEADERLESS);

    const items = catalog.entries.map((e) => e.item);
    expect(items).not.toContain("Total Points");
    expect(items).not.toContain("Number Pts");
    expect(items).not.toContain("Marked Mayhem");
    expect(warnings).toEqual([]);
  });

  it("routes Misc. and Team Challenges to bonuses with their points", () => {
    const { catalog } = build(HEADERLESS);

    expect([...catalog.byCategory.keys()]).not.toContain("Misc.");
    expect(
      catalog.bonusEntries.map((e) => `${e.item}=${e.points}`),
    ).toEqual([
      "Boss Pets=250",
      "Jars=100",
      "Most Team Profit=350",
      "Team 1st=400",
      "Team Participation=50",
    ]);
  });

  it("reports no prices, since the tab has no price column", () => {
    const { catalog } = build(HEADERLESS);
    expect(catalog.entries.every((e) => e.price === null)).toBe(true);
  });

  it("defaults every quantity limit to 1 when the column is absent", () => {
    const { catalog } = build(HEADERLESS);
    expect(catalog.entries.every((e) => e.fullPointsLimit === 1)).toBe(true);
  });

  it("reports true spreadsheet row numbers with no header to offset", () => {
    const { catalog } = build(HEADERLESS);
    // "Armadyl Chestplate" is on row 15 of the fixture.
    expect(catalog.byKey.get("armadyl|armadyl chestplate")?.row).toBe(15);
  });
});
