/**
 * Display formatting. Shared by server and client, so it must stay pure and
 * locale-independent — a value rendered on the server must match the one the
 * client renders after the first poll, or React hydration complains.
 */

/** Points can be fractional because half-credit drops are `points × 0.5`. */
export function formatPoints(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? value.toString() : trimZero(value.toFixed(1));
}

/** Whole numbers with thousands separators, for drop counts and item totals. */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** "just now", "14m ago", "3h ago", "2d ago". */
export function formatRelative(timestamp: number, now: number): string {
  const seconds = Math.round((now - timestamp) / 1000);

  if (seconds < 0) return "just now";
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  ended: boolean;
}

/** Time remaining until the event end. Clamps at zero rather than going negative. */
export function countdownTo(end: number, now: number): Countdown {
  const remaining = Math.max(0, end - now);
  const totalSeconds = Math.floor(remaining / 1000);

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    ended: remaining === 0,
  };
}

function trimZero(text: string): string {
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}
