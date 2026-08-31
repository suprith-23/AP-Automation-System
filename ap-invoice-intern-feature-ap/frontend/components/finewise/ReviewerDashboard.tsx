"use client";
import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import CapsuleStatRow from "../finewise/CapsuleStatRow";
import DataTable from "../finewise/DataTable";
import ColoredListCard from "../finewise/ColoredListCard";
import HeroChartCard from "./HeroChartCard";
import SystemCard from "./SystemCard";
import ConnectorCarousel from "./ConnectorCarousel";
import { Invoice } from "../../types/invoice";
import { calculateAverageReviewTime, mapInvoicesToGroupedTableRows, parseUTCTimestamp } from "../../utils/format";
import InvoiceSummaryPopup from "../ui/InvoiceSummaryPopup";



type ReviewerDashboardProps = {
  invoices: Invoice[];
  stats: any;
  enterpriseAnalytics: any;
  auditLogs: any[];
};

export default function ReviewerDashboard({ invoices = [], stats = {}, enterpriseAnalytics = null, auditLogs = [] }: ReviewerDashboardProps) {
  const router = useRouter();
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const safeInvoices = invoices || [];
  const safeAuditLogs = auditLogs || [];

  // Calculate dynamic stats inside a single useMemo pass
  const { pendingCount, atRiskCount, approvedToday, rejectedToday } = useMemo(() => {
    let pCount = 0;
    let rCount = 0;
    
    for (let i = 0; i < safeInvoices.length; i++) {
      const inv = safeInvoices[i];
      const wf = inv.workflow_status;
      const val = inv.validation_status;
      const conf = inv.confidence_score;
      
      const isResolved = ["approved", "rejected", "released_for_payment", "paid"].includes(wf || "");
      if (!isResolved) {
        if (wf === "pending_review" || wf === "validation_failed") pCount++;
        if (val === "FAILED" || (conf !== undefined && conf < 0.85)) rCount++;
      }
    }

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    let appToday = 0;
    let rejToday = 0;
    for (let j = 0; j < safeAuditLogs.length; j++) {
      const log = safeAuditLogs[j];
      if (log?.status_after === "approved" && log?.timestamp && parseUTCTimestamp(log.timestamp) >= oneDayAgo) appToday++;
      if (log?.status_after === "rejected" && log?.timestamp && parseUTCTimestamp(log.timestamp) >= oneDayAgo) rejToday++;
    }

    return {
      pendingCount: pCount,
      atRiskCount: rCount,
      approvedToday: appToday,
      rejectedToday: rejToday
    };
  }, [safeInvoices, safeAuditLogs]);

  const reviewerStats = [
    {
      color: "pink" as const,
      label: "Queue Size",
      value: `${pendingCount}`,
      sub: "Pending review",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      color: "red" as const,
      label: "SLA At-Risk",
      value: `${atRiskCount}`,
      sub: "Needs urgent review",
    },
    {
      color: "green" as const,
      label: "Approved Today",
      value: `${approvedToday}`,
      sub: "From system actions",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    {
      color: "red" as const,
      label: "Rejected Today",
      value: `${rejectedToday}`,
      sub: "With comments",
    },
    {
      color: "purple" as const,
      label: "Avg Review Time",
      value: calculateAverageReviewTime(invoices),

      sub: "Within SLA targets",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  // Derive Recent Actions list from logs (green variant - success-driven)
  const deriveRecentActions = (logs: any[]) => {
    const reviewerLogs = logs.filter((log) => 
      log.status_after === "approved" || 
      log.status_after === "rejected" || 
      log.status_after === "pending_approval" ||
      log.action === "REVIEWER_APPROVED" ||
      log.action === "APPROVER_APPROVED" ||
      log.action === "APPROVER_REJECTED"
    );
    if (reviewerLogs.length === 0) {
      return [];
    }
    return reviewerLogs.slice(0, 5).map((log) => {
      const dt = parseUTCTimestamp(log.timestamp);
      const day = dt.getDate().toString().padStart(2, "0");
      const month = dt.toLocaleString("en-US", { month: "short" });
      let displayValue = "FORWARDED";
      let displayStatus: any = "pending";
      if (log.status_after === "approved") {
        displayValue = "APPROVED";
        displayStatus = "approved";
      } else if (log.status_after === "rejected") {
        displayValue = "REJECTED";
        displayStatus = "rejected";
      }
      return {
        day,
        month,
        title: `${displayValue} — Invoice #${log.invoice_id}`,
        detail: log.action ? log.action.replace(/_/g, " ") : "Action taken",
        value: displayValue,
        status: displayStatus,
      };
    });
  };

  const tableGroups = mapInvoicesToGroupedTableRows(invoices);
  const recentActions = deriveRecentActions(auditLogs);


  // Reviewer Environments
  const reviewerSystems = useMemo(() => {
    const rawConns = stats?.apiConnections || [];
    if (rawConns.length > 0) {
      return rawConns.map((c: any) => ({
        name: c.name,
        connectorType: c.connectorType || "ERP Integration",
        secondaryLine: c.maskedKey || "•••• •••• ••••",
        environment: (c.environment || "production") as any,
        lastUsed: c.lastUsed || "Just now",
        status: (c.status === "active" ? "active" : "expired") as any,
        iconLetter: c.connectorType ? c.connectorType.substring(0, 2).toUpperCase() : "ERP"
      }));
    }
    return [];
  }, [stats]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Reviewer Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
          Review queue · SLA tracking · Audit trail · {new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stat row */}
      <CapsuleStatRow chips={reviewerStats} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-4 items-start">
        
        {/* Left main content */}
        <div className="space-y-4">
          <HeroChartCard invoices={invoices} role="Reviewer" chartType="bar" />
          <DataTable 
            groups={tableGroups} 
            onRowClick={(wfId) => {
              const numericId = parseInt(wfId.replace("WF-", ""));
              const matchedInv = invoices.find(inv => inv.id === numericId);
              if (matchedInv) {
                setSelectedInvoice(matchedInv);
              }
            }}
          />
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Recent actions (Green theme) */}
          <ColoredListCard
            title="Recent Actions"
            color="green"
            rows={recentActions}
          />

          {/* SLA warning mini-card */}
          {invoices.length > 0 && (
            <div className="bg-amber-500 dark:bg-amber-600 rounded-2xl p-5 text-white shadow-md border border-amber-600/30">
              <div className="font-black text-base mb-3 text-amber-50">⚠ SLA At-Risk</div>
              <div className="flex flex-col gap-2">
                {invoices.slice(0, 3).map((inv, i) => (
                  <button
                    key={i}
                    onClick={() => router.push(`/invoices/${inv.id}?role=Reviewer`)}
                    className="w-full text-left bg-white/15 hover:bg-white/25 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors block cursor-pointer"
                  >
                    INV-{inv.invoice_number || inv.id} · Verification SLA Warning
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live API Connections Row */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black uppercase tracking-widest text-zinc-400 flex items-center gap-3">
              <span>Live API Connections</span>
            </h2>
          </div>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium -mt-2.5 mb-2">Active database connectors and API gateways credentials</div>
        <div className="w-full">
          <ConnectorCarousel connections={reviewerSystems} />
        </div>
      </div>
      <InvoiceSummaryPopup
        invoice={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </div>
  );
}
