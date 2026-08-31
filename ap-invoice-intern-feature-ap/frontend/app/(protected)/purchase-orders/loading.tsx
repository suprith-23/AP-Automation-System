/** Generic table skeleton for all remaining protected routes */
export default function GenericTableLoading() {
  return (
    <div className="space-y-6 animate-fade-in" aria-label="Loading">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-44 rounded-full shimmer" />
          <div className="h-3 w-64 rounded-full shimmer" />
        </div>
        <div className="h-9 w-28 rounded-full shimmer" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-10 flex-1 max-w-sm rounded-full shimmer" />
        <div className="h-10 w-28 rounded-full shimmer" />
      </div>
      <div className="rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800/50">
        <div className="h-11 shimmer" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-[60px] border-t border-zinc-100 dark:border-zinc-800/50 px-5 flex items-center gap-4">
            <div className="h-3 w-6 rounded-full shimmer shrink-0" />
            <div className="h-3 flex-1 max-w-[200px] rounded-full shimmer" />
            <div className="h-3 w-24 rounded-full shimmer hidden md:block" />
            <div className="h-6 w-20 rounded-full shimmer ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
