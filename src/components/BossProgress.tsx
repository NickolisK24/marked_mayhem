"use client";

import { useMemo, useState } from "react";
import { FALLBACK_TEAM_COLOR } from "@/config/event";
import { formatCount, formatGp, formatPoints } from "@/lib/format";
import { normalize } from "@/lib/text";
import type { TeamColor } from "@/lib/teamColor";
import type { BossProgress as BossProgressData } from "@/lib/types";

/**
 * ~60 bosses and several hundred items, so the search box is the primary way in
 * and sections stay collapsed until opened. A search match auto-opens its
 * section, since a hit inside a collapsed section is invisible.
 */
export function BossProgress({
  bosses,
  colors,
}: {
  bosses: BossProgressData[];
  colors: Map<string, TeamColor>;
}) {
  const [query, setQuery] = useState("");
  const [openBosses, setOpenBosses] = useState<Set<string>>(new Set());

  const search = normalize(query);

  const filtered = useMemo(() => {
    if (search === "") return bosses;

    return bosses
      .map((boss) => {
        // A match on the boss name keeps all of its items; otherwise keep the
        // items that match.
        if (normalize(boss.boss).includes(search)) return boss;

        const items = boss.items.filter((item) =>
          normalize(item.item).includes(search),
        );
        if (items.length === 0) return null;

        // The header counts have to be recomputed from the items still on
        // screen, or a filtered section reads "2/1 · 165 pts".
        return {
          ...boss,
          items,
          totalPoints: items.reduce((sum, item) => sum + item.points, 0),
          claimedCount: items.filter((item) => item.claimedBy.length > 0).length,
        };
      })
      .filter((boss): boss is BossProgressData => boss !== null);
  }, [bosses, search]);

  const searching = search !== "";
  const totalItems = filtered.reduce((sum, boss) => sum + boss.items.length, 0);

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-4 bg-ink/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:px-0">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search items or bosses…"
          aria-label="Search items or bosses"
          className="w-full rounded-lg border border-ink-edge bg-ink-raised px-3 py-2.5 text-sm text-parchment placeholder:text-parchment-faint focus:border-gold-dim focus:outline-none"
        />
        <p className="mt-1.5 px-0.5 text-xs text-parchment-faint">
          {searching
            ? `${formatCount(totalItems)} item${totalItems === 1 ? "" : "s"} in ${filtered.length} categor${filtered.length === 1 ? "y" : "ies"}`
            : `${formatCount(bosses.length)} bosses`}
        </p>
      </div>

      {/* The claim markers are colour-only, so the colours need naming once. */}
      {colors.size > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-0.5 text-xs text-parchment-faint">
          {[...colors.entries()].map(([name, color]) => (
            <span key={name} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: color.hex }}
              />
              {name}
            </span>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="panel px-4 py-6 text-center text-sm text-parchment-faint">
          Nothing matches “{query}”.
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((boss) => {
          const open = searching || openBosses.has(boss.boss);
          const complete =
            boss.items.length > 0 && boss.claimedCount === boss.items.length;

          return (
            <section key={boss.boss} className="panel overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                aria-expanded={open}
                onClick={() =>
                  setOpenBosses((current) => {
                    const next = new Set(current);
                    if (next.has(boss.boss)) next.delete(boss.boss);
                    else next.add(boss.boss);
                    return next;
                  })
                }
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className={`text-parchment-faint transition-transform ${open ? "rotate-90" : ""}`}
                  >
                    ▸
                  </span>
                  <span className="truncate font-medium text-parchment">
                    {boss.boss}
                  </span>
                </span>

                <span className="shrink-0 text-xs text-parchment-faint tabular-nums">
                  <span className={complete ? "text-gold" : undefined}>
                    {boss.claimedCount}/{boss.items.length}
                  </span>{" "}
                  · {formatPoints(boss.totalPoints)} pts
                </span>
              </button>

              {open && (
                <ul className="divide-y divide-ink-edge border-t border-ink-edge">
                  {boss.items.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-start justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-parchment">
                          {item.item}
                        </p>
                        <p className="text-xs text-parchment-faint">
                          {formatPoints(item.points)} pts
                          {item.fullPointsLimit > 1 &&
                            ` · full points for first ${item.fullPointsLimit}`}
                          {item.price !== null &&
                            item.price > 0 &&
                            ` · ${formatGp(item.price)}`}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        {item.claimedBy.length === 0 ? (
                          <span className="text-xs text-parchment-faint">
                            unclaimed
                          </span>
                        ) : (
                          item.claimedBy.map((team) => {
                            const color =
                              colors.get(team) ?? FALLBACK_TEAM_COLOR;
                            return (
                              <span
                                key={team}
                                title={team}
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: color.hex }}
                              >
                                <span className="sr-only">{team}</span>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
