"use client";
import React, { useMemo } from "react";
import CapsuleStatRow from "../finewise/CapsuleStatRow";
import DataTable from "../finewise/DataTable";
import ColoredListCard from "../finewise/ColoredListCard";
import HeroChartCard from "./HeroChartCard";
import SystemCard from "./SystemCard";
import { Invoice } from "../../types/invoice";
import { mapInvoicesToGroupedTableRows } from "../../utils/format";


type FinanceManagerDashboardProps = {
  invoices: Invoice[];
  stats: any;
  enterpriseAnalytics: any;
  auditLogs: any[];
};

export default function FinanceManagerDashboard({ invoices = [], stats = {}, enterpriseAnalytics = null, auditLogs = [] }: FinanceManagerDashboardProps) {
  const safeInvoices = invoices || [];
  const safeAuditLogs = auditLogs || [];

  // Calculate dynamic stats inside a single useMemo pass
  const { pendingCount, totalVolume, approvedToday, rejectedToday } = useMemo(() => {
    let pCount = 0;
    let tVolume = 0;
    
    for (let i = 0; i < safeInvoices.length; i++) {
      const inv = safeInvoices[i];
      const wf = inv.workflow_status;
      if (wf === "pending_review" || wf === "validation_failed") pCount++;
      tVolume += (inv.total_amount || 0);
    }

    let appToday = 0;
    let rejToday = 0;
    for (let j = 0; j < safeAuditLogs.length; j++) {
      const log = safeAuditLogs[j];
      if (log?.status_after === "approved") appToday++;
      if (log?.status_after === "rejected") rejToday++;
    }

    return {
      pendingCount: pCount,
      totalVolume: tVolume,
      approvedToday: appToday,
      rejectedToday: rejToday
    };
  }, [safeInvoices, safeAuditLogs]);

  const financeStats = [
    {
      color: "pink" as const,
      label: "Disbursement Queue",
      value: `${pendingCount}`,
      sub: "Pending release approval",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      color: "blue" as const,
      label: "Total Volume managed",
      value: `₹${(totalVolume / 100000).toFixed(1)}L`,
      sub: "Historical invoice pool",
    },
    {
      color: "green" as const,
      label: "Disbursed Today",
      value: `${approvedToday}`,
      sub: "Approved vouchers",
    },
    {
      color: "red" as const,
      label: "Held Invoices",
      value: `${rejectedToday}`,
      sub: "Rejected vouchers",
    },
  ];

  const deriveRecentActions = (logs: any[]) => {
    return logs.slice(0, 5).map((log) => {
      const dt = new Date(log.timestamp);
      const day = dt.getDate().toString().padStart(2, "0");
      const month = dt.toLocaleString("en-US", { month: "short" });
      return {
        day,
        month,
        title: `Clearance Release — #${log.invoice_id}`,
        detail: log.action ? log.action.replace(/_/g, " ") : "Voucher release status",
        value: log.status_after ? log.status_after.toUpperCase() : "CLEARED",
        status: log.status_after === "approved" ? ("approved" as const) : ("rejected" as const),
      };
    });
  };

  const tableGroups = mapInvoicesToGroupedTableRows(invoices, "Finance Manager");
  const recentActions = deriveRecentActions(auditLogs);

  const financeSystems = useMemo(() => {
    const rawConns = stats?.apiConnections || [];
    return rawConns.slice(0, 3).map((c: any) => ({
      name: c.name,
      connectorType: c.connectorType || "Treasury Gateway",
      secondaryLine: "Disbursement Channel Link",
      environment: (c.environment || "production") as any,
      lastUsed: c.lastUsed || "Just now",
      status: (c.status === "active" ? "healthy" : "degraded") as any,
      iconLetter: "FM",
    }));
  }, [stats]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Finance Manager Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
          Accounts payable tracking and treasury settlement control ledger
        </p>
      </div>

      <CapsuleStatRow chips={financeStats} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          <HeroChartCard invoices={invoices} role={"Finance Manager" as any} chartType="bar" />
          <DataTable groups={tableGroups} />
        </div>

        <div className="flex flex-col gap-4">
          <ColoredListCard title="Payment Events" color="purple" rows={recentActions} />
        </div>
      </div>


      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-lg font-black uppercase tracking-widest text-zinc-400">Payment Gateways & Nodes</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {financeSystems.map((sys: any, idx: number) => (
            <SystemCard key={idx} {...sys} />
          ))}
        </div>
      </div>
    </div>
  );
}
