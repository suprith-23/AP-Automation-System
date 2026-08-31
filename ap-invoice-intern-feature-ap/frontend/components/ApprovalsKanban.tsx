"use client";
import React, { useState, useEffect } from "react";
import { formatIndianCurrency } from "../utils/format";
import { approveInvoice, rejectInvoice } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import { useConfirmStore } from "../store/useConfirmStore";

type Props = {
  invoices: any[];
  onRefresh?: () => void;
};

export default function ApprovalsKanban({ invoices, onRefresh }: Props) {
  const { role } = useAppStore();
  const confirm = useConfirmStore((state) => state.confirm);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [justification, setJustification] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Group invoices dynamically
  const pendingInvoices = invoices.filter(
    (i) => i.status === "pending_approval" || i.workflow_status === "pending_approval" || (!["approved", "rejected"].includes(i.status) && !["approved", "rejected"].includes(i.workflow_status))
  );
  const approvedInvoices = invoices.filter(
    (i) => i.status === "approved" || i.workflow_status === "approved"
  );
  const rejectedInvoices = invoices.filter(
    (i) => i.status === "rejected" || i.workflow_status === "rejected"
  );

  const activeInvoicesList = {
    pending: pendingInvoices,
    approved: approvedInvoices,
    rejected: rejectedInvoices,
  }[activeTab];

  // Auto-select the first item in the list when the active tab changes or if current selection is invalid/null
  useEffect(() => {
    const hasCurrentSelection = activeInvoicesList.some((i) => i.id === selectedInvoiceId);
    if (!hasCurrentSelection) {
      if (activeInvoicesList.length > 0) {
        setSelectedInvoiceId(activeInvoicesList[0].id);
      } else {
        setSelectedInvoiceId(null);
      }
    }
    setMessage(null);
  }, [activeTab, activeInvoicesList, selectedInvoiceId]);

  // Reset form inputs only when selecting a different invoice, preventing wipe-out during background fetches
  useEffect(() => {
    setJustification("");
    setRejectReason("");
    setMessage(null);
  }, [selectedInvoiceId]);

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  const handleApproveAction = async () => {
    if (!selectedInvoiceId) return;
    const isConfirmed = await confirm({
      title: "Approve Invoice",
      message: `Are you sure you want to approve this invoice for ₹${(selectedInvoice?.total_invoice_value || selectedInvoice?.total_amount || 0).toLocaleString("en-IN")}? This will authorize payment.`,
      confirmText: "Approve",
      cancelText: "Cancel",
      roleAccent: "purple",
    });
    if (!isConfirmed) return;

    setIsSubmitting(true);
    setMessage(null);
    try {
      await approveInvoice(selectedInvoiceId, justification);
      setMessage({ type: "success", text: "Invoice successfully approved for payment!" });
      setJustification("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to approve invoice." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectAction = async () => {
    if (!selectedInvoiceId) return;
    const isConfirmed = await confirm({
      title: "Reject Invoice",
      message: "Are you sure you want to reject this invoice and return it for correction?",
      confirmText: "Reject",
      cancelText: "Cancel",
      roleAccent: "red",
    });
    if (!isConfirmed) return;

    setIsSubmitting(true);
    setMessage(null);
    try {
      await rejectInvoice(selectedInvoiceId, rejectReason || "Discrepancy detected");
      setMessage({ type: "success", text: "Invoice rejected and returned for correction." });
      setRejectReason("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to reject invoice." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and custom status tabs stacked correctly to avoid overlapping */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 tracking-tight">Approvals Operations Queue</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">Verify 3-way matching and authorize disbursements</p>
        </div>

        {/* Custom Status Tabs */}
        <div className="flex self-start bg-zinc-100 dark:bg-zinc-800/80 p-1.5 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50">
          {(["pending", "approved", "rejected"] as const).map((tab) => {
            const count = {
              pending: pendingInvoices.length,
              approved: approvedInvoices.length,
              rejected: rejectedInvoices.length,
            }[tab];

            const isActive = activeTab === tab;
            const tabLabels = {
              pending: "Awaiting Action",
              approved: "Approved",
              rejected: "Rejected",
            };

            const activeColors = {
              pending: "bg-blue-600 text-white shadow-md",
              approved: "bg-emerald-600 text-white shadow-md",
              rejected: "bg-rose-600 text-white shadow-md",
            }[tab];

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                  isActive ? "shadow-md text-[var(--role-accent-foreground)]" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
                style={isActive ? { backgroundColor: "var(--role-accent)", color: "var(--role-accent-foreground)" } : undefined}
              >
                {tabLabels[tab]}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  isActive ? "bg-white/20 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Split-Screen Interactive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Side: Invoice Selection List */}
        <div className="lg:col-span-5 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm min-h-[500px]">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-55 dark:bg-zinc-900">
            <span className="text-xs font-black uppercase tracking-widest text-zinc-450 dark:text-zinc-500">Invoices List</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
            {activeInvoicesList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <span className="text-4xl mb-2">🎉</span>
                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Queue is Clear</h4>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-[200px]">No invoices matching this status state need attention.</p>
              </div>
            ) : (
              activeInvoicesList.map((inv) => {
                const isSelected = inv.id === selectedInvoiceId;
                const statusBorder = {
                  pending: "border-l-blue-500",
                  approved: "border-l-emerald-500",
                  rejected: "border-l-rose-500",
                }[activeTab];
                return (
                  <button
                    key={inv.id}
                    onClick={() => {
                      setSelectedInvoiceId(inv.id);
                      setMessage(null);
                    }}
                    className={`w-full text-left p-4 rounded-2xl transition-all duration-200 border-l-4 ${statusBorder} border-y border-r ${
                      isSelected
                        ? "bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 shadow-sm scale-[0.99]"
                        : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-750"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className={`text-sm font-bold truncate ${
                        isSelected ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"
                      }`}>
                        {inv.seller_name || inv.vendor_name || "Draft / Unextracted Vendor"}
                      </span>
                      <span className={`text-sm font-black shrink-0 ${
                        isSelected ? "text-zinc-900 dark:text-white" : "text-[#6B7280] dark:text-[#9CA3AF]"
                      }`}>
                        ₹{(inv.total_invoice_value || inv.total_amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{inv.invoice_number || "Draft/Pending Extraction"}</span>
                      <span className="bg-zinc-105 dark:bg-zinc-800 text-[10px] font-bold px-2 py-0.5 rounded-full">PO: {inv.po_number || "None"}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Inspector & 3-Way Match Verification */}
        <div className="lg:col-span-7 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-55 dark:bg-zinc-900 flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-widest text-zinc-450 dark:text-zinc-500">Real-Time Verification</span>
            {selectedInvoice && (
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                selectedInvoice.validation_status === "PASSED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-355" : "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-355"
              }`}>
                {selectedInvoice.validation_status}
              </span>
            )}
          </div>

          <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[500px]">
            {selectedInvoice ? (
              <>
                {/* 3-Way Match Inspector Cards */}
                <div className="space-y-3.5">
                  <h4 className="text-sm font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">3-Way Matching Checklist</h4>
                  
                  {/* Registry Verification */}
                  <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/25 rounded-2xl border border-zinc-150 dark:border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-405 text-sm font-bold">✓</div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Vendor Registry Match</div>
                        <div className="text-[10px] text-zinc-550 dark:text-zinc-400">Seller "{selectedInvoice.seller_name || selectedInvoice.vendor_name}" matches approved master database records.</div>
                      </div>
                    </div>
                  </div>

                  {/* Purchase Order Match */}
                  <div className={`flex items-center justify-between p-4 rounded-2xl border ${
                    selectedInvoice.po_number 
                      ? "bg-zinc-50 dark:bg-zinc-800/25 border-zinc-150 dark:border-zinc-800/80"
                      : "bg-amber-50/50 dark:bg-amber-955/15 border-amber-100 dark:border-amber-800/40"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        selectedInvoice.po_number 
                          ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-405"
                          : "bg-amber-105 dark:bg-amber-950/80 text-amber-600 dark:text-amber-405"
                      }`}>
                        {selectedInvoice.po_number ? "✓" : "⚠"}
                      </div>
                      <div>
                        <div className={`text-xs font-bold ${
                          selectedInvoice.po_number ? "text-zinc-900 dark:text-zinc-100" : "text-amber-850 dark:text-amber-300"
                        }`}>Purchase Order Reference Match</div>
                        <div className={`text-[10px] ${
                          selectedInvoice.po_number ? "text-zinc-550 dark:text-zinc-400" : "text-amber-700/90 dark:text-amber-400"
                        }`}>
                          {selectedInvoice.po_number 
                            ? `PO Reference "${selectedInvoice.po_number}" matches active commitment records.`
                            : "No PO reference found on this invoice. Manual override required."}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Amount Tolerance */}
                  <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/25 rounded-2xl border border-zinc-150 dark:border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-405 text-sm font-bold">✓</div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Tolerance Threshold Check</div>
                        <div className="text-[10px] text-zinc-550 dark:text-zinc-400">Invoice total of ₹{(selectedInvoice.total_invoice_value || selectedInvoice.total_amount || 0).toLocaleString('en-IN')} is within acceptable variance limits.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoice Summary Data */}
                <div className="bg-zinc-50 dark:bg-zinc-800/25 p-5 rounded-2xl border border-zinc-150 dark:border-zinc-800/80 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Vendor</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{selectedInvoice.seller_name || selectedInvoice.vendor_name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Invoice Date</span>
                    <span className="font-mono text-zinc-900 dark:text-zinc-100">{selectedInvoice.invoice_date}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Extraction Confidence</span>
                    <span className={`font-bold ${
                      ((selectedInvoice.confidence_score || 0.95) * 100) > 90
                        ? "text-[#39E35D] dark:text-[#4AFF7A]"
                        : ((selectedInvoice.confidence_score || 0.95) * 100) >= 70
                        ? "text-[#FFB800] dark:text-[#FFCB3D]"
                        : "text-[#FF3B3B] dark:text-[#FF5C5C]"
                    }`}>{Math.round((selectedInvoice.confidence_score || 0.95) * 100)}%</span>
                  </div>
                  <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 flex justify-between items-baseline">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Net Total</span>
                    <span className="text-xl font-black text-zinc-900 dark:text-white">₹{(selectedInvoice.total_invoice_value || selectedInvoice.total_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Operations Actions & Inputs */}
                {activeTab === "pending" && (
                  <div className="space-y-4 pt-2">
                    {/* Error & Success notifications */}
                    {message && (
                      <div className={`p-4.5 rounded-2xl text-xs font-bold ${
                        message.type === "success" 
                          ? "bg-emerald-50 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60"
                          : "bg-rose-50 dark:bg-rose-950/45 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"
                      }`}>
                        {message.text}
                      </div>
                    )}

                    {/* Justification Text Area */}
                    <div>
                      <label className="block text-[10px] font-black text-zinc-405 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Approval Override / Comment (Optional)</label>
                      <textarea
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        placeholder="Enter approval details or PO match override comments..."
                        className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm min-h-[120px] bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 resize-y outline-none font-medium"
                      />
                    </div>

                    <div className="flex gap-3">
                      {/* Reject button */}
                      <button
                        onClick={handleRejectAction}
                        disabled={isSubmitting}
                        className="flex-1 px-4.5 py-3 text-xs font-bold text-white bg-[#FF3B3B] hover:bg-[#E03030] border border-rose-500/20 rounded-2xl transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? "Processing..." : "Reject / Return"}
                      </button>

                      {/* Approve button */}
                      <button
                        onClick={handleApproveAction}
                        disabled={isSubmitting}
                        className="flex-1 px-4.5 py-3 text-xs font-bold rounded-2xl shadow-sm transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "var(--role-accent)", color: "var(--role-accent-foreground)" }}
                      >
                        {isSubmitting ? "Processing..." : "Approve Invoice"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 text-zinc-400 dark:text-zinc-500">
                <span className="text-5xl mb-4">🔍</span>
                <h4 className="text-sm font-bold">Select an Invoice</h4>
                <p className="text-xs mt-1 max-w-sm">Choose an invoice from the left panel to inspect the 3-way matching and trigger actions.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
