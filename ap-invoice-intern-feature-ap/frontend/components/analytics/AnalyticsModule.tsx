"use client";
import React, { useState, useEffect, useMemo } from "react";
import enterpriseService from "../../services/enterprise.service";
import { formatIndianCurrency } from "../../utils/format";
import ErrorBoundary from "../ErrorBoundary";
import ChartCard from "./ChartCard";

const stageStyles: Record<string, { bg: string; text: string; border: string; fill: string }> = {
  upload: {
    bg: "bg-zinc-50 dark:bg-zinc-950",
    text: "text-zinc-600 dark:text-zinc-400",
    border: "border-zinc-200/60 dark:border-zinc-800",
    fill: "var(--color-neutral)"
  },
  extraction: {
    bg: "bg-purple-500/15 dark:bg-zinc-900 border",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800/40",
    fill: "var(--chart-3)"
  },
  validation: {
    bg: "bg-pink-500/15 dark:bg-zinc-900 border",
    text: "text-pink-700 dark:text-pink-400",
    border: "border-pink-200 dark:border-pink-800/40",
    fill: "var(--chart-2)"
  },
  matching: {
    bg: "bg-blue-500/15 dark:bg-zinc-900 border",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800/40",
    fill: "var(--chart-1)"
  },
  approval: {
    bg: "bg-emerald-500/15 dark:bg-zinc-900 border",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/40",
    fill: "var(--color-success)"
  }
};

const shortStageNames: Record<string, string> = {
  upload: "Upld",
  extraction: "Extr",
  validation: "Vald",
  matching: "Mtch",
  approval: "Appr"
};
const getShortStage = (name: string) => shortStageNames[name.toLowerCase()] || name;

const shortExceptionNames: Record<string, string> = {
  "gst failures": "GST",
  "tds failures": "TDS",
  "rcm failures": "RCM",
  "po mismatch": "PO Match",
  "duplicates": "Dup"
};
const getShortException = (name: string) => shortExceptionNames[name.toLowerCase()] || name;

type AnalyticsModuleProps = {
  purchaseOrders?: any[];
  invoices?: any[];
  enterpriseAnalytics?: any;
  loading?: boolean;
  onRefresh?: () => void;
};

