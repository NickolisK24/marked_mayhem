import { describe, expect, it } from "vitest";
import {
  countdownTo,
  formatCount,
  formatGp,
  formatPoints,
  formatRelative,
} from "@/lib/format";

describe("formatGp", () => {
  it("formats the shapes OSRS players expect", () => {
    expect(formatGp(1_200_000)).toBe("1.2m");
    expect(formatGp(315_000_000)).toBe("315m");
    expect(formatGp(1_400_000_000)).toBe("1.4b");
  });

  it("drops a trailing .0", () => {
    expect(formatGp(2_000_000)).toBe("2m");
    expect(formatGp(3_000_000_000)).toBe("3b");
  });

  it("handles small and zero values", () => {
    expect(formatGp(0)).toBe("0");
    expect(formatGp(950)).toBe("950");
    expect(formatGp(40_331_957)).toBe("40.3m");
  });

  it("never renders NaN", () => {
    expect(formatGp(Number.NaN)).toBe("0");
    expect(formatGp(Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("formatPoints", () => {
  it("keeps half-credit points readable", () => {
    expect(formatPoints(60)).toBe("60");
    expect(formatPoints(2.5)).toBe("2.5");
    expect(formatPoints(0)).toBe("0");
  });
});

describe("formatCount", () => {
  it("separates thousands", () => {
    expect(formatCount(1234)).toBe("1,234");
  });
});

describe("formatRelative", () => {
  const now = Date.parse("2026-07-27T12:00:00Z");
  const ago = (ms: number) => formatRelative(now - ms, now);

  it("renders the brief's example", () => {
    expect(ago(14 * 60_000)).toBe("14m ago");
  });

  it("covers each unit", () => {
    expect(ago(5_000)).toBe("just now");
    expect(ago(90_000)).toBe("2m ago");
    expect(ago(3 * 3_600_000)).toBe("3h ago");
    expect(ago(2 * 86_400_000)).toBe("2d ago");
  });

  it("does not render a negative age from clock skew", () => {
    expect(formatRelative(now + 60_000, now)).toBe("just now");
  });
});

describe("countdownTo", () => {
  const now = Date.parse("2026-07-27T12:00:00Z");

  it("counts down", () => {
    const end = now + (2 * 86_400 + 3 * 3600 + 4 * 60 + 5) * 1000;
    expect(countdownTo(end, now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      ended: false,
    });
  });

  it("clamps at zero instead of going negative once the event ends", () => {
    expect(countdownTo(now - 86_400_000, now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      ended: true,
    });
  });
});
