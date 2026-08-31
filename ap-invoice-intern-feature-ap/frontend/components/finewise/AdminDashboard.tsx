"use client";
import React, { useMemo } from "react";
import CapsuleStatRow from "../finewise/CapsuleStatRow";
import ColoredListCard from "../finewise/ColoredListCard";
import StatusBadge from "../StatusBadge";
import Card from "../ui/Card";
import HeroChartCard from "./HeroChartCard";
import SystemCard from "./SystemCard";
import ConnectorCarousel from "./ConnectorCarousel";
import { Invoice } from "../../types/invoice";
import { formatIndianCurrency, parseUTCTimestamp } from "../../utils/format";
import { toast } from "sonner";
import InvoiceSummaryPopup from "../ui/InvoiceSummaryPopup";
import ConnectorDetailsModal from "../ui/ConnectorDetailsModal";
import CreateConnectorModal from "../ui/CreateConnectorModal";

const DonutSegment = React.memo(({ seg, isSelected, onClick, onMouseEnter, onMouseLeave }: any) => {
  const r = 80;
  const circ = 2 * Math.PI * r;
  const strokeDash = (seg.percentage / 100) * circ;
  const offset = -(seg.startAngle / 360) * circ;
  return (
    <circle
      cx="100"
      cy="100"
      r={r}
      fill="transparent"
      stroke={seg.color}
      strokeWidth={isSelected ? 22 : 16}
      strokeDasharray={`${strokeDash} ${circ}`}
      strokeDashoffset={offset}
      transform="rotate(-90 100 100)"
      className="cursor-pointer transition-all duration-200 hover:stroke-[22px]"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
});
DonutSegment.displayName = "DonutSegment";

type AdminDashboardProps = {
  stats: any;
  enterpriseAnalytics: any;
  auditLogs: any[];
  invoices: Invoice[];
  onRefresh?: () => void;
};


export default function AdminDashboard({ stats = {}, enterpriseAnalytics = null, auditLogs = [], invoices = [], onRefresh }: AdminDashboardProps) {
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [selectedConnector, setSelectedConnector] = React.useState<any | null>(null);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [customConns, setCustomConns] = React.useState<any[]>([]);

  React.useEffect(() => {
    const stored = localStorage.getItem("custom_erp_connections");
    if (stored) {
      try {
        setCustomConns(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleCreateConnector = (newConn: any) => {
    const updated = [...customConns, newConn];
    setCustomConns(updated);
    localStorage.setItem("custom_erp_connections", JSON.stringify(updated));
  };

  const handleDeleteConnector = (name: string) => {
    const updated = customConns.filter(c => c.name !== name);
    setCustomConns(updated);
    localStorage.setItem("custom_erp_connections", JSON.stringify(updated));
  };

  const handleUpdateStatus = (name: string, newStatus: string) => {
    if (customConns.some(c => c.name === name)) {
      const updated = customConns.map(c => 
        c.name === name ? { ...c, status: newStatus } : c
      );
      setCustomConns(updated);
      localStorage.setItem("custom_erp_connections", JSON.stringify(updated));
    }
  };

  const safeInvoices = invoices || [];

  // Compute dashboard metrics dynamically from invoices with single O(N) pass inside useMemo
  const { totalInvoices, pendingReview, pendingApproval, approved, rejected, exceptionCount } = useMemo(() => {
    let reviewCount = 0;
    let approvalCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < safeInvoices.length; i++) {
      const inv = safeInvoices[i];
      const wf = inv.workflow_status;
      const val = inv.validation_status;
      const conf = inv.confidence_score;

      // If the invoice is already resolved, bucket it under the final status
      if (wf === "approved" || wf === "released_for_payment" || wf === "paid") {
        approvedCount++;
      } else if (wf === "rejected") {
        rejectedCount++;
      } else if (val === "FAILED" || (conf !== undefined && conf < 0.85)) {
        // If not resolved, and it has validation/confidence errors, it is an active Exception
        failedCount++;
      } else {
        // Otherwise, bucket into standard workflow statuses.
        if (wf === "pending_review" || wf === "validation_failed" || wf === "validation_pending") reviewCount++;
        else if (wf === "pending_approval") approvalCount++;
      }
    }

    return {
      totalInvoices: safeInvoices.length,
      pendingReview: reviewCount,
      pendingApproval: approvalCount,
      approved: approvedCount,
      rejected: rejectedCount,
      exceptionCount: failedCount,
    };
  }, [safeInvoices]);

  const avgConfidenceVal = useMemo(() => {
    if (safeInvoices.length === 0) return 0;
    const scores = safeInvoices.filter((i) => i.confidence_score !== undefined).map((i) => i.confidence_score as number);
    if (scores.length === 0) return 0;
    const sum = scores.reduce((s, x) => s + x, 0);
    return Math.round((sum / scores.length) * 100);
  }, [safeInvoices]);

  const totalInvoiceValue = useMemo(() => {
    return safeInvoices.reduce((sum, i) => sum + (i.total_amount ?? 0), 0);
  }, [safeInvoices]);

  const todayProcessing = useMemo(() => {
    return safeInvoices.filter(inv => {
      const ts = inv.extraction_timestamp || inv.processed_at;
      if (!ts) return false;
      return new Date(ts).toDateString() === new Date().toDateString();
    }).length;
  }, [safeInvoices]);

  const activeJobs = useMemo(() => {
    if (!enterpriseAnalytics?.queue_health) return 0;
    return (enterpriseAnalytics.queue_health.running || 0) + (enterpriseAnalytics.queue_health.pending || 0);
  }, [enterpriseAnalytics]);

  const autoApprovalRate = useMemo(() => {
    return typeof enterpriseAnalytics?.overview?.auto_approval_percentage === "number" 
      ? enterpriseAnalytics.overview.auto_approval_percentage 
      : 0.0;
  }, [enterpriseAnalytics]);

  const processingTime = useMemo(() => {
    if (safeInvoices.length === 0) return "0s";
    return enterpriseAnalytics?.overview?.average_processing_time_mins !== undefined && enterpriseAnalytics?.overview?.average_processing_time_mins !== null
      ? `${enterpriseAnalytics.overview.average_processing_time_mins}m`
      : "5.4m";
  }, [enterpriseAnalytics, safeInvoices]);

  // Map to the stats array used by the CapsuleStatRow component (10 core metrics)
  const adminStats = [
    {
      color: "blue" as const,
      label: "Total Invoices",
      value: `${totalInvoices}`,
      sub: `Value: ₹${(totalInvoiceValue / 100000).toFixed(1)}L`,
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      color: "amber" as const,
      label: "Pending",
      value: `${pendingReview + pendingApproval}`,
      sub: "Awaiting review",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      color: "green" as const,
      label: "Processed Today",
      value: `${todayProcessing}`,
      sub: "Completed batches",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      color: "purple" as const,
      label: "Active Celery Jobs",
      value: `${activeJobs}`,
      sub: "Async queue status",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      color: "red" as const,
      label: "Processing Time",
      value: processingTime,
      sub: "Per document average",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      color: "teal" as const,
      label: "Match Rate",
      value: `${typeof stats?.matchRate === "number" ? stats.matchRate.toFixed(1) : "0.0"}%`,
      sub: "PO match percentage",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      color: "green" as const,
      label: "Auto Approval",
      value: `${typeof autoApprovalRate === "number" ? autoApprovalRate.toFixed(1) : "0.0"}%`,
      sub: "Touchless system runs",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      color: "purple" as const,
      label: "AI Confidence",
      value: `${avgConfidenceVal}%`,
      sub: "OCR extraction mean",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      color: "blue" as const,
      label: "Today's Invoices",
      value: `${todayProcessing}`,
      sub: "Extracted today",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      color: "grey" as const,
      label: "Active Jobs",
      value: `${activeJobs}`,
      sub: "Celery pipeline workers",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
    },
  ];

  // State for donut segment filter
  const [selectedStatusFilter, setSelectedStatusFilter] = React.useState<string | null>(null);
  const [hoveredSegment, setHoveredSegment] = React.useState<{ label: string; count: number; percentage: number } | null>(null);

  // Status breakdown metrics
  const donutData = React.useMemo(() => {
    const segments = [
      { label: "Approved", count: approved, color: "#22C55E", key: "approved" },
      { label: "Pending", count: pendingReview + pendingApproval, color: "#F59E0B", key: "pending_review" },
      { label: "Rejected", count: rejected, color: "#EF4444", key: "rejected" },
      { label: "Exceptions", count: exceptionCount, color: "#3B82F6", key: "exceptions" },
    ];
    const sumCounts = approved + (pendingReview + pendingApproval) + rejected + exceptionCount;
    const totalCount = sumCounts || 1;
    let currentAngle = 0;
    return segments.map((seg) => {
      const percentage = (seg.count / totalCount) * 100;
      const angle = (seg.count / totalCount) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      return { ...seg, percentage, angle, startAngle };
    });
  }, [approved, pendingReview, pendingApproval, rejected, exceptionCount]);

  // Derive Recent Uploads (last 5 invoices)
  const recentUploads = invoices
    .filter((inv) => {
      if (!selectedStatusFilter) return true;
      if (selectedStatusFilter === "exceptions") {
        return inv.validation_status === "FAILED" || (inv.confidence_score !== undefined && inv.confidence_score < 0.85);
      }
      if (selectedStatusFilter === "pending_review") {
        return inv.workflow_status === "pending_review" || inv.workflow_status === "pending_approval" || inv.workflow_status === "validation_failed";
      }
      return inv.workflow_status === selectedStatusFilter;
    })
    .slice(0, 5);

  // Derive Recent Exceptions (low confidence or failed validations)
  const recentExceptions = invoices.filter(
    (i) => i.validation_status === "FAILED" || (i.confidence_score !== undefined && i.confidence_score < 0.85)
  ).slice(0, 5);

  // Group audit logs for Recent Activities (Purple variant - general activity)
  const recentActivities = auditLogs
    .filter((log) => log.performed_by !== "system" && !log.action?.includes("LOGIN") && !log.action?.includes("LOGOUT"))
    .slice(0, 5)
    .map((log) => {
    const dt = parseUTCTimestamp(log.timestamp);
    const day = dt.getDate().toString().padStart(2, "0");
    const month = dt.toLocaleString("en-US", { month: "short" });
    const cleanAction = log.action ? log.action.replace(/_/g, " ") : "Action";
    return {
      day,
      month,
      title: `${cleanAction} on #${log.invoice_id || "System"}`,
      detail: `${log.performed_by} · ${dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
      value: log.status_after ? log.status_after.toUpperCase() : "DONE",
      status: log.status_after === "approved" ? ("approved" as const) : log.status_after === "rejected" ? ("rejected" as const) : ("pending" as const),
      invoiceId: log.invoice_id || undefined,
    };
  });

  // Green variant - Recently Resolved Exceptions
  const resolvedExceptionsFeed = useMemo(() => {
    const resolvedInvs = invoices
      .filter((inv) => inv.validation_status === "PASSED" && inv.workflow_status === "approved")
      .slice(0, 5);

    return resolvedInvs.map((inv) => {
      const dt = inv.processed_at ? parseUTCTimestamp(inv.processed_at) : (inv.invoice_date ? parseUTCTimestamp(inv.invoice_date) : new Date());
      const day = dt.getDate().toString().padStart(2, "0");
      const month = dt.toLocaleString("en-US", { month: "short" });
      return {
        day,
        month,
        title: `Resolved — Invoice #${inv.invoice_number || inv.id}`,
        detail: `GSTIN: ${inv.seller_name || inv.vendor_name || "Unknown"}`,
        value: `₹${(inv.total_amount || 0).toLocaleString("en-IN")}`,
        status: "resolved" as const,
        invoiceId: inv.id,
      };
    });
  }, [invoices]);

  // Blue variant - System Events (derived dynamically from audit logs)
  const systemEvents = useMemo(() => {
    const sysLogs = auditLogs
      .filter((log) => log.performed_by === "system" || log.action?.includes("LOGIN") || log.action?.includes("LOGOUT"))
      .slice(0, 5);

    if (sysLogs.length > 0) {
      return sysLogs.map((log) => {
        const dt = parseUTCTimestamp(log.timestamp);
        const day = dt.getDate().toString().padStart(2, "0");
        const month = dt.toLocaleString("en-US", { month: "short" });
        const time = dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const cleanAction = log.action ? log.action.replace(/_/g, " ") : "Action";
        return {
          day,
          month,
          title: cleanAction,
          detail: `By: ${log.performed_by} at ${time}`,
          value: log.status_after ? log.status_after.toUpperCase() : "HEALTHY",
          status: "healthy" as const,
          invoiceId: log.invoice_id || undefined,
        };
      });
    }

    return [];
  }, [auditLogs]);

  const liveConnections = useMemo(() => {
    const rawConns = stats?.apiConnections || [];
    const allConns = [...rawConns, ...customConns];
    if (allConns.length > 0) {
      return allConns.map((c: any) => {
        const item = {
          name: c.name,
          connectorType: c.connectorType || "ERP Integration",
          secondaryLine: c.maskedKey || c.secondaryLine || "•••• •••• ••••",
          environment: (c.environment || "production") as any,
          lastUsed: c.lastUsed || "Never",
          status: (c.status === "active" || c.status === "healthy" || c.status === "online" ? "active" : "expired") as any,
          iconLetter: c.connectorType ? c.connectorType.substring(0, 2).toUpperCase() : "ERP",
          onClick: () => setSelectedConnector({
            name: c.name,
            connectorType: c.connectorType || "ERP Integration",
            secondaryLine: c.maskedKey || c.secondaryLine || "•••• •••• ••••",
            environment: (c.environment || "production") as any,
            lastUsed: c.lastUsed || "Never",
            status: (c.status === "active" || c.status === "healthy" || c.status === "online" ? "active" : "expired") as any,
            iconLetter: c.connectorType ? c.connectorType.substring(0, 2).toUpperCase() : "ERP",
          })
        };
        return item;
      });
    }
    return [];
  }, [stats, customConns]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
          AP Automation system state overview and performance metrics
        </p>
      </div>

      {/* Stats Chips Capsule Grid */}
      <CapsuleStatRow chips={adminStats} />

      {/* Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Reusable Hero bar chart for Admin */}
        <HeroChartCard invoices={invoices} role="Admin" chartType="bar" />

        {/* Status Breakdown Donut Chart */}
        <div className="rounded-2xl p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black uppercase tracking-widest text-zinc-400">Status Breakdown</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Click status segment to filter list below</p>
              </div>
              {selectedStatusFilter && (
                <button
                  onClick={() => setSelectedStatusFilter(null)}
                  className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-600 dark:text-zinc-350 transition-colors"
                >
                  Clear Filter ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
            {/* SVG Donut */}
            <div className="w-36 h-36 relative">
              <svg className="w-full h-full" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="80" fill="transparent" stroke="#E4E4E7" className="dark:stroke-zinc-800" strokeWidth="16" />
                {donutData.map((seg, idx) => (
                  <DonutSegment
                    key={idx}
                    seg={seg}
                    isSelected={selectedStatusFilter === seg.key}
                    onClick={() => setSelectedStatusFilter(seg.key)}
                    onMouseEnter={() => setHoveredSegment({ label: seg.label, count: seg.count, percentage: seg.percentage })}
                    onMouseLeave={() => setHoveredSegment(null)}
                  />
                ))}

              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-black text-zinc-900 dark:text-white leading-none">{invoices.length}</span>
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">Total Docs</span>
              </div>
            </div>

            {/* Legend & Tooltip Display */}
            <div className="flex flex-col gap-2.5 min-w-[140px]">
              {donutData.map((seg, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedStatusFilter(seg.key)}
                  className={`flex items-center justify-between text-left p-1.5 rounded-xl transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    selectedStatusFilter === seg.key ? "bg-zinc-100 dark:bg-zinc-800 font-extrabold" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 font-bold">{seg.label}</span>
                  </div>
                  <span className="text-xs text-zinc-450 dark:text-zinc-500 font-black">{seg.count}</span>
                </button>
              ))}

              {hoveredSegment && (
                <div className="mt-1 bg-zinc-950 text-white rounded-lg p-2 text-[10px] font-black shadow-lg border border-zinc-800 animate-fade-in absolute sm:static mt-3">
                  {hoveredSegment.label}: {hoveredSegment.count} ({hoveredSegment.percentage.toFixed(1)}%)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Tables on Left, Activity Stack on Right */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-4 items-start">
        <div className="space-y-3">
          
          {/* Recent Uploads Table */}
          <Card title="Recent Uploads">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-white text-[10px] font-black uppercase tracking-wider">
                    <th className="rounded-l-full py-3.5 px-4 bg-[#EC4899]">File Name</th>
                    <th className="py-3.5 px-4 bg-[#EC4899]">Uploaded By</th>
                    <th className="py-3.5 px-4 bg-[#EC4899]">Amount</th>
                    <th className="py-3.5 px-4 bg-[#EC4899]">Processing Status</th>
                    <th className="rounded-r-full py-3.5 px-4 bg-[#EC4899] text-right pr-5">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800 text-xs">
                  {recentUploads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-zinc-400 dark:text-zinc-500">
                        No uploads recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recentUploads.map((inv) => (
                      <tr 
                        key={inv.id} 
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 cursor-pointer"
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <td className="py-3 font-bold text-zinc-800 dark:text-zinc-100 pl-5">
                          {inv.invoice_number || `INV-${inv.id}`}
                        </td>
                        <td className="py-3 text-zinc-500 dark:text-zinc-400">
                          {inv.source_type || "Manual Upload"}
                        </td>
                        <td className="py-3 text-right font-bold text-zinc-800 dark:text-zinc-100 pr-5">
                          ₹{formatIndianCurrency(inv.total_amount || 0)}
                        </td>
                        <td className="py-3">
                          <StatusBadge status={inv.workflow_status || "Uploaded"} />
                        </td>
                        <td className="py-3 font-bold text-zinc-850 dark:text-zinc-100 pr-5 text-right">
                          {inv.confidence_score ? `${(inv.confidence_score * 100).toFixed(0)}%` : "95%"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
 
          <Card title="Recent Exceptions">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-white text-[10px] font-black uppercase tracking-wider">
                    <th className="rounded-l-full py-3.5 px-4 bg-[#EC4899]">Invoice Number</th>
                    <th className="py-3.5 px-4 bg-[#EC4899]">Vendor</th>
                    <th className="py-3.5 px-4 bg-[#EC4899]">Severity</th>
                    <th className="py-3.5 px-4 bg-[#EC4899]">Description</th>
                    <th className="rounded-r-full py-3.5 px-4 bg-[#EC4899]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800 text-xs">
                  {recentExceptions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-zinc-400 dark:text-zinc-500">
                        No active exceptions detected.
                      </td>
                    </tr>
                  ) : (
                    recentExceptions.map((inv) => (
                      <tr 
                        key={inv.id} 
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 cursor-pointer"
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <td className="py-3 font-bold text-zinc-800 dark:text-zinc-100 pl-5">
                          {inv.invoice_number || `INV-${inv.id}`}
                        </td>
                        <td className="py-3 text-zinc-850 dark:text-zinc-100 font-semibold">
                          {inv.seller_name || inv.vendor_name || "Unknown"}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            inv.confidence_score && inv.confidence_score < 0.7 ? "bg-red-100 text-red-700 dark:bg-red-900/30" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30"
                          }`}>
                            {inv.confidence_score && inv.confidence_score < 0.7 ? "Critical" : "High"}
                          </span>
                        </td>
                        <td className="py-3 text-zinc-500 dark:text-zinc-400 font-medium truncate max-w-[180px]">
                          {inv.validation_errors?.[0] || (inv.confidence_score && inv.confidence_score < 0.85 ? "Low confidence score extraction flag" : "Missing PO match relation")}
                        </td>
                        <td className="py-3">
                          <StatusBadge status={inv.workflow_status || "Pending"} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Recently Resolved Exceptions (Green) - Moved to left column to balance spacing */}
          <ColoredListCard title="Recently Resolved" color="green" rows={resolvedExceptionsFeed} />
        </div>
 
        {/* Right Sidebar Stack */}
        <div className="space-y-4">
          {/* System Events (Blue) */}
          <ColoredListCard title="System Events" color="blue" rows={systemEvents} />
 
          {/* Recent Activities (Purple) */}
          <ColoredListCard title="Recent Activities" color="purple" rows={recentActivities} />
        </div>
      </div>
 
      {/* Live API Connections Row */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black uppercase tracking-widest text-zinc-400 flex items-center gap-3">
              <span>Live API Connections</span>
              <button 
                onClick={() => setIsCreateOpen(true)}
                className="w-6 h-6 rounded-full bg-[#22C55E] text-black font-black text-sm flex items-center justify-center hover:scale-[1.04] transition-transform select-none shadow-sm shrink-0"
              >
                +
              </button>
            </h2>
          </div>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium -mt-2.5 mb-2">Active database connectors and API gateways credentials</div>
        <div className="w-full">
          <ConnectorCarousel connections={liveConnections} />
        </div>
      </div>
      
      <InvoiceSummaryPopup
        invoice={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
      <ConnectorDetailsModal
        connector={selectedConnector}
        isOpen={selectedConnector !== null}
        onClose={() => setSelectedConnector(null)}
        onUpdateStatus={handleUpdateStatus}
        onDelete={customConns.some(c => c.name === selectedConnector?.name) ? handleDeleteConnector : undefined}
      />
      <CreateConnectorModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateConnector}
      />
    </div>
  );
}
