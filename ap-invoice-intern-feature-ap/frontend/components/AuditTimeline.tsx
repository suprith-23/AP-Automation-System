import React from "react";
import { AuditLogResponse } from "../types/api_schemas";

type Props = {
  logs: AuditLogResponse[];
};

export default function AuditTimeline({ logs }: Props) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-zinc-400">No audit history recorded.</p>
      </div>
    );
  }

  const getLogStyle = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("APPROVE")) {
      return {
        bgColor: "bg-emerald-100 dark:bg-emerald-950/40",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        dotColor: "bg-emerald-500",
        label: "Approved",
        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      };
    }
    if (act.includes("REJECT") || act.includes("FAIL")) {
      return {
        bgColor: "bg-rose-100 dark:bg-rose-950/40",
        iconColor: "text-rose-650 dark:text-rose-400",
        dotColor: "bg-rose-500",
        label: "Issue / Rejected",
        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      };
    }
    if (act.includes("SUBMIT") || act.includes("REVIEW")) {
      return {
        bgColor: "bg-amber-100 dark:bg-amber-955/40",
        iconColor: "text-amber-600 dark:text-amber-400",
        dotColor: "bg-amber-500",
        label: "Action Required",
        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      };
    }
    if (act.includes("MATCH")) {
      return {
        bgColor: "bg-blue-100 dark:bg-blue-950/40",
        iconColor: "text-blue-600 dark:text-blue-400",
        dotColor: "bg-blue-500",
        label: "System Match",
        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      };
    }
    // Default system action
    return {
      bgColor: "bg-slate-100 dark:bg-zinc-800",
      iconColor: "text-slate-600 dark:text-zinc-400",
      dotColor: "bg-slate-400",
      label: "System Event",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    };
  };

  return (
    <div className="flex overflow-x-auto pb-6 pt-2 px-2 space-x-6 relative before:absolute before:top-6 before:left-0 before:w-full before:h-0.5 before:bg-gradient-to-r before:from-transparent before:via-zinc-200 dark:before:via-zinc-850 before:to-transparent hide-scrollbar">
      {logs.map((log) => {
        const style = getLogStyle(log.action);
        return (
          <div key={log.id} className="relative flex flex-col items-center gap-4 group min-w-[280px] shrink-0">
            {/* Timeline Dot/Icon */}
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm shrink-0 z-10 ${style.bgColor} ${style.iconColor}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {style.icon}
              </svg>
            </div>
            
            {/* Content Box */}
            <div className="w-full p-4 rounded-xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-zinc-800 dark:text-zinc-100 text-sm">{log.action.replace(/_/g, ' ')}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${style.bgColor} ${style.iconColor}`}>
                    {style.label}
                  </span>
               </div>
               
               {log.details && (
                 <p className="text-xs text-zinc-650 dark:text-zinc-400 mb-3 bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-100 dark:border-zinc-800 whitespace-pre-wrap font-mono">
                   {typeof log.details === "object" ? JSON.stringify(log.details, null, 2) : log.details}
                 </p>
               )}

               <div className="text-zinc-500 dark:text-zinc-400 text-xs flex items-center justify-between mt-2 pt-2 border-t border-zinc-50 dark:border-zinc-800">
                  <div className="flex items-center space-x-1">
                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span className="font-medium text-zinc-700 dark:text-zinc-350">{log.performed_by || "System"}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>{new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
               </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
