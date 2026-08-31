/**
 * Invoices page loading skeleton.
 * Mirrors the InvoiceModule table layout — search bar, filter row, and table rows
 * with correct column proportions so no layout shift when data arrives.
 */
export default function InvoicesLoading() {
  return (
    <div className="space-y-6 animate-fade-in" aria-label="Loading invoices">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-32 rounded-full shimmer" />
          <div className="h-3 w-56 rounded-full shimmer" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-32 rounded-full shimmer" />
          <div className="h-9 w-28 rounded-full shimmer" />
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3">
        <div className="h-10 flex-1 max-w-sm rounded-full shimmer" />
        <div className="h-10 w-28 rounded-full shimmer" />
        <div className="h-10 w-28 rounded-full shimmer" />
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800/50">
        {/* Table header */}
        <div className="h-11 shimmer" />

        {/* Table rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="h-[60px] border-t border-zinc-100 dark:border-zinc-800/50 px-5 flex items-center gap-4"
          >
            <div className="h-3 w-6 rounded-full shimmer shrink-0" />
            <div className="h-3 w-28 rounded-full shimmer" />
            <div className="h-3 flex-1 max-w-[160px] rounded-full shimmer hidden md:block" />
            <div className="h-3 w-24 rounded-full shimmer hidden lg:block" />
            <div className="h-3 w-20 rounded-full shimmer hidden xl:block" />
            <div className="h-6 w-24 rounded-full shimmer ml-auto" />
            <div className="h-6 w-6 rounded-full shimmer" />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-2">
        <div className="h-3 w-40 rounded-full shimmer" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-8 rounded-full shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}
