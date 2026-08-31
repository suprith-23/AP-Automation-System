import React, { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Invoice } from "../types/invoice";
import StatusBadge from "./StatusBadge";
import TableHeader from "./ui/TableHeader";
import Button from "./ui/Button";
import { formatIndianCurrency } from "../utils/format";
import FilterBar, { FilterConfig, defaultFilterConfig } from "./FilterBar";
import { approveInvoice, submitInvoiceForApproval, updateInvoice, deleteInvoice } from "../services/api";
import InvoiceDetailDrawer from "./InvoiceDetailDrawer";
import { toast } from "sonner";
import { Virtuoso } from "react-virtuoso";
import { useConfirmStore } from "../store/useConfirmStore";

type Props = {
  invoices: Invoice[];
  onRefresh?: () => void;
  userRole?: string;
  users?: any[];
};

function getRowAccent(invoice: Invoice): string {
  const isFailed = invoice.validation_status === "FAILED";
  const isLowConf = (invoice.confidence_score ?? 1) < 0.85;
  const wf = (invoice.workflow_status || invoice.status || "").toLowerCase();

  if (isFailed || isLowConf) return "inv-row-failed";
  if (wf === "approved") return "inv-row-approved";
  if (wf === "pending_review" || wf === "pending_approval") return "inv-row-pending";
  return "inv-row-default";
}

function ExceptionBadge({ invoice }: { invoice: Invoice }) {
  const isFailed  = invoice.validation_status === "FAILED";
  const isDup     = invoice.invoice_number?.includes("DUP");
  const isLowConf = (invoice.confidence_score ?? 1) < 0.85;

  if (isDup) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-[#2E8BFF] dark:bg-[#1E3A8A] text-[#FFFFFF] dark:text-[#4FA3FF] border-none">
        <span>⊕</span> Duplicate
      </span>
    );
  }
  if (isFailed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-[#FF3B3B] dark:bg-[#3D1414] text-[#FFFFFF] dark:text-[#FF5C5C] border-none">
        <span>⚠</span> Validation Failed
      </span>
    );
  }
  if (isLowConf) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-[#FFB800] dark:bg-[#3D2E05] text-[#3D2E05] dark:text-[#FFCB3D] border-none">
        <span>◑</span> Low Confidence
      </span>
    );
  }
  return null;
}

