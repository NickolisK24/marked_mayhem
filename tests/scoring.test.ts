import { describe, expect, it } from "vitest";
import {
  buildFixture,
  dropsCsv,
  dropsWithPriceCsv,
  player,
  team,
  BINGO_CSV,
} from "./helpers";

describe("scoring — base cases", () => {
  it("scores a single drop at its catalog value", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(60);
    expect(team(result, "Lauren").uniques).toBe(1);
    expect(team(result, "Lauren").dropCount).toBe(1);
  });

  it("scores the same item differently per boss — the join is composite", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Lauren", "Charzbtw", "Chaos Elemental", "Dragon 2h sword"],
        ["Lauren", "Charzbtw", "Venenatis", "Dragon 2h sword"],
      ]),
    });

    // 60 at Callisto + 25 at Chaos Elemental + 50 at Venenatis, all full credit:
    // they are three distinct catalog entries, not three of the same item.
    expect(team(result, "Lauren").totalPoints).toBe(135);
    expect(team(result, "Lauren").uniques).toBe(3);
  });

  it("resolves an alias account to its canonical player", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "scuffdcharz", "Callisto", "Dragon 2h sword"],
        ["Lauren", "Charzbtw", "Callisto", "Voidwaker hilt"],
      ]),
    });

    expect(player(result, "Charzbtw").dropCount).toBe(2);
    expect(player(result, "Charzbtw").points).toBe(140);
    expect(result.warnings).toHaveLength(0);
  });

  it("credits a drop logged under a stray-space roster name", () => {
    const result = buildFixture({
      drops: dropsCsv([["harmony", "harmony", "Callisto", "Voidwaker hilt"]]),
    });

    expect(team(result, "harmony").totalPoints).toBe(80);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("scoring — the quantity limit and the half-point multiplier", () => {
  it("halves everything past a limit of 1", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Lauren", "canofeesh", "Callisto", "Dragon 2h sword"],
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
      ]),
    });

    // 60 + 30 + 30
    expect(team(result, "Lauren").totalPoints).toBe(120);
    // Duplicates still count as drops and still add GP, they just score less.
    expect(team(result, "Lauren").dropCount).toBe(3);
    expect(team(result, "Lauren").uniques).toBe(1);
  });

  it("crosses a limit of 3 mid-sequence: three full, then half", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Any Shard"],
        ["Lauren", "canofeesh", "Callisto", "Any Shard"],
        ["Lauren", "Charzbtw", "Callisto", "Any Shard"],
        ["Lauren", "Charzbtw", "Callisto", "Any Shard"],
        ["Lauren", "canofeesh", "Callisto", "Any Shard"],
      ]),
    });

    // 5 + 5 + 5 + 2.5 + 2.5
    expect(team(result, "Lauren").totalPoints).toBe(20);

    // Which drops took the half is visible in the per-player split: Charzbtw
    // logged 1st, 3rd and 4th (5 + 5 + 2.5), canofeesh 2nd and 5th (5 + 2.5).
    expect(player(result, "Charzbtw").points).toBe(12.5);
    expect(player(result, "canofeesh").points).toBe(7.5);
  });

  it("counts the limit per team, not globally", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Faedaa", "MarylandRat", "Callisto", "Dragon 2h sword"],
      ]),
    });

    // Both teams get full credit for their first one.
    expect(team(result, "Lauren").totalPoints).toBe(60);
    expect(team(result, "Faedaa").totalPoints).toBe(60);
  });

  it("counts the limit per item, not per boss", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Any Shard"],
        ["Lauren", "Charzbtw", "Chaos Elemental", "Any Shard"],
      ]),
    });

    // Different catalog entries, so each is the team's first of that entry.
    expect(team(result, "Lauren").totalPoints).toBe(10);
    expect(team(result, "Lauren").uniques).toBe(2);
  });

  it("orders by row when the drop log has no timestamps", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Any Shard"],
        ["Lauren", "canofeesh", "Callisto", "Any Shard"],
        ["Lauren", "Charzbtw", "Callisto", "Any Shard"],
        ["Lauren", "canofeesh", "Callisto", "Any Shard"],
      ]),
    });

    expect(result.ordering).toBe("rowOrder");
    // Rows 1 and 3 are Charzbtw (5 + 5); rows 2 and 4 are canofeesh, and the
    // fourth is the one that crosses the limit of 3 (5 + 2.5).
    expect(player(result, "Charzbtw").points).toBe(10);
    expect(player(result, "canofeesh").points).toBe(7.5);
  });

  it("orders by timestamp when the column exists, not by row", () => {
    const csv = [
      "Team,User,Boss,Drop,Timestamp",
      // Logged out of order: the later row happened first.
      "Lauren,Charzbtw,Callisto,Dragon 2h sword,2026-07-27T12:30:00Z",
      "Lauren,canofeesh,Callisto,Dragon 2h sword,2026-07-27T09:00:00Z",
    ].join("\n");

    const result = buildFixture({ drops: csv });

    expect(result.ordering).toBe("timestamp");
    // canofeesh got there first, so canofeesh gets full points.
    expect(player(result, "canofeesh").points).toBe(60);
    expect(player(result, "Charzbtw").points).toBe(30);
  });
});

describe("scoring — player attribution", () => {
  it("attributes each drop to the individual who logged it", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Lauren", "canofeesh", "Callisto", "Voidwaker hilt"],
      ]),
    });

    expect(player(result, "Charzbtw").points).toBe(60);
    expect(player(result, "canofeesh").points).toBe(80);
  });

  it("passes the team-level multiplier through to the player who was second", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Lauren", "canofeesh", "Callisto", "Dragon 2h sword"],
      ]),
    });

    // The limit is a team resource: canofeesh is second for the team, so half.
    expect(player(result, "Charzbtw").points).toBe(60);
    expect(player(result, "canofeesh").points).toBe(30);
  });

  it("lists every rostered player, including those with no drops", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"]]),
    });

    expect(result.players).toHaveLength(12);
    expect(player(result, "Woox").points).toBe(0);
    expect(player(result, "Woox").dropCount).toBe(0);
  });
});

