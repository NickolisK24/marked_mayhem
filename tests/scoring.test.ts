import { describe, expect, it } from "vitest";
import {
  buildFixture,
  dropsCsv,
  dropsWithBonusCsv,
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

    expect(team(result, "Lauren").dropPoints).toBe(60);
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
    expect(team(result, "Lauren").dropPoints).toBe(135);
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

    expect(team(result, "harmony").dropPoints).toBe(80);
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
    expect(team(result, "Lauren").dropPoints).toBe(120);
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
    expect(team(result, "Lauren").dropPoints).toBe(20);

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
    expect(team(result, "Lauren").dropPoints).toBe(60);
    expect(team(result, "Faedaa").dropPoints).toBe(60);
  });

  it("counts the limit per item, not per boss", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Any Shard"],
        ["Lauren", "Charzbtw", "Chaos Elemental", "Any Shard"],
      ]),
    });

    // Different catalog entries, so each is the team's first of that entry.
    expect(team(result, "Lauren").dropPoints).toBe(10);
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

describe("scoring — bonus points from the drop log's Bonus column", () => {
  it("adds a bonus on a drop row to the team, on top of the drop's points", () => {
    const result = buildFixture({
      drops: dropsWithBonusCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword", "250"],
      ]),
    });

    const lauren = team(result, "Lauren");
    expect(lauren.dropPoints).toBe(60);
    expect(lauren.bonusPoints).toBe(250);
    expect(lauren.totalPoints).toBe(310);
    expect(result.warnings).toEqual([]);
  });

  it("accepts a bonus-only row with no boss or item", () => {
    const result = buildFixture({
      drops: dropsWithBonusCsv([["Lauren", "Charzbtw", "", "", "400"]]),
    });

    const lauren = team(result, "Lauren");
    expect(lauren.dropPoints).toBe(0);
    expect(lauren.bonusPoints).toBe(400);
    expect(lauren.dropCount).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it("awards a bonus row that names only a team, with no player", () => {
    const result = buildFixture({
      drops: dropsWithBonusCsv([["harmony", "", "", "", "50"]]),
    });

    expect(team(result, "harmony").bonusPoints).toBe(50);
    expect(result.warnings).toEqual([]);
  });

  it("keeps bonus points out of individual player totals", () => {
    const result = buildFixture({
      drops: dropsWithBonusCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword", "250"],
      ]),
    });

    expect(player(result, "Charzbtw").points).toBe(60);
  });

  it("sums several bonus rows for the same team", () => {
    const result = buildFixture({
      drops: dropsWithBonusCsv([
        ["Lauren", "Charzbtw", "", "", "250"],
        ["Lauren", "canofeesh", "", "", "100"],
        ["Faedaa", "MarylandRat", "", "", "75"],
      ]),
    });

    expect(team(result, "Lauren").bonusPoints).toBe(350);
    expect(team(result, "Faedaa").bonusPoints).toBe(75);
  });

  it("reads comma-formatted and negative bonus values", () => {
    const result = buildFixture({
      drops: dropsWithBonusCsv([
        ["Lauren", "Charzbtw", "", "", "1,250"],
        ["Lauren", "canofeesh", "", "", "-50"],
      ]),
    });

    expect(team(result, "Lauren").bonusPoints).toBe(1200);
  });

  it("ignores a blank, zero or broken Bonus cell without warning", () => {
    const result = buildFixture({
      drops: dropsWithBonusCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword", ""],
        ["Lauren", "canofeesh", "Callisto", "Voidwaker hilt", "0"],
        ["Faedaa", "MarylandRat", "Venenatis", "Treasonous ring", "#REF!"],
      ]),
    });

    expect(team(result, "Lauren").bonusPoints).toBe(0);
    expect(team(result, "Faedaa").bonusPoints).toBe(0);
    expect(team(result, "Lauren").dropPoints).toBe(140);
    expect(result.warnings).toEqual([]);
  });

  it("flags a bonus with nobody to award it to", () => {
    const result = buildFixture({
      drops: dropsWithBonusCsv([["", "", "", "", "500"]]),
    });

    expect(result.teams.every((t) => t.bonusPoints === 0)).toBe(true);
    const warning = result.warnings.find((w) => w.kind === "incompleteRow");
    expect(warning?.message).toContain("nobody to award it to");
  });

  it("flags a bonus for a team that is not on the roster", () => {
    const result = buildFixture({
      drops: dropsWithBonusCsv([["Team Rocket", "", "", "", "500"]]),
    });

    expect(result.teams.every((t) => t.bonusPoints === 0)).toBe(true);
    expect(result.warnings.map((w) => w.kind)).toContain("unknownTeam");
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

    expect(team(result, "Lauren").dropPoints).toBe(80);
    const warning = result.warnings.find((w) => w.kind === "unknownPlayer");
    expect(warning?.value).toBe("SomeRandomGuy");
    expect(warning?.row).toBe(2);
  });

  it("skips an unknown item at a known boss", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Dragon 2h swrod"]]),
    });

    expect(team(result, "Lauren").dropPoints).toBe(0);
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
    expect(team(result, "Lauren").dropPoints).toBe(0);
    expect(result.warnings.map((w) => w.kind)).toContain("unknownItem");
  });

  it("refuses to score a bonus-category row logged in the drop log", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Misc.", "Boss Pets"]]),
    });

    expect(team(result, "Lauren").dropPoints).toBe(0);
    // Misc. is not a boss category, so it does not exist in the join map.
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("trusts the roster over the drop log's Team column, and flags the clash", () => {
    const result = buildFixture({
      drops: dropsCsv([["Faedaa", "Charzbtw", "Callisto", "Dragon 2h sword"]]),
    });

    expect(team(result, "Lauren").dropPoints).toBe(60);
    expect(team(result, "Faedaa").dropPoints).toBe(0);
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

    expect(team(result, "Lauren").dropPoints).toBe(80);
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

    expect(team(result, "Lauren").dropPoints).toBe(60);
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

    expect(team(result, "Lauren").dropPoints).toBe(60);
    expect(team(result, "Lauren").bonusPoints).toBe(0);
  });
});

