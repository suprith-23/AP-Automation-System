/**
 * Dashboard-specific loading skeleton.
 * Rendered while the dashboard page chunk is loading or suspended.
 * Matches the exact spatial layout of the admin dashboard so there is
 * no layout shift when content arrives.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-fade-in" aria-label="Loading dashboard">
      {/* Stat capsule row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl shimmer" />
        ))}
      </div>

      {/* Hero chart */}
      <div className="h-72 rounded-2xl shimmer" />

      {/* Secondary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 h-56 rounded-2xl shimmer" />
        <div className="h-56 rounded-2xl shimmer" />
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800/50">
        {/* Header pill */}
        <div className="h-12 shimmer mx-0" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-[60px] border-t border-zinc-100 dark:border-zinc-800/50 px-5 flex items-center gap-4"
          >
            <div className="h-3 w-6 rounded-full shimmer shrink-0" />
            <div className="h-3 flex-1 max-w-[180px] rounded-full shimmer" />
            <div className="h-3 w-28 rounded-full shimmer hidden md:block" />
            <div className="h-3 w-20 rounded-full shimmer hidden lg:block" />
            <div className="h-6 w-24 rounded-full shimmer ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
