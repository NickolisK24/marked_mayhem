import { teamColor } from "@/lib/teamColor";
import type { RosterTeam } from "@/lib/types";

export function Rosters({ rosters }: { rosters: RosterTeam[] }) {
  if (rosters.length === 0) {
    return (
      <p className="panel px-4 py-6 text-center text-sm text-parchment-faint">
        No rosters found.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rosters.map((team) => {
        const color = teamColor(team.colorIndex);

        return (
          <section key={team.name} className="panel overflow-hidden">
            <header
              className="flex items-baseline justify-between gap-2 px-4 py-2.5"
              style={{ backgroundColor: color.soft }}
            >
              <h3
                className="truncate font-display font-semibold"
                style={{ color: color.hex }}
              >
                {team.name}
              </h3>
              <span className="shrink-0 text-xs text-parchment-faint">
                {team.players.length} player
                {team.players.length === 1 ? "" : "s"}
              </span>
            </header>

            <ul className="divide-y divide-ink-edge">
              {team.players.map((player) => (
                <li
                  key={player.displayName}
                  className="flex items-start justify-between gap-3 px-4 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-parchment">
                      {player.displayName}
                      {player.isCaptain && (
                        <span className="ml-1.5 text-[0.65rem] tracking-wider text-gold uppercase">
                          captain
                        </span>
                      )}
                    </p>
                    {/* Second accounts, so it is obvious which RSNs count as
                        this player when a drop is logged. */}
                    {player.rsns.length > 1 && (
                      <p className="truncate text-xs text-parchment-faint">
                        {player.rsns.slice(1).join(", ")}
                      </p>
                    )}
                  </div>

                  {player.ehb !== "" && (
                    <span className="shrink-0 rounded bg-ink-edge px-1.5 py-0.5 text-xs text-parchment-dim tabular-nums">
                      {player.ehb}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
