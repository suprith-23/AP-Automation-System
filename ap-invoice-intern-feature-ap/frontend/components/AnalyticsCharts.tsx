"use client";
import React, { useMemo } from "react";
import { Invoice } from "../types/invoice";
import { PurchaseOrder } from "../types/purchase_order";
import CapsuleStatRow from "./finewise/CapsuleStatRow";

type Props = {
  invoices?: Invoice[];
  purchaseOrders?: PurchaseOrder[];
};

export default function AnalyticsCharts({ invoices = [], purchaseOrders = [] }: Props) {
  const metrics = useMemo(() => {
    const total = invoices.length;

    // Total invoice value
    const totalValue = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
    const formattedValue = totalValue >= 10_00_000
      ? `₹${(totalValue / 10_00_000).toFixed(1)}L`
      : `₹${Math.round(totalValue / 1000)}K`;

    // Validation pass rate
    const passed = invoices.filter((i) => i.validation_status === "PASSED").length;
    const passRate = total > 0 ? (passed / total) * 100 : 0;

    // Avg confidence
    const confList = invoices.filter((i) => i.confidence_score !== undefined).map((i) => i.confidence_score as number);
    const avgConf  = confList.length > 0 ? (confList.reduce((a, b) => a + b, 0) / confList.length) * 100 : 0;

    // PO match coverage
    const withPO  = invoices.filter((i) => i.po_number && i.po_number !== "").length;
    const poRate  = total > 0 ? (withPO / total) * 100 : 0;

    // Workflow breakdown (Final state wins)
    const approved = invoices.filter((i) => (i.workflow_status || i.status || "").toLowerCase() === "approved").length;
    const pending  = invoices.filter((i) =>
      ["pending_review", "pending_approval"].includes((i.workflow_status || i.status || "").toLowerCase())
    ).length;
    const failed = invoices.filter((i) => 
      (i.validation_status === "FAILED" || i.validation_status === "FAILED_VALIDATION" || (i.confidence_score !== undefined && i.confidence_score < 0.85) || i.workflow_status === "validation_failed" || i.workflow_status === "rejected")
      && (i.workflow_status || i.status || "").toLowerCase() !== "approved"
    ).length;

    return { total, totalValue, formattedValue, passed, failed, passRate, avgConf, withPO, poRate, approved, pending };
  }, [invoices]);

  const cards = useMemo(() => [
    {
      color: "blue" as const,
      label: "Total Invoice Value",
      value: metrics.formattedValue,
      sub: `Across ${metrics.total} invoices`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16V5" />
        </svg>
      ),
    },
    {
      color: metrics.passRate > 90 ? ("pink" as const) : metrics.passRate >= 70 ? ("amber" as const) : ("red" as const),
      label: "Validation Pass Rate",
      value: `${metrics.passRate.toFixed(1)}%`,
      sub: `${metrics.passed} passed · ${metrics.failed} failed`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      color: metrics.avgConf > 90 ? ("green" as const) : metrics.avgConf >= 70 ? ("amber" as const) : ("red" as const),
      label: "Avg AI Confidence",
      value: `${metrics.avgConf.toFixed(1)}%`,
      sub: "Mean extraction confidence",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      color: "teal" as const,
      label: "PO Coverage",
      value: `${metrics.poRate.toFixed(0)}%`,
      sub: `${metrics.withPO} of ${metrics.total} linked`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ], [metrics]);

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <CapsuleStatRow chips={cards} />

      {/* Workflow breakdown */}
      <div className="premium-card p-6">
        <div className="mb-5">
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Workflow Status Breakdown</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Distribution across all invoice lifecycle stages</p>
        </div>

        <div className="space-y-4">
          {[
            { label: "Approved",       count: metrics.approved, color: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
            { label: "Pending Review", count: metrics.pending,  color: "bg-amber-400",   text: "text-amber-700 dark:text-amber-400"   },
            { label: "Failed",         count: metrics.failed,   color: "bg-rose-500",    text: "text-rose-700 dark:text-rose-400"     },
          ].map((row) => {
            const pct = metrics.total > 0 ? (row.count / metrics.total) * 100 : 0;
            return (
              <div key={row.label} className="flex items-center gap-4">
                <div className="w-28 text-xs font-bold text-zinc-600 dark:text-zinc-400 shrink-0">{row.label}</div>
                <div className="flex-1 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.color} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-xs font-black w-16 text-right ${row.text}`}>
                  {row.count} <span className="font-normal opacity-60">({pct.toFixed(0)}%)</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-700 flex justify-between items-center text-xs">
          <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Total Invoices in System</span>
          <span className="font-black text-zinc-800 dark:text-zinc-200 text-base">{metrics.total}</span>
        </div>
      </div>

      {/* Empty state when no data loaded */}
      {metrics.total === 0 && (
        <div className="premium-card p-10 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-zinc-400 dark:text-zinc-500 font-semibold">No invoice data available yet.</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">Upload invoices or connect the backend to see live analytics.</p>
        </div>
      )}
    </div>
  );
}
