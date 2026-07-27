import { describe, expect, it } from "vitest";
import { buildAliasIndex, splitRsns } from "@/lib/aliases";
import { parseTable } from "@/lib/csv";
import { buildRoster } from "@/lib/roster";
import type { Player } from "@/lib/types";
import { TEAMS_CSV } from "./helpers";

function roster(csv = TEAMS_CSV) {
  return buildRoster(parseTable(csv), "TEAMS");
}

describe("splitRsns", () => {
  it("splits on a slash", () => {
    expect(splitRsns("Charzbtw/scuffdcharz")).toEqual([
      "Charzbtw",
      "scuffdcharz",
    ]);
  });

  it("splits on a slash with surrounding spaces", () => {
    expect(splitRsns("Haxoonie / Maxoonie")).toEqual(["Haxoonie", "Maxoonie"]);
  });

  it("splits on a comma", () => {
    expect(splitRsns("canofeesh, can o fish")).toEqual([
      "canofeesh",
      "can o fish",
    ]);
  });

  it("keeps a single name intact", () => {
    expect(splitRsns("MarylandRat")).toEqual(["MarylandRat"]);
  });

  it("preserves legitimate internal spaces", () => {
    expect(splitRsns("can o fish")).toEqual(["can o fish"]);
  });

  it("drops empty segments from trailing separators", () => {
    expect(splitRsns("Zezima/")).toEqual(["Zezima"]);
    expect(splitRsns("  ")).toEqual([]);
  });
});

describe("alias resolution", () => {
  it("resolves both accounts of a slash-separated pair to one player", () => {
    const { roster: r } = roster();
    const first = r.resolve("Charzbtw");
    const second = r.resolve("scuffdcharz");
    expect(first?.displayName).toBe("Charzbtw");
    expect(second?.id).toBe(first?.id);
  });

  it("resolves comma-separated aliases", () => {
    const { roster: r } = roster();
    expect(r.resolve("can o fish")?.id).toBe(r.resolve("canofeesh")?.id);
  });

  it("resolves case-insensitively", () => {
    const { roster: r } = roster();
    expect(r.resolve("MARYLANDRAT")?.displayName).toBe("MarylandRat");
    expect(r.resolve("marylandrat")?.displayName).toBe("MarylandRat");
  });

  it("normalises leading, trailing and repeated whitespace", () => {
    const { roster: r } = roster();
    expect(r.resolve("  Haxoonie  ")?.displayName).toBe("Haxoonie");
    expect(r.resolve("can  o   fish")?.displayName).toBe("canofeesh");
  });

  it("repairs stray internal spaces in roster names", () => {
    // The roster says "harmon y" and "Cambrid ge"; the drop log will not.
    const { roster: r } = roster();
    expect(r.resolve("harmony")?.team).toBe("harmony");
    expect(r.resolve("Cambridge")?.displayName).toBe("Cambrid ge");
  });

  it("keeps MarylandRat and MarylandFlag distinct", () => {
    const { roster: r } = roster();
    expect(r.resolve("MarylandRat")?.team).toBe("Faedaa");
    expect(r.resolve("MarylandFlag")?.team).toBe("Faedaa");
    expect(r.resolve("MarylandRat")?.id).not.toBe(r.resolve("MarylandFlag")?.id);
  });

  it("returns null for an unknown RSN instead of guessing at a near match", () => {
    const { roster: r } = roster();
    expect(r.resolve("Charzbtww")).toBeNull();
    expect(r.resolve("SomeRandomGuy")).toBeNull();
    expect(r.resolve("")).toBeNull();
  });

  it("refuses to guess when two players differ only in spacing", () => {
    const players: Player[] = [
      mkPlayer("p1", "Iron Man", "Lauren"),
      mkPlayer("p2", "IronMan", "Faedaa"),
    ];
    const index = buildAliasIndex(players, "TEAMS");

    // Each exact spelling still resolves to the right player.
    expect(index.resolve("Iron Man")?.id).toBe("p1");
    expect(index.resolve("IronMan")?.id).toBe("p2");

    // A third spelling matches neither exactly and would be ambiguous under the
    // space-stripping repair, so it resolves to null and surfaces as a warning
    // rather than handing another team's player the points.
    expect(index.resolve("Iron  Man ")?.id).toBe("p1"); // normalises to "iron man"
    expect(index.resolve("I ronMan")).toBeNull();
    expect(index.resolve("Ir on Man")).toBeNull();
  });

  it("flags the same RSN appearing on two teams", () => {
    const players: Player[] = [
      mkPlayer("p1", "Zezima", "Lauren"),
      mkPlayer("p2", "Zezima", "Faedaa"),
    ];
    const index = buildAliasIndex(players, "TEAMS");
    expect(index.warnings).toHaveLength(1);
    expect(index.warnings[0]!.kind).toBe("rosterAmbiguousAlias");
    // First listing wins, deterministically.
    expect(index.resolve("Zezima")?.id).toBe("p1");
  });
});

describe("roster parsing", () => {
  it("reads the wide layout into four teams of three", () => {
    const { roster: r, layout } = roster();
    expect(layout).toBe("wide");
    expect(r.teams.map((t) => t.name)).toEqual([
      "Lauren",
      "Faedaa",
      "Oops",
      "harmony",
    ]);
    expect(r.teams.every((t) => t.players.length === 3)).toBe(true);
  });

  it("reads EHB brackets from the column beside each team", () => {
    const { roster: r } = roster();
    expect(r.resolve("Charzbtw")?.ehb).toBe("500-999");
    expect(r.resolve("Woox")?.ehb).toBe("100-499");
  });

  it("reads the long layout too", () => {
    const csv = [
      "Team,Player,EHB Bracket",
      "Lauren,Charzbtw/scuffdcharz,500-999",
      "Faedaa,MarylandRat,100-499",
    ].join("\n");
    const { roster: r, layout } = roster(csv);
    expect(layout).toBe("long");
    expect(r.teams.map((t) => t.name)).toEqual(["Lauren", "Faedaa"]);
    expect(r.resolve("scuffdcharz")?.ehb).toBe("500-999");
  });

  it("identifies captains by name", () => {
    const { roster: r } = roster();
    expect(r.teams.find((t) => t.name === "Lauren")?.captain).toBe("Lauren");
    expect(r.resolve("Lauren")?.isCaptain).toBe(true);
    expect(r.resolve("Charzbtw")?.isCaptain).toBe(false);
  });

  it("identifies a captain whose roster name has a stray space", () => {
    // The sheet says "harmon y"; the captain list says "harmony".
    const { roster: r } = roster();
    expect(r.resolve("harmony")?.isCaptain).toBe(true);
    expect(r.teams.find((t) => t.name === "harmony")?.captain).toBe("harmon y");
  });

  it("resolves team names case-insensitively", () => {
    const { roster: r } = roster();
    expect(r.resolveTeam("lauren")).toBe("Lauren");
    expect(r.resolveTeam("  FAEDAA ")).toBe("Faedaa");
    expect(r.resolveTeam("Team Rocket")).toBeNull();
  });

  it("reports a layout it cannot read rather than throwing", () => {
    const { layout, roster: r } = roster("\n");
    expect(layout).toBe("none");
    expect(r.players).toHaveLength(0);
  });
});

function mkPlayer(id: string, rsn: string, team: string): Player {
  return {
    id,
    displayName: rsn,
    rsns: [rsn],
    team,
    ehb: "",
    isCaptain: false,
    row: 2,
  };
}