describe("scoring — bad input never crashes and never scores silently", () => {
  it("skips an unknown RSN and names it in a warning", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "SomeRandomGuy", "Callisto", "Dragon 2h sword"],
        ["Lauren", "Charzbtw", "Callisto", "Voidwaker hilt"],
      ]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(80);
    const warning = result.warnings.find((w) => w.kind === "unknownPlayer");
    expect(warning?.value).toBe("SomeRandomGuy");
    expect(warning?.row).toBe(2);
  });

  it("skips an unknown item at a known boss", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Dragon 2h swrod"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(0);
    const warning = result.warnings.find((w) => w.kind === "unknownItem");
    expect(warning?.value).toBe("Callisto — Dragon 2h swrod");
  });

  it("distinguishes an unknown boss from an unknown item", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callsto", "Dragon 2h sword"]]),
    });

    expect(result.warnings.map((w) => w.kind)).toContain("bossNotInCatalog");
  });

  it("refuses to score an item that exists only at another boss", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Treasonous ring"]]),
    });

    // Treasonous ring is a Venenatis item; it must not fall back to that entry.
    expect(team(result, "Lauren").totalPoints).toBe(0);
    expect(result.warnings.map((w) => w.kind)).toContain("unknownItem");
  });

  it("scores a Misc. row from the catalog, as drop points", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Misc.", "Boss Pets"]]),
    });

    // Misc. is a category like any other, scored from its catalog points.
    expect(team(result, "Lauren").totalPoints).toBe(50);
    expect(result.warnings).toEqual([]);
  });

  it("trusts the roster over the drop log's Team column, and flags the clash", () => {
    const result = buildFixture({
      drops: dropsCsv([["Faedaa", "Charzbtw", "Callisto", "Dragon 2h sword"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(60);
    expect(team(result, "Faedaa").totalPoints).toBe(0);
    expect(result.warnings.map((w) => w.kind)).toContain("teamMismatch");
  });

  it("keeps a team with zero drops on the leaderboard", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"]]),
    });

    expect(result.teams).toHaveLength(4);
    const oops = team(result, "Oops");
    expect(oops.totalPoints).toBe(0);
    expect(oops.uniques).toBe(0);
    expect(oops.dropCount).toBe(0);
    // ...and ranked last rather than missing.
    expect(result.teams[0]!.name).toBe("Lauren");
  });

  it("scores an item whose optional columns are all absent", () => {
    const bingo = ["Category,Item,Points", "Callisto,Voidwaker hilt,80"].join(
      "\n",
    );

    const result = buildFixture({
      bingo,
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Voidwaker hilt"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(80);
    expect(result.warnings).toHaveLength(0);
  });

  it("ignores blank drop rows without warning about them", () => {
    const csv = [
      "Team,User,Boss,Drop,Points Earned",
      "Lauren,Charzbtw,Callisto,Dragon 2h sword,60",
      ",,,,",
      ",,,,#REF!",
      ",,,,0",
      "",
    ].join("\n");

    const result = buildFixture({ drops: csv });

    expect(team(result, "Lauren").totalPoints).toBe(60);
    // Padding rows whose formula columns still evaluate are not warnings.
    expect(result.warnings).toHaveLength(0);
  });

  it("flags a half-filled drop row", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", ""]]),
    });

    const warning = result.warnings.find((w) => w.kind === "incompleteRow");
    expect(warning?.message).toContain("Drop");
  });

  it("produces an empty but valid result when every tab is empty", () => {
    const result = buildFixture({ bingo: "", teams: "", drops: "" });

    expect(result.teams).toEqual([]);
    expect(result.players).toEqual([]);
  });

  it("does not read the sheet's own Points Earned or Multiplier columns", () => {
    const csv = [
      "Team,User,Boss,Drop,Points Earned,Multiplier",
      // The sheet claims 9999 points at 3x. Both are ignored.
      "Lauren,Charzbtw,Callisto,Dragon 2h sword,9999,3",
    ].join("\n");

    const result = buildFixture({ drops: csv });

    expect(team(result, "Lauren").totalPoints).toBe(60);
  });
});

describe("scoring — catalog integrity", () => {
  it("includes team-award categories in the scoreable catalog", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Team Challenges", "Team Challenge 1st"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(100);
  });

  it("uses the first of two duplicate catalog rows", () => {
    const bingo = [
      BINGO_CSV,
      "Callisto,Dragon 2h sword,CallistoDragon 2h sword,999,1",
    ].join("\n");

    const result = buildFixture({
      bingo,
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(60);
  });
});

describe("scoring — an unrecognised RSN is still refused", () => {
  it("does not fall back to the row's Team when the RSN is unknown", () => {
    // A blank User means a whole-team row and scores for the Team column. A
    // User that was typed but does not resolve is a typo, and falling back
    // would hide it while still moving the team's total.
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "SomeRandomGuy", "Callisto", "Dragon 2h sword"],
      ]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(0);
    expect(result.warnings.map((w) => w.kind)).toContain("unknownPlayer");
  });

  it("names the RSN and the fix in the warning", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "SomeRandomGuy", "Callisto", "Dragon 2h sword"],
      ]),
    });

    const warning = result.warnings.find((w) => w.kind === "unknownPlayer");
    expect(warning?.message).toContain("SomeRandomGuy");
    expect(warning?.message).toContain("roster cell");
  });
});

