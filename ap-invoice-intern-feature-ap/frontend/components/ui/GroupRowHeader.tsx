"use client";

type Props = {
  label:     string;
  count?:    number;
  collapsed: boolean;
  onToggle:  () => void;
};

const ChevronIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    className={`w-3 h-3 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
  </svg>
);

/**
 * GroupRowHeader — collapsible date-group section header for tables.
 * Shows chevron (rotates on collapse), group label, and item count badge.
 * Per spec: newest group starts expanded, older groups collapsed by default.
 */
export default function GroupRowHeader({ label, count, collapsed, onToggle }: Props) {
  return (
    <div className="px-3 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? "Expand" : "Collapse"} group: ${label}`}
        className="w-full flex items-center gap-2 px-4 py-2
                   rounded-xl
                   bg-zinc-50 dark:bg-zinc-800/60
                   text-xs font-bold text-zinc-500 dark:text-zinc-400
                   uppercase tracking-widest
                   hover:bg-zinc-100 dark:hover:bg-zinc-800
                   transition-colors duration-150
                   focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-400"
      >
        <ChevronIcon collapsed={collapsed} />

        <span className="flex-1 text-left">{label}</span>

        {count !== undefined && (
          <span
            aria-label={`${count} items`}
            className="inline-flex items-center justify-center
                       min-w-[20px] h-5 px-1.5
                       rounded-full
                       bg-zinc-200 dark:bg-zinc-700
                       text-[10px] font-black text-zinc-600 dark:text-zinc-300"
          >
            {count}
          </span>
        )}
      </button>
    </div>
  );
}
