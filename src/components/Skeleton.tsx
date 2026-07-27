/** First-paint placeholder. The page must never render blank. */
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading standings">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="panel px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-3 w-20" />
            </div>
            <div className="skeleton h-7 w-16" />
          </div>
          <div className="skeleton mt-3 h-2 w-full" />
          <div className="mt-3 grid grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((cell) => (
              <div key={cell} className="space-y-1.5">
                <div className="skeleton h-2 w-10" />
                <div className="skeleton h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