describe("scoring — the per-player drop breakdown", () => {
  it("lists each of a player's drops with its boss, item and points", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Lauren", "Charzbtw", "Callisto", "Voidwaker hilt"],
      ]),
    });

    const drops = player(result, "Charzbtw").drops;
    expect(drops.map((d) => d.item)).toEqual([
      "Dragon 2h sword",
      "Voidwaker hilt",
    ]);
    expect(drops.map((d) => d.boss)).toEqual(["Callisto", "Callisto"]);
    expect(drops.map((d) => d.points)).toEqual([60, 80]);
    expect(drops.map((d) => d.row)).toEqual([2, 3]);
  });

  it("marks the team's first of an item unique and the rest duplicates", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Lauren", "canofeesh", "Callisto", "Dragon 2h sword"],
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
      ]),
    });

    expect(player(result, "Charzbtw").drops.map((d) => d.unique)).toEqual([
      true,
      false,
    ]);
    // The unique belongs to the team, so a different player's copy is a dupe.
    expect(player(result, "canofeesh").drops.map((d) => d.unique)).toEqual([
      false,
    ]);
  });

  it("counts uniqueness per team, so two teams can each have a unique", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Faedaa", "MarylandRat", "Callisto", "Dragon 2h sword"],
      ]),
    });

    expect(player(result, "Charzbtw").drops[0]!.unique).toBe(true);
    expect(player(result, "MarylandRat").drops[0]!.unique).toBe(true);
  });

  it("separates uniqueness from the points multiplier", () => {
    // Any Shard has a limit of 3, so the team's 2nd still scores full points
    // while no longer being a unique.
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Any Shard"],
        ["Lauren", "Charzbtw", "Callisto", "Any Shard"],
      ]),
    });

    const drops = player(result, "Charzbtw").drops;
    expect(drops.map((d) => d.unique)).toEqual([true, false]);
    expect(drops.map((d) => d.points)).toEqual([5, 5]);
  });

  it("reads the GP value from the drop log's Price column", () => {
    const result = buildFixture({
      drops: dropsWithPriceCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword", "40,331,957"],
        ["Lauren", "Charzbtw", "Callisto", "Voidwaker hilt", "120000000"],
      ]),
    });

    const charz = player(result, "Charzbtw");
    expect(charz.drops.map((d) => d.price)).toEqual([40_331_957, 120_000_000]);
    expect(charz.gpValue).toBe(160_331_957);
  });

  it("treats a blank or broken Price as unknown, not as zero", () => {
    const result = buildFixture({
      drops: dropsWithPriceCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword", ""],
        ["Lauren", "Charzbtw", "Callisto", "Voidwaker hilt", "#REF!"],
      ]),
    });

    const charz = player(result, "Charzbtw");
    expect(charz.drops.map((d) => d.price)).toEqual([null, null]);
    expect(charz.gpValue).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it("falls back to column H when there is no Price header", () => {
    // A..H with the value in H, and no header naming it.
    const csv = [
      "Team,User,Boss,Drop,Points Earned,# from Team,# Seen,Price",
      "Lauren,Charzbtw,Callisto,Dragon 2h sword,,,,\"40,331,957\"",
    ].join("\n");

    const result = buildFixture({ drops: csv });
    expect(player(result, "Charzbtw").drops[0]!.price).toBe(40_331_957);
  });

  it("gives a player with no drops an empty breakdown, not undefined", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"]]),
    });

    expect(player(result, "Woox").drops).toEqual([]);
    expect(player(result, "Woox").gpValue).toBe(0);
  });

});

describe("scoring — the drop log's User column holding a whole roster cell", () => {
  it("scores a drop logged under the combined cell text", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw/scuffdcharz", "Callisto", "Dragon 2h sword"],
      ]),
    });

    expect(player(result, "Charzbtw").points).toBe(60);
    expect(team(result, "Lauren").totalPoints).toBe(60);
    expect(result.warnings).toEqual([]);
  });

  it("pools the combined cell and a bare RSN into one player", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw/scuffdcharz", "Callisto", "Dragon 2h sword"],
        ["Lauren", "scuffdcharz", "Callisto", "Voidwaker hilt"],
      ]),
    });

    expect(player(result, "Charzbtw").dropCount).toBe(2);
    expect(player(result, "Charzbtw").points).toBe(140);
  });
});

describe("scoring — reading Price when a row's named cell is blank", () => {
  it("falls back to column H for a row the named column left empty", () => {
    // Google's CSV endpoint blanks a cell whose type does not match the rest of
    // its column, so one row can come through empty while its neighbours do not.
    const csv = [
      "Team,User,Boss,Drop,Points Earned,# from Team,# Seen,Price",
      'Lauren,Charzbtw,Callisto,Dragon 2h sword,,,,"40,331,957"',
      'Lauren,canofeesh,Callisto,Voidwaker hilt,,,,"120,000,000"',
    ].join("\n");

    const result = buildFixture({ drops: csv });
    expect(player(result, "Charzbtw").drops[0]!.price).toBe(40_331_957);
    expect(player(result, "canofeesh").drops[0]!.price).toBe(120_000_000);
  });

  it("still reports an unreadable price as unknown rather than zero", () => {
    const result = buildFixture({
      drops: dropsWithPriceCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword", "#REF!"],
      ]),
    });

    expect(player(result, "Charzbtw").drops[0]!.price).toBeNull();
  });
});

describe("scoring — a Price still being calculated by a custom formula", () => {
  it("shows an uncomputed price as unknown rather than zero", () => {
    // The drop log prices items with =OSRSPRICE(), an Apps Script function.
    // Custom functions do not run for an anonymous read, so an uncached cell
    // arrives as the literal text "Loading...".
    const result = buildFixture({
      drops: dropsWithPriceCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword", "Loading..."],
      ]),
    });

    expect(player(result, "Charzbtw").drops[0]!.price).toBeNull();
    expect(player(result, "Charzbtw").gpValue).toBe(0);
  });

  it("still scores the drop's points normally", () => {
    const result = buildFixture({
      drops: dropsWithPriceCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword", "Loading..."],
      ]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(60);
  });

  it("says so once, not once per row", () => {
    const result = buildFixture({
      drops: dropsWithPriceCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword", "Loading..."],
        ["Lauren", "canofeesh", "Callisto", "Voidwaker hilt", "Loading…"],
        ["Faedaa", "MarylandRat", "Venenatis", "Treasonous ring", "Loading"],
      ]),
    });

    const pending = result.warnings.filter((w) => w.kind === "pendingPrice");
    expect(pending).toHaveLength(1);
    expect(pending[0]!.value).toBe("3");
    expect(pending[0]!.message).toContain("Paste special");
  });

  it("does not complain when every price computed", () => {
    const result = buildFixture({
      drops: dropsWithPriceCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword", "$34,494,507"],
      ]),
    });

    expect(player(result, "Charzbtw").drops[0]!.price).toBe(34_494_507);
    expect(result.warnings.filter((w) => w.kind === "pendingPrice")).toEqual([]);
  });

  it("reads the currency-formatted values the sheet exports", () => {
    const result = buildFixture({
      drops: dropsWithPriceCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword", "$47,912,500"],
        ["Lauren", "canofeesh", "Callisto", "Voidwaker hilt", "$6,207,870"],
      ]),
    });

    expect(player(result, "Charzbtw").drops[0]!.price).toBe(47_912_500);
    expect(player(result, "canofeesh").drops[0]!.price).toBe(6_207_870);
  });

  it("does not mistake a blank price for a pending one", () => {
    const result = buildFixture({
      drops: dropsWithPriceCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword", ""],
      ]),
    });

    expect(result.warnings.filter((w) => w.kind === "pendingPrice")).toEqual([]);
  });
});

