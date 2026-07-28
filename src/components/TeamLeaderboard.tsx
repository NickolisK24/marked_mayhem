import { formatCount, formatPoints } from "@/lib/format";
import { teamColor } from "@/lib/teamColor";
import type { TeamScore } from "@/lib/types";

export function TeamLeaderboard({ teams }: { teams: TeamScore[] }) {
  if (teams.length === 0) {
    return (
      <p className="panel px-4 py-6 text-center text-sm text-parchment-faint">
        No teams yet. Check the roster tab.
      </p>
    );
  }

  const leader = Math.max(...teams.map((team) => team.totalPoints), 1);

  return (
    <div className="space-y-3">
      {teams.map((team, index) => {
        const color = teamColor(team.colorIndex);
        const share = (team.totalPoints / leader) * 100;

        return (
          <article key={team.name} className="panel px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-2.5">
                <span className="font-display text-lg text-parchment-faint tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3
                    className="truncate font-display text-lg leading-tight font-semibold"
                    style={{ color: color.hex }}
                  >
                    {team.name}
                  </h3>
                  {team.captain && (
                    <p className="text-xs text-parchment-faint">
                      Captain {team.captain}
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="font-display text-2xl leading-none font-bold text-parchment tabular-nums">
                  {formatPoints(team.totalPoints)}
                </div>
                <div className="text-[0.65rem] tracking-wider text-parchment-faint uppercase">
                  points
                </div>
              </div>
            </div>

            {/* Each team's total as a share of the leader's, so the gap at the
                top is legible without reading the numbers. */}
            <div
              className="mt-3 flex h-2 overflow-hidden rounded-full bg-ink-edge"
              role="img"
              aria-label={`${formatPoints(team.totalPoints)} points`}
            >
              <div
                className="h-full transition-[width] duration-500"
                style={{ width: `${share}%`, backgroundColor: color.hex }}
              />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Stat label="Uniques" value={formatCount(team.uniques)} />
              <Stat label="Drops" value={formatCount(team.dropCount)} />
            </dl>

            {/* Challenges the whole team completed. Listed rather than counted:
                they are not item drops, and with no player named there is no
                drop breakdown anywhere else that would show them. */}
            {team.awards.length > 0 && (
              <div className="mt-3 border-t border-ink-edge pt-2.5">
                {/* "Team awards" rather than "Team challenges": these come
                    from Misc. as well, and Jars is not a challenge. */}
                <h4 className="text-[0.65rem] tracking-wider text-parchment-faint uppercase">
                  Team awards
                </h4>
                <ul className="mt-1.5 space-y-1">
                  {team.awards.map((award) => (
                    <li
                      key={award.id}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      {/* Derived awards name their boss on a line of their own:
                          "All Uniques (Not Shard)" is ambiguous across four of
                          them, and inline it truncates away on a phone. Saying
                          the site worked it out makes a wrong completion
                          something you can spot rather than something that
                          quietly adds points. */}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-parchment">
                          {award.item}
                        </span>
                        {award.derived && (
                          <span className="block truncate text-xs text-parchment-faint">
                            {award.category} · completed
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-parchment-faint tabular-nums">
                        {formatPoints(award.points)} pts
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        );
      })}
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