export default function AnalyticsModule({
  purchaseOrders = [],
  invoices = [],
  enterpriseAnalytics: parentAnalytics,
  loading: parentLoading = false,
  onRefresh
}: AnalyticsModuleProps) {
  const [localData, setLocalData] = useState<any>(null);
  const [localLoading, setLocalLoading] = useState<boolean>(true);
  const [localError, setLocalError] = useState<string | null>(null);

  // Load analytics dashboard if not passed from parent
  useEffect(() => {
    if (parentAnalytics) {
      setLocalData(parentAnalytics);
      setLocalLoading(parentLoading);
      return;
    }
    async function loadDashboardData() {
      try {
        setLocalLoading(true);
        const res = await enterpriseService.getAnalyticsDashboard();
        setLocalData(res);
      } catch (err: any) {
        console.error(err);
        setLocalError("Failed to fetch compliance analytics from gateway.");
      } finally {
        setLocalLoading(false);
      }
    }
    loadDashboardData();
  }, [parentAnalytics, parentLoading]);

  const data = parentAnalytics || localData;
  const isLoading = parentAnalytics ? parentLoading : localLoading;

  // Active Tooltip States for Charts
  const [hoveredPieSegment, setHoveredPieSegment] = useState<any>(null);
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<any>(null);
  const [hoveredVendorBar, setHoveredVendorBar] = useState<any>(null);
  const [hoveredConfidenceBar, setHoveredConfidenceBar] = useState<any>(null);
  const [hoveredStageBar, setHoveredStageBar] = useState<any>(null);
  const [hoveredExceptionBar, setHoveredExceptionBar] = useState<any>(null);
  const [hoveredTaxGroup, setHoveredTaxGroup] = useState<any>(null);

  // Compute Metrics and Chart Data Points
  const charts = useMemo(() => {
    if (!data) return null;

    const overview = data.overview || {};
    const finance = data.finance_summary || {};
    const aging = data.invoice_aging || {};
    const sla = data.processing_sla || {};
    const validation = data.validation_failures || {};
    const extraction = data.extraction_analytics || {};

    // 1. Invoice Status Pie Data (Exception-priority mutually-exclusive logic mirroring AdminDashboard.tsx)
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let exceptionCount = 0;

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      const wf = inv.workflow_status;
      const val = inv.validation_status;
      const conf = inv.confidence_score;

      if (val === "FAILED" || (conf !== undefined && conf < 0.85)) {
        exceptionCount++;
      } else {
        if (wf === "pending_review" || wf === "validation_failed" || wf === "pending_approval") pendingCount++;
        else if (wf === "approved") approvedCount++;
        else if (wf === "rejected") rejectedCount++;
      }
    }

    const totalCount = invoices.length || 1;
    const pieSegments = [
      { label: "Approved", count: approvedCount, color: "var(--color-success)" },
      { label: "Pending Review", count: pendingCount, color: "var(--color-warning)" },
      { label: "Rejected", count: rejectedCount, color: "var(--color-error)" },
      { label: "Exceptions", count: exceptionCount, color: "var(--chart-3)" }
    ];
    let currentAngle = 0;
    const pieData = pieSegments.map((seg) => {
      const percentage = (seg.count / totalCount) * 100;
      const angle = (seg.count / totalCount) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      return { ...seg, percentage, angle, startAngle };
    });

    // 2. Monthly Trend Line Data
    const trend = finance.monthly_spend || [];
    const maxSpend = Math.max(...trend.map((t: any) => t.spend), 1);
    const trendPoints = trend.map((p: any, idx: number) => {
      const x = trend.length > 1 ? (idx / (trend.length - 1)) * 360 + 40 : 40;
      const y = 140 - (p.spend / maxSpend) * 90;
      return { x, y, label: p.month, spend: p.spend };
    });

    // 3. Top Vendor Bar Data
    const vendors = finance.top_vendors || [];
    const maxVendorSpend = Math.max(...vendors.map((v: any) => v.spend), 1);
    const vendorBars = vendors.map((v: any, idx: number) => {
      const w = (v.spend / maxVendorSpend) * 220;
      return { label: v.vendor_name || v.vendor, value: v.spend, width: w, idx };
    });

    // 4. AI Confidence Distribution Data
    const confDist = extraction.confidence_distribution || { "0_50": 0, "50_75": 0, "75_90": 0, "90_100": 0 };
    const confData = [
      { label: "0-50%", count: confDist["0_50"] || 0 },
      { label: "50-75%", count: confDist["50_75"] || 0 },
      { label: "75-90%", count: confDist["75_90"] || 0 },
      { label: "90-100%", count: confDist["90_100"] || 0 }
    ];
    const maxConfCount = Math.max(...confData.map(c => c.count), 1);
    const confidenceBars = confData.map((c, i) => {
      const h = (c.count / maxConfCount) * 100;
      return { ...c, height: h, i };
    });

    // 5. Processing Time Stages Data
    const stages = sla.stage_durations || {};
    const stageData = Object.entries(stages).map(([k, v]: any) => ({ label: k, mins: v }));
    const maxMins = Math.max(...stageData.map(s => s.mins), 1);
    const stageBars = stageData.map((s, idx) => {
      const h = (s.mins / maxMins) * 100;
      return { ...s, height: h, idx };
    });

    // 6. Exception Distribution Data
    const excData = [
      { label: "GST Failures", count: validation.gst_failures || 0, color: "var(--chart-6)" },
      { label: "TDS Failures", count: validation.tds_failures || 0, color: "var(--chart-2)" },
      { label: "RCM Failures", count: validation.rcm_failures || 0, color: "var(--chart-5)" },
      { label: "PO Mismatch", count: validation.po_mismatches || 0, color: "var(--chart-4)" },
      { label: "Duplicates", count: validation.duplicate_invoices || 0, color: "var(--chart-3)" }
    ];
    const maxExcCount = Math.max(...excData.map(e => e.count), 1);
    const exceptionBars = excData.map((e, idx) => {
      const h = (e.count / maxExcCount) * 100;
      return { ...e, height: h, idx };
    });

    // 7. GST vs TDS Comparison Data
    const gstTotal = finance.total_gst || 0;
    const tdsTotal = finance.total_tds || 0;
    const maxTax = Math.max(gstTotal, tdsTotal, 1);
    const taxBars = [
      { label: "Calculated GST", amount: gstTotal, height: (gstTotal / maxTax) * 110, fill: "var(--chart-1)" },
      { label: "Deducted TDS", amount: tdsTotal, height: (tdsTotal / maxTax) * 110, fill: "var(--chart-2)" }
    ];

    return { pieData, trendPoints, vendorBars, confidenceBars, stageBars, exceptionBars, taxBars };
  }, [data]);

  const handleRetry = () => {
    setLocalError(null);
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-8 bg-zinc-100 dark:bg-zinc-800 rounded-full w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 bg-zinc-100 dark:bg-zinc-800 rounded-3xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded-3xl"></div>
          <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  if (localError || !data) {
    return (
      <div className="p-8 text-center bg-zinc-900 border border-red-900/30 rounded-3xl max-w-md mx-auto space-y-4">
        <div className="flex justify-center text-rose-500">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-zinc-150">Analytics Load Interrupted</h3>
        <p className="text-xs text-zinc-400">{localError || "The database returned empty analytics metrics."}</p>
        <button 
          onClick={handleRetry} 
          className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
        >
          Verify Sync & Retry
        </button>
      </div>
    );
  }

  const overview = data.overview || {};
  const finance = data.finance_summary || {};
  const aging = data.invoice_aging || {};
  const sla = data.processing_sla || {};
  const validation = data.validation_failures || {};
  const queue = data.queue_health || {};
  const vendors = data.vendor_performance || [];

  return (
    <ErrorBoundary>
      <div className="space-y-5 animate-fade-in font-sans">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-2.5 tracking-tight">
              <span>AP Automations Analytics & Insights</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-1 font-medium">Compliance validations, processing SLA trends, and vendor ledger analysis.</p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all"
            >
              Refresh Data ↻
            </button>
          )}
        </div>

        {/* Dynamic KPI Metrics Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-3xl bg-[#3B82F6] text-white shadow-lg shadow-blue-500/10 flex flex-col justify-between">
            <div className="text-[10px] text-white/80 font-black uppercase tracking-widest">Invoices Overview</div>
            <div className="text-3xl font-black mt-3">{overview.total_invoices ?? 0}</div>
            <div className="text-xs text-white/90 mt-2 font-semibold">Accepted: {overview.approved ?? 0} | Rejected: {overview.rejected ?? 0} | Pending: {overview.pending ?? 0}</div>
          </div>
          <div className="p-6 rounded-3xl bg-[#8B5CF6] text-white shadow-lg shadow-purple-500/10 flex flex-col justify-between">
            <div className="text-[10px] text-white/80 font-black uppercase tracking-widest">Total Invoice Value</div>
            <div className="text-3xl font-black mt-3">₹{formatIndianCurrency(finance.total_invoice_value ?? 0)}</div>
            <div className="text-xs text-white/90 mt-2 font-semibold">Average: ₹{formatIndianCurrency(finance.average_invoice_amount ?? 0)}</div>
          </div>
          <div className="p-6 rounded-3xl bg-[#EC4899] text-white shadow-lg shadow-pink-500/10 flex flex-col justify-between">
            <div className="text-[10px] text-white/80 font-black uppercase tracking-widest">Pending Review Exceptions</div>
            <div className="text-3xl font-black mt-3">{overview.pending ?? 0}</div>
            <div className="text-xs text-white/90 mt-2 font-semibold">Awaiting analyst action</div>
          </div>
          <div className="p-6 rounded-3xl bg-[#10B981] text-white shadow-lg shadow-emerald-500/10 flex flex-col justify-between">
            <div className="text-[10px] text-white/80 font-black uppercase tracking-widest">Auto-Approval Ratio</div>
            <div className="text-3xl font-black mt-3">
              {overview.auto_approval_percentage ? `${overview.auto_approval_percentage}%` : "0%"}
            </div>
            <div className="text-xs text-white/90 mt-2 font-semibold">Auto approved: {overview.auto_approved ?? 0}</div>
          </div>
        </div>

        {/* 7 SVG responsive charts blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          {/* Chart 1: Invoice Status Pie (Donut) */}
          <ChartCard title="Invoice Status Distribution">
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
              <div className="w-36 h-36 relative">
                <svg className="w-full h-full" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="75" fill="transparent" stroke="#F4F4F5" className="dark:stroke-zinc-800" strokeWidth="18" />
                  {charts?.pieData.map((seg, idx) => {
                    const circ = 2 * Math.PI * 75;
                    const strokeDash = (seg.percentage / 100) * circ;
                    const offset = circ - (seg.startAngle / 360) * circ;
                    return (
                      <circle
                        key={idx}
                        cx="100"
                        cy="100"
                        r="75"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="18"
                        strokeDasharray={`${strokeDash} ${circ}`}
                        strokeDashoffset={offset}
                        transform="rotate(-90 100 100)"
                        className="cursor-pointer transition-all duration-200 hover:stroke-[22px]"
                        onMouseEnter={() => setHoveredPieSegment(seg)}
                        onMouseLeave={() => setHoveredPieSegment(null)}
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-2xl font-black text-zinc-900 dark:text-white leading-none">{overview.total_invoices}</span>
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">Total Docs</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 min-w-[150px]">
                {charts?.pieData.map((seg, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-zinc-600 dark:text-zinc-300">{seg.label}</span>
                    </div>
                    <span className="text-zinc-900 dark:text-white font-mono">{seg.count}</span>
                  </div>
                ))}
                {hoveredPieSegment && (
                  <div className="mt-2 bg-zinc-950 text-white rounded-lg p-2 text-[10px] font-bold border border-zinc-800 animate-fade-in">
                    {hoveredPieSegment.label}: {hoveredPieSegment.percentage.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          </ChartCard>

          {/* Chart 2: Monthly Spend Line Trend */}
          <ChartCard title="Monthly Spend Trend" action={
              <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>Spend (INR)</span>
              </div>
          }>
            <div className="h-44 relative mt-2">
              <svg className="w-full h-full" viewBox="0 0 460 170" preserveAspectRatio="none">
                {/* Horizontal reference lines & Y axis values */}
                <line x1="50" y1="20" x2="440" y2="20" stroke="#F4F4F5" className="dark:stroke-zinc-800" strokeWidth="1" />
                <text x="10" y="24" className="fill-zinc-400 text-[8px] font-bold">Max</text>

                <line x1="50" y1="65" x2="440" y2="65" stroke="#F4F4F5" className="dark:stroke-zinc-800" strokeWidth="1" />
                <text x="10" y="69" className="fill-zinc-400 text-[8px] font-bold">Mid</text>

                <line x1="50" y1="110" x2="440" y2="110" stroke="#F4F4F5" className="dark:stroke-zinc-800" strokeWidth="1" />
                <text x="10" y="114" className="fill-zinc-400 text-[8px] font-bold">Min</text>

                <line x1="50" y1="140" x2="440" y2="140" stroke="#F4F4F5" className="dark:stroke-zinc-800" strokeWidth="1" />
                <text x="10" y="144" className="fill-zinc-400 text-[8px] font-bold">0</text>

                {/* Line Path */}
                {charts?.trendPoints.length && (
                  <path
                    d={charts.trendPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x + 10} ${p.y - 10}`).join(" ")}
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Plot points */}
                {charts?.trendPoints.map((p, idx) => (
                  <g key={idx}>
                    <circle
                      cx={p.x + 10}
                      cy={p.y - 10}
                      r="4.5"
                      fill="#3B82F6"
                      className="cursor-pointer transition-all hover:r-6"
                      onMouseEnter={() => setHoveredTrendPoint(p)}
                      onMouseLeave={() => setHoveredTrendPoint(null)}
                    />
                    {/* Bottom X axis labels */}
                    <text
                      x={p.x + 10}
                      y="160"
                      textAnchor="middle"
                      className="fill-zinc-500 dark:fill-zinc-400 text-[8px] font-bold"
                    >
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>

              {/* Tooltip Overlay */}
              {hoveredTrendPoint && (
                <div
                  className="absolute bg-zinc-950 text-white text-[10px] font-bold rounded-lg px-2 py-1 shadow-xl border border-zinc-800 pointer-events-none"
                  style={{
                    left: `${((hoveredTrendPoint.x + 10) / 460) * 100}%`,
                    top: `${((hoveredTrendPoint.y - 10) / 170) * 100 - 20}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  {hoveredTrendPoint.label}: ₹{formatIndianCurrency(hoveredTrendPoint.spend)}
                </div>
              )}
            </div>
          </ChartCard>

          {/* Chart 3: Top Vendor Spend Bars */}
          <ChartCard title="Top Vendors Spend Breakdown" className="col-span-1 lg:col-span-2">
            <div className="space-y-3.5 max-h-44 overflow-y-auto">
              {charts?.vendorBars.length === 0 ? (
                <div className="text-center text-xs text-zinc-500 py-6">No vendor spend recorded.</div>
              ) : (
                charts?.vendorBars.map((v, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-24 text-[10px] font-bold truncate text-zinc-600 dark:text-zinc-300">{v.label}</div>
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 h-3 rounded-full overflow-hidden relative flex items-center">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300 cursor-pointer"
                        style={{ width: `${(v.width / 220) * 100}%` }}
                        onMouseEnter={() => setHoveredVendorBar(v)}
                        onMouseLeave={() => setHoveredVendorBar(null)}
                      />
                    </div>
                    <div className="w-16 text-[10px] font-bold text-right text-zinc-900 dark:text-white">
                      ₹{formatIndianCurrency(v.value)}
                    </div>
                  </div>
                ))
              )}
              {hoveredVendorBar && (
                <div className="text-[10px] font-bold text-blue-500 text-center pt-2">
                  Selected: {hoveredVendorBar.label} · ₹{formatIndianCurrency(hoveredVendorBar.value)}
                </div>
              )}
            </div>
          </ChartCard>

          {/* Chart 4: AI Confidence Distribution Chart */}
          <ChartCard title="AI Confidence Distribution Bracket">
            <div className="h-36 flex items-end gap-5 justify-around relative">
              <svg width="0" height="0" className="absolute" aria-hidden="true">
                <defs>
                  <pattern id="pat-dist-grain" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.15)" />
                    <circle cx="8" cy="8" r="1" fill="rgba(255,255,255,0.15)" />
                  </pattern>
                </defs>
              </svg>
              {charts?.confidenceBars.map((bar) => (
                <div key={bar.i} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[8px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">{bar.count} docs</span>
                  <div className="h-24 w-full flex items-end relative">
                    <div
                      className="w-full bg-[#8B5CF6] hover:bg-[#9d73f8] rounded-t-lg transition-all cursor-pointer relative overflow-hidden"
                      style={{ height: `${Math.max(bar.height, 4)}%` }}
                      onMouseEnter={() => setHoveredConfidenceBar(bar)}
                      onMouseLeave={() => setHoveredConfidenceBar(null)}
                    >
                      <div className="absolute inset-0 opacity-40 bg-[url(#pat-dist-grain)] pointer-events-none" />
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-zinc-450 uppercase tracking-widest">{bar.label}</span>
                </div>
              ))}

              {hoveredConfidenceBar && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-zinc-950 text-white rounded-lg p-2 text-[10px] font-black border border-zinc-800 shadow-xl">
                  Bracket {hoveredConfidenceBar.label}: {hoveredConfidenceBar.count} documents
                </div>
              )}
            </div>
          </ChartCard>

          {/* Chart 5: Stage-wise Processing Duration */}
          <ChartCard title="Stage-wise Processing Time (minutes)">
            <div className="h-36 flex items-end gap-5 justify-around relative">
              <svg width="0" height="0" className="absolute" aria-hidden="true">
                <defs>
                  <pattern id="pat-stage-wave" width="20" height="12" patternUnits="userSpaceOnUse">
                    <path d="M0 6 Q5 0, 10 6 T20 6" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
                  </pattern>
                </defs>
              </svg>
              {charts?.stageBars.map((bar) => {
                const style = stageStyles[bar.label.toLowerCase()] || stageStyles.upload;
                return (
                  <div key={bar.idx} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] font-bold text-zinc-550 dark:text-zinc-400 mb-1">{bar.mins}m</span>
                    <div className="h-24 w-full flex items-end relative">
                      <div
                        className="w-full rounded-t-lg transition-all cursor-pointer relative overflow-hidden"
                        style={{ height: `${Math.max(bar.height, 4)}%`, backgroundColor: style.fill }}
                        onMouseEnter={() => setHoveredStageBar(bar)}
                        onMouseLeave={() => setHoveredStageBar(null)}
                      >
                        <div className="absolute inset-0 opacity-40 bg-[url(#pat-stage-wave)] pointer-events-none" />
                      </div>
                    </div>
                    <span className="text-[9px] font-black text-zinc-455 uppercase tracking-widest" title={bar.label}>{getShortStage(bar.label)}</span>
                  </div>
                );
              })}

              {hoveredStageBar && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-zinc-950 text-white rounded-lg p-2 text-[10px] font-black border border-zinc-800 shadow-xl">
                  {hoveredStageBar.label} Avg: {hoveredStageBar.mins} mins
                </div>
              )}
            </div>
          </ChartCard>

          {/* Chart 6: Exception Categories Distribution */}
          <ChartCard title="Validation Failure Distributions">
            <div className="h-36 flex items-end gap-5 justify-around relative">
              <svg width="0" height="0" className="absolute" aria-hidden="true">
                <defs>
                  <pattern id="pat-exc-squiggle" width="16" height="16" patternUnits="userSpaceOnUse">
                    <path d="M0 8 C 4 12, 6 4, 10 8 S 14 4, 16 8" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
                  </pattern>
                </defs>
              </svg>
              {charts?.exceptionBars.map((bar) => (
                <div key={bar.idx} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] font-bold text-zinc-550 dark:text-zinc-400 mb-1">{bar.count}</span>
                  <div className="h-24 w-full flex items-end relative">
                    <div
                      className="w-full rounded-t-lg transition-all cursor-pointer relative overflow-hidden"
                      style={{ height: `${Math.max(bar.height, 4)}%`, backgroundColor: bar.color }}
                      onMouseEnter={() => setHoveredExceptionBar(bar)}
                      onMouseLeave={() => setHoveredExceptionBar(null)}
                    >
                      <div className="absolute inset-0 opacity-45 bg-[url(#pat-exc-squiggle)] pointer-events-none" />
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-zinc-450 uppercase tracking-widest" title={bar.label}>{getShortException(bar.label)}</span>
                </div>
              ))}

              {hoveredExceptionBar && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-zinc-950 text-white rounded-lg p-2 text-[10px] font-black border border-zinc-800 shadow-xl">
                  {hoveredExceptionBar.label}: {hoveredExceptionBar.count} failures
                </div>
              )}
            </div>
          </ChartCard>

          {/* Chart 7: Tax comparison GST vs TDS */}
          <ChartCard title="Calculated Tax Breakdown (GST vs TDS)" className="col-span-1 lg:col-span-2">
            <div className="h-36 flex items-end justify-center gap-16 relative">
              <svg width="0" height="0" className="absolute" aria-hidden="true">
                <defs>
                  <pattern id="pat-tax-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                    <line x1="0" y1="0" x2="10" y2="0" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                  </pattern>
                </defs>
              </svg>
              {charts?.taxBars.map((bar, i) => (
                <div key={i} className="flex flex-col items-center gap-1 w-24">
                  <span className="text-[9px] font-bold text-zinc-850 dark:text-zinc-200 mb-1">₹{formatIndianCurrency(bar.amount)}</span>
                  <div className="h-24 w-full flex items-end relative border-b border-zinc-150 dark:border-zinc-800">
                    <div
                      className="w-full rounded-t-lg transition-all cursor-pointer opacity-90 hover:opacity-100 relative overflow-hidden"
                      style={{ height: `${Math.max(bar.height, 4)}%`, backgroundColor: bar.fill }}
                      onMouseEnter={() => setHoveredTaxGroup(bar)}
                      onMouseLeave={() => setHoveredTaxGroup(null)}
                    >
                      <div className="absolute inset-0 opacity-40 bg-[url(#pat-tax-grid)] pointer-events-none" />
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest">{bar.label}</span>
                </div>
              ))}

              {hoveredTaxGroup && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-zinc-950 text-white rounded-lg p-2 text-[10px] font-black border border-zinc-800 shadow-xl">
                  {hoveredTaxGroup.label} Total: ₹{formatIndianCurrency(hoveredTaxGroup.amount)}
                </div>
              )}
            </div>
          </ChartCard>

        </div>

        {/* Detailed Vendor Performance Ranking table */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6">Vendor Performance Ranking Metrics</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-white text-[10px] font-black uppercase tracking-wider border-none">
                  <th className="rounded-l-full py-3.5 px-4 bg-[#EC4899] text-white">Vendor Name</th>
                  <th className="py-3.5 px-4 bg-[#EC4899] text-white">Invoice Volume</th>
                  <th className="py-3.5 px-4 bg-[#EC4899] text-white">Approval Rate</th>
                  <th className="py-3.5 px-4 bg-[#EC4899] text-white">PO Match Rate</th>
                  <th className="py-3.5 px-4 bg-[#EC4899] text-white">GST Compliance Holds</th>
                  <th className="rounded-r-full py-3.5 px-4 bg-[#EC4899] text-white">TDS Withhold Mismatch</th>
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-450 dark:text-zinc-500 font-bold">No vendor ledger matches found.</td>
                  </tr>
                ) : (
                  vendors.map((v: any, idx: number) => (
                    <tr key={idx} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-white">{v.vendor_name}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-zinc-800 dark:text-zinc-200">{v.invoice_count}</td>
                      <td className="py-3.5 px-4 text-center text-emerald-500 font-extrabold">{v.approval_rate}%</td>
                      <td className="py-3.5 px-4 text-center text-blue-500 font-extrabold">{v.match_rate}%</td>
                      <td className="py-3.5 px-4 text-center text-rose-500 font-semibold">{v.gst_mismatch_count}</td>
                      <td className="py-3.5 px-4 text-center text-rose-500 font-semibold">{v.tds_mismatch_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