describe("scoring — the Infernal cape per-team cap", () => {
  // The catalog writes the cap into the item name, as the live sheet does.
  const bingo = [
    "Category,Item,Points",
    "Zuk,Infernal Cape (Limit 5),60",
    "Zuk,Jal-nib-rek,40",
  ].join("\n");

  const capes = (n: number) =>
    dropsCsv(
      Array.from({ length: n }, (_, i) => [
        "Lauren",
        i % 2 === 0 ? "Charzbtw" : "canofeesh",
        "Zuk",
        // The drop log records the plain name, without the suffix.
        "Infernal Cape",
      ]) as Array<[string, string, string, string]>,
    );

  it("scores the first cape in full", () => {
    const result = buildFixture({ bingo, drops: capes(1) });
    expect(team(result, "Lauren").totalPoints).toBe(60);
  });

  it("scores all five capes in full — there is no half tier for a capped item", () => {
    const result = buildFixture({ bingo, drops: capes(5) });
    // 60 x 5
    expect(team(result, "Lauren").totalPoints).toBe(300);
  });

  it("scores nothing for the sixth cape and beyond", () => {
    const result = buildFixture({ bingo, drops: capes(9) });
    expect(team(result, "Lauren").totalPoints).toBe(300);
  });

  it("marks the over-cap capes so the breakdown can say why", () => {
    const result = buildFixture({ bingo, drops: capes(7) });

    const all = [
      ...player(result, "Charzbtw").drops,
      ...player(result, "canofeesh").drops,
    ].sort((a, b) => a.row - b.row);

    expect(all.map((d) => d.points)).toEqual([60, 60, 60, 60, 60, 0, 0]);
    expect(all.map((d) => d.overCap)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it("carries the cap on each drop so the breakdown can name it", () => {
    const result = buildFixture({ bingo, drops: capes(2) });
    const all = [
      ...player(result, "Charzbtw").drops,
      ...player(result, "canofeesh").drops,
    ];
    expect(all.every((d) => d.cap === 5)).toBe(true);
  });

  it("leaves an uncapped item's cap null", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"]]),
    });
    expect(player(result, "Charzbtw").drops[0]!.cap).toBeNull();
  });

  it("still lists an over-cap cape, since the team did receive it", () => {
    const result = buildFixture({ bingo, drops: capes(7) });

    const logged =
      player(result, "Charzbtw").drops.length +
      player(result, "canofeesh").drops.length;
    expect(logged).toBe(7);
  });

  it("counts the cap per team, so each team gets its own five", () => {
    const rows: Array<[string, string, string, string]> = [];
    for (let i = 0; i < 7; i += 1) {
      rows.push(["Lauren", "Charzbtw", "Zuk", "Infernal Cape"]);
      rows.push(["Faedaa", "MarylandRat", "Zuk", "Infernal Cape"]);
    }
    const result = buildFixture({ bingo, drops: dropsCsv(rows) });

    expect(team(result, "Lauren").totalPoints).toBe(300);
    expect(team(result, "Faedaa").totalPoints).toBe(300);
  });

  it("leaves uncapped items unlimited", () => {
    const rows = Array.from({ length: 9 }, () => [
      "Lauren",
      "Charzbtw",
      "Zuk",
      "Jal-nib-rek",
    ]) as Array<[string, string, string, string]>;
    const result = buildFixture({ bingo, drops: dropsCsv(rows) });

    // 40 + eight at 20: half points keep accruing with no ceiling.
    expect(team(result, "Lauren").totalPoints).toBe(40 + 8 * 20);
  });

  it("counts the first cape as the team's unique and the rest as duplicates", () => {
    const result = buildFixture({ bingo, drops: capes(7) });
    expect(team(result, "Lauren").uniques).toBe(1);
  });

  it("caps whichever item carries the suffix, under any boss", () => {
    const other = [
      "Category,Item,Points",
      "Fortis Colosseum,Dizana's quiver (Limit 5),50",
    ].join("\n");
    const rows = Array.from({ length: 7 }, () => [
      "Lauren",
      "Charzbtw",
      "Fortis Colosseum",
      "Dizana's quiver",
    ]) as Array<[string, string, string, string]>;

    const result = buildFixture({ bingo: other, drops: dropsCsv(rows) });
    // Five quivers at 50 each, then nothing.
    expect(team(result, "Lauren").totalPoints).toBe(250);
  });

  it("matches a drop that does carry the suffix too", () => {
    const result = buildFixture({
      bingo,
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Zuk", "Infernal Cape (Limit 5)"],
      ]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(60);
    expect(result.warnings).toEqual([]);
  });

  it("never shows the suffix in the item name", () => {
    const result = buildFixture({ bingo, drops: capes(1) });
    expect(player(result, "Charzbtw").drops[0]!.item).toBe("Infernal Cape");
  });
});

describe("scoring — team totals do not depend on the order of the drop log", () => {
  // DROPS has no Timestamp column and is not getting one: event managers accept
  // submissions by hand and will not also record when each happened. So drops
  // are ordered by row position, which is only chronological while rows are
  // appended rather than inserted.
  //
  // These tests pin down how much that actually costs. Exactly N of an item
  // score full points no matter which N they are, so a team's total is the same
  // under every ordering — an inserted row cannot move the leaderboard. What it
  // can move is which *player* is credited with the full points.
  const rows: Array<[string, string, string, string]> = [
    // Uncapped, limit 1: one of these is full, the other two are half.
    ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
    ["Lauren", "canofeesh", "Callisto", "Dragon 2h sword"],
    ["Lauren", "Lauren", "Callisto", "Dragon 2h sword"],
    // Uncapped, limit 3: three full, one half.
    ["Lauren", "Charzbtw", "Callisto", "Any Shard"],
    ["Lauren", "canofeesh", "Callisto", "Any Shard"],
    ["Lauren", "Lauren", "Callisto", "Any Shard"],
    ["Lauren", "canofeesh", "Callisto", "Any Shard"],
    // Capped at 5: all five full, the sixth nothing.
    ...Array.from(
      { length: 6 },
      (_, i): [string, string, string, string] => [
        "Lauren",
        i % 2 === 0 ? "Charzbtw" : "canofeesh",
        "Zuk",
        "Infernal Cape",
      ],
    ),
  ];

  /** Every permutation of `items`, generated deterministically. */
  function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) return [items];
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += 1) {
      const rest = [...items.slice(0, i), ...items.slice(i + 1)];
      for (const tail of permutations(rest)) out.push([items[i]!, ...tail]);
    }
    return out;
  }

  const baseline = team(buildFixture({ drops: dropsCsv(rows) }), "Lauren");

  it("scores the fixture as expected in its original order", () => {
    // 60 + 30 + 30, then 5 + 5 + 5 + 2.5, then 60 x 5 + 0.
    expect(baseline.totalPoints).toBe(437.5);
    expect(baseline.uniques).toBe(3);
    expect(baseline.dropCount).toBe(13);
  });

  it("gives the same team total for every ordering of the same drops", () => {
    // 13 rows is far too many to permute exhaustively, so permute a
    // representative subset in full: one of each item, plus a fourth row that
    // makes one of them a duplicate.
    const subset = rows.slice(0, 4);
    const totals = new Set(
      permutations(subset).map(
        (order) => team(buildFixture({ drops: dropsCsv(order) }), "Lauren").totalPoints,
      ),
    );
    expect([...totals]).toHaveLength(1);
  });

  it("gives the same team total when rows are reversed or rotated", () => {
    const orderings = [
      [...rows].reverse(),
      [...rows.slice(6), ...rows.slice(0, 6)],
      [...rows.slice(1), rows[0]!],
    ];
    for (const order of orderings) {
      const scored = team(buildFixture({ drops: dropsCsv(order) }), "Lauren");
      expect(scored.totalPoints).toBe(baseline.totalPoints);
      expect(scored.uniques).toBe(baseline.uniques);
      expect(scored.dropCount).toBe(baseline.dropCount);
    }
  });

  it("can move full points between players on the same team", () => {
    // The cost of row order, stated precisely: the same 13 drops, and one
    // player's personal total changes depending on who was written down first.
    const first = player(buildFixture({ drops: dropsCsv(rows) }), "Charzbtw");
    const second = player(
      buildFixture({ drops: dropsCsv([...rows].reverse()) }),
      "Charzbtw",
    );
    expect(first.points).not.toBe(second.points);
    expect(first.dropCount).toBe(second.dropCount);
  });
});

