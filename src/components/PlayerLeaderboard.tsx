"use client";

import { useState } from "react";
import { FALLBACK_TEAM_COLOR } from "@/config/event";
import { formatCount, formatGp, formatPoints } from "@/lib/format";
import type { TeamColor } from "@/lib/teamColor";
import type { PlayerScore } from "@/lib/types";

export function PlayerLeaderboard({
  players,
  teams,
  colors,
  hasPrices,
}: {
  players: PlayerScore[];
  teams: string[];
  colors: Map<string, TeamColor>;
  hasPrices: boolean;
}) {
  const [filter, setFilter] = useState<string | null>(null);

  const shown =
    filter === null
      ? players
      : players.filter((player) => player.team === filter);

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <FilterChip
          label="All teams"
          active={filter === null}
          onClick={() => setFilter(null)}
        />
        {teams.map((team) => (
          <FilterChip
            key={team}
            label={team}
            active={filter === team}
            color={colors.get(team)}
            onClick={() => setFilter(filter === team ? null : team)}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="panel px-4 py-6 text-center text-sm text-parchment-faint">
          No players to show.
        </p>
      ) : (
        <ol className="panel divide-y divide-ink-edge">
          {shown.map((player, index) => {
            const color = colors.get(player.team) ?? FALLBACK_TEAM_COLOR;

            return (
              <li
                key={player.id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="w-6 shrink-0 text-right text-sm text-parchment-faint tabular-nums">
                  {index + 1}
                </span>
                <span
                  aria-hidden
                  className="h-8 w-0.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color.hex }}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-parchment">
                    {player.displayName}
                    {player.isCaptain && (
                      <span className="ml-1.5 text-[0.65rem] tracking-wider text-gold uppercase">
                        captain
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-parchment-faint">
                    {player.team}
                    {player.dropCount > 0 &&
                      ` · ${formatCount(player.dropCount)} drop${player.dropCount === 1 ? "" : "s"}`}
                    {hasPrices &&
                      player.gpValue > 0 &&
                      ` · ${formatGp(player.gpValue)}`}
                  </p>
                </div>

                <span className="shrink-0 font-display text-lg font-semibold text-parchment tabular-nums">
                  {formatPoints(player.points)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: TeamColor;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="shrink-0 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors"
      style={{
        borderColor: active ? (color?.hex ?? "#f0b429") : "#241e16",
        backgroundColor: active ? (color?.soft ?? "rgba(240,180,41,0.16)") : "transparent",
        color: active ? (color?.hex ?? "#f0b429") : "#b5a68b",
      }}
    >
      {label}
    </button>
  );
}
