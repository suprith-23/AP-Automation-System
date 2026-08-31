"use client";

import React, { useMemo } from "react";
import CapsuleStatRow from "./CapsuleStatRow";
import ColoredListCard from "./ColoredListCard";
import Card from "../ui/Card";
import Link from "next/link";
import { useSuperAdminDashboard } from "../../hooks/useSuperAdminDashboard";

interface Organization {
  id: string;
  name: string;
  code: string;
  gst_number?: string;
  address?: string;
  status: string;
  created_at: string;
  admin_assigned?: string;
  user_count?: number;
  invoice_count?: number;
}

export default function SuperAdminDashboard() {
  const {
    orgs,
    overallStats,
    auditLogs,
    pendingApprovalsCount,
    loading,
    refresh,
  } = useSuperAdminDashboard();

  // Compute registrations 7d / 30d
  const recentRegistrations = useMemo(() => {
    const now = new Date();
    const limit7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const limit30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let count7d = 0;
    let count30d = 0;

    orgs.forEach((o) => {
      const regDate = new Date(o.created_at);
      if (regDate >= limit7d) count7d++;
      if (regDate >= limit30d) count30d++;
    });

    return { count7d, count30d };
  }, [orgs]);

  // Map metrics to CapsuleStatRow chips
  const kpiChips = useMemo(() => {
    return [
      {
        color: "amber" as const,
        label: "Total Tenants / Orgs",
        value: `${orgs.length}`,
        sub: `Active: ${orgs.filter((o: any) => o.status === "Active").length}`,
        icon: (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      },
      {
        color: "green" as const,
        label: "Total Active Users",
        value: `${overallStats?.total_users ?? 0}`,
        sub: "System-wide registry",
        icon: (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        color: "purple" as const,
        label: "Pending Approvals",
        value: `${pendingApprovalsCount}`,
        sub: "Awaiting decision validation",
        icon: (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        color: "blue" as const,
        label: "Registrations (7d / 30d)",
        value: `${recentRegistrations.count7d} / ${recentRegistrations.count30d}`,
        sub: "New enterprise signups",
        icon: (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
    ];
  }, [orgs, overallStats, pendingApprovalsCount, recentRegistrations]);

  // Derive Activity List for feed
  const systemActivity = useMemo(() => {
    return auditLogs.slice(0, 5).map((log) => {
      const dt = new Date(log.timestamp);
      const day = dt.getDate().toString().padStart(2, "0");
      const month = dt.toLocaleString("en-US", { month: "short" });
      const time = dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      const cleanAction = log.action ? log.action.replace(/_/g, " ") : "Activity";
      return {
        day,
        month,
        title: `${cleanAction} (${log.performed_by})`,
        detail: `ID: #${log.invoice_id || "System"} · ${time}`,
        value: log.status_after ? log.status_after.toUpperCase() : "DONE",
        status: log.status_after === "approved" ? ("approved" as const) : log.status_after === "rejected" ? ("rejected" as const) : ("pending" as const),
      };
    });
  }, [auditLogs]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3 font-sans text-zinc-500">
        <svg className="animate-spin h-8 w-8 text-[#FFB800]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-xs">Gathering system-wide tenant registry data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Super Admin Portal</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            System-wide operational oversight, multi-tenant registry, and audit trials.
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all"
        >
          Refresh System ↻
        </button>
      </div>

      {/* KPI stats */}
      <CapsuleStatRow chips={kpiChips} />

      {/* Main content split grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-6 items-start">
        {/* Left: Organization registry table */}
        <div className="space-y-6">
          <Card title="Multi-Tenant Registry">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-black uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 ">Tenant Code</th>
                    <th className="py-3 px-4 ">Name</th>
                    <th className="py-3 px-4 ">Users count</th>
                    <th className="py-3 px-4 ">Invoices count</th>
                    <th className="py-3 px-4 ">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                  {orgs.map((org: Organization) => (
                    <tr key={org.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="py-4 pl-5 font-mono font-bold text-zinc-800 dark:text-zinc-100">{org.code}</td>
                      <td className="py-4 font-bold text-zinc-700 dark:text-zinc-300">
                        <div>{org.name}</div>
                        <div className="text-[10px] text-zinc-450 font-normal">{org.address || "—"}</div>
                      </td>
                      <td className="py-4 text-right font-bold text-zinc-850 dark:text-zinc-100">{org.user_count ?? 0}</td>
                      <td className="py-4 text-right font-bold text-zinc-850 dark:text-zinc-100">{org.invoice_count ?? 0}</td>
                      <td className="py-4 pl-8">
                        <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-350 font-bold">
                          <span className={`w-1.5 h-1.5 rounded-full ${org.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                          {org.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {orgs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-400">
                        No organizations found in database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quick Registration entry point */}
          <div className="rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Quick Operations</h3>
            <p className="text-xs text-zinc-500 font-medium">Quick links to register new tenants and manage system parameters.</p>
            <div className="flex flex-col gap-2">
              <Link
                href="/organizations"
                className="px-4 py-2.5 bg-[var(--role-accent)] text-[var(--role-accent-foreground)] font-bold text-xs rounded-xl shadow-sm hover:opacity-90 transition-all text-center"
              >
                Go to Tenant Manager
              </Link>
              <Link
                href="/settings"
                className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-250 font-bold text-xs rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-center"
              >
                Configure Global Routing
              </Link>
            </div>
          </div>

          {/* Activity Logs feed */}
          <ColoredListCard title="System Activity Audit Feed" color="purple" rows={systemActivity} />
        </div>
      </div>
    </div>
  );
}
