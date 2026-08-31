"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import apiClient from "../../services/api-client";
import { Invoice } from "../../types/invoice";
import InvoiceTable from "../InvoiceTable";
import { useAppStore } from "../../store/useAppStore";
import { formatIndianCurrency } from "../../utils/format";

export default function ReviewerQueues() {
  const { invoices, fetchAllData, role, users } = useAppStore();
  
  const [activeQueue, setActiveQueue] = useState<
    "review_queue" | "low_confidence" | "validation_errors" | "duplicate_review" | "missing_information" | "returned_by_approver" | "completed_reviews" | "analytics"
  >("review_queue");

  const [queueIds, setQueueIds] = useState<Record<string, number[]>>({
    review_queue: [],
    low_confidence: [],
    validation_errors: [],
    duplicate_review: [],
    missing_information: [],
    returned_by_approver: [],
    completed_reviews: []
  });

  const [analytics, setAnalytics] = useState<any>({
    pending_reviews: 0,
    reviewed_today: 0,
    avg_review_time_seconds: 0,
    ai_accuracy_percent: 0,
    reviewer_corrections: 0,
    low_confidence_percent: 0,
    common_errors: {},
    returned_invoices: 0,
    rejected_invoices: 0
  });

  const [loading, setLoading] = useState(false);

  const fetchQueues = useCallback(async () => {
    setLoading(true);
    try {
      const [queuesRes, analyticsRes] = await Promise.all([
        apiClient.get("/reviewer/queues"),
        apiClient.get("/reviewer/analytics")
      ]);
      setQueueIds(queuesRes.data || {});
      setAnalytics(analyticsRes.data || {});
    } catch {
      toast.error("Failed to load reviewer validation queues.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  const activeInvoices = useMemo(() => {
    if (activeQueue === "analytics") return [];
    const ids = queueIds[activeQueue] || [];
    return invoices.filter((i) => ids.includes(i.id));
  }, [invoices, queueIds, activeQueue]);

  const tabs = [
    { key: "review_queue", label: "Review Queue", count: queueIds.review_queue.length },
    { key: "low_confidence", label: "Low Confidence", count: queueIds.low_confidence.length },
    { key: "validation_errors", label: "Validation Errors", count: queueIds.validation_errors.length },
    { key: "duplicate_review", label: "Duplicate Review", count: queueIds.duplicate_review.length },
    { key: "missing_information", label: "Missing Info", count: queueIds.missing_information.length },
    { key: "returned_by_approver", label: "Returned by Approver", count: queueIds.returned_by_approver.length },
    { key: "completed_reviews", label: "Completed Reviews", count: queueIds.completed_reviews.length },
    { key: "analytics", label: "Review Analytics", count: null }
  ];

  return (
    <div className="space-y-6 text-zinc-950 dark:text-white font-sans animate-fade-in">
      
      {/* Analytics Summary Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Pending Reviews", value: analytics.pending_reviews, color: "text-amber-500" },
          { label: "Reviewed Today", value: analytics.reviewed_today, color: "text-emerald-500" },
          { label: "Avg Review Time", value: `${Math.round(analytics.avg_review_time_seconds / 60)}m`, color: "text-blue-500" },
          { label: "AI Extraction Accuracy", value: `${analytics.ai_accuracy_percent}%`, color: "text-purple-500" },
          { label: "Reviewer Corrections", value: analytics.reviewer_corrections, color: "text-rose-500" }
        ].map((s, idx) => (
          <div key={idx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4.5 shadow-sm flex flex-col justify-between min-h-[90px]">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-black leading-tight">{s.label}</span>
            <span className={`text-xl font-black tracking-tight mt-2.5 ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Dynamic Tab Selector Headers */}
      <div className="flex space-x-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveQueue(tab.key as any)}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider shrink-0 ${
              activeQueue === tab.key
                ? "bg-[#EC4899] text-white shadow-sm font-black"
                : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${activeQueue === tab.key ? "bg-white/25 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-xs text-zinc-400 py-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm">
          Loading classified validation queue...
        </div>
      ) : activeQueue === "analytics" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chart/Detail 1 */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Common Error Distribution</h3>
            <div className="space-y-3 pt-2">
              {Object.entries(analytics.common_errors || {}).map(([errType, val]: any) => (
                <div key={errType} className="flex justify-between items-center text-xs font-bold">
                  <span className="text-zinc-500">{errType}</span>
                  <span className="text-zinc-850 dark:text-zinc-150">{val} instances</span>
                </div>
              ))}
            </div>
          </div>
          {/* Chart/Detail 2 */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Validation Performance KPI</h3>
            <div className="space-y-4 pt-2">
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500 font-bold">Low Confidence Ratio</span>
                <span className="text-xs font-bold text-amber-500">{analytics.low_confidence_percent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500 font-bold">Returned by Approvers</span>
                <span className="text-xs font-bold text-rose-500">{analytics.returned_invoices} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500 font-bold">Total Rejected Invoices</span>
                <span className="text-xs font-bold text-red-500">{analytics.rejected_invoices} items</span>
              </div>
            </div>
          </div>
        </div>
      ) : activeInvoices.length === 0 ? (
        <div className="text-xs text-zinc-400 py-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm">
          No invoices in this workbench queue.
        </div>
      ) : (
        <InvoiceTable
          invoices={activeInvoices}
          onRefresh={async () => {
            await fetchAllData();
            await fetchQueues();
          }}
          userRole={role}
          users={users}
        />
      )}
    </div>
  );
}
