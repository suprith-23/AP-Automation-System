"use client";
import React, { useRef, useEffect } from "react";
import StatusPill from "./StatusPill";
import Button from "./Button";
import { Invoice } from "../../types/invoice";
import { formatIndianCurrency } from "../../utils/format";
import { useRouter } from "next/navigation";

type Props = {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onDeepInspect?: (id: number) => void;
};

export default function InvoiceSummaryPopup({ invoice, isOpen, onClose, onDeepInspect }: Props) {
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !invoice) return null;

  const handleDeepInspectClick = () => {
    onClose();
    if (onDeepInspect) {
      onDeepInspect(invoice.id);
    } else {
      router.push(`/invoices/${invoice.id}`);
    }
  };

  const hasValidationErrors = invoice.validation_errors && invoice.validation_errors.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div 
        ref={modalRef}
        className="relative w-full max-w-lg rounded-[22px] bg-white dark:bg-[#121214] p-6 shadow-xl border border-zinc-200/60 dark:border-zinc-800 animate-scale-in text-zinc-900 dark:text-zinc-100 flex flex-col gap-5"
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Invoice Summary</h3>
            <h2 className="text-lg font-black mt-1 text-zinc-800 dark:text-white truncate">
              {invoice.invoice_number || `Invoice #${invoice.id}`}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {invoice.seller_name || invoice.vendor_name || "Unknown Vendor"}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Invoice Date</span>
            <span className="font-bold text-zinc-700 dark:text-zinc-300">{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : "—"}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Due Date</span>
            <span className="font-bold text-zinc-700 dark:text-zinc-300">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">PO Reference</span>
            <span className="font-bold text-zinc-700 dark:text-zinc-300 font-mono">{invoice.po_number || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Workflow Status</span>
            <StatusPill status={invoice.workflow_status || invoice.status} className="mt-1" />
          </div>
        </div>

        {/* Financial Overview */}
        <div className="rounded-[18px] bg-zinc-50 dark:bg-zinc-800/40 p-4 space-y-2 text-xs border border-zinc-100 dark:border-zinc-800/50">
          <div className="flex justify-between items-center">
            <span className="text-zinc-550 dark:text-zinc-400">Total Taxable Value</span>
            <span className="font-bold">₹{formatIndianCurrency(invoice.total_taxable_value || invoice.subtotal || 0)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-550 dark:text-zinc-400">Total GST Amount</span>
            <span className="font-bold">₹{formatIndianCurrency(invoice.total_cgst_value || invoice.tax_amount || 0)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800 font-bold text-sm text-zinc-800 dark:text-white">
            <span>Total Value</span>
            <span className="text-[#EC4899]">₹{formatIndianCurrency(invoice.total_invoice_value || invoice.total_amount || 0)}</span>
          </div>
        </div>

        {/* SLA / Exceptions Warning */}
        {hasValidationErrors && (
          <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs rounded-xl border border-rose-500/20 font-medium space-y-1">
            <span className="font-bold block">Validation Discrepancies:</span>
            <ul className="list-disc pl-4 space-y-0.5">
              {invoice.validation_errors.slice(0, 2).map((err: string, i: number) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          <Button variant="primary" size="sm" onClick={handleDeepInspectClick}>Deep Inspect</Button>
        </div>
      </div>
    </div>
  );
}
