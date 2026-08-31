"use client";
import React, { useState, useMemo } from "react";
import SegmentedControl from "../ui/SegmentedControl";
import { Invoice } from "../../types/invoice";
import { Role } from "../../store/useAppStore";

type HeroChartCardProps = {
  invoices: Invoice[];
  role: Role;
  chartType: "bar" | "line";
};

type TabKey = "submitted" | "approved" | "rejected" | "processed" | "failed" | "exceptions" | "reviewed";

function HeroChartCard({ invoices, role, chartType }: HeroChartCardProps) {

  // Define tabs based on role
  const tabs = useMemo(() => {
    if (role === "Admin") {
      return [
        { key: "processed", label: "Processed" },
        { key: "failed", label: "Failed" },
        { key: "exceptions", label: "Exceptions" },
      ];
    } else if (role === "Reviewer" || role === ("Finance Manager" as any) || role === "Auditor") {
      return [
        { key: "reviewed", label: "Reviewed" },
        { key: "approved", label: "Approved" },
        { key: "rejected", label: "Rejected" },
      ];
    } else {
      return [
        { key: "submitted", label: "Submitted" },
        { key: "approved", label: "Approved" },
        { key: "rejected", label: "Rejected" },
      ];
    }
  }, [role]);

  const [activeTab, setActiveTab] = useState<TabKey>(tabs[0].key as TabKey);

  // Group invoices by month — last 7 months so charts always have real data
  const rangeLength = 7;

  const chartData = useMemo(() => {
    const now = new Date();
    const result = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = rangeLength - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = monthNames[d.getMonth()];
      const yr = d.getFullYear();
      const dateKey = `${monthLabel} ${yr}`;

      // Match invoices whose invoice_date falls in this month/year
      const monthInvoices = invoices.filter((inv) => {
        const dateStr = (inv as any).processed_at || (inv as any).extraction_timestamp || inv.invoice_date;
        if (!dateStr) return false;
        const dt = new Date(dateStr);
        return dt.getMonth() === d.getMonth() && dt.getFullYear() === d.getFullYear();
      });

      // Compute counts per status type
      const counts: Record<TabKey, number> = {
        submitted: monthInvoices.length,
        approved: monthInvoices.filter((inv) => inv.workflow_status === "approved").length,
        rejected: monthInvoices.filter((inv) => inv.workflow_status === "rejected").length,
        processed: monthInvoices.filter((inv) => inv.workflow_status === "approved").length,
        failed: monthInvoices.filter((inv) => inv.workflow_status === "rejected").length,
        exceptions: monthInvoices.filter((inv) => inv.validation_status === "FAILED" || (inv.confidence_score !== undefined && inv.confidence_score < 0.85)).length,
        reviewed: monthInvoices.filter((inv) => ["pending_approval", "approved", "rejected"].includes(inv.workflow_status || "")).length,
      };

      result.push({
        label: monthLabel,
        date: dateKey,
        value: counts[activeTab] || 0,
      });
    }
    return result;
  }, [invoices, activeTab]);

  const totalValue = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  // Delta calculation: compare last month vs month before
  const deltaText = useMemo(() => {
    const thisMonth = chartData[chartData.length - 1]?.value ?? 0;
    const prevMonth = chartData[chartData.length - 2]?.value ?? 0;
    if (prevMonth === 0) return totalValue > 0 ? "↑ Active this month" : "No data yet";
    const pct = prevMonth > 0 ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : 0;
    return `${pct >= 0 ? "+" : ""}${pct}% vs last month`;
  }, [chartData, totalValue]);

  const maxVal = Math.max(...chartData.map((d) => d.value), 1);
  const chartHeight = 120;

  const fillConfig = useMemo(() => {
    if (activeTab.includes("approve") || activeTab === "processed") {
      return { patternId: "pat-dot-wave", fill: "#22C55E", label: "Approved" };
    }
    if (activeTab.includes("reject") || activeTab === "failed") {
      return { patternId: "pat-squiggle", fill: "#EF4444", label: "Rejected/Failed" };
    }
    if (activeTab === "exceptions") {
      return { patternId: "pat-wave", fill: "#F59E0B", label: "Exceptions" };
    }
    return { patternId: "pat-squiggle", fill: "#4F46E5", label: "Active" };
  }, [activeTab]);

  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-5 relative overflow-hidden text-white bg-zinc-900 dark:bg-zinc-950 border border-zinc-800/60"
      style={{
        minHeight: 280,
      }}
    >
      {/* Inline SVG patterns for pattern fill bars */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <pattern id="pat-dot-wave" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.15)" />
            <circle cx="8" cy="8" r="1" fill="rgba(255,255,255,0.15)" />
          </pattern>
          <pattern id="pat-wave" width="20" height="12" patternUnits="userSpaceOnUse">
            <path d="M0 6 Q5 0, 10 6 T20 6" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
          </pattern>
          <pattern id="pat-squiggle" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M0 8 C 4 12, 6 4, 10 8 S 14 4, 16 8" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
          </pattern>
        </defs>
      </svg>

      {/* Header Info */}
      <div className="flex items-start justify-between gap-4 flex-wrap z-10">
        <div>
          <div className="text-4xl font-black text-white leading-none">{totalValue}</div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Last 7 months</div>
          <div className="text-xs font-semibold text-zinc-400 mt-0.5">{deltaText}</div>
        </div>


        {/* Tab switcher */}
        <div className="bg-black/35 rounded-full p-1 border border-zinc-800">
          <SegmentedControl
            options={tabs}
            value={activeTab}
            onChange={(k) => setActiveTab(k as TabKey)}
          />
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="flex-1 flex items-end gap-2 relative">
        {chartData.map((d, i) => {
          const barH = Math.max((d.value / maxVal) * chartHeight, 8);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
              <span className="text-[10px] font-black text-white/90 opacity-0 group-hover:opacity-100 transition-opacity">
                {d.value}
              </span>
              <div
                className="w-full rounded-lg transition-all duration-300 hover:brightness-110"
                style={{ height: barH, backgroundColor: fillConfig.fill }}
                aria-label={`${d.label}: ${d.value}`}
                role="img"
              />
              <span className="text-[10px] font-black text-zinc-450 uppercase tracking-widest">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default React.memo(HeroChartCard);

