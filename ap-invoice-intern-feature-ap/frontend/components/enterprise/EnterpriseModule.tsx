"use client";

import React, { useState, useEffect } from "react";
import enterpriseService from "../../services/enterprise.service";

type EnterpriseModuleProps = {
  invoices: any[];
  onRefresh: () => void;
};

export default function EnterpriseModule({ invoices, onRefresh }: EnterpriseModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<"tds" | "gst" | "po-matching" | "approvals" | "payments" | "reports" | "integrations">("tds");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // --- Integrations States ---
  const [integrationsStatus, setIntegrationsStatus] = useState<any>({ odoo: false, sap: false, netsuite: false, quickbooks: false });
  const [syncLogs, setSyncLogs] = useState<any[]>([]);

  const fetchIntegrations = async () => {
    try {
      const statusRes = await enterpriseService.getIntegrationsStatus();
      const logsRes = await enterpriseService.getSyncLogs();
      setIntegrationsStatus(statusRes);
      setSyncLogs(logsRes);
    } catch (err) {
      console.error("Failed to fetch integrations status", err);
    }
  };

  useEffect(() => {
    if (activeSubTab === "integrations") {
      fetchIntegrations();
    }
  }, [activeSubTab]);

  // Helper to show message banner
  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 5000);
  };

  // --- TDS States ---
  const [tdsSec, setTdsSec] = useState("194C");
  const [tdsDesc, setTdsDesc] = useState("Payments to Contractors");
  const [tdsRateWithPan, setTdsRateWithPan] = useState(0.01);
  const [tdsRateWithoutPan, setTdsRateWithoutPan] = useState(0.20);
  const [tdsSingleLimit, setTdsSingleLimit] = useState(30000);
  const [tdsAggLimit, setTdsAggLimit] = useState(100000);
  const [tdsInvoiceId, setTdsInvoiceId] = useState("");
  const [tdsPan, setTdsPan] = useState("");
  const [tdsResult, setTdsResult] = useState<any>(null);

  // --- GST States ---
  const [gstInvoiceId, setGstInvoiceId] = useState("");
  const [gstResult, setGstResult] = useState<any>(null);

  // --- PO Matching States ---
  const [poInvoiceId, setPoInvoiceId] = useState("");
  const [isThreeWay, setIsThreeWay] = useState(true);
  const [poResult, setPoResult] = useState<any>(null);

  // --- Approval States ---
  const [appDept, setAppDept] = useState("Finance");
  const [appCostCenter, setAppCostCenter] = useState("");
  const [appMinAmount, setAppMinAmount] = useState(0);
  const [appApprovers, setAppApprovers] = useState("Manager, VP_Finance");
  const [appSlaHours, setAppSlaHours] = useState(24);
  const [appInvoiceId, setAppInvoiceId] = useState("");
  const [appComments, setAppComments] = useState("");

  // --- Payment States ---
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [paySchedDate, setPaySchedDate] = useState("");
  const [payMethod, setPayMethod] = useState("NEFT");
  const [payRef, setPayRef] = useState("");
  const [payAmtPaid, setPayAmtPaid] = useState("");
  const [noteNum, setNoteNum] = useState("");
  const [noteType, setNoteType] = useState("CREDIT");
  const [noteAmt, setNoteAmt] = useState("");
  const [noteReason, setNoteReason] = useState("");

  const handleSaveTdsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await enterpriseService.configureTdsSection({
        section_code: tdsSec,
        description: tdsDesc,
        rate_with_pan: Number(tdsRateWithPan),
        rate_without_pan: Number(tdsRateWithoutPan),
        single_threshold: Number(tdsSingleLimit),
        aggregate_threshold: Number(tdsAggLimit)
      });
      showMessage(`TDS section ${tdsSec} configured successfully!`);
    } catch (err: any) {
      showMessage(err.response?.data?.detail || "Failed to configure TDS section.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateTds = async () => {
    if (!tdsInvoiceId) return;
    setLoading(true);
    try {
      const res = await enterpriseService.calculateTds({
        invoice_id: Number(tdsInvoiceId),
        section_code: tdsSec,
        vendor_pan: tdsPan || undefined
      });
      setTdsResult(res);
      showMessage("TDS deduction calculated.");
      onRefresh();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || "Failed to calculate TDS.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyGst = async () => {
    if (!gstInvoiceId) return;
    setLoading(true);
    try {
      const res = await enterpriseService.verifyGst({ invoice_id: Number(gstInvoiceId) });
      setGstResult(res);
      showMessage("GST audit finished.");
    } catch (err: any) {
      showMessage(err.response?.data?.detail || "Failed to verify GST compliance.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePoMatching = async () => {
    if (!poInvoiceId) return;
    setLoading(true);
    try {
      const res = await enterpriseService.poMatch({
        invoice_id: Number(poInvoiceId),
        is_three_way: isThreeWay
      });
      setPoResult(res);
      showMessage(`PO Match completed with status: ${res.match_status}`);
      onRefresh();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || "Failed to perform matching.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApprovalRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await enterpriseService.createApprovalRule({
        department: appDept || undefined,
        cost_center: appCostCenter || undefined,
        min_amount: Number(appMinAmount),
        approvers: appApprovers.split(",").map(s => s.trim()),
        sla_hours: Number(appSlaHours)
      });
      showMessage("Approval rule saved successfully!");
    } catch (err: any) {
      showMessage(err.response?.data?.detail || "Failed to save rule.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalDecision = async (action: string) => {
    if (!appInvoiceId) return;
    setLoading(true);
    try {
      await enterpriseService.submitApprovalDecision({
        invoice_id: Number(appInvoiceId),
        actor: "Admin Manager",
        action: action,
        comments: appComments || undefined
      });
      showMessage(`Workflow decision: ${action} submitted.`);
      onRefresh();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || "Failed to submit decision.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSlaCheck = async () => {
    setLoading(true);
    try {
      const res = await enterpriseService.runSlaCheck();
      showMessage(`SLA scan completed. ${res.escalated_count} overdue steps escalated.`);
    } catch (err: any) {
      showMessage("SLA check failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePayment = async () => {
    if (!payInvoiceId || !paySchedDate) return;
    setLoading(true);
    try {
      await enterpriseService.schedulePayment({
        invoice_id: Number(payInvoiceId),
        scheduled_date: paySchedDate
      });
      showMessage("Payment schedule date updated.");
    } catch (err: any) {
      showMessage(err.response?.data?.detail || "Failed to schedule payment.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!payInvoiceId || !payAmtPaid) return;
    setLoading(true);
    try {
      await enterpriseService.recordPayment({
        invoice_id: Number(payInvoiceId),
        amount_paid: Number(payAmtPaid),
        payment_method: payMethod,
        reference_number: payRef || undefined
      });
      showMessage("Payout transaction recorded successfully!");
      onRefresh();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || "Failed to record transaction.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePostNote = async () => {
    if (!payInvoiceId || !noteNum || !noteAmt) return;
    setLoading(true);
    try {
      await enterpriseService.postCreditDebitNote({
        invoice_id: Number(payInvoiceId),
        note_number: noteNum,
        note_type: noteType,
        amount: Number(noteAmt),
        reason: noteReason || undefined
      });
      showMessage(`${noteType} note applied successfully.`);
      onRefresh();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || "Failed to apply note.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySync = async (logId: number) => {
    setLoading(true);
    try {
      await enterpriseService.retrySyncLog(logId);
      showMessage("ERP Sync retried successfully!");
      fetchIntegrations();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || "Failed to retry ERP Sync.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Enterprise AP Suite</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-normal">
          Manage TDS deductions, GST audits, 3-way matching rules, approvals routing, payments scheduling, and reporting exports
        </p>
      </div>

      {/* Message alert banner */}
      {msg && (
        <div className={`p-4 rounded-2xl border text-xs font-bold ${
          msg.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900" 
            : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900"
        }`}>
          {msg.text}
        </div>
      )}

      {/* Navigation sub-tabs */}
      <div className="flex space-x-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto hide-scrollbar">
        {[
          { id: "tds", label: "TDS Engine" },
          { id: "gst", label: "GST Compliance" },
          { id: "po-matching", label: "PO Matching" },
          { id: "approvals", label: "Approval Workflows" },
          { id: "payments", label: "Payments Manager" },
          { id: "reports", label: "Reports Download" },
          { id: "integrations", label: "ERP Integrations" }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeSubTab === t.id
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-850 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left forms area */}
        <div className="lg:col-span-2 space-y-6">

          {/* Sub-tab 1: TDS Engine */}
          {activeSubTab === "tds" && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#FF3EA5]">TDS Settings & Calculations</h2>
              
              <form onSubmit={handleSaveTdsConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">TDS Section Code</label>
                  <input type="text" value={tdsSec} onChange={(e) => setTdsSec(e.target.value)} required className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Description</label>
                  <input type="text" value={tdsDesc} onChange={(e) => setTdsDesc(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Rate (With PAN)</label>
                  <input type="number" step="0.001" value={tdsRateWithPan} onChange={(e) => setTdsRateWithPan(Number(e.target.value))} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Rate (Without PAN)</label>
                  <input type="number" step="0.001" value={tdsRateWithoutPan} onChange={(e) => setTdsRateWithoutPan(Number(e.target.value))} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Single Invoice Threshold Limit</label>
                  <input type="number" value={tdsSingleLimit} onChange={(e) => setTdsSingleLimit(Number(e.target.value))} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Annual Aggregate Limit</label>
                  <input type="number" value={tdsAggLimit} onChange={(e) => setTdsAggLimit(Number(e.target.value))} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                </div>
                <div className="md:col-span-2">
                  <button type="submit" disabled={loading} className="w-full py-3 bg-[#FF3EA5] hover:bg-[#FF5CB8] text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                    Save Section Config
                  </button>
                </div>
              </form>

              <hr className="border-zinc-150 dark:border-zinc-800" />

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Run Calculation on Invoice</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Invoice ID</label>
                    <select value={tdsInvoiceId} onChange={(e) => setTdsInvoiceId(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer">
                      <option value="">Select Invoice...</option>
                      {invoices.map(i => <option key={i.id} value={i.id}>{i.invoice_number || `ID: ${i.id}`} ({i.seller_name || "Unknown"})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Vendor PAN</label>
                    <input type="text" placeholder="ABCDE1234F" value={tdsPan} onChange={(e) => setTdsPan(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                  </div>
                  <button onClick={handleCalculateTds} disabled={loading || !tdsInvoiceId} className="py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                    Calculate TDS
                  </button>
                </div>

                {tdsResult && (
                  <div className="p-4 bg-[#F8F9FA] dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs space-y-2.5 font-medium">
                    <div className="flex justify-between"><span className="text-zinc-400">PAN Validation Status:</span><span className={`font-black ${tdsResult.pan_valid ? "text-emerald-500" : "text-rose-500"}`}>{tdsResult.pan_valid ? "VALID" : "INVALID"}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">TDS Applicable:</span><span className={`font-black ${tdsResult.tds_applicable ? "text-rose-500" : "text-zinc-500"}`}>{tdsResult.tds_applicable ? "YES" : "NO"}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Vendor Category:</span><span className="font-bold">{tdsResult.vendor_category || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">TDS Section Code:</span><span className="font-bold">{tdsResult.section_code || "194C"}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Applied Rate:</span><span className="font-bold text-zinc-800 dark:text-white">{(tdsResult.tds_rate * 100).toFixed(1)}%</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Expected TDS:</span><span className="font-bold">₹{(tdsResult.expected_tds ?? tdsResult.tds_amount).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Actual TDS:</span><span className="font-bold">₹{(tdsResult.actual_tds ?? 0.0).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Variance:</span><span className={`font-black ${(tdsResult.variance ?? 0) < 0 ? "text-rose-500" : (tdsResult.variance ?? 0) > 0 ? "text-amber-500" : "text-emerald-500"}`}>₹{(tdsResult.variance ?? 0).toFixed(2)} ({tdsResult.variance_status?.toUpperCase() || "MATCHED"})</span></div>
                    <p className="text-[10px] text-zinc-500 mt-2 font-mono leading-relaxed">{tdsResult.reason}</p>
                    {tdsResult.recommendation && (
                      <div className="mt-2 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-[10px] text-zinc-600 dark:text-zinc-300 font-bold border-l-2 border-[#FF3EA5]">
                        <span className="text-[#FF3EA5] mr-1">Recommendation:</span>
                        {tdsResult.recommendation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sub-tab 2: GST Compliance */}
          {activeSubTab === "gst" && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#FF3EA5]">GST Compliance Portal</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Select Invoice to Audit</label>
                    <select value={gstInvoiceId} onChange={(e) => setGstInvoiceId(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer">
                      <option value="">Select Invoice...</option>
                      {invoices.map(i => <option key={i.id} value={i.id}>{i.invoice_number || `ID: ${i.id}`} - Seller GSTIN: {i.seller_gstin || "None"}</option>)}
                    </select>
                  </div>
                  <button onClick={handleVerifyGst} disabled={loading || !gstInvoiceId} className="w-full py-2.5 bg-[#FF3EA5] hover:bg-[#FF5CB8] text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                    Verify GST Rules
                  </button>
                </div>

                {gstResult && (
                  <div className="space-y-4 animate-fade-in text-xs font-medium">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 bg-[#F8F9FA] dark:bg-[#141417] rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <span className="block text-[9px] uppercase tracking-wider text-zinc-400 mb-1">Status</span>
                        <span className={`font-black ${gstResult.is_compliant ? "text-emerald-500" : "text-rose-500"}`}>
                          {gstResult.is_compliant ? "COMPLIANT" : "DISCREPANCIES"}
                        </span>
                      </div>
                      <div className="p-3 bg-[#F8F9FA] dark:bg-[#141417] rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <span className="block text-[9px] uppercase tracking-wider text-zinc-400 mb-1">Transaction</span>
                        <span className="font-bold text-zinc-700 dark:text-zinc-200">{gstResult.is_interstate ? "Inter-state" : "Intra-state"}</span>
                      </div>
                      <div className="p-3 bg-[#F8F9FA] dark:bg-[#141417] rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <span className="block text-[9px] uppercase tracking-wider text-zinc-400 mb-1">Reverse Charge (RCM)</span>
                        <span className={`font-bold ${gstResult.rcm_applicable ? "text-amber-500" : "text-zinc-500"}`}>
                          {gstResult.rcm_applicable ? "Applicable" : "Not Applicable"}
                        </span>
                      </div>
                      <div className="p-3 bg-[#F8F9FA] dark:bg-[#141417] rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <span className="block text-[9px] uppercase tracking-wider text-zinc-400 mb-1">ITC Eligibility</span>
                        <span className={`font-bold ${gstResult.itc_eligible ? "text-emerald-500" : "text-rose-500"}`}>
                          {gstResult.itc_eligible ? "Eligible" : "Ineligible / Blocked"}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2">
                      <div className="flex justify-between"><span className="text-zinc-400">Total Audit CGST:</span><span>₹{gstResult.total_calculated_cgst.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Total Audit SGST:</span><span>₹{gstResult.total_calculated_sgst.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Total Audit IGST:</span><span>₹{gstResult.total_calculated_igst.toFixed(2)}</span></div>
                      <hr className="border-zinc-200 dark:border-zinc-800" />
                      <div className="flex justify-between"><span className="text-zinc-400">Invoice Header GST:</span><span>₹{(gstResult.invoice_gst ?? 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Extracted Line Items GST:</span><span>₹{(gstResult.extracted_gst ?? 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Purchase Order GST:</span><span>₹{(gstResult.po_gst ?? 0).toFixed(2)}</span></div>
                      <div className="flex justify-between font-bold"><span className="text-zinc-400">Reconciliation Ratio:</span><span className="text-[#FF3EA5]">{gstResult.reconciliation_percentage ?? 100.0}%</span></div>
                      <hr className="border-zinc-200 dark:border-zinc-800" />
                      <div className="flex justify-between font-bold"><span className="text-zinc-400">IRN Signature:</span><span className="text-zinc-600 dark:text-zinc-300 font-mono">{gstResult.irn_status}</span></div>
                      <div className="flex justify-between font-bold"><span className="text-zinc-400">GSTR-2B Match:</span><span className="text-zinc-600 dark:text-zinc-300 font-mono">{gstResult.gstr2b_status}</span></div>
                    </div>

                    {gstResult.reconciliation?.recommendation && (
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                        <p className="font-bold text-[10px] uppercase tracking-wider text-zinc-450 mb-1">GST Reconciliation Action</p>
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{gstResult.reconciliation.recommendation}</p>
                      </div>
                    )}

                    {gstResult.rcm?.recommendation && gstResult.rcm_applicable && (
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                        <p className="font-bold text-[10px] uppercase tracking-wider text-zinc-450 mb-1">RCM Action Recommendation</p>
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{gstResult.rcm.recommendation}</p>
                      </div>
                    )}

                    {gstResult.errors.length > 0 && (
                      <div className="p-4 bg-rose-50 text-rose-800 border border-rose-200 rounded-2xl space-y-1">
                        <p className="font-bold text-[10px] uppercase tracking-wider text-rose-500">Errors Detected</p>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                          {gstResult.errors.map((e: string, idx: number) => <li key={idx}>{e}</li>)}
                        </ul>
                      </div>
                    )}

                    {gstResult.warnings.length > 0 && (
                      <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl space-y-1">
                        <p className="font-bold text-[10px] uppercase tracking-wider text-amber-600">Compliance Advisories</p>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                          {gstResult.warnings.map((w: string, idx: number) => <li key={idx}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sub-tab 3: PO Matching */}
          {activeSubTab === "po-matching" && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#FF3EA5]">Purchase Order Matching & Tolerances</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Select Invoice</label>
                    <select value={poInvoiceId} onChange={(e) => setPoInvoiceId(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer">
                      <option value="">Select Invoice...</option>
                      {invoices.map(i => <option key={i.id} value={i.id}>{i.invoice_number || `ID: ${i.id}`} (PO: {i.po_number || "None"})</option>)}
                    </select>
                  </div>
                  <div className="flex items-center space-x-2 py-2.5">
                    <input type="checkbox" id="threeway" checked={isThreeWay} onChange={(e) => setIsThreeWay(e.target.checked)} className="rounded text-rose-600 outline-none w-4 h-4 cursor-pointer" />
                    <label htmlFor="threeway" className="text-xs font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer">Enable 3-Way Match</label>
                  </div>
                  <button onClick={handlePoMatching} disabled={loading || !poInvoiceId} className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                    Execute Match
                  </button>
                </div>

                {poResult && (
                  <div className="p-4 bg-[#F8F9FA] dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs space-y-4 font-medium">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Match Status:</span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${
                        poResult.match_status === "MATCHED" ? "bg-emerald-100 text-emerald-800" :
                        poResult.match_status === "PARTIAL_MATCH" ? "bg-amber-100 text-amber-800" :
                        "bg-rose-100 text-rose-800"
                      }`}>{poResult.match_status}</span>
                    </div>

                    <div className="flex justify-between"><span className="text-zinc-400">Match Score:</span><span className="font-black text-zinc-800 dark:text-white">{poResult.match_score}%</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Matching Mode:</span><span className="font-bold">{poResult.is_three_way ? "3-Way (PO + GRN + Invoice)" : "2-Way (PO + Invoice)"}</span></div>

                    {poResult.mismatch_reasons.length > 0 && (
                      <div className="p-3.5 bg-rose-50 text-rose-850 rounded-xl space-y-1">
                        <p className="font-bold text-[9px] uppercase tracking-wider text-rose-500">Mismatch Reasons</p>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-rose-800 leading-relaxed font-mono">
                          {poResult.mismatch_reasons.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                        </ul>
                      </div>
                    )}

                    {poResult.warnings.length > 0 && (
                      <div className="p-3.5 bg-amber-50 text-amber-850 rounded-xl space-y-1">
                        <p className="font-bold text-[9px] uppercase tracking-wider text-amber-600">Matching Warnings</p>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-amber-800 leading-relaxed">
                          {poResult.warnings.map((w: string, idx: number) => <li key={idx}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sub-tab 4: Approval Workflows */}
          {activeSubTab === "approvals" && (
            <div className="space-y-6">
              {/* Configure new rule */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-[#FF3EA5]">Register Workflow Routing Rule</h2>
                <form onSubmit={handleSaveApprovalRule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Department</label>
                    <input type="text" value={appDept} onChange={(e) => setAppDept(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Cost Center</label>
                    <input type="text" value={appCostCenter} onChange={(e) => setAppCostCenter(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Min Payout Limit (INR)</label>
                    <input type="number" value={appMinAmount} onChange={(e) => setAppMinAmount(Number(e.target.value))} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Approver Roles (Comma split)</label>
                    <input type="text" value={appApprovers} onChange={(e) => setAppApprovers(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">SLA Limit (Hours)</label>
                    <input type="number" value={appSlaHours} onChange={(e) => setAppSlaHours(Number(e.target.value))} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" disabled={loading} className="w-full py-3 bg-[#FF3EA5] hover:bg-[#FF5CB8] text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                      Save Routing Rule
                    </button>
                  </div>
                </form>
              </div>

              {/* Approval queues */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-[#FF3EA5]">Submit Approval Decisions</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Select Invoice</label>
                    <select value={appInvoiceId} onChange={(e) => setAppInvoiceId(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer">
                      <option value="">Select Invoice...</option>
                      {invoices.filter(i => i.status === "PENDING_APPROVAL" || i.status === "VALIDATED").map(i => <option key={i.id} value={i.id}>{i.invoice_number || `ID: ${i.id}`} (Status: {i.status})</option>)}
                    </select>
                  </div>
                  <button onClick={handleTriggerSlaCheck} disabled={loading} className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 font-bold text-xs rounded-xl shadow-sm text-zinc-700 dark:text-zinc-200">
                    Scan SLA Breach
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Decision Comments / Rejection Reasons</label>
                  <textarea value={appComments} onChange={(e) => setAppComments(e.target.value)} placeholder="Decision notes..." className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none h-16 resize-none" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => handleApprovalDecision("APPROVE")} disabled={loading || !appInvoiceId} className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                    Approve Level
                  </button>
                  <button onClick={() => handleApprovalDecision("REJECT")} disabled={loading || !appInvoiceId} className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                    Reject Invoice
                  </button>
                  <button onClick={() => handleApprovalDecision("OVERRIDE")} disabled={loading || !appInvoiceId} className="py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                    Admin Override
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 5: Payments Manager */}
          {activeSubTab === "payments" && (
            <div className="space-y-6">
              {/* Payment schedule / schedule Date */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-[#FF3EA5]">Schedule Approved Payouts</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Invoice</label>
                    <select value={payInvoiceId} onChange={(e) => setPayInvoiceId(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer">
                      <option value="">Select Invoice...</option>
                      {invoices.map(i => <option key={i.id} value={i.id}>{i.invoice_number || `ID: ${i.id}`} ({i.seller_name || "Unknown Vendor"})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Scheduled Payout Date</label>
                    <input type="date" value={paySchedDate} onChange={(e) => setPaySchedDate(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                  </div>
                  <button onClick={handleSchedulePayment} disabled={loading || !payInvoiceId || !paySchedDate} className="py-2.5 bg-[#FF3EA5] hover:bg-[#FF5CB8] text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                    Schedule Payout
                  </button>
                </div>
              </div>

              {/* Record payouts transaction */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-[#FF3EA5]">Record Payout Transaction</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Payment Method</label>
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer">
                      <option value="NEFT">NEFT</option>
                      <option value="RTGS">RTGS</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Reference Number / Cheque No.</label>
                    <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Amount Paid (INR)</label>
                    <input type="number" value={payAmtPaid} onChange={(e) => setPayAmtPaid(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={handleRecordPayment} disabled={loading || !payInvoiceId || !payAmtPaid} className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                      Record Payment
                    </button>
                  </div>
                </div>
              </div>

              {/* Apply credit/debit note */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-[#FF3EA5]">Apply Debit/Credit Note Adjustments</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Note Number</label>
                    <input type="text" placeholder="CN-0098" value={noteNum} onChange={(e) => setNoteNum(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Adjustment Type</label>
                    <select value={noteType} onChange={(e) => setNoteType(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer">
                      <option value="CREDIT">CREDIT NOTE</option>
                      <option value="DEBIT">DEBIT NOTE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Adjustment Value</label>
                    <input type="number" value={noteAmt} onChange={(e) => setNoteAmt(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Adjustment Reason</label>
                    <input type="text" value={noteReason} onChange={(e) => setNoteReason(e.target.value)} className="w-full bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-xl px-3 py-2.5 text-xs font-bold outline-none" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={handlePostNote} disabled={loading || !payInvoiceId || !noteNum || !noteAmt} className="w-full py-3 bg-[#FF3EA5] hover:bg-[#FF5CB8] text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                      Post Adjustment Note
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 6: Reports Center */}
          {activeSubTab === "reports" && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#FF3EA5]">Downloadable Reports Center</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: "Invoice Ledger CSV", type: "invoices", desc: "List of all invoices processed through the platform." },
                  { title: "GST Audit Report", type: "gst", desc: "Tax details including CGST, SGST, IGST splits and state verification." },
                  { title: "TDS Ledger Export", type: "tds", desc: "TDS tax calculations u/s 194 and PAN verification logs." },
                  { title: "Payment Schedules", type: "payments", desc: "Outstanding payment schedules, pay dates, and discounts." },
                  { title: "Exception Center logs", type: "exceptions", desc: "Ingestion discrepancy failures and resolution times." },
                  { title: "Audit Trail logs", type: "audit", desc: "Immutable history of status updates and user actions." }
                ].map((rep) => (
                  <div key={rep.type} className="p-4 bg-zinc-50 dark:bg-[#1A1A1A]/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-zinc-800 dark:text-white">{rep.title}</h3>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-normal">{rep.desc}</p>
                    </div>
                    <a
                      href={enterpriseService.getCSVReportUrl(rep.type)}
                      download
                      className="mt-4 inline-block text-center py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-[10px] uppercase rounded-xl hover:opacity-90"
                    >
                      Download CSV
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-tab 7: ERP Integrations Dashboard */}
          {activeSubTab === "integrations" && (
            <div className="space-y-6">
              {/* Connection Status Cards */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4 overflow-hidden">
                <h2 className="text-sm font-black uppercase tracking-widest text-[#FF3EA5]">ERP Integration Status</h2>
                <div className="py-2">
                  <div className="flex gap-6">
                    {[
                      { id: "odoo", name: "Odoo Community", desc: "Syncs vendor bills (account.move) automatically u/s XML-RPC.", brandColor: "border-l-4 border-l-[#714B67]" }
                    ].map((erp, index) => {
                      const isConnected = integrationsStatus[erp.id];
                      return (
                        <div key={`${erp.id}-${index}`} className={`w-[260px] flex-shrink-0 p-4 bg-zinc-50 dark:bg-[#1A1A1A]/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between space-y-3 fw-texture-grain ${erp.brandColor}`}>
                          <div>
                            <div className="flex justify-between items-start">
                              <h3 className="text-xs font-black text-zinc-800 dark:text-white">{erp.name}</h3>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase ${
                                isConnected 
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400" 
                                  : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}>
                                {isConnected ? "Connected" : "Inactive"}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-2 font-normal leading-normal">{erp.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sync history / logs */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-[#FF3EA5]">Sync Logs</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-150 dark:border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-400 font-black">
                        <th className="pb-3 pr-2">Sync Time</th>
                        <th className="pb-3 pr-2">Invoice No</th>
                        <th className="pb-3 pr-2">Vendor</th>
                        <th className="pb-3 pr-2">ERP System</th>
                        <th className="pb-3 pr-2">Amount</th>
                        <th className="pb-3 pr-2">Status</th>
                        <th className="pb-3 pr-2">Reference / Error</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850 text-xs">
                      {syncLogs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-zinc-400 font-bold font-sans">
                            No ERP synchronization events recorded yet.
                          </td>
                        </tr>
                      ) : (
                        syncLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-[#1A1A1A]/40 font-medium">
                            <td className="py-3.5 pr-2 font-mono text-[10px] text-zinc-400">
                              {new Date(log.sync_timestamp).toLocaleString()}
                            </td>
                            <td className="py-3.5 pr-2 font-bold text-zinc-800 dark:text-white">
                              {log.invoice_number}
                            </td>
                            <td className="py-3.5 pr-2 truncate max-w-[120px]" title={log.vendor_name}>
                              {log.vendor_name}
                            </td>
                            <td className="py-3.5 pr-2 font-bold text-[10px] uppercase text-zinc-500">
                              {log.erp_system}
                            </td>
                            <td className="py-3.5 pr-2 font-black">
                              ₹{(log.total_value || 0).toLocaleString()}
                            </td>
                            <td className="py-3.5 pr-2">
                              <span className={`px-2 py-0.5 rounded-xl text-[9px] font-black tracking-wider uppercase ${
                                log.sync_status === "SUCCESS"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400"
                              }`}>
                                {log.sync_status}
                              </span>
                            </td>
                            <td className="py-3.5 max-w-[180px] truncate font-mono text-[10px] pr-2" title={log.external_ref || log.error_message}>
                              {log.sync_status === "SUCCESS" ? (
                                <span className="text-[#FF3EA5] font-black">{log.external_ref}</span>
                              ) : (
                                <span className="text-rose-500">{log.error_message}</span>
                              )}
                            </td>
                            <td className="py-3.5 text-right">
                              {log.sync_status !== "SUCCESS" && (
                                <button
                                  type="button"
                                  onClick={() => handleRetrySync(log.id)}
                                  className="px-2.5 py-1.5 bg-[#FF3EA5] hover:bg-[#db3f88] text-white font-black uppercase text-[9px] tracking-wider rounded-lg shadow-sm transition-all"
                                >
                                  Retry
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right side stats drawer */}
        <div className="space-y-6">
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">AP Suite Overview</h2>
            
            <div className="p-4 bg-[#FAFAFC] dark:bg-[#1A1A1A]/30 rounded-2xl space-y-3 font-semibold text-xs">
              <div className="flex justify-between"><span className="text-zinc-400">Invoices Tracked:</span><span>{invoices.length}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Ready to Approve:</span><span>{invoices.filter(i => i.status === "PENDING_APPROVAL" || i.status === "VALIDATED").length}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Fully Paid:</span><span className="text-emerald-500">{invoices.filter(i => i.status === "PAID").length}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Flagged Exception:</span><span className="text-rose-500">{invoices.filter(i => i.status === "EXCEPTION").length}</span></div>
            </div>

            <div className="p-4 bg-[#FAFAFC] dark:bg-[#1A1A1A]/30 rounded-2xl space-y-2 text-[10px] text-zinc-500 leading-normal font-medium">
              <p>Calculations like TDS limits or GST intra/inter splits are computed instantly when clicking calculations triggers.</p>
              <p>SLA breaches are monitored based on the workflow config routing. Escalate notifications if approvals are delayed.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
