"use client";
import React, { useState, useMemo } from "react";
import { useAppStore } from "../../../store/useAppStore";

function formatLogDetails(log: any) {
  if (!log.details) return "—";
  let details = log.details;
  if (typeof details === "string") {
    try {
      details = JSON.parse(details);
    } catch {
      return details;
    }
  }
  const parts = [];
  if (details.ip_address) parts.push(`IP: ${details.ip_address}`);
  if (details.reason) parts.push(`Reason: ${details.reason}`);
  if (details.status) parts.push(`Status: ${details.status}`);
  if (details.email) parts.push(`Email: ${details.email}`);
  if (details.error) parts.push(`Error: ${details.error}`);
  return parts.length > 0 ? parts.join(" | ") : JSON.stringify(details);
}

export default function AuditLogsPage() {
  const { auditLogs } = useAppStore();
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const performed = (log.performed_by || "").toLowerCase();
      const action = (log.action || "").toLowerCase();
      const detailsStr = log.details ? JSON.stringify(log.details).toLowerCase() : "";
      const matchSearch = performed.includes(auditSearch.toLowerCase()) || 
                          action.includes(auditSearch.toLowerCase()) ||
                          detailsStr.includes(auditSearch.toLowerCase());
      if (auditActionFilter !== "ALL" && log.action !== auditActionFilter) return false;
      return matchSearch;
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  const handleExportAuditLogs = () => {
    const headers = ["Timestamp", "Performed By", "Action", "Invoice ID", "Status Before", "Status After", "Details"];
    const rows = auditLogs.map((log) => [
      new Date(log.timestamp).toLocaleString(),
      log.performed_by || "",
      log.action || "",
      log.invoice_id || "System",
      log.status_before || "—",
      log.status_after || "—",
      log.details ? JSON.stringify(log.details) : "—"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", encodeURI(csvContent));
    dlAnchorElem.setAttribute("download", `audit_trail_export_${Date.now()}.csv`);
    dlAnchorElem.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Audit Trail</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-normal">
            Immutable trail of all status updates and database invoice alterations
          </p>
        </div>
        <button
          onClick={handleExportAuditLogs}
          className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs rounded-xl shadow-sm"
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-800">
          <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            placeholder="Search audit logs by performed by, actions, details..."
            className="flex-1 bg-transparent text-xs text-zinc-800 dark:text-white placeholder-zinc-400 outline-none"
          />
        </div>
        <select
          value={auditActionFilter}
          onChange={(e) => setAuditActionFilter(e.target.value)}
          className="bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-xs font-bold border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FFB800] dark:focus:ring-[#FFCB3D] focus:border-transparent outline-none cursor-pointer transition-all duration-200"
        >
          <option value="ALL" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">All Actions</option>
          <option value="status_changed" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">Status Changed</option>
          <option value="invoice_created" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">Invoice Created</option>
          <option value="invoice_updated" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">Invoice Updated</option>
        </select>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FFB800] dark:bg-[#FFCB3D] text-[#451A03] dark:text-[#000000] text-[10px] font-black uppercase tracking-wider">
                <th className="py-3.5 px-4 first:rounded-l-2xl">Timestamp</th>
                <th className="py-3.5 px-4">Invoice ID</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Previous Value</th>
                <th className="py-3.5 px-4">Updated Value</th>
                <th className="py-3.5 px-4 last:rounded-r-2xl">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800 text-xs">
               {filteredAuditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                  <td className="py-4 pl-4 font-mono font-medium text-zinc-500 dark:text-zinc-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-4 font-mono text-zinc-400">#{log.invoice_id || "System"}</td>
                  <td className="py-4 font-bold text-zinc-800 dark:text-zinc-100">{log.performed_by || "System"}</td>
                  <td className="py-4 text-zinc-500">{log.performed_by === "system" ? "Engine" : "Staff"}</td>
                  <td className="py-4 capitalize font-semibold">{log.action?.replace(/_/g, " ")}</td>
                  <td className="py-4 text-zinc-400 font-mono">{log.status_before || "—"}</td>
                  <td className="py-4 text-zinc-800 dark:text-zinc-100 font-mono font-bold">{log.status_after || "done"}</td>
                  <td className="py-4 pr-4 text-zinc-500 dark:text-zinc-400 truncate max-w-xs">{formatLogDetails(log)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
