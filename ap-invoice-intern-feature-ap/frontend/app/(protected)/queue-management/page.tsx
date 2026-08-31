"use client";
import React, { useState } from "react";
import { useAppStore } from "../../../store/useAppStore";
import { updateInvoice } from "../../../services/api";
import StatusBadge from "../../../components/StatusBadge";

export default function QueueManagementPage() {
  const { invoices, fetchAllData, users } = useAppStore();
  const [activeQueueTab, setActiveQueueTab] = useState<"reviewer" | "approver" | "processing" | "completed" | "exception" | "failed">("reviewer");

  const handleAssignQueueUser = async (invoiceId: number, userName: string) => {
    try {
      await updateInvoice(invoiceId, { reviewer: userName });
      // Phase 8 Notification
      await fetchAllData();
    } catch (err: any) {
      console.error("Failed to assign:", err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Queue Management</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-normal">
          Admin workflow routing queues and reviewer/approver workloads
        </p>
      </div>

      <div className="flex space-x-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        {[
          { key: "reviewer", label: "Reviewer Queue" },
          { key: "approver", label: "Approver Queue" },
          { key: "processing", label: "Processing Queue" },
          { key: "completed", label: "Completed Queue" },
          { key: "exception", label: "Exception Queue" },
          { key: "failed", label: "Failed Queue" },
        ].map((q) => (
          <button
            key={q.key}
            onClick={() => setActiveQueueTab(q.key as any)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeQueueTab === q.key
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="text-white text-[10px] font-black uppercase tracking-widest border-none">
                <th className="rounded-l-full py-3 px-4 bg-[#EC4899] text-white">Invoice Number</th>
                <th className="py-3 px-4 bg-[#EC4899] text-white">Vendor</th>
                <th className="py-3 px-4 bg-[#EC4899] text-white">Assigned Analyst</th>
                <th className="py-3 px-4 bg-[#EC4899] text-white">Stage</th>
                <th className="py-3 px-4 bg-[#EC4899] text-white">SLA Status</th>
                <th className="rounded-r-full py-3 px-4 bg-[#EC4899] text-white">Assign Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800 text-xs">
              {invoices
                .filter((inv) => {
                  const wf = (inv.workflow_status || inv.status || "").toLowerCase();
                  if (activeQueueTab === "reviewer") return wf === "pending_review" || wf === "validation_failed";
                  if (activeQueueTab === "approver") return wf === "pending_approval";
                  if (activeQueueTab === "processing") return wf === "validation_pending";
                  if (activeQueueTab === "completed") return wf === "approved";
                  if (activeQueueTab === "failed") return wf === "rejected";
                  if (activeQueueTab === "exception") return inv.validation_status === "FAILED";
                  return true;
                })
                .map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="py-4 pl-5 font-mono font-bold text-zinc-800 dark:text-zinc-100">
                      {inv.invoice_number || `INV-${inv.id}`}
                    </td>
                    <td className="py-4 font-semibold text-zinc-850 dark:text-zinc-100">
                      {inv.seller_name || inv.vendor_name || "Unknown"}
                    </td>
                    <td className="py-4 text-zinc-650 dark:text-zinc-350">{inv.reviewer || "Unassigned"}</td>
                    <td className="py-4">
                      <StatusBadge status={inv.workflow_status} />
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        inv.validation_status === "PASSED" 
                          ? "bg-emerald-100 dark:bg-fw-green-deep text-emerald-800 dark:text-fw-green-dark" 
                          : "bg-rose-100 dark:bg-fw-red-deep text-rose-800 dark:text-fw-red-dark"
                      }`}>
                        {inv.validation_status === "PASSED" ? "SLA Compliant" : "At-Risk"}
                      </span>
                    </td>
                    <td className="py-4 pr-5 text-right align-middle">
                      <select
                        defaultValue=""
                        onChange={(e) => handleAssignQueueUser(inv.id, e.target.value)}
                        className="bg-[#F7F7F7] dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none text-zinc-700 dark:text-zinc-300 cursor-pointer"
                      >
                        <option value="" disabled>Assign User...</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