describe("scoring — a row with no User scores for its team", () => {
  // These are picked from the same dropdown as a boss and score from the same
  // catalog points. The only difference is that a team wins them rather than a
  // person, so the drop log leaves User empty — and a row with no User must
  // still score, instead of being turned away by the rostered-player rule.

  it("scores a Misc. award with no User at all", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "", "Misc.", "Boss Pets"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(50);
    expect(team(result, "Lauren").totalPoints).toBe(50);
    expect(result.warnings).toEqual([]);
  });

  it("scores a Team Challenges award with no User at all", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "", "Team Challenges", "Team Challenge 1st"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(100);
    expect(result.warnings).toEqual([]);
  });

  it("keeps an award out of the team's drop and unique counts", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "", "Misc.", "Boss Pets"]]),
    });

    // It scored, but it is an award rather than an item: counting it as a
    // unique would make "Most Team Uniques" a unique in its own right.
    expect(team(result, "Lauren").totalPoints).toBe(50);
    expect(team(result, "Lauren").dropCount).toBe(0);
    expect(team(result, "Lauren").uniques).toBe(0);
  });

  it("credits no player when the row names nobody", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "", "Misc.", "Boss Pets"]]),
    });

    // The team scores, but with nobody named there is nobody to attribute it
    // to, so no player total moves and no breakdown gains a row.
    expect(result.players.every((p) => p.points === 0)).toBe(true);
    expect(result.players.every((p) => p.drops.length === 0)).toBe(true);
  });

  it("credits the player when the row does name one", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Misc.", "Boss Pets"]]),
    });

    expect(player(result, "Charzbtw").points).toBe(50);
    expect(player(result, "Charzbtw").dropCount).toBe(1);
  });

  it("takes the team from the Team column when there is no User", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "", "Misc.", "Boss Pets"],
        ["Faedaa", "", "Misc.", "Boss Pets"],
      ]),
    });

    // Each team's first, so both score full — the limit is per team.
    expect(team(result, "Lauren").totalPoints).toBe(50);
    expect(team(result, "Faedaa").totalPoints).toBe(50);
  });

  it("still needs a recognisable team, and says so when there is not one", () => {
    const result = buildFixture({
      drops: dropsCsv([["Nonexistent", "", "Misc.", "Boss Pets"]]),
    });

    expect(result.warnings.map((w) => w.kind)).toContain("unknownTeam");
  });

  it("flags an award that is not in the catalog", () => {
    // The loud-failure rule still applies: an unrecognised award is reported,
    // never guessed at.
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "", "Misc.", "Something Invented"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(0);
    expect(result.warnings.map((w) => w.kind)).toContain("unknownItem");
  });

  it("accepts the bare Misc spelling as well as Misc.", () => {
    const result = buildFixture({
      bingo: [BINGO_CSV, "Misc,Boss Pets,MiscBoss Pets,50,1"].join("\n"),
      drops: dropsCsv([["Lauren", "", "Misc", "Boss Pets"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(50);
    expect(result.warnings).toEqual([]);
  });

  it("applies the half multiplier to a repeated award like any other item", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "", "Misc.", "Boss Pets"],
        ["Lauren", "", "Misc.", "Boss Pets"],
      ]),
    });

    // 50 + 25. Nothing about a team award changes the quantity rules.
    expect(team(result, "Lauren").totalPoints).toBe(75);
  });

  it("applies the same rule to a boss row with no User", () => {
    // Nothing here is special-cased by category: any row may omit the User and
    // score for its team, because an individual challenge and a team one are
    // logged in the same two categories and only the User cell tells them apart.
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "", "Callisto", "Dragon 2h sword"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(60);
    expect(result.warnings).toEqual([]);
  });

  it("adds team awards alongside ordinary drops in one total", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Lauren", "", "Misc.", "Boss Pets"],
        ["Lauren", "", "Team Challenges", "Team Challenge 1st"],
      ]),
    });

    const scored = team(result, "Lauren");
    expect(scored.totalPoints).toBe(210);
    // Only the Callisto drop belongs to a player.
    expect(player(result, "Charzbtw").points).toBe(60);
  });
});

