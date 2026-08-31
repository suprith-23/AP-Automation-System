import React, { useState, useCallback } from "react";
import { PurchaseOrder } from "../types/purchase_order";
import { deletePurchaseOrder } from "../services/api";
import StatusBadge from "./StatusBadge";
import PurchaseOrderFormModal from "./PurchaseOrderFormModal";
import { formatIndianCurrency } from "../utils/format";
import { toast } from "sonner";

type Props = {
  purchaseOrders: PurchaseOrder[];
  onRefresh: () => void;
};

// Central dictionary to manage all user-facing strings to support clean internationalization (i18n).
const TEXTS = {
  title: "Purchase Orders",
  emptyState: "No purchase orders found in the database.",
  colPoNumber: "PO Number",
  colVendorName: "Vendor Name",
  colAmount: "Amount",
  colDate: "PO Date",
  colStatus: "Status",
  colActions: "Actions",
  btnCreate: "Add Purchase Order",
  btnEdit: "Edit",
  btnDelete: "Delete",
  btnConfirm: "Confirm",
  btnCancel: "Cancel",
  deleteSuccess: "Purchase order deleted successfully.",
  deleteErrorDetail: "Failed to delete purchase order.",
  currencyCode: "INR",
};

const MemoizedPurchaseOrderRow = React.memo(({ 
  po, 
  deleteConfirmId, 
  onEdit, 
  onDeleteConfirm, 
  onDeleteCancel, 
  onDeleteInitiate 
}: any) => {
  return (
    <tr className="hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20 transition-colors">
      <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-zinc-800 dark:text-zinc-100">{po.po_number}</td>
      <td className="px-8 py-4 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-300">
        <div>
          <div className="font-bold text-zinc-800 dark:text-zinc-100">{po.vendor_name}</div>
          {po.vendor_gstin && <div className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold mt-0.5">{po.vendor_gstin}</div>}
        </div>
      </td>
      <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-zinc-800 dark:text-zinc-100">{TEXTS.currencyCode} {formatIndianCurrency(po.po_amount)}</td>
      <td className="px-8 py-4 whitespace-nowrap text-sm text-zinc-450 dark:text-zinc-400 font-medium">{new Date(po.po_date).toLocaleDateString()}</td>
      <td className="px-8 py-4 whitespace-nowrap text-sm">
        <StatusBadge status={po.status} />
      </td>
      <td className="px-8 py-4 whitespace-nowrap text-sm space-x-3.5">
        <button
          onClick={() => onEdit(po)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition-colors"
        >
          {TEXTS.btnEdit}
        </button>
        {deleteConfirmId === po.id ? (
          <span className="space-x-2.5">
            <button
              onClick={() => onDeleteConfirm(po.id)}
              className="text-rose-600 dark:text-rose-450 hover:text-rose-700 dark:hover:text-rose-350 font-bold transition-colors animate-pulse"
            >
              {TEXTS.btnConfirm}
            </button>
            <button
              onClick={onDeleteCancel}
              className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors font-medium"
            >
              {TEXTS.btnCancel}
            </button>
          </span>
        ) : (
          <button
            onClick={() => onDeleteInitiate(po.id)}
            className="text-rose-600 dark:text-rose-450 hover:text-rose-700 dark:hover:text-rose-350 font-semibold transition-colors"
          >
            {TEXTS.btnDelete}
          </button>
        )}
      </td>
    </tr>
  );
});

export default function PurchaseOrderTable({ purchaseOrders, onRefresh }: Props) {
  // Modal visibility and active editing item states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPo, setCurrentPo] = useState<PurchaseOrder | null>(null);

  // Deletion confirmation ID tracker
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const openAddModal = useCallback(() => {
    setCurrentPo(null);
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((po: PurchaseOrder) => {
    setCurrentPo(po);
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await deletePurchaseOrder(id);
      setDeleteConfirmId(null);
      toast.success(TEXTS.deleteSuccess);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || TEXTS.deleteErrorDetail);
    }
  }, [onRefresh]);

  const handleDeleteCancel = useCallback(() => setDeleteConfirmId(null), []);
  const handleDeleteInitiate = useCallback((id: number) => setDeleteConfirmId(id), []);
  const handleModalClose = useCallback(() => setIsModalOpen(false), []);

  return (
    <div className="space-y-4">
      {/* Dashboard Section Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{TEXTS.title}</h2>
        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0"
        >
          {TEXTS.btnCreate}
        </button>
      </div>

      {/* Empty State warning when no records exist */}
      {(!purchaseOrders || purchaseOrders.length === 0) ? (
        <div className="premium-card rounded-2xl p-10 border border-zinc-200 dark:border-zinc-800 text-center shadow-sm bg-white dark:bg-zinc-900">
          <p className="text-zinc-400 dark:text-zinc-500 font-medium text-sm">{TEXTS.emptyState}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm bg-white dark:bg-zinc-900">
          <table className="min-w-full border-separate border-spacing-y-0">
            <thead>
              <tr className="text-white text-[10px] font-black uppercase tracking-wider border-none">
                <th className="rounded-l-2xl px-8 py-3.5 text-left text-xs font-black uppercase tracking-wider bg-[#EC4899] text-white">{TEXTS.colPoNumber}</th>
                <th className="px-8 py-3.5 text-left text-xs font-black uppercase tracking-wider bg-[#EC4899] text-white">{TEXTS.colVendorName}</th>
                <th className="px-8 py-3.5 text-left text-xs font-black uppercase tracking-wider bg-[#EC4899] text-white">{TEXTS.colAmount}</th>
                <th className="px-8 py-3.5 text-left text-xs font-black uppercase tracking-wider bg-[#EC4899] text-white">{TEXTS.colDate}</th>
                <th className="px-8 py-3.5 text-left text-xs font-black uppercase tracking-wider bg-[#EC4899] text-white">{TEXTS.colStatus}</th>
                <th className="rounded-r-2xl px-8 py-3.5 text-left text-xs font-black uppercase tracking-wider bg-[#EC4899] text-white">{TEXTS.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {purchaseOrders.map((po) => (
                <MemoizedPurchaseOrderRow
                  key={po.id}
                  po={po}
                  deleteConfirmId={deleteConfirmId}
                  onEdit={openEditModal}
                  onDeleteConfirm={handleDelete}
                  onDeleteCancel={handleDeleteCancel}
                  onDeleteInitiate={handleDeleteInitiate}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Extracted Form Modal Overlay component */}
      <PurchaseOrderFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSaveSuccess={onRefresh}
        purchaseOrder={currentPo}
      />
    </div>
  );
}
