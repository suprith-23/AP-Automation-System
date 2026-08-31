import React from "react";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function ChartCard({ title, subtitle, action, children, className = "" }: ChartCardProps) {
  return (
    <div className={`rounded-3xl p-5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between gap-4 shadow-sm ${className}`}>
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{title}</h3>
            {subtitle && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      </div>
      <div className="flex-1 w-full flex flex-col">
        {children}
      </div>
    </div>
  );
}
