import { describe, expect, it } from "vitest";
import { looksLikeCsv, parseCsv, parseTable, toTable } from "@/lib/csv";
import { parseLimit, parseNumber, parseTimestamp } from "@/lib/numbers";

describe("parseCsv", () => {
  it("parses plain rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCsv('Team,Price\nLauren,"40,331,957"')).toEqual([
      ["Team", "Price"],
      ["Lauren", "40,331,957"],
    ]);
  });

  it("handles escaped quotes and embedded newlines", () => {
    const rows = parseCsv('a,"say ""hi""","line1\nline2"');
    expect(rows).toEqual([["a", 'say "hi"', "line1\nline2"]]);
  });

  it("handles CRLF line endings and a UTF-8 BOM", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns no rows for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("keeps empty trailing fields", () => {
    expect(parseCsv("a,b,\n")).toEqual([["a", "b", ""]]);
  });
});

describe("looksLikeCsv", () => {
  it("rejects the HTML page gviz serves for an unpublished sheet", () => {
    expect(looksLikeCsv("<!DOCTYPE html><html><head>")).toBe(false);
  });

  it("rejects a gviz JS callback response", () => {
    expect(
      looksLikeCsv('/*O_o*/\ngoogle.visualization.Query.setResponse({...})'),
    ).toBe(false);
  });

  it("accepts real CSV", () => {
    expect(looksLikeCsv("Team,User,Boss,Drop\n")).toBe(true);
  });
});

describe("toTable", () => {
  it("reports missing required columns instead of throwing", () => {
    const table = parseTable("Team,User\nLauren,Charzbtw", [
      "Team",
      "User",
      "Boss",
      "Drop",
    ]);
    expect(table.missingColumns).toEqual(["Boss", "Drop"]);
    expect(table.rows).toHaveLength(1);
    // A missing column reads as empty rather than blowing up the row.
    expect(table.rows[0]!.get("Boss")).toBe("");
    expect(table.rows[0]!.has("Boss")).toBe(false);
  });

  it("matches headers case- and whitespace-insensitively", () => {
    const table = parseTable("  FULL pts   qty limit ,Item\n3,Any Shard");
    expect(table.rows[0]!.get("Full pts qty limit")).toBe("3");
  });

  it("drops fully blank rows silently", () => {
    const table = parseTable("Team,User\n,\nLauren,Charzbtw\n   ,  \n");
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]!.get("User")).toBe("Charzbtw");
  });

  it("reports spreadsheet row numbers a staff member would recognise", () => {
    const table = parseTable("Team,User\n,\nLauren,Charzbtw");
    // Header is row 1, the blank is row 2, so the real row is 3.
    expect(table.rows[0]!.row).toBe(3);
  });

  it("returns every required column as missing for an empty tab", () => {
    expect(toTable([], ["Team"]).missingColumns).toEqual(["Team"]);
  });

  it("ignores a duplicated header rather than shadowing the first", () => {
    const table = parseTable("Item,Price,Item\nAny Shard,100,WRONG");
    expect(table.rows[0]!.get("Item")).toBe("Any Shard");
  });
});

describe("parseNumber", () => {
  it("parses comma-formatted prices", () => {
    expect(parseNumber("40,331,957")).toBe(40_331_957);
  });

  it("parses currency and zero", () => {
    expect(parseNumber("$0")).toBe(0);
    expect(parseNumber("$1,250")).toBe(1250);
  });

  it("parses k/m/b shorthand", () => {
    expect(parseNumber("1.4b")).toBe(1_400_000_000);
    expect(parseNumber("315m")).toBe(315_000_000);
  });

  it("returns null — never 0 — for spreadsheet errors", () => {
    for (const cell of ["#REF!", "#N/A", "#VALUE!", "#DIV/0!", "#NAME?"]) {
      expect(parseNumber(cell), cell).toBeNull();
    }
  });

  it("returns null for blanks and junk", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("   ")).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber("tbd")).toBeNull();
    expect(parseNumber("1.2.3")).toBeNull();
  });

  it("never returns NaN", () => {
    for (const cell of ["#REF!", "abc", "", "-", "$"]) {
      const value = parseNumber(cell);
      expect(value === null || Number.isFinite(value), cell).toBe(true);
    }
  });

  it("parses negatives in both notations", () => {
    expect(parseNumber("-500")).toBe(-500);
    expect(parseNumber("(500)")).toBe(-500);
  });
});

describe("parseLimit", () => {
  it("defaults to 1 when blank or broken", () => {
    expect(parseLimit("")).toBe(1);
    expect(parseLimit("#REF!")).toBe(1);
    expect(parseLimit("nonsense")).toBe(1);
  });

  it("reads real limits", () => {
    expect(parseLimit("3")).toBe(3);
    expect(parseLimit("5")).toBe(5);
  });

  it("falls back rather than producing a limit that halves everything", () => {
    expect(parseLimit("0")).toBe(1);
    expect(parseLimit("-2")).toBe(1);
  });
});

describe("parseTimestamp", () => {
  it("parses ISO timestamps", () => {
    expect(parseTimestamp("2026-07-27T12:00:00Z")).toBe(
      Date.parse("2026-07-27T12:00:00Z"),
    );
  });

  it("parses the gviz Date() serialisation with a 0-based month", () => {
    expect(parseTimestamp("Date(2026,6,27,14,3,0)")).toBe(
      Date.UTC(2026, 6, 27, 14, 3, 0),
    );
  });

  it("returns null for blanks and errors rather than guessing", () => {
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("#REF!")).toBeNull();
    expect(parseTimestamp("soon")).toBeNull();
  });
});
