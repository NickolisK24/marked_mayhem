import { describe, expect, it } from "vitest";
import { buildPayload } from "@/lib/payload";
import type { TabConfig } from "@/config/event";
import { BONUS_COLUMNS } from "@/lib/bonus";
import { BINGO_CSV, TEAMS_CSV, dropsCsv } from "./helpers";

const TABS: TabConfig = {
  drops: "DROPS",
  bingo: "BINGO",
  teams: "TEAMS",
  rules: "RULES",
  bonus: "BONUS",
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
      bonus: [BONUS_COLUMNS.join(","), "Lauren,Boss Pets,50,,pet"].join("\n"),
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
    expect(payload.teams[0]!.totalPoints).toBe(110);
    expect(payload.rosters).toHaveLength(4);
    expect(payload.tabErrors).toEqual([]);
  });

  it("groups boss progress by category and marks claims", () => {
    const payload = build();

    const callisto = payload.bosses.find((b) => b.boss === "Callisto");
    expect(callisto?.items).toHaveLength(3);
    expect(callisto?.claimedCount).toBe(1);

    const sword = callisto?.items.find((i) => i.item === "Dragon 2h sword");
    expect(sword?.claimedBy).toEqual(["Lauren"]);
    expect(sword?.points).toBe(60);

    const hilt = callisto?.items.find((i) => i.item === "Voidwaker hilt");
    expect(hilt?.claimedBy).toEqual([]);
  });

  it("keeps bonus categories out of boss progress", () => {
    const payload = build();

    expect(payload.bosses.map((b) => b.boss)).not.toContain("Misc.");
    expect(payload.bosses.map((b) => b.boss)).not.toContain("Team Challenges");
    expect(payload.bonusCatalog.map((e) => e.item)).toContain("Boss Pets");
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
    const callisto = payload.bosses.find((b) => b.boss === "Callisto");
    expect(callisto?.items[0]?.fullPointsLimit).toBe(1);
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
    const payload = build({ drops: null, bonus: null, rules: null });

    expect(payload.teams).toHaveLength(4);
    expect(payload.feed).toEqual([]);
    expect(payload.rules).toEqual([]);
    // A tab that failed to fetch is reported by the route, not invented here.
    expect(payload.tabErrors).toEqual([]);
  });

  it("carries fetch errors through untouched", () => {
    const payload = buildPayload(
      { bingo: BINGO_CSV, teams: TEAMS_CSV, drops: null, bonus: null, rules: null },
      TABS,
      [{ tab: "DROPS", problem: "Tab not found (HTTP 404)." }],
      NOW,
    );

    expect(payload.tabErrors).toEqual([
      { tab: "DROPS", problem: "Tab not found (HTTP 404)." },
    ]);
    expect(payload.teams).toHaveLength(4);
  });

  it("caps the feed and orders it newest first", () => {
    const rows = Array.from({ length: 60 }, () =>
      ["Lauren", "Charzbtw", "Callisto", "Any Shard"] as [
        string,
        string,
        string,
        string,
      ],
    );
    const payload = build({ drops: dropsCsv(rows) });

    expect(payload.feed).toHaveLength(50);
    expect(payload.feed[0]!.row).toBe(61);
    expect(payload.feed[0]!.halfPoints).toBe(true);
  });

  it("never throws on garbage in every tab", () => {
    expect(() =>
      buildPayload(
        {
          bingo: "#REF!\n#REF!,#REF!",
          teams: "#REF!",
          drops: ",,,,\n#N/A,#N/A",
          bonus: "#REF!",
          rules: "#REF!",
        },
        TABS,
        [],
        NOW,
      ),
    ).not.toThrow();
  });
});
