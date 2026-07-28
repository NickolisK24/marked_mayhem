"use client";

import { useEffect, useState } from "react";
import { HalfPointsBadge, TeamChip } from "./Chips";
import { formatPoints, formatRelative } from "@/lib/format";
import { FALLBACK_TEAM_COLOR } from "@/config/event";
import type { TeamColor } from "@/lib/teamColor";
import type { FeedEntry } from "@/lib/types";

export function DropFeed({
  feed,
  colors,
  ordering,
}: {
  feed: FeedEntry[];
  colors: Map<string, TeamColor>;
  ordering: "timestamp" | "rowOrder";
}) {
  // Relative times are computed after mount for the same hydration reason as
  // the countdown, and re-tick once a minute.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (feed.length === 0) {
    return (
      <p className="panel px-4 py-6 text-center text-sm text-parchment-faint">
        No drops logged yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {ordering === "rowOrder" && (
        <p className="text-xs text-parchment-faint">
          Ordered by the row order of the drop log — add a{" "}
          <span className="font-mono text-parchment-dim">Timestamp</span> column
          to show drop times.
        </p>
      )}

      <ul className="panel divide-y divide-ink-edge">
        {feed.map((entry) => {
          const color = colors.get(entry.team) ?? FALLBACK_TEAM_COLOR;

          return (
            <li key={entry.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <TeamChip team={entry.team} color={color} />
                    <span className="truncate text-sm text-parchment">
                      {entry.player}
                    </span>
                    {/* The account that got the drop, when it isn't the
                        player's primary — otherwise the feed looks wrong to
                        anyone who knows the alt. */}
                    {entry.rsn.toLowerCase() !==
                      entry.player.toLowerCase() && (
                      <span className="text-xs text-parchment-faint">
                        as {entry.rsn}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 truncate text-sm font-medium text-gold">
                    {entry.item}
                  </p>
                  <p className="text-xs text-parchment-faint">
                    {entry.boss}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {entry.halfPoints && <HalfPointsBadge />}
                    <span className="font-display text-lg leading-none font-semibold text-parchment tabular-nums">
                      {formatPoints(entry.points)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-parchment-faint tabular-nums">
                    {entry.halfPoints && (
                      <span title="Past this item's full-points limit for the team">
                        {formatPoints(entry.basePoints)} × 0.5
                      </span>
                    )}
                    {entry.timestamp !== null && now !== null && (
                      <span>
                        {entry.halfPoints && " · "}
                        {formatRelative(entry.timestamp, now)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
