import { describe, expect, it } from "vitest";
import { BINGO_ALL_COLUMNS } from "@/lib/catalog";
import { BONUS_COLUMNS } from "@/lib/bonus";
import { buildFixture, dropsCsv, player, team, BINGO_CSV } from "./helpers";

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
    expect(result.feed.every((entry) => !entry.halfPoints)).toBe(true);
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

    // The feed is newest-first, so reverse it to read the sequence in order.
    const sequence = [...result.feed].reverse().map((entry) => entry.points);
    expect(sequence).toEqual([5, 5, 5, 2.5, 2.5]);

    const flags = [...result.feed].reverse().map((entry) => entry.halfPoints);
    expect(flags).toEqual([false, false, false, true, true]);
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
    // The fourth logged is the one that loses full credit.
    const last = [...result.feed].reverse().at(-1)!;
    expect(last.player).toBe("canofeesh");
    expect(last.halfPoints).toBe(true);
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

describe("scoring — bonuses", () => {
  const bonusCsv = [
    BONUS_COLUMNS.join(","),
    "Lauren,Boss Pets,50,2026-07-27T12:00:00Z,Callisto pet",
    "Faedaa,Team Participation,25,,",
  ].join("\n");

  it("tracks bonus points separately from drop points", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"]]),
      bonus: bonusCsv,
    });

    const lauren = team(result, "Lauren");
    expect(lauren.dropPoints).toBe(60);
    expect(lauren.bonusPoints).toBe(50);
    expect(lauren.totalPoints).toBe(110);
    expect(lauren.bonuses).toHaveLength(1);
    expect(lauren.bonuses[0]!.notes).toBe("Callisto pet");
  });

  it("keeps bonuses out of player totals", () => {
    const result = buildFixture({
      drops: dropsCsv([["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"]]),
      bonus: bonusCsv,
    });

    expect(player(result, "Charzbtw").points).toBe(60);
  });

  it("awards points for an unrecognised bonus type but flags it", () => {
    const result = buildFixture({
      bonus: [BONUS_COLUMNS.join(","), "Lauren,Bosss Petz,50,,typo"].join("\n"),
    });

    expect(team(result, "Lauren").bonusPoints).toBe(50);
    expect(result.warnings.map((w) => w.kind)).toContain("unknownBonusType");
  });

  it("skips a bonus for an unknown team and says so", () => {
    const result = buildFixture({
      bonus: [BONUS_COLUMNS.join(","), "Team Rocket,Jars,50,,"].join("\n"),
    });

    const warning = result.warnings.find((w) => w.kind === "unknownTeam");
    expect(warning?.value).toBe("Team Rocket");
    expect(result.teams.every((t) => t.bonusPoints === 0)).toBe(true);
  });

  it("skips a bonus whose points cell is broken", () => {
    const result = buildFixture({
      bonus: [BONUS_COLUMNS.join(","), "Lauren,Jars,#REF!,,"].join("\n"),
    });

    expect(team(result, "Lauren").bonusPoints).toBe(0);
    expect(result.warnings.map((w) => w.kind)).toContain("unparsedNumber");
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
    const result = buildFixture({ bingo: "", teams: "", drops: "", bonus: "" });

    expect(result.teams).toEqual([]);
    expect(result.players).toEqual([]);
    expect(result.feed).toEqual([]);
  });

  it("does not read the sheet's own Points Earned or Multiplier columns", () => {
    const csv = [
      "Team,User,Boss,Drop,Points Earned,Multiplier",
      // The sheet claims 9999 points at 3x. Both are ignored.
      "Lauren,Charzbtw,Callisto,Dragon 2h sword,9999,3",
    ].join("\n");

    const result = buildFixture({ drops: csv });

    expect(team(result, "Lauren").dropPoints).toBe(60);
    expect(result.feed[0]!.multiplier).toBe(1);
  });
});

describe("scoring — claims feed the boss progress view", () => {
  it("records which teams have claimed each catalog entry", () => {
    const result = buildFixture({
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Faedaa", "MarylandRat", "Callisto", "Dragon 2h sword"],
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
      ]),
    });

    expect(result.claims.get("callisto|dragon 2h sword")).toEqual([
      "Lauren",
      "Faedaa",
    ]);
    expect(result.claims.get("callisto|voidwaker hilt")).toBeUndefined();
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

describe("scoring — bonus points come from the catalog when the tab omits them", () => {
  const bingo = [
    "Misc.,,",
    ",Boss Pets,250",
    ",Jars,100",
    "Team Challenges,,",
    ",Team 1st,400",
    "Callisto,,",
    ",Dragon 2h sword,60",
  ].join("\n");

  it("looks up the points for a bonus whose points cell is blank", () => {
    const result = buildFixture({
      bingo,
      bonus: [BONUS_COLUMNS.join(","), "Lauren,Boss Pets,,,Callisto pet"].join("\n"),
    });

    expect(team(result, "Lauren").bonusPoints).toBe(250);
    expect(result.warnings.filter((w) => w.kind === "unknownBonusType")).toEqual([]);
  });

  it("lets an explicit points value override the catalog", () => {
    const result = buildFixture({
      bingo,
      bonus: [BONUS_COLUMNS.join(","), "Lauren,Boss Pets,75,,half award"].join("\n"),
    });

    expect(team(result, "Lauren").bonusPoints).toBe(75);
  });

  it("accepts a bonus type the catalog defines but the config list does not", () => {
    // The sheet says "Team 1st"; the hard-coded fallback list says
    // "Team Challenge 1st". The catalog is the authority.
    const result = buildFixture({
      bingo,
      bonus: [BONUS_COLUMNS.join(","), "Oops,Team 1st,,,week 1"].join("\n"),
    });

    expect(team(result, "Oops").bonusPoints).toBe(400);
    expect(result.warnings.filter((w) => w.kind === "unknownBonusType")).toEqual([]);
  });

  it("flags a bonus type in neither the catalog nor the config list", () => {
    const result = buildFixture({
      bingo,
      bonus: [BONUS_COLUMNS.join(","), "Lauren,Bosss Petz,50,,typo"].join("\n"),
    });

    expect(team(result, "Lauren").bonusPoints).toBe(50);
    expect(result.warnings.map((w) => w.kind)).toContain("unknownBonusType");
  });

  it("skips a bonus with no points anywhere and says where to look", () => {
    const result = buildFixture({
      bingo,
      bonus: [BONUS_COLUMNS.join(","), "Lauren,Mystery Award,,,"].join("\n"),
    });

    expect(team(result, "Lauren").bonusPoints).toBe(0);
    const warning = result.warnings.find((w) => w.kind === "unparsedNumber");
    expect(warning?.message).toContain("item catalog");
  });
});
