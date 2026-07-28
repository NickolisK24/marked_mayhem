import { describe, expect, it } from "vitest";
import { buildPayload } from "@/lib/payload";
import type { TabConfig } from "@/config/event";
import { BINGO_CSV, TEAMS_CSV, dropsCsv } from "./helpers";

const TABS: TabConfig = {
  drops: "DROPS",
  bingo: "BINGO",
  teams: "TEAMS",
  rules: "RULES",
};

const NOW = Date.parse("2026-07-27T12:00:00Z");

function build(overrides: Partial<Parameters<typeof buildPayload>[0]> = {}) {
  return buildPayload(
    {
      bingo: BINGO_CSV,
      teams: TEAMS_CSV,
      drops: dropsCsv([
        ["Lauren", "Charzbtw", "Callisto", "Dragon 2h sword"],
        ["Faedaa", "MarylandRat", "Venenatis", "Treasonous ring"],
      ]),
      rules: "Rules\n1. Be excellent to each other\n\n2. Two accounts allowed",
      ...overrides,
    },
    TABS,
    [],
    NOW,
  );
}

describe("buildPayload", () => {
  it("assembles a complete payload", () => {
    const payload = build();

    expect(payload.generatedAt).toBe(NOW);
    expect(payload.stale).toBe(false);
    expect(payload.teams).toHaveLength(4);
    expect(payload.teams[0]!.name).toBe("Lauren");
    expect(payload.teams[0]!.totalPoints).toBe(60);
    expect(payload.rosters).toHaveLength(4);
    expect(payload.tabErrors).toEqual([]);
    // The event window travels in the payload so the header can render all
    // three phases without importing config into a client component.
    expect(payload.eventStart).toBe("2026-07-30T17:00:00-04:00");
    expect(payload.eventEnd).toBe("2026-08-09T17:00:00-04:00");
  });

  it("reads rules line by line, keeping the first row", () => {
    const payload = build();

    expect(payload.rules).toEqual([
      "Rules",
      "1. Be excellent to each other",
      "2. Two accounts allowed",
    ]);
  });

  it("works without the optional catalog columns", () => {
    // Key is never used for scoring and Full pts qty limit defaults to 1, so
    // neither is required — losing them must not raise a tab error.
    const payload = build({
      bingo: "Category,Item,Price,Points\nCallisto,Any Shard,100,5",
    });

    expect(payload.tabErrors.find((e) => e.tab === "BINGO")).toBeUndefined();
    expect(payload.teams).toHaveLength(4);
  });

  it("names the tab and the column when the catalog loses Points", () => {
    const payload = build({
      bingo: "Category,Item,Price\nCallisto,Any Shard,100",
    });

    const error = payload.tabErrors.find((e) => e.tab === "BINGO");
    expect(error?.problem).toContain("Points");
  });

  it("names the tab when the drop log loses a column", () => {
    const payload = build({ drops: "Team,User\nLauren,Charzbtw" });

    const error = payload.tabErrors.find((e) => e.tab === "DROPS");
    expect(error?.problem).toContain("Boss");
    expect(error?.problem).toContain("Drop");
  });

  it("reports an unreadable roster instead of rendering an empty site", () => {
    const payload = build({ teams: "nothing useful here\n" });

    const error = payload.tabErrors.find((e) => e.tab === "TEAMS");
    expect(error?.problem).toContain("No players could be read");
  });

  it("survives every optional tab being unavailable", () => {
    const payload = build({ drops: null, rules: null });

    expect(payload.teams).toHaveLength(4);
    expect(payload.teams.every((team) => team.totalPoints === 0)).toBe(true);
    expect(payload.rules).toEqual([]);
    // A tab that failed to fetch is reported by the route, not invented here.
    expect(payload.tabErrors).toEqual([]);
  });

  it("carries fetch errors through untouched", () => {
    const payload = buildPayload(
      { bingo: BINGO_CSV, teams: TEAMS_CSV, drops: null, rules: null },
      TABS,
      [{ tab: "DROPS", problem: "Tab not found (HTTP 404)." }],
      NOW,
    );

    expect(payload.tabErrors).toEqual([
      { tab: "DROPS", problem: "Tab not found (HTTP 404)." },
    ]);
    expect(payload.teams).toHaveLength(4);
  });

  it("scores a long drop log without truncating it", () => {
    const rows = Array.from({ length: 60 }, () =>
      ["Lauren", "Charzbtw", "Callisto", "Any Shard"] as [
        string,
        string,
        string,
        string,
      ],
    );
    const payload = build({ drops: dropsCsv(rows) });

    const lauren = payload.teams.find((t) => t.name === "Lauren")!;
    expect(lauren.dropCount).toBe(60);
    // Limit of 3: three at 5 points, then 57 at half.
    expect(lauren.totalPoints).toBe(3 * 5 + 57 * 2.5);
  });

  it("never throws on garbage in every tab", () => {
    expect(() =>
      buildPayload(
        {
          bingo: "#REF!\n#REF!,#REF!",
          teams: "#REF!",
          drops: ",,,,\n#N/A,#N/A",
          rules: "#REF!",
        },
        TABS,
        [],
        NOW,
      ),
    ).not.toThrow();
  });
});
