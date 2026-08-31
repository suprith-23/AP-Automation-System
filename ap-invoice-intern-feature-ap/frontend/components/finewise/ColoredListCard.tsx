"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type ListRow = {
  day: string;
  month: string;
  title: string;
  detail: string;
  value: string;
  status: "approved" | "rejected" | "pending" | "healthy" | "degraded" | "error" | "down" | "resolved";
  invoiceId?: number;
};

type CardColor = "purple" | "green" | "pink" | "blue" | "teal" | "black" | "grey";

type ColoredListCardProps = {
  title: string;
  color: CardColor;
  rows: ListRow[];
};

const CARD_COLORS: Record<
  CardColor,
  {
    lightBg:        string;
    darkBg:         string;
    headerText:     string;
    darkHeaderText: string;
    chevronBg:      string;
  }
> = {
  green:  { lightBg: "#22C55E", darkBg: "#4ADE80", headerText: "#0A0A0A", darkHeaderText: "#0A0A0A", chevronBg: "#EDEDED" },
  pink:   { lightBg: "#EC4899", darkBg: "#F472B6", headerText: "#FFFFFF", darkHeaderText: "#0A0A0A", chevronBg: "#EDEDED" },
  purple: { lightBg: "#4F46E5", darkBg: "#818CF8", headerText: "#FFFFFF", darkHeaderText: "#0A0A0A", chevronBg: "#EDEDED" },
  blue:   { lightBg: "#3B82F6", darkBg: "#93C5FD", headerText: "#FFFFFF", darkHeaderText: "#0A0A0A", chevronBg: "#EDEDED" },
  teal:   { lightBg: "#14B8A6", darkBg: "#5EEAD4", headerText: "#0A0A0A", darkHeaderText: "#0A0A0A", chevronBg: "#EDEDED" },
  black:  { lightBg: "#0A0A0A", darkBg: "#1A1A1A", headerText: "#FFFFFF", darkHeaderText: "#FFFFFF", chevronBg: "#333333" },
  grey:   { lightBg: "#E4E4E7", darkBg: "#3F3F46", headerText: "#0A0A0A", darkHeaderText: "#FFFFFF", chevronBg: "#EDEDED" },
};

const STATUS_STYLES: Record<ListRow["status"], { light: string; dark: string; label: string }> = {
  approved: { light: "bg-[#DCFCE7] text-[#166534]",  dark: "dark:bg-[#14532D] dark:text-[#4ADE80]", label: "Approved" },
  rejected: { light: "bg-[#FEE2E2] text-[#991B1B]",  dark: "dark:bg-[#450A0A] dark:text-[#FCA5A5]", label: "Rejected" },
  pending:  { light: "bg-[#FEF3C7] text-[#92400E]",  dark: "dark:bg-[#451A03] dark:text-[#FCD34D]", label: "Pending"  },
  healthy:  { light: "bg-[#DCFCE7] text-[#166534]",  dark: "dark:bg-[#14532D] dark:text-[#4ADE80]", label: "Healthy"  },
  degraded: { light: "bg-[#FEF3C7] text-[#92400E]",  dark: "dark:bg-[#451A03] dark:text-[#FCD34D]", label: "Degraded" },
  error:    { light: "bg-[#FEE2E2] text-[#991B1B]",  dark: "dark:bg-[#450A0A] dark:text-[#FCA5A5]", label: "Error"    },
  down:     { light: "bg-[#FEE2E2] text-[#991B1B]",  dark: "dark:bg-[#450A0A] dark:text-[#FCA5A5]", label: "Down"     },
  resolved: { light: "bg-[#DCFCE7] text-[#166534]",  dark: "dark:bg-[#14532D] dark:text-[#4ADE80]", label: "Resolved" },
};