describe("scoring — catalog integrity", () => {
  it("excludes bonus categories from the scoreable catalog", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Team Challenges", "Team Challenge 1st"]]),
    });

    expect(team(result, "Lauren").dropPoints).toBe(0);
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

    expect(team(result, "Lauren").dropPoints).toBe(60);
  });
});

describe("scoring — an item drop still needs a rostered player", () => {
  it("does not credit an item to the team named on the row when the RSN is unknown", () => {
    // A bonus may be awarded from the Team column alone, but an item may not:
    // that would move points on the strength of a hand-typed cell.
    const result = buildFixture({
      drops: dropsWithBonusCsv([
        ["Lauren", "SomeRandomGuy", "Callisto", "Dragon 2h sword", ""],
      ]),
    });

    expect(team(result, "Lauren").dropPoints).toBe(0);
    expect(result.warnings.map((w) => w.kind)).toContain("unknownPlayer");
  });

  it("still awards the bonus on that same row", () => {
    const result = buildFixture({
      drops: dropsWithBonusCsv([
        ["Lauren", "SomeRandomGuy", "Callisto", "Dragon 2h sword", "250"],
      ]),
    });

    expect(team(result, "Lauren").bonusPoints).toBe(250);
    expect(team(result, "Lauren").dropPoints).toBe(0);
  });

  it("flags an item row with no User at all", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "", "Callisto", "Dragon 2h sword"]]),
    });

    expect(team(result, "Lauren").dropPoints).toBe(0);
    const warning = result.warnings.find((w) => w.kind === "unknownPlayer");
    expect(warning?.message).toContain("no User");
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

  it("keeps bonus-only rows out of the drop breakdown", () => {
    const result = buildFixture({
      drops: dropsWithBonusCsv([["Lauren", "Charzbtw", "", "", "250"]]),
    });

    expect(player(result, "Charzbtw").drops).toEqual([]);
    expect(team(result, "Lauren").bonusPoints).toBe(250);
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
    expect(team(result, "Lauren").dropPoints).toBe(60);
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

    expect(team(result, "Lauren").dropPoints).toBe(60);
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
    expect(team(result, "Lauren").dropPoints).toBe(60);
  });

  it("scores all five capes in full — there is no half tier for a capped item", () => {
    const result = buildFixture({ bingo, drops: capes(5) });
    // 60 x 5
    expect(team(result, "Lauren").dropPoints).toBe(300);
  });

  it("scores nothing for the sixth cape and beyond", () => {
    const result = buildFixture({ bingo, drops: capes(9) });
    expect(team(result, "Lauren").dropPoints).toBe(300);
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

    expect(team(result, "Lauren").dropPoints).toBe(300);
    expect(team(result, "Faedaa").dropPoints).toBe(300);
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
    expect(team(result, "Lauren").dropPoints).toBe(40 + 8 * 20);
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
    expect(team(result, "Lauren").dropPoints).toBe(250);
  });

  it("matches a drop that does carry the suffix too", () => {
    const result = buildFixture({
      bingo,
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Zuk", "Infernal Cape (Limit 5)"],
      ]),
    });

    expect(team(result, "Lauren").dropPoints).toBe(60);
    expect(result.warnings).toEqual([]);
  });

  it("never shows the suffix in the item name", () => {
    const result = buildFixture({ bingo, drops: capes(1) });
    expect(player(result, "Charzbtw").drops[0]!.item).toBe("Infernal Cape");
  });
});
