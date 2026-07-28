"use client";

import { useEffect, useRef } from "react";
import { formatCount, formatGp, formatPoints } from "@/lib/format";
import type { TeamColor } from "@/lib/teamColor";
import type { PlayerScore } from "@/lib/types";

/**
 * A player's drop breakdown, opened from the player leaderboard.
 *
 * Sized to the viewport rather than to its contents — `max-h-[85dvh]` with the
 * list scrolling inside — so a player with sixty drops is as usable on a phone
 * as one with two. `dvh` rather than `vh` because mobile browsers shrink the
 * visual viewport when their chrome is showing, and `vh` would push the close
 * button off-screen.
 */
export function PlayerDropsModal({
  player,
  color,
  onClose,
}: {
  player: PlayerScore;
  color: TeamColor;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Stop the page behind the dialog scrolling with it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // Newest first, matching how people read a drop log.
  const drops = [...player.drops].reverse();
  const uniques = drops.filter((drop) => drop.unique).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-drops-title"
        // Contain the click so tapping inside does not dismiss.
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-ink-edge bg-ink-raised sm:max-h-[80dvh] sm:rounded-2xl"
      >
        <header
          className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-edge px-4 py-3"
          style={{ backgroundColor: color.soft }}
        >
          <div className="min-w-0">
            <h2
              id="player-drops-title"
              className="truncate font-display text-lg font-semibold"
              style={{ color: color.hex }}
            >
              {player.displayName}
            </h2>
            <p className="truncate text-xs text-parchment-faint">
              {player.team}
              {player.rsns.length > 1 &&
                ` · ${player.rsns.slice(1).join(", ")}`}
            </p>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-parchment-faint transition-colors hover:text-parchment focus:outline-none focus-visible:ring-1 focus-visible:ring-gold"
          >
            ×
          </button>
        </header>

        <dl className="grid shrink-0 grid-cols-4 gap-x-3 border-b border-ink-edge px-4 py-2.5 text-sm">
          <Stat label="Points" value={formatPoints(player.points)} />
          <Stat label="Drops" value={formatCount(player.dropCount)} />
          <Stat label="Uniques" value={formatCount(uniques)} />
          <Stat label="Value" value={formatGp(player.gpValue)} />
        </dl>

        {/* The only scrolling region: the header and totals stay put. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {drops.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-parchment-faint">
              No drops logged yet.
            </p>
          ) : (
            <ul className="divide-y divide-ink-edge">
              {drops.map((drop) => (
                <li
                  key={drop.id}
                  className="flex items-start gap-3 px-4 py-2.5"
                >
                  {/* Derived from the scoring pass, so it is a read-only
                      indicator rather than something to toggle. */}
                  {/* Not `disabled`, which greys the tick out to near
                      invisibility on this background; made inert with
                      pointer-events and tabIndex instead. */}
                  <input
                    type="checkbox"
                    checked={drop.unique}
                    readOnly
                    tabIndex={-1}
                    aria-label={
                      drop.unique
                        ? "Unique for the team"
                        : "Duplicate — the team already had this item"
                    }
                    className="pointer-events-none mt-1 size-4 shrink-0 accent-gold"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-parchment">
                      {drop.item}
                    </p>
                    <p className="truncate text-xs text-parchment-faint">
                      {drop.boss} ·{" "}
                      {drop.overCap ? (
                        // Received, but past the item's per-team cap, so it
                        // scored nothing. Said plainly rather than shown as a
                        // bare 0 that looks like a bug.
                        <span className="text-warn">over the cap</span>
                      ) : drop.cap !== null && !drop.unique ? (
                        // A capped item pays full points for all of them, so a
                        // duplicate here is worth as much as the first. Without
                        // this the full points next to "duplicate" read as a bug.
                        <span className="text-gold">within the {drop.cap} cap</span>
                      ) : (
                        <span className={drop.unique ? "text-gold" : undefined}>
                          {drop.unique ? "unique" : "duplicate"}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-sm text-parchment tabular-nums">
                      {drop.price === null ? "—" : formatGp(drop.price)}
                    </div>
                    <div
                      className={`text-xs tabular-nums ${drop.overCap ? "text-warn" : "text-parchment-faint"}`}
                    >
                      {formatPoints(drop.points)} pts
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.65rem] tracking-wider text-parchment-faint uppercase">
        {label}
      </dt>
      <dd className="text-parchment tabular-nums">{value}</dd>
    </div>
  );
}
