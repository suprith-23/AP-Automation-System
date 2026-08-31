"use client";
import React, { useState, useRef, useEffect } from "react";
import StatusPill from "../ui/StatusPill";

export type TableRowData = {
  id: string;
  workflow: string;
  submittedBy: string;
  date: string;
  status: "approved" | "rejected" | "pending" | "in_review";
  reviewer: string;
  environment: "production" | "staging" | "development";
};

const DotsIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="5"  r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

type DataTableRowProps = {
  row: TableRowData;
  onClick: () => void;
  onAction?: (id: string, action: string) => void;
};

export default function DataTableRow({ row, onClick, onAction }: DataTableRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  return (
    <div
      className="flex items-center gap-3 px-5 py-3.5 w-full
                 border-b border-zinc-50 dark:border-zinc-800/60
                 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40
                 transition-colors duration-150 cursor-pointer group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={`View details for ${row.workflow}`}
    >
      {/* Workflow */}
      <div className="flex-[2] min-w-0">
        <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">{row.workflow}</div>
        <div className="text-[10px] text-zinc-450 dark:text-zinc-500 font-mono">{row.id}</div>
      </div>

      {/* Submitted By */}
      <div className="flex-[1.2] flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-full bg-[#A855F7] dark:bg-[#3B0764] flex items-center justify-center text-[9px] font-bold text-[#3B0764] dark:text-[#D8B4FE] shrink-0">
          {row.submittedBy.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">{row.submittedBy}</span>
      </div>

      {/* Date */}
      <div className="flex-1 text-xs text-zinc-500 dark:text-zinc-400">{row.date}</div>

      {/* Status pill */}
      <div className="flex-1">
        <StatusPill status={row.status} />
      </div>

      {/* Reviewer */}
      <div className="flex-[1.2] text-xs text-zinc-600 dark:text-zinc-400 truncate">{row.reviewer}</div>

      {/* Environment */}
      <div className="flex-1">
        <StatusPill status={row.environment} />
      </div>

      {/* Three-dot — circle icon button */}
      <div
        className="w-9 flex justify-center relative"
        onClick={(e) => e.stopPropagation()}
        ref={menuRef}
      >
        <button
          type="button"
          aria-label={`More actions for ${row.workflow}`}
          onClick={() => {
            setShowMenu(!showMenu);
            onAction?.(row.id, "menu");
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center
                     text-zinc-400 dark:text-zinc-500
                     hover:text-zinc-700 dark:hover:text-zinc-200
                     hover:bg-zinc-100 dark:hover:bg-zinc-700
                     transition-colors duration-150"
        >
          <DotsIcon />
        </button>

        {showMenu && (
          <div className="absolute right-8 top-0 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl z-50 animate-scale-in text-left">
            <div className="flex justify-between items-start mb-2 border-b border-zinc-150 dark:border-zinc-800 pb-1.5">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider font-mono truncate max-w-[120px]">{row.id}</span>
              <button 
                onClick={() => setShowMenu(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">Entity Name</span>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100 block truncate">{row.workflow}</span>
              </div>
              <div className="flex justify-between gap-2">
                <div>
                  <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">Status</span>
                  <StatusPill status={row.status} />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">Environment</span>
                  <StatusPill status={row.environment} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">Submitted By</span>
                  <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate block">{row.submittedBy}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">Reviewer</span>
                  <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate block">{row.reviewer}</span>
                </div>
              </div>
              <div>
                <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">Timestamp</span>
                <span className="text-[10px] font-bold text-zinc-550 dark:text-zinc-400 block">{row.date}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