describe("scoring — a Bonus column in the sheet is ignored", () => {
  // Column M is a leftover from the sheet this one's layout was copied from.
  // The event managers confirmed it is unused and hidden, so a number sitting
  // in it must not quietly become points.

  it("ignores a Bonus value on a drop row", () => {
    const csv = [
      "Team,User,Boss,Drop,Bonus",
      "Lauren,Charzbtw,Callisto,Dragon 2h sword,250",
    ].join("\n");

    const result = buildFixture({ drops: csv });

    expect(team(result, "Lauren").totalPoints).toBe(60);
  });

  it("does not score a row that carries nothing but a Bonus", () => {
    const csv = ["Team,User,Boss,Drop,Bonus", "Lauren,,,,400"].join("\n");

    const result = buildFixture({ drops: csv });

    expect(team(result, "Lauren").totalPoints).toBe(0);
    // It has no Boss or Drop, so it is an incomplete row like any other.
    expect(result.warnings.map((w) => w.kind)).toContain("incompleteRow");
  });
});

describe("scoring — individual and whole-team rows in one log", () => {
  // The managers' rule: team challenges are logged for the whole team, and
  // individual ones name whoever got it. Both shapes appear in the same tab and
  // the same categories, so the User cell is the only thing distinguishing them.

  it("scores both shapes side by side and splits the attribution", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "", "Team Challenges", "Team Challenge 1st"],
        ["Lauren", "Charzbtw", "Misc.", "Boss Pets"],
      ]),
    });

    // The team banks both; only the named one reaches a player.
    expect(team(result, "Lauren").totalPoints).toBe(150);
    expect(player(result, "Charzbtw").points).toBe(50);
    expect(result.players.reduce((sum, p) => sum + p.points, 0)).toBe(50);
    expect(result.warnings).toEqual([]);
  });

  it("lists a whole-team row on the team instead of counting it", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "", "Team Challenges", "Team Challenge 1st"]]),
    });

    const scored = team(result, "Lauren");
    expect(scored.dropCount).toBe(0);
    expect(scored.uniques).toBe(0);
    expect(scored.awards).toHaveLength(1);
    expect(scored.awards[0]?.item).toBe("Team Challenge 1st");
    expect(scored.awards[0]?.points).toBe(100);
    expect(scored.awards[0]?.category).toBe("Team Challenges");
  });

  it("shares one per-team quantity count across both shapes", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Misc.", "Boss Pets"],
        ["Lauren", "", "Misc.", "Boss Pets"],
      ]),
    });

    // The team-level count does not care who logged it: 50 then half.
    expect(team(result, "Lauren").totalPoints).toBe(75);
    expect(player(result, "Charzbtw").points).toBe(50);
  });

  it("still needs a team when the row names nobody", () => {
    const result = buildFixture({
      drops: dropsCsv([["", "", "Misc.", "Boss Pets"]]),
    });

    expect(result.warnings.map((w) => w.kind)).toContain("unknownTeam");
  });
});

describe("scoring — whole-team challenges listed on the team", () => {
  // Awards are not item drops, so they stay out of the uniques and drop counts
  // — otherwise "Most Team Uniques" would itself be a unique. A whole-team one
  // is collected onto the team instead, because with no player named there is
  // no drop breakdown anywhere that would otherwise show it.

  it("collects a whole-team award onto the team", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "", "Misc.", "Boss Pets"]]),
    });

    const [award] = team(result, "Lauren").awards;
    expect(award?.item).toBe("Boss Pets");
    expect(award?.category).toBe("Misc.");
    expect(award?.points).toBe(50);
    expect(award?.row).toBe(2);
  });

  it("does not list an award that names a player", () => {
    // That one shows in the player's own breakdown, so listing it on the team
    // as well would show the same award twice on two different pages.
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Misc.", "Boss Pets"]]),
    });

    expect(team(result, "Lauren").awards).toEqual([]);
    expect(player(result, "Charzbtw").drops).toHaveLength(1);
    expect(team(result, "Lauren").totalPoints).toBe(50);
  });

  it("keeps an individual award out of the team's item counts too", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Misc.", "Boss Pets"]]),
    });

    expect(team(result, "Lauren").uniques).toBe(0);
    expect(team(result, "Lauren").dropCount).toBe(0);
  });

  it("lists several awards oldest first", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "", "Team Challenges", "Team Challenge 1st"],
        ["Lauren", "", "Misc.", "Boss Pets"],
      ]),
    });

    expect(team(result, "Lauren").awards.map((a) => a.item)).toEqual([
      "Team Challenge 1st",
      "Boss Pets",
    ]);
  });

  it("shows the reduced points on a repeated award", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "", "Misc.", "Boss Pets"],
        ["Lauren", "", "Misc.", "Boss Pets"],
      ]),
    });

    // The quantity rules still apply, and the listing shows what each scored
    // rather than the catalog value, so 50 then 25 is visible on the card.
    expect(team(result, "Lauren").awards.map((a) => a.points)).toEqual([50, 25]);
  });

  it("gives each award a distinct key for rendering", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "", "Misc.", "Boss Pets"],
        ["Lauren", "", "Misc.", "Boss Pets"],
      ]),
    });

    const ids = team(result, "Lauren").awards.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leaves ordinary drops counted as before", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Lauren", "canofeesh", "Callisto", "Voidwaker hilt"],
        ["Lauren", "", "Team Challenges", "Team Challenge 1st"],
      ]),
    });

    const scored = team(result, "Lauren");
    expect(scored.uniques).toBe(2);
    expect(scored.dropCount).toBe(2);
    expect(scored.awards).toHaveLength(1);
    // The award still counts toward the total the leaderboard sorts on.
    expect(scored.totalPoints).toBe(240);
  });

  it("gives a team with no awards an empty list, not undefined", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"]]),
    });

    expect(team(result, "Lauren").awards).toEqual([]);
    expect(team(result, "Faedaa").awards).toEqual([]);
  });
});

