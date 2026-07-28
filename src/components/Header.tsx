"use client";

import { useEffect, useState } from "react";
import { countdownTo, formatRelative } from "@/lib/format";

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function Header({
  eventName,
  eventStart,
  eventEnd,
  generatedAt,
  refreshing,
  stale,
  onRefresh,
}: {
  eventName: string;
  eventStart: string | null;
  eventEnd: string | null;
  generatedAt: number | null;
  refreshing: boolean;
  stale: boolean;
  onRefresh: () => void;
}) {
  // The clock only starts after mount: rendering a time on the server and a
  // different one on the client is a hydration error, and on this page it would
  // fire on every load.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Three phases: counting down to the start, counting down to the end, and
  // over. The target switches once the event begins so the header never sits on
  // a stale "starts in 00:00:00".
  const startMs = eventStart ? Date.parse(eventStart) : Number.NaN;
  const endMs = eventEnd ? Date.parse(eventEnd) : Number.NaN;
  const hasStart = Number.isFinite(startMs);
  const hasEnd = Number.isFinite(endMs);

  const notStarted = hasStart && now !== null && now < startMs;
  const finished = hasEnd && now !== null && now >= endMs;

  const target = notStarted ? startMs : endMs;
  const label = notStarted ? "Starts in" : finished ? "Event over" : "Ends in";

  const countdown =
    now !== null && Number.isFinite(target) && !finished
      ? countdownTo(target, now)
      : null;

  return (
    <header className="border-b border-ink-edge">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5">
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight font-bold tracking-tight text-gold sm:text-3xl">
            {eventName}
          </h1>
          <p className="mt-0.5 text-xs text-parchment-faint">
            {generatedAt === null || now === null ? (
              "Loading…"
            ) : (
              <>
                Updated {formatRelative(generatedAt, now)}
                {stale && (
                  <span className="text-warn"> · couldn&apos;t refresh</span>
                )}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="text-left sm:text-right">
            <div className="text-[0.65rem] tracking-wider text-parchment-faint uppercase">
              {label}
            </div>
            <div className="font-display text-lg tabular-nums text-parchment">
              {countdown === null ? (
                <span className="text-parchment-faint">
                  {finished ? "—" : hasEnd ? "—" : "dates TBD"}
                </span>
              ) : (
                <>
                  {countdown.days > 0 && `${countdown.days}d `}
                  {pad(countdown.hours)}:{pad(countdown.minutes)}:
                  {pad(countdown.seconds)}
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="shrink-0 rounded-lg border border-ink-edge px-3 py-2 text-sm text-parchment-dim transition-colors hover:border-gold-dim hover:text-gold disabled:opacity-50"
            aria-label="Refresh standings"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
    </header>
  );
}
