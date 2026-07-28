"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EVENT_NAME, REVALIDATE_SECONDS } from "@/config/event";
import { teamColorMap } from "@/lib/teamColor";
import type { EventPayload } from "@/lib/types";
import { ErrorBanner, WarningsPanel } from "./Banners";
import { BossProgress } from "./BossProgress";
import { DropFeed } from "./DropFeed";
import { Header } from "./Header";
import { PlayerLeaderboard } from "./PlayerLeaderboard";
import { Rosters } from "./Rosters";
import { Rules } from "./Rules";
import { LeaderboardSkeleton } from "./Skeleton";
import { TeamLeaderboard } from "./TeamLeaderboard";

const VIEWS = [
  { id: "teams", label: "Teams" },
  { id: "feed", label: "Drops" },
  { id: "bosses", label: "Bosses" },
  { id: "players", label: "Players" },
  { id: "rules", label: "Rules" },
  { id: "rosters", label: "Rosters" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

export function Dashboard() {
  const [payload, setPayload] = useState<EventPayload | null>(null);
  const [view, setView] = useState<ViewId>("teams");
  const [refreshing, setRefreshing] = useState(false);
  /** Set when the fetch itself failed, as opposed to the payload being stale. */
  const [fetchFailed, setFetchFailed] = useState(false);

  // Guards against a slow response from an earlier poll overwriting a newer one.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);

    try {
      const response = await fetch("/api/event", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as EventPayload;
      if (id !== requestId.current) return;

      setPayload(data);
      setFetchFailed(false);
    } catch {
      if (id !== requestId.current) return;
      // Keep whatever is on screen. An empty page is worse than an old one.
      setFetchFailed(true);
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REVALIDATE_SECONDS * 1000);

    // Phones suspend timers in the background; refresh on return so a tab left
    // open over lunch is not showing an hour-old leaderboard.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const colors = useMemo(
    () => teamColorMap(payload?.teams ?? []),
    [payload?.teams],
  );
  const teamNames = useMemo(
    () => (payload?.teams ?? []).map((team) => team.name),
    [payload?.teams],
  );

  const stale = fetchFailed || (payload?.stale ?? false);

  return (
    <div className="min-h-dvh">
      <Header
        eventName={payload?.eventName ?? EVENT_NAME}
        eventStart={payload?.eventStart ?? null}
        eventEnd={payload?.eventEnd ?? null}
        generatedAt={payload?.generatedAt ?? null}
        refreshing={refreshing}
        stale={stale}
        onRefresh={() => void load()}
      />

      <nav className="sticky top-0 z-20 border-b border-ink-edge bg-ink/95 backdrop-blur">
        <div
          className="no-scrollbar mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2"
          role="tablist"
          aria-label="Views"
        >
          {VIEWS.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(item.id)}
                className={`shrink-0 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "border-gold text-gold"
                    : "border-transparent text-parchment-faint hover:text-parchment-dim"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-16">
        {fetchFailed && (
          <div
            role="status"
            className="panel border-warn/30 bg-warn/5 px-4 py-2.5 text-sm text-warn"
          >
            Couldn&apos;t refresh — showing the last data that loaded.
          </div>
        )}

        {payload && <ErrorBanner errors={payload.tabErrors} />}
        {payload && <WarningsPanel warnings={payload.warnings} />}

        {payload === null ? (
          <LeaderboardSkeleton />
        ) : (
          <>
            {view === "teams" && <TeamLeaderboard teams={payload.teams} />}
            {view === "feed" && (
              <DropFeed
                feed={payload.feed}
                colors={colors}
                ordering={payload.ordering}
              />
            )}
            {view === "bosses" && (
              <BossProgress bosses={payload.bosses} colors={colors} />
            )}
            {view === "players" && (
              <PlayerLeaderboard
                players={payload.players}
                teams={teamNames}
                colors={colors}
              />
            )}
            {view === "rules" && <Rules rules={payload.rules} />}
            {view === "rosters" && <Rosters rosters={payload.rosters} />}
          </>
        )}
      </main>
    </div>
  );
}
