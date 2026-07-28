import { describe, expect, it } from "vitest";
import {
  countdownTo,
  formatCount,
  formatPoints,
  formatRelative,
} from "@/lib/format";

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

describe("event phases", () => {
  const start = Date.parse("2026-07-30T17:00:00-04:00");
  const end = Date.parse("2026-08-09T17:00:00-04:00");

  it("parses the configured window to the intended instants", () => {
    // 17:00 US Eastern daylight time is 21:00 UTC.
    expect(new Date(start).toISOString()).toBe("2026-07-30T21:00:00.000Z");
    expect(new Date(end).toISOString()).toBe("2026-08-09T21:00:00.000Z");
    expect(end - start).toBe(10 * 86_400_000);
  });

  it("counts down to the start before the event begins", () => {
    const now = Date.parse("2026-07-29T17:00:00-04:00");
    expect(countdownTo(start, now)).toEqual({
      days: 1,
      hours: 0,
      minutes: 0,
      seconds: 0,
      ended: false,
    });
  });

  it("counts down to the end once it is running", () => {
    const now = Date.parse("2026-08-08T17:00:00-04:00");
    expect(countdownTo(end, now).days).toBe(1);
    expect(countdownTo(end, now).ended).toBe(false);
  });

  it("reports ended, not a negative timer, after the end", () => {
    const now = Date.parse("2026-08-10T00:00:00-04:00");
    expect(countdownTo(end, now).ended).toBe(true);
    expect(countdownTo(end, now).days).toBe(0);
  });
});
