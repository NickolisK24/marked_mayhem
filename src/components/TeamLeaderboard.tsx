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
        const dropShare = (team.dropPoints / leader) * 100;
        const bonusShare = (team.bonusPoints / leader) * 100;

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

            {/* Drop points and bonus points as one bar, so the split is visible
                at a glance without reading the numbers. */}
            <div
              className="mt-3 flex h-2 overflow-hidden rounded-full bg-ink-edge"
              role="img"
              aria-label={`${formatPoints(team.dropPoints)} drop points, ${formatPoints(team.bonusPoints)} bonus points`}
            >
              <div
                className="h-full transition-[width] duration-500"
                style={{ width: `${dropShare}%`, backgroundColor: color.hex }}
              />
              <div
                className="h-full transition-[width] duration-500"
                style={{
                  width: `${bonusShare}%`,
                  backgroundColor: color.hex,
                  opacity: 0.45,
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(0,0,0,0.35) 0 3px, transparent 3px 6px)",
                }}
              />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <Stat label="Drop pts" value={formatPoints(team.dropPoints)} />
              <Stat
                label="Bonus"
                value={formatPoints(team.bonusPoints)}
                muted={team.bonusPoints === 0}
              />
              <Stat label="Uniques" value={formatCount(team.uniques)} />
              <Stat label="Drops" value={formatCount(team.dropCount)} />
            </dl>
          </article>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <dt className="text-[0.65rem] tracking-wider text-parchment-faint uppercase">
        {label}
      </dt>
      <dd
        className={`tabular-nums ${muted ? "text-parchment-faint" : "text-parchment"}`}
      >
        {value}
      </dd>
    </div>
  );
}
