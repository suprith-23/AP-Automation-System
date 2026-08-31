"use client";
import React from "react";
import Drawer from "./ui/Drawer";
import Button from "./ui/Button";
import StatusPill from "./ui/StatusPill";
import ProgressBar from "./ui/ProgressBar";
import InvoiceEditModal from "./InvoiceEditModal";
import { Invoice } from "../types/invoice";
import { formatIndianCurrency } from "../utils/format";
import { approveInvoice, submitInvoiceForApproval, rejectInvoice, downloadDocument } from "../services/api";
import { toast } from "sonner";
import { useConfirmStore } from "../store/useConfirmStore";

type Props = {
  invoice:    Invoice | null;
  isOpen:     boolean;
  onClose:    () => void;
  userRole?:  string;
  onRefresh?: () => void;
};

function FieldRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-zinc-50 dark:border-zinc-800/80 last:border-0">
      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 shrink-0 pt-0.5">
        {label}
      </span>
      <span className={`text-sm font-semibold text-zinc-800 dark:text-zinc-100 text-right ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">
        {title}
      </h4>
      <div className="rounded-[18px] bg-zinc-50 dark:bg-zinc-800/40 px-4 divide-y-0">
        {children}
      </div>
    </div>
  );
}

function AuditRow({ action, by, at, statusAfter }: { action: string; by: string; at: string; statusAfter?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 mt-2 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 capitalize">
          {action.replace(/_/g, " ")}
        </div>
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
          {by} · {at}
        </div>
      </div>
      {statusAfter && <StatusPill status={statusAfter} className="text-[10px]" />}
    </div>
  );
}

import { enterpriseService } from "../services/api";

export default function InvoiceDetailDrawer({ invoice, isOpen, onClose, userRole, onRefresh }: Props) {
  const confirm = useConfirmStore((state) => state.confirm);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [isRejectMode, setIsRejectMode] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [currentInvoice, setCurrentInvoice] = React.useState<Invoice | null>(invoice);

  // Compliance states
  const [gstReport, setGstReport] = React.useState<any>(null);
  const [tdsReport, setTdsReport] = React.useState<any>(null);
  const [complianceLoading, setComplianceLoading] = React.useState(false);

  // Document preview zoom state
  const [zoom, setZoom] = React.useState(1.0);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  // Keep currentInvoice in sync with prop and fetch compliance
  React.useEffect(() => {
    setCurrentInvoice(invoice);
    setZoom(1.0);
    setPreviewOpen(false);

    if (invoice?.id) {
      setComplianceLoading(true);
      Promise.all([
        enterpriseService.verifyGst({ invoice_id: invoice.id }),
        enterpriseService.calculateTds({ 
          invoice_id: invoice.id,
          section_code: (invoice as any).extracted_json?.applicable_section || "194C"
        })
      ]).then(([gst, tds]) => {
        setGstReport(gst);
        setTdsReport(tds);
      }).catch(err => {
        console.error("Compliance fetch failed", err);
      }).finally(() => {
        setComplianceLoading(false);
      });
    } else {
      setGstReport(null);
      setTdsReport(null);
    }
  }, [invoice]);

  if (!currentInvoice) return null;

  const inv = currentInvoice;
  const conf = inv.confidence_score != null ? Math.round(inv.confidence_score * 100) : null;
  const wfStatus = inv.workflow_status || inv.status || "unknown";
  const isSuperAdmin = userRole === "Super Admin";
  const canApprove = (userRole === "Approver" || userRole === "Admin") && !isSuperAdmin;
  const canReview  = (userRole === "Reviewer" || userRole === "Admin") && !isSuperAdmin;
  const canEdit    = canReview; // Edit restricted to Admin + Reviewer only

  async function handleApprove() {
    if (!inv) return;
    
    let justification = "";
    const needsJustification = inv.match_status !== "matched" || inv.validation_status === "FAILED";
    
    if (needsJustification) {
      const reason = window.prompt(
        "A detailed justification (minimum 10 characters) is required to approve this unmatched or validation-failed invoice:"
      );
      if (reason === null) return; // User cancelled
      if (reason.trim().length < 10) {
        toast.error("Justification must be at least 10 characters long.");
        return;
      }
      justification = reason.trim();
    }

    const isConfirmed = await confirm({
      title: "Approve Invoice",
      message: `Are you sure you want to approve this invoice for ₹${formatIndianCurrency(inv.total_amount || 0)}? This will authorize payment.`,
      confirmText: "Approve",
      cancelText: "Cancel",
      roleAccent: "purple",
    });
    if (!isConfirmed) return;

    setLoading("approve");
    try {
      await approveInvoice(inv.id as number, justification);
      toast.success("Invoice approved — moved to Payment Queue.");
      onRefresh?.();
      onClose();
    } catch (err: any) {
      toast.error("Failed to approve invoice: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(null);
    }
  }

  async function handleSubmit() {
    if (!inv) return;
    setLoading("submit");
    try {
      await submitInvoiceForApproval(inv.id as number);
      toast.success("Invoice forwarded to Approver.");
      onRefresh?.();
      onClose();
    } finally {
      setLoading(null);
    }
  }

  const handleReject = async () => {
    if (!inv?.id) return;
    if (!rejectionReason.trim()) {
      toast.error("A rejection reason is required.");
      return;
    }
    const isConfirmed = await confirm({
      title: "Reject Invoice",
      message: "Are you sure you want to reject this invoice and return it for correction?",
      confirmText: "Reject",
      cancelText: "Cancel",
      roleAccent: "red",
    });
    if (!isConfirmed) return;

    setLoading("reject");
    try {
      await rejectInvoice(inv.id as number, rejectionReason);
      toast.success("Invoice rejected successfully.");
      setIsRejectMode(false);
      onRefresh?.();
      onClose();
    } catch (err: any) {
      toast.error("Failed to reject invoice: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(null);
    }
  };

  const handleDownload = () => {
    if (!inv?.document_id) {
      toast.error("No document associated with this invoice.");
      return;
    }
    downloadDocument(inv.document_id);
  };

  const handleZoomIn  = () => setZoom((z) => Math.min(z + 0.25, 3.0));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));

  const footer = (
    <div className="flex flex-wrap gap-2 justify-end">
      <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>

      {/* Edit Invoice */}
      {canEdit && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setEditOpen(true)}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          }
        >
          Edit Invoice
        </Button>
      )}

      {/* Forward to Approver */}
      {canReview && wfStatus === "pending_review" && (
        <Button
          variant="secondary"
          size="sm"
          loading={loading === "submit"}
          onClick={handleSubmit}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          Forward to Approver
        </Button>
      )}

      {/* Reject / Approve */}
      {canApprove && wfStatus === "pending_approval" && (
        <>
          {isRejectMode ? (
            <div className="flex flex-col gap-2 w-full">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection (required)..."
                rows={2}
                className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setIsRejectMode(false)}>Cancel</Button>
                <Button variant="danger" size="sm" loading={loading === "reject"} onClick={handleReject}>
                  Confirm Reject
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="danger" size="sm" onClick={() => setIsRejectMode(true)}>
                Reject
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={loading === "approve"}
                onClick={handleApprove}
              >
                Approve
              </Button>
            </>
          )}
        </>
      )}

      {/* Download */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        icon={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        }
      >
        Download
      </Button>
    </div>
  );

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={inv.invoice_number || `Invoice #${inv.id}`}
        subtitle={inv.seller_name || inv.vendor_name || "Unknown Vendor"}
        status={wfStatus}
        footer={footer}
      >
        {/* ─ Confidence Score ─ */}
        {conf !== null && (
          <div>
            <ProgressBar value={conf} label="AI Confidence Score" showValue />
          </div>
        )}

        {/* ─ Invoice Details ─ */}
        <Section title="Invoice Details">
          <FieldRow label="Invoice No."    value={inv.invoice_number || `#${inv.id}`} mono />
          <FieldRow label="Invoice Date"   value={inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString("en-IN") : null} />
          <FieldRow label="Due Date"       value={inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-IN") : null} />
          <FieldRow label="Vendor"         value={inv.seller_name || inv.vendor_name} />
          <FieldRow label="Vendor GSTIN"   value={(inv as any).seller_gstin || (inv as any).vendor_gstin} mono />
          <FieldRow label="PO Number"      value={inv.po_number} mono />
          <FieldRow label="Currency"       value={(inv as any).currency || "INR"} />
          <FieldRow label="Payment Terms"  value={(inv as any).payment_terms} />
        </Section>

        {/* ─ Financial Summary ─ */}
        <Section title="Financial Summary">
          <FieldRow label="Subtotal"      value={inv.total_amount != null ? `₹${formatIndianCurrency(inv.total_amount)}` : null} />
          <FieldRow label="Tax Amount"    value={inv.tax_amount != null ? `₹${formatIndianCurrency(inv.tax_amount)}` : null} />
          <FieldRow label="GST Amount"    value={(inv as any).gst_amount != null ? `₹${formatIndianCurrency((inv as any).gst_amount)}` : null} />
          <FieldRow label="TDS Amount"    value={(inv as any).tds_amount != null ? `₹${formatIndianCurrency((inv as any).tds_amount)}` : null} />
          <FieldRow label="Total Amount"  value={
            <span className="text-[#EC4899] font-black">
              ₹{formatIndianCurrency(inv.total_amount || 0)}
            </span>
          } />
          <FieldRow label="Line Items"    value={(inv as any).line_items?.length ?? (inv as any).line_item_count ?? "—"} />
        </Section>

        {/* ─ Bank & Payment Details ─ */}
        {((inv as any).bank_account_number || (inv as any).bank_name || (inv as any).ifsc_code) && (
          <Section title="Bank & Payment Details">
            <FieldRow label="Bank Name"      value={(inv as any).bank_name} />
            <FieldRow label="Account Number" value={(inv as any).bank_account_number} mono />
            <FieldRow label="IFSC Code"      value={(inv as any).ifsc_code} mono />
          </Section>
        )}

        {/* ─ Status & Validation ─ */}
        <Section title="Status & Validation">
          <div className="py-3 flex flex-wrap gap-2">
            <StatusPill status={inv.validation_status?.toLowerCase() || "unknown"} label={`Validation: ${inv.validation_status || "Unknown"}`} />
            <StatusPill status={inv.match_status?.toLowerCase() || "unknown"} label={`Match: ${inv.match_status || "Unmatched"}`} />
            {inv.workflow_status && <StatusPill status={inv.workflow_status} />}
            
            {/* RCM Status Badge */}
            {gstReport && (
              <StatusPill 
                status={gstReport.rcm_applicable ? "exception" : "validated"} 
                label={gstReport.rcm_applicable ? "RCM: APPLICABLE" : "RCM: NOT APPLICABLE"} 
              />
            )}

            {/* Blocked ITC Badge */}
            {gstReport && (
              <StatusPill 
                status={gstReport.itc_eligible ? "validated" : "failed"} 
                label={gstReport.itc_eligible ? "ITC: ELIGIBLE" : "ITC: BLOCKED/INELIGIBLE"} 
              />
            )}

            {/* PAN Validation Badge */}
            {tdsReport && (
              <StatusPill 
                status={tdsReport.pan_valid ? "validated" : "failed"} 
                label={tdsReport.pan_valid ? "PAN: VALID" : "PAN: INVALID"} 
              />
            )}
          </div>

          {/* Compliance Details Block */}
          {(gstReport || tdsReport) && (
            <div className="py-2.5 border-t border-zinc-100 dark:border-zinc-800 text-xs space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Compliance Audits</p>
              
              {/* RCM Details */}
              {gstReport?.rcm_applicable && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                  <div className="font-bold text-amber-800 dark:text-amber-400">Reverse Charge Applicable ({gstReport.rcm?.applicable_section})</div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-500 font-normal mt-0.5">{gstReport.rcm_reason}</div>
                  <div className="text-[10px] text-zinc-500 font-normal mt-1"><span className="font-bold">Recommendation:</span> {gstReport.rcm?.recommendation}</div>
                </div>
              )}

              {/* Indian GSTIN Formats & POS Tax Routing */}
              {gstReport && (
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-zinc-100/50 dark:bg-zinc-800/40 rounded-xl text-[11px]">
                  <div>
                    <span className="text-zinc-400 font-bold block uppercase text-[9px]">POS Route type</span>
                    <span className="font-black text-zinc-700 dark:text-zinc-300">{gstReport.is_interstate ? "IGST (Inter-State)" : "CGST/SGST (Intra-State)"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 font-bold block uppercase text-[9px]">Reconciliation</span>
                    <span className="font-black text-zinc-700 dark:text-zinc-300">{gstReport.reconciliation_percentage}% match</span>
                  </div>
                </div>
              )}

              {/* TDS Section Rates Calculation Details */}
              {tdsReport && (
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl">
                  <div className="flex justify-between items-center font-bold text-blue-800 dark:text-blue-400">
                    <span>TDS Section {tdsReport.applicable_section}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-black ${tdsReport.status === "PASS" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400"}`}>
                      {tdsReport.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-blue-700 dark:text-blue-500 font-normal mt-0.5">{tdsReport.reason}</div>
                  <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-blue-200/40 dark:border-blue-900/30 text-[10px]">
                    <div>
                      <span className="text-zinc-400 block uppercase text-[8px]">Expected TDS</span>
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">₹{tdsReport.expected_tds}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block uppercase text-[8px]">Actual TDS</span>
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">₹{tdsReport.actual_tds}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block uppercase text-[8px]">Variance</span>
                      <span className={`font-bold ${Math.abs(tdsReport.variance) > 0.01 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        ₹{tdsReport.variance}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {inv.validation_errors && inv.validation_errors.length > 0 && (
            <div className="pb-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Validation Errors</p>
              <ul className="space-y-1">
                {inv.validation_errors.map((err: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[#991B1B] dark:text-[#F87171]">
                    <span className="w-1 h-1 rounded-full bg-[#EF4444] mt-1.5 shrink-0" />
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* ─ E-Invoicing (IRN) ─ */}
        {((inv as any).irn || (inv as any).irn_verification_status) && (
          <Section title="E-Invoicing (IRN)">
            <FieldRow label="IRN Number" value={(inv as any).irn || "—"} mono />
            
            <div className="flex justify-between items-start gap-4 py-2.5 border-b border-zinc-50 dark:border-zinc-800/80 last:border-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 shrink-0 pt-0.5">
                Verification Status
              </span>
              <div className="text-right flex flex-col items-end">
                <StatusPill status={(inv as any).irn_verification_status?.toLowerCase() || "unknown"} label={(inv as any).irn_verification_status || "PENDING"} />
                {(inv as any).irn_verification_message && (
                  <span className="text-[10px] text-zinc-500 mt-1 max-w-[200px] leading-tight">
                    {(inv as any).irn_verification_message}
                  </span>
                )}
              </div>
            </div>

            {(inv as any).irn_verified_at && (
              <FieldRow label="Verified At" value={new Date((inv as any).irn_verified_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })} />
            )}
          </Section>
        )}

        {/* ─ Document Preview ─ */}
        {inv.document_id && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Document Preview
              </h4>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewOpen((p) => !p)}
                  className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {previewOpen ? "Hide ↑" : "Show ↓"}
                </button>
              </div>
            </div>
            {previewOpen && (
              <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden bg-zinc-50 dark:bg-zinc-800/40">
                {/* Zoom toolbar */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    Zoom: {Math.round(zoom * 100)}%
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleZoomOut}
                      disabled={zoom <= 0.5}
                      className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-black text-sm transition-colors disabled:opacity-40"
                      aria-label="Zoom out"
                    >
                      −
                    </button>
                    <button
                      onClick={() => setZoom(1.0)}
                      className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      onClick={handleZoomIn}
                      disabled={zoom >= 3.0}
                      className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-black text-sm transition-colors disabled:opacity-40"
                      aria-label="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
                {/* Document frame */}
                <div className="overflow-auto max-h-80 p-4">
                  <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", transition: "transform 0.2s ease" }}>
                    <iframe
                      src={`/api/documents/${inv.document_id}/preview`}
                      className="w-full min-h-64 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white"
                      title={`Document preview — ${inv.invoice_number || inv.id}`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─ Notes ─ */}
        {(inv as any).notes && (
          <Section title="Notes">
            <div className="py-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {(inv as any).notes}
            </div>
          </Section>
        )}

        {/* ─ Audit Trail ─ */}
        {(inv as any).audit_logs && (inv as any).audit_logs.length > 0 && (
          <Section title="Audit Trail">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(inv as any).audit_logs.slice(0, 8).map((log: any, i: number) => (
                <AuditRow
                  key={i}
                  action={log.action}
                  by={log.performed_by || "System"}
                  at={log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : ""}
                  statusAfter={log.status_after}
                />
              ))}
            </div>
          </Section>
        )}
      </Drawer>

      {/* Edit Modal */}
      <InvoiceEditModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        invoice={currentInvoice}
        onSaveSuccess={(updated) => {
          setCurrentInvoice(updated);
          setEditOpen(false);
          onRefresh?.();
          toast.success("Invoice updated successfully.");
        }}
      />
    </>
  );
}
