/**
 * Shared protected-route loading state.
 * Rendered by Next.js App Router during route transitions.
 * Preserves spatial layout so there is no blank flash between navigations.
 */
export default function ProtectedLoading() {
  return (
    <div className="min-h-screen bg-[#FAFAFC] dark:bg-[#050506] font-sans" aria-label="Loading page">
      {/* Nav skeleton — same dimensions as AppTopNav */}
      <div className="sticky top-0 z-30 h-16 bg-white dark:bg-[#0A0A0A] border-b border-zinc-100 dark:border-zinc-800/60 flex items-center gap-4 px-6">
        <div className="w-9 h-9 rounded-full shimmer shrink-0" />
        <div className="w-20 h-3 rounded-full shimmer hidden sm:block" />
        <div className="flex items-center gap-2 flex-1 ml-4">
          {[80, 64, 72, 56, 80].map((w, i) => (
            <div key={i} className="h-7 rounded-full shimmer" style={{ width: w }} />
          ))}
        </div>
        <div className="flex items-center gap-2.5 shrink-0 ml-2">
          <div className="w-20 h-7 rounded-full shimmer" />
          <div className="w-9 h-9 rounded-full shimmer" />
          <div className="w-24 h-8 rounded-full shimmer" />
        </div>
      </div>

      {/* Content skeleton */}
      <main className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
        {/* Page title */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 rounded-full shimmer" />
            <div className="h-3.5 w-72 rounded-full shimmer" />
          </div>
          <div className="h-9 w-28 rounded-full shimmer" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl shimmer" />
          ))}
        </div>

        {/* Chart area */}
        <div className="h-64 rounded-2xl shimmer" />

        {/* Table area */}
        <div className="rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800/50">
          <div className="h-12 shimmer" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 border-t border-zinc-100 dark:border-zinc-800/50 px-5 flex items-center gap-4">
              <div className="h-3 w-8 rounded-full shimmer" />
              <div className="h-3 flex-1 rounded-full shimmer" />
              <div className="h-3 w-24 rounded-full shimmer hidden md:block" />
              <div className="h-6 w-20 rounded-full shimmer" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
