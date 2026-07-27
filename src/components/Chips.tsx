import type { TeamColor } from "@/lib/teamColor";

export function TeamChip({
  team,
  color,
  className = "",
}: {
  team: string;
  color: TeamColor;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}
      style={{ backgroundColor: color.soft, color: color.hex }}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color.hex }}
      />
      {team}
    </span>
  );
}

/**
 * Marks a drop that scored half because its team was already at the item's
 * full-points limit. Deliberately loud — "why is this 2.5 and not 5" is the
 * first question anyone asks about the feed.
 */
export function HalfPointsBadge() {
  return (
    <span className="inline-flex items-center rounded bg-warn/15 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-warn uppercase">
      half
    </span>
  );
}