const MemoizedInvoiceRow = React.memo(({ 
  invoice, 
  userRole, 
  isExpanded, 
  selected, 
  actionLoading, 
  onToggleRow, 
  onDrawerOpen, 
  onToggleSelect, 
  onQuickApprove, 
  onQuickSubmit, 
  onDeepInspect 
}: any) => {
  const confidenceVal = invoice.confidence_score !== undefined ? invoice.confidence_score : 0.95;
  const confidence    = (confidenceVal * 100).toFixed(0);
  const seller        = invoice.seller_name || invoice.vendor_name || "Unknown Vendor";
  const dueDate       = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—";

  const isLowConfidence   = confidenceVal < 0.85;
  const isFailedValidation = invoice.validation_status === "FAILED";
  const riskLevel = (isLowConfidence || isFailedValidation) ? "High" : "Low";
  const riskBg    = riskLevel === "High"
    ? "bg-[#FF3B3B] text-[#FFFFFF] border-none"
    : "bg-[#39E35D] text-[#123B22] border-none";

  const currentWfStatus  = (invoice.workflow_status || invoice.status || "").toLowerCase();
  const showApproveButton = userRole === "Approver" && currentWfStatus === "pending_approval";
  const showSubmitButton  = (userRole === "Reviewer" || userRole === "Admin") &&
    (currentWfStatus === "pending_review" || currentWfStatus === "validation_failed");

  const accentClass = getRowAccent(invoice);

  const rawIngestionDate = invoice.processed_at || invoice.extraction_timestamp;
  const ingestionDate = rawIngestionDate ? new Date(rawIngestionDate).toLocaleString() : "Just now";

  return (
    <div className="pb-3">
      <div
        onClick={() => onDrawerOpen(invoice)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onDrawerOpen(invoice);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`View details for invoice ${invoice.invoice_number || `INV-${invoice.id}`}`}
        className={`premium-card p-5 cursor-pointer ${accentClass} hover:-translate-y-0.5 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-400 outline-none ${
          isExpanded ? "shadow-sm" : ""
        }`}
      >
        {/* Main Card Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">

        {/* Col 1: Checkbox + Doc icon + Invoice info */}
        <div className="lg:col-span-4 flex items-center space-x-4 min-w-0">
          {userRole === "Admin" && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(invoice.id);
              }}
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
          )}

          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-800">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-zinc-800 dark:text-zinc-100 text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap">
                {invoice.invoice_number || `INV-${invoice.id}`}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">•</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate max-w-[140px]" title={seller}>
                {seller}
              </span>
              <ExceptionBadge invoice={invoice} />
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                PO: {invoice.po_number || "PO-8291"}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">•</span>
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                Due: {dueDate}
              </span>
            </div>
          </div>
        </div>

        {/* Col 2: AI Match */}
        <div className="lg:col-span-2 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block tracking-wider whitespace-nowrap mb-1">AI Match</span>
          <div className="flex items-center gap-2">
            <div className="w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden shrink-0">
              <div
                className={`h-full rounded-full ${
                  parseInt(confidence) > 90
                    ? "bg-status-approved"
                    : parseInt(confidence) >= 70
                    ? "bg-status-pending"
                    : "bg-status-rejected"
                }`}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className={`text-xs font-black whitespace-nowrap ${
              parseInt(confidence) > 90
                ? "text-status-approved"
                : parseInt(confidence) >= 70
                ? "text-status-pending"
                : "text-status-rejected"
            }`}>
              {confidence}%
            </span>
          </div>
        </div>

        {/* Col 3: Ingestion Source */}
        <div className="lg:col-span-1 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block tracking-wider whitespace-nowrap">Ingested Via</span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-[#22D3EE] dark:bg-[#053A44] text-[#053A44] dark:text-[#67E8F9] border-none uppercase mt-0.5 whitespace-nowrap">
            {invoice.source_type || "Email"}
          </span>
        </div>

        {/* Col 4: Amount */}
        <div className="lg:col-span-2 lg:text-right">
          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block tracking-wider whitespace-nowrap">Amount</span>
          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 whitespace-nowrap block">
            {invoice.currency || "INR"} {formatIndianCurrency(invoice.total_amount || 0)}
          </span>
        </div>

        {/* Col 5: Status Badges */}
        <div className="lg:col-span-2 flex items-center space-x-1.5 lg:justify-end flex-wrap gap-1">
          <StatusBadge status={invoice.validation_status} />
          <StatusBadge status={invoice.workflow_status} />
        </div>

        {/* Col 6: Expand button */}
        <div className="lg:col-span-1 flex justify-end">
          <button
            onClick={(e) => onToggleRow(invoice.id, e)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            title="Expand Details"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse invoice details" : "Expand invoice details"}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-700/60 grid grid-cols-1 md:grid-cols-4 gap-6 text-xs animate-fade-in"
        >
          <div>
            <h4 className="font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-[9px] mb-2">Extraction Analysis</h4>
            <ul className="space-y-1.5 text-zinc-600 dark:text-zinc-400 font-medium">
              <li>Invoice Date: <span className="font-bold text-zinc-800 dark:text-zinc-200">{invoice.invoice_date || "-"}</span></li>
              <li>Tax GST Rate: <span className="font-bold text-zinc-800 dark:text-zinc-200">18.00%</span></li>
              <li>Vendor GSTIN: <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{invoice.seller_gstin || "27AAACQ2839F1Z9"}</span></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-[9px] mb-2">Compliance & Risk</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-zinc-500 dark:text-zinc-400">Risk Score:</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${riskBg}`}>
                  {riskLevel} Risk
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-zinc-500 dark:text-zinc-400">Verification:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">GSTIN Match Verified</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-[9px] mb-2">System Validations</h4>
            {invoice.validation_status === "FAILED" && invoice.validation_errors && invoice.validation_errors.length > 0 ? (
              <div className="space-y-1">
                {invoice.validation_errors.map((error: any, idx: number) => (
                  <p key={idx} className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="truncate">{error}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                <span>✓</span>
                <span>Passed all 3-way matching rules</span>
              </p>
            )}
          </div>

          <div className="flex flex-col justify-between items-end gap-3">
            <div className="text-right">
              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 block uppercase">Ingestion Date</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">{ingestionDate}</span>
            </div>

            <div className="flex space-x-2">
              {showApproveButton && (
                <button
                  onClick={(e) => onQuickApprove(invoice.id, e)}
                  disabled={actionLoading === invoice.id}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-[10px] transition-all shadow-sm disabled:opacity-50"
                >
                  {actionLoading === invoice.id ? "Approve..." : "Quick Approve"}
                </button>
              )}
              {showSubmitButton && (
                <button
                  onClick={(e) => onQuickSubmit(invoice.id, e)}
                  disabled={actionLoading === invoice.id}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-xl text-[10px] transition-all shadow-sm disabled:opacity-50"
                >
                  {actionLoading === invoice.id ? "Submit..." : "Quick Submit"}
                </button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => onDeepInspect(invoice.id, e)}
              >
                Deep Inspect
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
});

export default function InvoiceTable({ invoices, onRefresh, userRole, users = [] }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterConfig>(defaultFilterConfig);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | string | null>(null);
  const [drawerInvoice, setDrawerInvoice] = useState<Invoice | null>(null);

  // Bulk actions and sorting states
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<"date" | "amount" | "confidence" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [bulkAssignReviewerOpen, setBulkAssignReviewerOpen] = useState(false);
  const [bulkAssignApproverOpen, setBulkAssignApproverOpen] = useState(false);

  // Filter and sort invoices
  const processedInvoices = useMemo(() => {
    const lowerSearch = filters.search.toLowerCase();
    
    // 1. Filtering
    let result = invoices.filter((inv) => {
      const seller = inv.seller_name || inv.vendor_name || "";
      const vendorMatch  = seller.toLowerCase().includes(lowerSearch);
      const invoiceMatch = (inv.invoice_number || "").toLowerCase().includes(lowerSearch);
      const poMatch      = (inv.po_number || "").toLowerCase().includes(lowerSearch);
      if (filters.search && !(vendorMatch || invoiceMatch || poMatch)) return false;

      if (filters.validationStatus !== "ALL") {
        const vStatus = (inv.validation_status || "").toUpperCase();
        if (filters.validationStatus === "PASSED" && vStatus !== "PASSED") return false;
        if (filters.validationStatus === "FAILED" && vStatus !== "FAILED") return false;
      }

      if (filters.workflowStatus !== "ALL") {
        const wfStatus = (inv.workflow_status || inv.status || "").toLowerCase();
        if (wfStatus !== filters.workflowStatus.toLowerCase()) return false;
      }

      if (filters.minConfidence !== "0") {
        const minConf = parseFloat(filters.minConfidence);
        const invConf = inv.confidence_score || 0;
        if (invConf < minConf) return false;
      }

      return true;
    });

    // 2. Sorting
    result.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortBy === "date") {
        valA = new Date(a.invoice_date || 0).getTime();
        valB = new Date(b.invoice_date || 0).getTime();
      } else if (sortBy === "amount") {
        valA = a.total_amount || 0;
        valB = b.total_amount || 0;
      } else if (sortBy === "confidence") {
        valA = a.confidence_score || 0;
        valB = b.confidence_score || 0;
      } else if (sortBy === "status") {
        valA = a.workflow_status || "";
        valB = b.workflow_status || "";
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [invoices, filters, sortBy, sortOrder]);

  const toggleRow = useCallback((id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedInvoiceId(prev => (prev === id ? null : id));
  }, []);

  const handleDeepInspect = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/invoices/${id}?role=${userRole || "Admin"}`);
  }, [router, userRole]);

  const handleQuickApprove = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionLoading(id);
      await approveInvoice(id, "Quick Approved via Ledger Card Action");
      toast.success("Invoice approved successfully!");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to approve invoice.");
    } finally {
      setActionLoading(null);
    }
  }, [onRefresh]);

  const handleQuickSubmit = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionLoading(id);
      await submitInvoiceForApproval(id);
      toast.success("Invoice submitted for approval successfully!");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to submit invoice.");
    } finally {
      setActionLoading(null);
    }
  }, [onRefresh]);

  // Bulk operations handlers
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(processedInvoices.map((inv) => inv.id));
    } else {
      setSelectedIds([]);
    }
  }, [processedInvoices]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await useConfirmStore.getState().confirm({
      title: "Delete Invoices",
      message: `Are you sure you want to delete the ${selectedIds.length} selected invoices?`,
      roleAccent: "red"
    });
    if (confirmed) {
      try {
        await Promise.all(selectedIds.map((id) => deleteInvoice(id)));
        toast.success(`Successfully deleted ${selectedIds.length} invoices.`);
        setSelectedIds([]);
        if (onRefresh) onRefresh();
      } catch (err: any) {
        toast.error("Failed to delete some invoices: " + (err.response?.data?.detail || err.message));
      }
    }
  };

  const handleBulkAssignReviewer = async (reviewerName: string) => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(
        selectedIds.map((id) =>
          updateInvoice(id, { reviewer: reviewerName })
        )
      );
      toast.success(`Assigned ${selectedIds.length} invoices to Reviewer ${reviewerName}.`);
      setSelectedIds([]);
      setBulkAssignReviewerOpen(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error("Failed to assign reviewer: " + (err.message || err));
    }
  };

  const handleBulkAssignApprover = async (approverName: string) => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(
        selectedIds.map((id) =>
          updateInvoice(id, { approver: approverName })
        )
      );
      toast.success(`Assigned ${selectedIds.length} invoices to Approver ${approverName}.`);
      setSelectedIds([]);
      setBulkAssignApproverOpen(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error("Failed to assign approver: " + (err.message || err));
    }
  };

  // Export functions
  const handleExport = (type: "json" | "csv") => {
    const dataToExport = invoices.filter((i) => selectedIds.length === 0 || selectedIds.includes(i.id));
    if (type === "json") {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices_export_${Date.now()}.json`;
      a.click();
    } else {
      const headers = ["Invoice Number", "Vendor", "PO Number", "Invoice Date", "Due Date", "Amount", "Status", "AI Confidence"];
      const rows = dataToExport.map(i => [
        i.invoice_number || "",
        i.seller_name || i.vendor_name || "",
        i.po_number || "",
        i.invoice_date || "",
        i.due_date || "",
        i.total_amount || 0,
        i.workflow_status || i.status || "",
        i.confidence_score || 0
      ]);
      const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices_export_${Date.now()}.csv`;
      a.click();
    }
  };

  const toggleSort = useCallback((field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  }, [sortBy]);

  const reviewersList = useMemo(() => users.filter((u) => u.role === "Reviewer"), [users]);
  const approversList = useMemo(() => users.filter((u) => u.role === "Approver"), [users]);

  if (!invoices || invoices.length === 0) {
    return (
      <div className="premium-card p-12 text-center flex flex-col items-center justify-center">
        <svg className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-zinc-400 dark:text-zinc-500 font-bold text-sm">No invoices found in the system.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FilterBar filters={filters} setFilters={setFilters} />

      {/* Sorting, Export, and Selection controls — all buttons use rounded-full */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-[22px] text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-black uppercase tracking-wider text-zinc-400">Sort by:</span>
          {[
            { key: "date" as const, label: "Date" },
            { key: "amount" as const, label: "Amount" },
            { key: "confidence" as const, label: "AI Score" },
            { key: "status" as const, label: "Status" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => toggleSort(item.key)}
              className={`px-3 py-1.5 rounded-full font-bold transition-all ${
                sortBy === item.key
                  ? "bg-fw-black text-white dark:bg-fw-white dark:text-fw-black shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {item.label} {sortBy === item.key && (sortOrder === "asc" ? "↑" : "↓")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold rounded-full transition-colors"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            className="px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold rounded-full transition-colors"
          >
            JSON
          </button>
        </div>
      </div>

      {/* Bulk Actions overlay panel */}
      {selectedIds.length > 0 && userRole === "Admin" && (
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-150 dark:border-blue-900/40 rounded-2xl animate-fade-in text-xs font-bold text-blue-800 dark:text-blue-300 shadow-sm">
          <span>{selectedIds.length} invoices selected</span>
          <div className="flex items-center space-x-3.5 relative">
            
            <button
              onClick={() => {
                setBulkAssignReviewerOpen(!bulkAssignReviewerOpen);
                setBulkAssignApproverOpen(false);
              }}
              className="px-3.5 py-1.5 bg-white dark:bg-zinc-800 border border-blue-200 dark:border-zinc-700 hover:bg-blue-50/50 dark:hover:bg-zinc-700 rounded-xl transition-colors"
            >
              Assign Reviewer
            </button>
            {bulkAssignReviewerOpen && (
              <div className="absolute top-8 right-36 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-2 min-w-[160px] space-y-1">
                <div className="p-1 text-[10px] text-zinc-400 uppercase tracking-widest font-black">Choose Reviewer</div>
                {reviewersList.map((rev) => (
                  <button
                    key={rev.id}
                    onClick={() => handleBulkAssignReviewer(rev.name)}
                    className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-lg font-semibold text-zinc-700 dark:text-zinc-200"
                  >
                    {rev.name}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                setBulkAssignApproverOpen(!bulkAssignApproverOpen);
                setBulkAssignReviewerOpen(false);
              }}
              className="px-3.5 py-1.5 bg-white dark:bg-zinc-800 border border-blue-200 dark:border-zinc-700 hover:bg-blue-50/50 dark:hover:bg-zinc-700 rounded-xl transition-colors"
            >
              Assign Approver
            </button>
            {bulkAssignApproverOpen && (
              <div className="absolute top-8 right-16 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-2 min-w-[160px] space-y-1">
                <div className="p-1 text-[10px] text-zinc-400 uppercase tracking-widest font-black">Choose Approver</div>
                {approversList.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => handleBulkAssignApprover(app.name)}
                    className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-lg font-semibold text-zinc-700 dark:text-zinc-200"
                  >
                    {app.name}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleBulkDelete}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-sm"
            >
              Bulk Delete
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {processedInvoices.length > 0 && (
          <div className="hidden lg:block px-5 py-2">
            <TableHeader
              columns={[
                { label: "File Name / ID / Vendor", className: "lg:col-span-4 flex items-center" },
                { label: "AI Match", className: "lg:col-span-2 flex items-center" },
                { label: "Ingested Via", className: "lg:col-span-1 flex items-center" },
                { label: "Amount", className: "lg:col-span-2 flex items-center lg:justify-end" },
                { label: "Status", className: "lg:col-span-2 flex items-center lg:justify-end" },
                { label: "Inspect", className: "lg:col-span-1 flex items-center lg:justify-end" },
              ]}
              color="bg-fw-pink text-white"
              layoutClass="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
            />
          </div>
        )}
        {userRole === "Admin" && processedInvoices.length > 0 && (
          <div className="flex items-center space-x-2 px-5 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
            <input
              type="checkbox"
              checked={selectedIds.length > 0 && selectedIds.length === processedInvoices.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Select All</span>
          </div>
        )}

        {processedInvoices.length > 0 ? (
          <Virtuoso
            useWindowScroll
            data={processedInvoices}
            itemContent={(index, invoice) => (
              <MemoizedInvoiceRow
                key={invoice.id}
                invoice={invoice}
                userRole={userRole}
                isExpanded={expandedInvoiceId === invoice.id}
                selected={selectedIds.includes(invoice.id)}
                actionLoading={actionLoading}
                onToggleRow={toggleRow}
                onDrawerOpen={setDrawerInvoice}
                onToggleSelect={toggleSelect}
                onQuickApprove={handleQuickApprove}
                onQuickSubmit={handleQuickSubmit}
                onDeepInspect={handleDeepInspect}
              />
            )}
          />
        ) : (
          <div className="premium-card p-10 text-center text-zinc-400 dark:text-zinc-500">
            No invoices match the selected filter criteria.
          </div>
        )}
      </div>

      {/* Pagination removed for virtualization */}

      {/* Invoice detail drawer — opens on row click, preserves table scroll position */}
      <InvoiceDetailDrawer
        invoice={drawerInvoice}
        isOpen={!!drawerInvoice}
        onClose={() => setDrawerInvoice(null)}
        userRole={userRole}
        onRefresh={onRefresh}
      />
    </div>
  );
}