describe("scoring — set completions and all-uniques rows", () => {
  // The sheet works these out itself: when a team collects every piece, it
  // awards the set. They arrive in the drop log as ordinary catalog entries,
  // so nothing here special-cases them — these tests exist to pin down that
  // the value the platform shows matches the catalog, whoever the row names.
  const BINGO = [
    "Category,Item,Key,Points,Full pts qty limit",
    "Nex,Torva Platebody,NexTorva Platebody,400,1",
    "Nex,Completed Torva,NexCompleted Torva,1200,1",
    "Armadyl,All Uniques (Not Shard),ArmadylAll Uniques (Not Shard),300,1",
  ].join("\n");

  it("scores a completed set at its catalog value", () => {
    const result = buildFixture({
      bingo: BINGO,
      drops: dropsCsv([["Lauren", "Charzbtw", "Nex", "Completed Torva"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(1200);
    expect(result.warnings).toEqual([]);
  });

  it("scores it the same when the row names nobody", () => {
    // A set spans several players, so the sheet may well leave User empty.
    const result = buildFixture({
      bingo: BINGO,
      drops: dropsCsv([["Lauren", "", "Nex", "Completed Torva"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(1200);
    expect(result.warnings).toEqual([]);
  });

  it("scores an all-uniques row at its catalog value", () => {
    const result = buildFixture({
      bingo: BINGO,
      drops: dropsCsv([["Lauren", "", "Armadyl", "All Uniques (Not Shard)"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(300);
  });

  it("counts a set as an item, not an award", () => {
    // It sits under a boss, so it belongs in the item statistics — unlike a
    // Misc. or Team Challenges row, which is listed separately instead.
    const result = buildFixture({
      bingo: BINGO,
      drops: dropsCsv([["Lauren", "", "Nex", "Completed Torva"]]),
    });

    const scored = team(result, "Lauren");
    expect(scored.uniques).toBe(1);
    expect(scored.dropCount).toBe(1);
    expect(scored.awards).toEqual([]);
  });

  it("adds the set on top of the pieces rather than replacing them", () => {
    const result = buildFixture({
      bingo: BINGO,
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Nex", "Torva Platebody"],
        ["Lauren", "", "Nex", "Completed Torva"],
      ]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(1600);
    expect(player(result, "Charzbtw").points).toBe(400);
  });

  it("halves a second set like any other repeated item", () => {
    const result = buildFixture({
      bingo: BINGO,
      drops: dropsCsv([
        ["Lauren", "", "Nex", "Completed Torva"],
        ["Lauren", "", "Nex", "Completed Torva"],
      ]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(1800);
  });

  it("flags a set name the catalog does not have", () => {
    // If the sheet ever renames one, it fails loudly rather than scoring 0.
    const result = buildFixture({
      bingo: BINGO,
      drops: dropsCsv([["Lauren", "", "Nex", "Completed Virtus"]]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(0);
    expect(result.warnings.map((w) => w.kind)).toContain("unknownItem");
  });
});

describe("scoring — a cap holds when the catalog name loses its suffix", () => {
  // The regression this guards. The cap used to be read only from a "(Limit 5)"
  // suffix on the catalog's item name. That is ordinary cell text: somebody
  // tidying the sheet removed it, and every cape after the first quietly went
  // back to half points, with nothing on the site to say so. The cap is an
  // event rule, so it is configured, and the sheet can no longer switch it off.
  const PLAIN = [
    "Category,Item,Key,Points,Full pts qty limit",
    "Zuk,Infernal Cape,ZukInfernal Cape,60,1",
    "Fortis Colosseum,Dizana's quiver,Fortis ColosseumDizana's quiver,50,1",
  ].join("\n");

  const capes = (n: number) =>
    dropsCsv(
      Array.from(
        { length: n },
        (): [string, string, string, string] => [
          "Lauren",
          "Charzbtw",
          "Zuk",
          "Infernal Cape",
        ],
      ),
    );

  it("gives all five capes full points with no suffix in the catalog", () => {
    const result = buildFixture({ bingo: PLAIN, drops: capes(5) });

    expect(team(result, "Lauren").totalPoints).toBe(300);
  });

  it("scores nothing past the fifth", () => {
    const result = buildFixture({ bingo: PLAIN, drops: capes(8) });

    expect(team(result, "Lauren").totalPoints).toBe(300);
  });

  it("marks the over-cap ones in the player breakdown", () => {
    const result = buildFixture({ bingo: PLAIN, drops: capes(7) });

    const drops = player(result, "Charzbtw").drops;
    expect(drops.map((d) => d.points)).toEqual([60, 60, 60, 60, 60, 0, 0]);
    expect(drops.map((d) => d.overCap)).toEqual([
      false, false, false, false, false, true, true,
    ]);
    expect(drops.every((d) => d.cap === 5)).toBe(true);
  });

  it("caps Dizana's quiver too, apostrophe and all", () => {
    const result = buildFixture({
      bingo: PLAIN,
      drops: dropsCsv(
        Array.from(
          { length: 7 },
          (): [string, string, string, string] => [
            "Lauren",
            "Charzbtw",
            "Fortis Colosseum",
            "Dizana's quiver",
          ],
        ),
      ),
    });

    expect(team(result, "Lauren").totalPoints).toBe(250);
  });

  it("still honours a suffix when the catalog does carry one", () => {
    const withSuffix = [
      "Category,Item,Key,Points,Full pts qty limit",
      "Zuk,Infernal Cape (Limit 5),ZukInfernal Cape (Limit 5),60,1",
    ].join("\n");

    const result = buildFixture({ bingo: withSuffix, drops: capes(7) });

    expect(team(result, "Lauren").totalPoints).toBe(300);
  });

  it("leaves an uncapped item on the usual full-then-half rule", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
      ]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(90);
  });
});

describe("scoring — All Uniques is derived, not logged", () => {
  // The sheet works this out with a formula. A formula fills in a cell; it
  // cannot append a row to the drop log, so the completion exists in the
  // sheet's own totals and in no row the site could ever read. The site works
  // it out from the catalog instead.
  const BINGO = [
    "Category,Item,Key,Points,Full pts qty limit",
    "Armadyl,Armadyl Chestplate,ArmadylArmadyl Chestplate,40,1",
    "Armadyl,Armadyl Chainskirt,ArmadylArmadyl Chainskirt,40,1",
    "Armadyl,Armadyl Helmet,ArmadylArmadyl Helmet,35,1",
    "Armadyl,Armadyl Hilt,ArmadylArmadyl Hilt,80,1",
    "Armadyl,Any Shard,ArmadylAny Shard,5,3",
    "Armadyl,All Uniques (Not Shard),ArmadylAll Uniques (Not Shard),300,1",
  ].join("\n");

  const piece = (item: string): [string, string, string, string] => [
    "Lauren",
    "Charzbtw",
    "Armadyl",
    item,
  ];
  const ALL_FOUR = [
    piece("Armadyl Chestplate"),
    piece("Armadyl Chainskirt"),
    piece("Armadyl Helmet"),
    piece("Armadyl Hilt"),
  ];

  it("awards it once the team holds every non-shard unique", () => {
    const result = buildFixture({ bingo: BINGO, drops: dropsCsv(ALL_FOUR) });

    // 40 + 40 + 35 + 80 = 195, plus the 300 completion.
    expect(team(result, "Lauren").totalPoints).toBe(495);
  });

  it("does not award it while a piece is missing", () => {
    const result = buildFixture({
      bingo: BINGO,
      drops: dropsCsv(ALL_FOUR.slice(0, 3)),
    });

    expect(team(result, "Lauren").totalPoints).toBe(115);
    expect(team(result, "Lauren").awards).toEqual([]);
  });

  it("does not need the shard, which is not a unique", () => {
    const result = buildFixture({ bingo: BINGO, drops: dropsCsv(ALL_FOUR) });

    expect(team(result, "Lauren").awards).toHaveLength(1);
  });

  it("lists it on the team, marked as derived", () => {
    const result = buildFixture({ bingo: BINGO, drops: dropsCsv(ALL_FOUR) });

    const [award] = team(result, "Lauren").awards;
    expect(award?.item).toBe("All Uniques (Not Shard)");
    expect(award?.category).toBe("Armadyl");
    expect(award?.points).toBe(300);
    expect(award?.derived).toBe(true);
    expect(award?.row).toBeNull();
  });

  it("does not pay twice when the row was also logged by hand", () => {
    // The one way this could double up: managers log it as well.
    const result = buildFixture({
      bingo: BINGO,
      drops: dropsCsv([...ALL_FOUR, piece("All Uniques (Not Shard)")]),
    });

    expect(team(result, "Lauren").totalPoints).toBe(495);
    // The logged row scored it, so nothing was derived on top.
    expect(team(result, "Lauren").awards).toEqual([]);
  });

  it("keeps it out of the uniques and drop counts", () => {
    const result = buildFixture({ bingo: BINGO, drops: dropsCsv(ALL_FOUR) });

    expect(team(result, "Lauren").uniques).toBe(4);
    expect(team(result, "Lauren").dropCount).toBe(4);
  });

  it("credits no player for it", () => {
    const result = buildFixture({ bingo: BINGO, drops: dropsCsv(ALL_FOUR) });

    // Nobody personally completed the set, so it stays a team figure.
    expect(player(result, "Charzbtw").points).toBe(195);
    expect(player(result, "Charzbtw").drops).toHaveLength(4);
  });

  it("counts per team, so one team's pieces do not complete another's", () => {
    const result = buildFixture({
      bingo: BINGO,
      drops: dropsCsv([
        ...ALL_FOUR.slice(0, 2),
        ["Faedaa", "MarylandRat", "Armadyl", "Armadyl Helmet"],
        ["Faedaa", "MarylandRat", "Armadyl", "Armadyl Hilt"],
      ]),
    });

    expect(team(result, "Lauren").awards).toEqual([]);
    expect(team(result, "Faedaa").awards).toEqual([]);
  });

  it("awards it from a duplicate as readily as a first", () => {
    // "Holds one" is the test, not "scored full points for one".
    const result = buildFixture({
      bingo: BINGO,
      drops: dropsCsv([...ALL_FOUR, piece("Armadyl Hilt")]),
    });

    expect(team(result, "Lauren").awards).toHaveLength(1);
  });

  it("does not derive a category whose only other entry is a shard", () => {
    // Nothing to complete, so awarding it would be free points on day one.
    const thin = [
      "Category,Item,Key,Points,Full pts qty limit",
      "Zuk,Any Shard,ZukAny Shard,5,1",
      "Zuk,All Uniques (Not Shard),ZukAll Uniques (Not Shard),300,1",
    ].join("\n");

    const result = buildFixture({
      bingo: thin,
      drops: dropsCsv([["Lauren", "Charzbtw", "Zuk", "Any Shard"]]),
    });

    expect(team(result, "Lauren").awards).toEqual([]);
    expect(team(result, "Lauren").totalPoints).toBe(5);
  });

  it("does not require a set completion, which is itself derived elsewhere", () => {
    // Nex lists "Completed Torva" alongside the pieces. Requiring it would make
    // one aggregate depend on another that may never have been logged.
    const nex = [
      "Category,Item,Key,Points,Full pts qty limit",
      "Nex,Torva Full Helm,NexTorva Full Helm,400,1",
      "Nex,Torva Platebody,NexTorva Platebody,400,1",
      "Nex,Nihil Horn,NexNihil Horn,400,1",
      "Nex,Completed Torva,NexCompleted Torva,1200,1",
      "Nex,All Uniques,NexAll Uniques,2400,1",
    ].join("\n");

    const result = buildFixture({
      bingo: nex,
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Nex", "Torva Full Helm"],
        ["Lauren", "Charzbtw", "Nex", "Torva Platebody"],
        ["Lauren", "Charzbtw", "Nex", "Nihil Horn"],
      ]),
    });

    expect(team(result, "Lauren").awards.map((a) => a.item)).toEqual([
      "All Uniques",
    ]);
    expect(team(result, "Lauren").totalPoints).toBe(3600);
  });
});
