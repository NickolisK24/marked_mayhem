import { describe, expect, it } from "vitest";
import { describeHttpStatus, tabUrl } from "@/lib/sheet";

describe("tabUrl", () => {
  it("builds the gviz CSV url", () => {
    expect(tabUrl("abc123", "BINGO", "https://docs.google.com")).toBe(
      "https://docs.google.com/spreadsheets/d/abc123/gviz/tq?tqx=out:csv&sheet=BINGO",
    );
  });

  it("escapes tab names with spaces and symbols", () => {
    expect(tabUrl("abc123", "Team Challenges", "https://x")).toContain(
      "sheet=Team%20Challenges",
    );
  });
});

describe("describeHttpStatus", () => {
  it("names link sharing — not publishing — as the fix for 401 and 403", () => {
    for (const status of [401, 403]) {
      const message = describeHttpStatus(status, "BINGO");
      expect(message).toContain("Anyone with the link");
      // The misleading advice: publishing to the web does not fix a 401, and
      // telling someone who has just published to publish again is a dead end.
      expect(message).toContain("not enough");
      expect(message).not.toMatch(/check the sheet is published/i);
    }
  });

  it("points at the tab name for 400 and 404", () => {
    expect(describeHttpStatus(404, "BINGO")).toContain('"BINGO"');
    expect(describeHttpStatus(400, "DROPS")).toContain('"DROPS"');
  });

  it("says a 5xx is Google's problem, not the sheet's", () => {
    expect(describeHttpStatus(503, "DROPS")).toContain("their end");
  });

  it("still says something useful for an unexpected status", () => {
    expect(describeHttpStatus(418, "DROPS")).toContain("418");
  });
});
