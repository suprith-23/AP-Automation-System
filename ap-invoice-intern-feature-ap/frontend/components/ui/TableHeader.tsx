"use client";

type Column = {
  label: string;
  /** Tailwind flex-based width e.g. "flex-[2]" or specific px like "w-24" */
  className?: string;
};

type Props = {
  columns:     Column[];
  color?:      string;   // Tailwind bg class e.g. "bg-[#EC4899]"
  onSettings?: () => void;
  layoutClass?: string;
};

const GearIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

/**
 * TableHeader — pill-shaped fully-rounded colored header bar.
 * Floats above the table body. Settings/Gear icon on far right.
 * Never a traditional bordered thead.
 */
export default function TableHeader({ columns, color = "bg-[#EC4899]", onSettings, layoutClass }: Props) {
  return (
    <div
      className={`${layoutClass ? `rounded-2xl w-full px-5 py-3 ${layoutClass}` : "table-header-pill"} ${color} text-white`}
      role="row"
    >
      {columns.map((col, i) => (
        <span
          key={i}
          className={`text-[10px] font-black uppercase tracking-widest opacity-90 ${col.className ?? "flex-1"}`}
          role="columnheader"
        >
          {col.label}
        </span>
      ))}

      {onSettings && (
        <button
          type="button"
          onClick={onSettings}
          aria-label="Table settings"
          className="w-6 h-6 rounded-full flex items-center justify-center
                     bg-white/10 hover:bg-white/20
                     transition-colors duration-150 shrink-0"
        >
          <GearIcon />
        </button>
      )}
    </div>
  );
}
