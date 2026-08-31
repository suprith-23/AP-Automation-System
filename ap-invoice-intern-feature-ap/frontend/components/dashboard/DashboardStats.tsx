"use client";

import { Invoice } from "../../types/invoice";
import { PurchaseOrder } from "../../types/purchase_order";

interface Props {
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
  loading: boolean;
}

/**
 * DashboardStats — standalone stats card grid for the AP dashboard.
 * Displays: Invoice Volume, Needs Attention count, Active PO Commitments, Match Rate.
 */
export default function DashboardStats({ invoices, purchaseOrders, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl h-28" />
        ))}
      </div>
    );
  }

  const totalVolume = invoices.reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0);
  const invoiceCount = invoices.length;

  const needsAttention = invoices.filter(
    (inv) =>
      inv.workflow_status === "validation_failed" ||
      inv.workflow_status === "pending_review" ||
      inv.validation_status === "FAILED"
  ).length;

  const activePOs = purchaseOrders.filter((po) => po.status === "open" || po.status === "approved");
  const activePOCommitments = activePOs.reduce((sum, po) => sum + (po.po_amount ?? 0), 0);
  const activePOCount = activePOs.length;

  const matchedCount = invoices.filter((inv) => inv.status === "matched").length;
  const matchRate = invoiceCount > 0 ? ((matchedCount / invoiceCount) * 100).toFixed(1) : "0.0";

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const cards = [
    {
      label: "Invoice Volume",
      value: `₹${fmt(totalVolume)}`,
      sub: `${invoiceCount} invoices received`,
      bg: "bg-[#3B82F6]",
      textColor: "text-white",
      subColor: "text-blue-100",
    },
    {
      label: "Needs Attention",
      value: `${needsAttention}`,
      sub: "Pending review / failed",
      bg: "bg-[#F59E0B]",
      textColor: "text-[#0A0A0A]",
      subColor: "text-amber-900",
    },
    {
      label: "PO Commitments",
      value: `₹${fmt(activePOCommitments)}`,
      sub: `${activePOCount} active orders`,
      bg: "bg-[#22C55E]",
      textColor: "text-[#0A0A0A]",
      subColor: "text-green-900",
    },
    {
      label: "Match Rate",
      value: `${matchRate}%`,
      sub: "PO match percentage",
      bg: "bg-[#EC4899]",
      textColor: "text-white",
      subColor: "text-pink-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`${card.bg} rounded-2xl px-5 py-4 flex flex-col justify-between min-h-[96px] shadow-sm`}
        >
          <span className={`text-[10px] font-black uppercase tracking-widest leading-tight ${card.subColor} opacity-80`}>
            {card.label}
          </span>
          <div>
            <div className={`text-2xl font-black tracking-tight leading-none mt-2 ${card.textColor}`}>
              {card.value}
            </div>
            <div className={`text-[10px] font-semibold mt-1 ${card.subColor}`}>
              {card.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

