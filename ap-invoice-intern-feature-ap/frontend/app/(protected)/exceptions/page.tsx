"use client";
import React, { useState, useMemo } from "react";
import { useAppStore } from "../../../store/useAppStore";
import InvoiceTable from "../../../components/InvoiceTable";

export default function ExceptionsPage() {
  const { invoices, fetchAllData, role, users } = useAppStore();
  const [activeExceptionCategory, setActiveExceptionCategory] = useState<string>("Low Confidence");

  const exceptionsInvoicesList = useMemo(() => {
    return invoices.filter((inv) => {
      if (activeExceptionCategory === "Low Confidence") {
        return inv.confidence_score !== undefined && inv.confidence_score < 0.85;
      }
      if (activeExceptionCategory === "Duplicate Invoice") {
        return inv.invoice_number?.includes("DUP") || inv.validation_errors?.some((e: string) => e.includes("dup"));
      }
      if (activeExceptionCategory === "Missing PO") {
        return !inv.po_number || inv.match_status === "unmatched";
      }
      if (activeExceptionCategory === "GST Validation Failed") {
        return inv.validation_errors?.some((e: string) => e.includes("GST") || e.includes("gst"));
      }
      if (activeExceptionCategory === "Amount Mismatch") {
        return inv.validation_errors?.some((e: string) => e.toLowerCase().includes("amount") || e.toLowerCase().includes("math") || e.toLowerCase().includes("discrepancy"));
      }
      return inv.validation_status === "FAILED";
    });
  }, [invoices, activeExceptionCategory]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Exceptions Center</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-normal">
          Identify, resolve, and reprocess invoices containing mathematical or tax compliance errors
        </p>
      </div>

      <div className="flex space-x-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        {[
          "Low Confidence",
          "Duplicate Invoice",
          "Missing PO",
          "Amount Mismatch",
          "GST Validation Failed",
        ].map((category) => (
          <button
            key={category}
            onClick={() => setActiveExceptionCategory(category)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeExceptionCategory === category
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <InvoiceTable
        invoices={exceptionsInvoicesList}
        onRefresh={fetchAllData}
        userRole={role}
        users={users}
      />
    </div>
  );
}
