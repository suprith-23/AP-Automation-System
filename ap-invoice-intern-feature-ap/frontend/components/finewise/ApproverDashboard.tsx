"use client";
import React, { useMemo, useState } from "react";
import CapsuleStatRow from "../finewise/CapsuleStatRow";
import HeroChartCard from "./HeroChartCard";
import SystemCard from "./SystemCard";
import ConnectorCarousel from "./ConnectorCarousel";
import { Invoice } from "../../types/invoice";
import { calculateAverageReviewTime } from "../../utils/format";


type ApproverDashboardProps = {
  invoices: Invoice[];
  stats: any;
  enterpriseAnalytics: any;
};

export default function ApproverDashboard({ invoices = [], stats = {}, enterpriseAnalytics = null }: ApproverDashboardProps) {
  const safeInvoices = invoices || [];
  const [hoveredTime, setHoveredTime] = useState<any | null>(null);

  // Compute metric counts
  const awaitingAction = useMemo(() => {
    return safeInvoices.filter(
      (i) => i.workflow_status === "pending_approval"
    ).length;
  }, [safeInvoices]);

  const oneWeekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const approvedThisWeek = useMemo(() => {
    return invoices.filter((i) => {
      if (i.workflow_status !== "approved") return false;
      const dt = i.invoice_date ? new Date(i.invoice_date) : null;
      return dt && dt >= oneWeekAgo;
    }).length;
  }, [invoices, oneWeekAgo]);

  const rejectedThisWeek = useMemo(() => {
    return invoices.filter((i) => {
      if (i.workflow_status !== "rejected") return false;
      const dt = i.invoice_date ? new Date(i.invoice_date) : null;
      return dt && dt >= oneWeekAgo;
    }).length;
  }, [invoices, oneWeekAgo]);

  const avgReviewTime = useMemo(() => {
    return calculateAverageReviewTime(invoices);
  }, [invoices]);


  const approverStats = [
    {
      color: "blue" as const,
      label: "Awaiting My Action",
      value: `${awaitingAction}`,
      sub: "Needs decision verification",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      color: "green" as const,
      label: "Approved This Week",
      value: `${approvedThisWeek}`,
      sub: "Authorized disbursements",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      color: "red" as const,
      label: "Rejected This Week",
      value: `${rejectedThisWeek}`,
      sub: "Returned for discrepancies",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    {
      color: "grey" as const,
      label: "Avg My Review Time",
      value: avgReviewTime,
      sub: "SLA target < 4h",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ];

  // Turnaround Time Trend — compute real avg processing time per month from actual data
  const turnaroundData = useMemo(() => {
    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = monthNames[d.getMonth()];

      // Filter invoices processed in this month
      const monthInvoices = invoices.filter((inv: any) => {
        const procDate = inv.processed_at || inv.invoice_date;
        if (!procDate) return false;
        const dt = new Date(procDate);
        return dt.getMonth() === d.getMonth() && dt.getFullYear() === d.getFullYear();
      });

      // Compute avg turnaround in hours (processed_at - invoice_date)
      let avgHours = 0;
      if (monthInvoices.length > 0) {
        const hoursArr = monthInvoices
          .map((inv: any) => {
            if (inv.processed_at && inv.invoice_date) {
              const start = new Date(inv.invoice_date).getTime();
              const end = new Date(inv.processed_at).getTime();
              return Math.abs((end - start) / (1000 * 60 * 60)); // hours
            }
            return null;
          })
          .filter((h: number | null): h is number => h !== null && h >= 0 && h < 720); // ignore outliers > 30 days
        avgHours = hoursArr.length > 0 ? hoursArr.reduce((s, h) => s + h, 0) / hoursArr.length : 3.5;
      } else {
        avgHours = 0; // no data for that month
      }

      result.push({
        date: monthLabel,
        hours: parseFloat(avgHours.toFixed(1)),
      });
    }
    return result;
  }, [invoices]);


  const maxTimeVal = Math.max(...turnaroundData.map((d) => d.hours), 5);

  const turnaroundPoints = turnaroundData.map((d, index) => {
    const x = turnaroundData.length > 1 ? (index / (turnaroundData.length - 1)) * 380 + 40 : 40;
    const y = 140 - (d.hours / maxTimeVal) * 90;
    return { x, y, date: d.date, hours: d.hours };
  });

  const slaY = 140 - (4.0 / maxTimeVal) * 90;
  const timePath = turnaroundPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = turnaroundPoints.length > 0
    ? `M ${turnaroundPoints[0].x} 140 ` +
      turnaroundPoints.map((p) => `L ${p.x} ${p.y}`).join(" ") +
      ` L ${turnaroundPoints[turnaroundPoints.length - 1].x} 140 Z`
    : "";

  // Linked ERP systems for approvals flow
  const linkedSystems = useMemo(() => {
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
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Approver Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
          Personal overview of pending verification actions and approval metrics
        </p>
      </div>

      {/* KPI stats capsules */}
      <CapsuleStatRow chips={approverStats} />

      {/* Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Reusable Hero Bar Chart */}
        <HeroChartCard invoices={invoices} role="Approver" chartType="bar" />

        {/* Turnaround Time chart — line chart with SLA line */}
        <div className="rounded-2xl p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3">
          <div>
            <h3 className="text-base font-black uppercase tracking-widest text-zinc-400">Turnaround Time</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Average time-to-decision trend vs SLA target (last 30 days)</p>
          </div>

          <div className="h-44 relative mt-2 text-white">
            <svg className="w-full h-full" viewBox="0 0 460 170" preserveAspectRatio="none">
              <defs>
                <linearGradient id="turnaroundAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--role-accent)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--role-accent)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Shaded SLA Breach Region (values above 4.0h) */}
              <rect
                x="40"
                y="20"
                width="380"
                height={Math.max(0, slaY - 20)}
                fill="#EF4444"
                fillOpacity="0.04"
                rx="8"
              />
              {/* Shaded Within-SLA Target Region (values below or equal 4.0h) */}
              <rect
                x="40"
                y={slaY}
                width="380"
                height={Math.max(0, 140 - slaY)}
                fill="#22C55E"
                fillOpacity="0.02"
                rx="8"
              />

              <line
                x1="40"
                y1={slaY}
                x2="420"
                y2={slaY}
                stroke="#6B7280"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <text x="425" y={slaY + 3} fill="#6B7280" className="text-[9px] font-bold">
                SLA (4h)
              </text>

              {areaPath && (
                <path d={areaPath} fill="url(#turnaroundAreaGrad)" />
              )}

              {turnaroundPoints.slice(0, -1).map((p, idx) => {
                const nextP = turnaroundPoints[idx + 1];
                const avgHours = (p.hours + nextP.hours) / 2;
                const strokeColor = avgHours > 4.0 ? "#EF4444" : "#22C55E";
                return (
                  <line
                    key={idx}
                    x1={p.x}
                    y1={p.y}
                    x2={nextP.x}
                    y2={nextP.y}
                    stroke={strokeColor}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                );
              })}

              {turnaroundPoints.map((p, idx) => {
                const fillColor = p.hours > 4.0 ? "#EF4444" : "#22C55E";
                return (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={4}
                    fill={fillColor}
                    className="cursor-pointer hover:scale-125 transition-transform duration-150"
                    onMouseEnter={() => setHoveredTime(p)}
                    onMouseLeave={() => setHoveredTime(null)}
                  />
                );
              })}
            </svg>

            {hoveredTime && (
              <div
                className="absolute bg-zinc-950 text-white text-[10px] font-black rounded-lg px-2.5 py-1.5 shadow-xl border border-zinc-800 z-50 pointer-events-none"
                style={{
                  left: `${(hoveredTime.x / 460) * 100}%`,
                  top: `${(hoveredTime.y / 170) * 100 - 30}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div>{hoveredTime.date}</div>
                <div className={`text-xs mt-0.5 ${hoveredTime.hours > 4.0 ? "text-rose-500" : "text-emerald-500"}`}>{hoveredTime.hours} hours</div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Linked Systems / Approval Channels Row */}
      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-lg font-black uppercase tracking-widest text-zinc-400">Approval Channels & Linked Systems</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Verification sync endpoints for ledger disbursement</p>
        </div>
        <div className="w-full">
          <ConnectorCarousel connections={linkedSystems} />
        </div>
      </div>
    </div>
  );
}