export default function ColoredListCard({ title, color, rows }: ColoredListCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [isDark,   setIsDark]   = useState(false);
  const [activeMenuIdx, setActiveMenuIdx] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ListRow | null>(null);

  // Properly observe dark mode changes with cleanup — fixes MutationObserver leak
  useEffect(() => {
    function update() {
      setIsDark(document.documentElement.classList.contains("dark"));
    }
    update(); // initial read

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Close menu on click outside
  useEffect(() => {
    if (activeMenuIdx === null) return;
    const handleClose = () => setActiveMenuIdx(null);
    document.addEventListener("click", handleClose);
    return () => document.removeEventListener("click", handleClose);
  }, [activeMenuIdx]);

  const c               = CARD_COLORS[color];
  const activeBg        = isDark ? c.darkBg : c.lightBg;
  const activeHeaderText = isDark ? c.darkHeaderText : c.headerText;
  const rowBg           = isDark ? "#1A1A1A" : "#FFFFFF";
  const badgeBg         = isDark ? "#FFFFFF" : "#0A0A0A";
  const badgeText       = isDark ? "#0A0A0A" : "#FFFFFF";
  const rowTitleColor   = isDark ? "text-zinc-100" : "text-zinc-800";
  const rowDetailColor  = isDark ? "text-zinc-400" : "text-zinc-500";

  const handleInspect = (row: ListRow) => {
    if (row.invoiceId) {
      router.push(`/invoices/${row.invoiceId}`);
    } else {
      setSelectedEvent(row);
    }
  };

  const handleCopyEvent = (row: ListRow) => {
    navigator.clipboard.writeText(`${row.title} - ${row.detail} (${row.value})`);
    toast.success("Event details copied to clipboard!");
  };

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ backgroundColor: activeBg }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-base font-black" style={{ color: activeHeaderText }}>{title}</span>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-white/50 outline-none"
          style={{
            backgroundColor: c.chevronBg,
            color: activeHeaderText,
            transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Rows */}
      {expanded && (
        <div className="flex flex-col gap-2">
          {rows.length === 0 ? (
            <div
              className="rounded-2xl flex items-center justify-center p-6 text-xs font-semibold"
              style={{ backgroundColor: rowBg, color: isDark ? "#A1A1AA" : "#71717A" }}
            >
              No recent actions recorded.
            </div>
          ) : (
            rows.map((row, i) => (
            <div
              key={i}
              className="rounded-2xl flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:brightness-95"
              style={{ backgroundColor: rowBg }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Circular date badge */}
                <div
                  className="rounded-full w-10 h-10 flex flex-col items-center justify-center shrink-0"
                  style={{ backgroundColor: badgeBg }}
                  aria-label={`${row.day} ${row.month}`}
                >
                  <span className="text-sm font-black leading-none" style={{ color: badgeText }}>{row.day}</span>
                  <span className="text-[8px] font-semibold uppercase leading-none mt-0.5" style={{ color: badgeText, opacity: 0.65 }}>{row.month}</span>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-bold ${rowTitleColor} truncate`}>{row.title}</div>
                  <div className={`text-[10px] ${rowDetailColor} truncate mt-0.5`}>{row.detail}</div>
                </div>
              </div>

              {/* Value & Status */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`text-sm font-black ${rowTitleColor}`}>{row.value}</span>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm ${STATUS_STYLES[row.status].light} ${STATUS_STYLES[row.status].dark}`}>
                  {STATUS_STYLES[row.status].label}
                </span>
              </div>

              {/* Three-dot menu — circle button */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setActiveMenuIdx(activeMenuIdx === i ? null : i)}
                  aria-label={`More options for ${row.title}`}
                  className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 transition-colors ml-1
                             w-6 h-6 rounded-full flex items-center justify-center
                             hover:bg-zinc-200 dark:hover:bg-zinc-750 focus-visible:ring-2 focus-visible:ring-white/50 outline-none"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <circle cx="12" cy="5"  r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
                {activeMenuIdx === i && (
                  <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-30 py-1 text-xs text-zinc-800 dark:text-zinc-200 animate-scale-in">
                    <button
                      onClick={() => handleInspect(row)}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold"
                    >
                      Inspect Item
                    </button>
                    <button
                      onClick={() => handleCopyEvent(row)}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold"
                    >
                      Copy Event
                    </button>
                  </div>
                )}
              </div>
            </div>
          )))}
        </div>
      )}

      {/* Detailed Event Inspector Modal */}
      {selectedEvent && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => setSelectedEvent(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-[22px] bg-white dark:bg-[#121214] p-6 shadow-xl border border-zinc-200/65 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 flex flex-col gap-4 font-sans animate-scale-in">
            <div className="flex justify-between items-start border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-base font-black text-zinc-800 dark:text-white">Event Inspector</h2>
                <p className="text-[10px] text-zinc-450 dark:text-zinc-400 font-bold uppercase tracking-wider mt-0.5">Audit Log Entry Details</p>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="space-y-3.5 text-xs font-semibold">
              <div>
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider block mb-0.5">Action Event</span>
                <span className="text-zinc-800 dark:text-zinc-100 font-bold text-sm">{selectedEvent.title}</span>
              </div>
              <div>
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider block mb-0.5">Metadata / Detail</span>
                <span className="text-zinc-700 dark:text-zinc-350">{selectedEvent.detail}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] text-zinc-400 uppercase tracking-wider block mb-0.5">Date</span>
                  <span className="text-zinc-750 dark:text-zinc-300">{selectedEvent.day} {selectedEvent.month}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-400 uppercase tracking-wider block mb-0.5">Status Value</span>
                  <span className="text-[#FF3EA5] font-bold">{selectedEvent.value}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-100 dark:border-zinc-850">
              <button onClick={() => setSelectedEvent(null)} className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-xl shadow-sm transition-all hover:opacity-90">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
