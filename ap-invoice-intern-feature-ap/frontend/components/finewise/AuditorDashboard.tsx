"use client";
import React, { useMemo } from "react";
import CapsuleStatRow from "../finewise/CapsuleStatRow";
import DataTable from "../finewise/DataTable";
import ColoredListCard from "../finewise/ColoredListCard";
import HeroChartCard from "./HeroChartCard";
import SystemCard from "./SystemCard";
import { Invoice } from "../../types/invoice";
import { mapInvoicesToGroupedTableRows } from "../../utils/format";
import ConnectorDetailsModal from "../ui/ConnectorDetailsModal";


type AuditorDashboardProps = {
  invoices: Invoice[];
  stats: any;
  enterpriseAnalytics: any;
  auditLogs: any[];
};

export default function AuditorDashboard({ invoices = [], stats = {}, enterpriseAnalytics = null, auditLogs = [] }: AuditorDashboardProps) {
  const safeInvoices = invoices || [];
  const safeAuditLogs = auditLogs || [];
  const [selectedConnector, setSelectedConnector] = React.useState<any | null>(null);

  // Calculate dynamic stats inside a single useMemo pass
  const { pendingCount, atRiskCount, approvedToday, rejectedToday } = useMemo(() => {
    let pCount = 0;
    let rCount = 0;
    
    for (let i = 0; i < safeInvoices.length; i++) {
      const inv = safeInvoices[i];
      const wf = inv.workflow_status;
      const val = inv.validation_status;
      const conf = inv.confidence_score;
      if (wf === "pending_review" || wf === "validation_failed") pCount++;
      if (val === "FAILED" || (conf !== undefined && conf < 0.85)) rCount++;
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
      atRiskCount: rCount,
      approvedToday: appToday,
      rejectedToday: rejToday
    };
  }, [safeInvoices, safeAuditLogs]);

  const auditorStats = [
    {
      color: "blue" as const,
      label: "Audit Queue",
      value: `${pendingCount}`,
      sub: "Awaiting inspection",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },

    {
      color: "red" as const,
      label: "Audit Warning Flags",
      value: `${atRiskCount}`,
      sub: "High risk discrepancies",
    },
    {
      color: "green" as const,
      label: "Validated Today",
      value: `${approvedToday}`,
      sub: "Approved logs",
    },
    {
      color: "red" as const,
      label: "Returned Today",
      value: `${rejectedToday}`,
      sub: "Rejected logs",
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
        title: `Audit Action — #${log.invoice_id}`,
        detail: log.action ? log.action.replace(/_/g, " ") : "Log inspection",
        value: log.status_after ? log.status_after.toUpperCase() : "CHECKED",
        status: log.status_after === "approved" ? ("approved" as const) : ("rejected" as const),
      };
    });
  };

  const tableGroups = mapInvoicesToGroupedTableRows(invoices, "Auditor");
  const recentActions = deriveRecentActions(auditLogs);



  const auditorSystems = useMemo(() => {
    const rawConns = stats?.apiConnections || [];
    return rawConns.slice(0, 3).map((c: any) => {
      const item = {
        name: c.name,
        connectorType: c.connectorType || "Audit Vault",
        secondaryLine: "Audit Gateway Node",
        environment: (c.environment || "production") as any,
        lastUsed: c.lastUsed || "Just now",
        status: (c.status === "active" ? "healthy" : "degraded") as any,
        iconLetter: "AU",
        onClick: () => setSelectedConnector({
          name: c.name,
          connectorType: c.connectorType || "Audit Vault",
          secondaryLine: "Audit Gateway Node",
          environment: (c.environment || "production") as any,
          lastUsed: c.lastUsed || "Just now",
          status: (c.status === "active" ? "healthy" : "degraded") as any,
          iconLetter: "AU"
        })
      };
      return item;
    });
  }, [stats]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Auditor Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
          Comprehensive compliance monitoring and system inspection logs
        </p>
      </div>

      <CapsuleStatRow chips={auditorStats} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          <HeroChartCard invoices={invoices} role="Auditor" chartType="bar" />
          <DataTable groups={tableGroups} />
        </div>

        <div className="flex flex-col gap-4">
          <ColoredListCard title="Recent Audits" color="blue" rows={recentActions} />
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-lg font-black uppercase tracking-widest text-zinc-400">Ledger Pipeline Status</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {auditorSystems.map((sys: any, idx: number) => (
            <SystemCard key={idx} {...sys} />
          ))}
        </div>
      </div>
      <ConnectorDetailsModal
        connector={selectedConnector}
        isOpen={selectedConnector !== null}
        onClose={() => setSelectedConnector(null)}
      />
    </div>
  );
}
