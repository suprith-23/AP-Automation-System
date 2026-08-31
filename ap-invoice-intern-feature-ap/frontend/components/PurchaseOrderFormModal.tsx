"use client";
import { useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PurchaseOrder } from "../types/purchase_order";
import { createPurchaseOrder, updatePurchaseOrder } from "../services/api";
import PillInput from "./ui/PillInput";
import Button from "./ui/Button";
import { useFocusTrap } from "../hooks/useFocusTrap";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  purchaseOrder: PurchaseOrder | null;
};

const TEXTS = {
  modalTitleEdit: "Edit Purchase Order",
  modalTitleAdd: "Add Purchase Order",
  labelPoNumber: "PO Number",
  labelVendorName: "Vendor Name",
  labelVendorGstin: "Vendor GSTIN",
  labelAmount: "Amount (INR)",
  labelDate: "Date",
  labelStatus: "Status",
  statusOpen: "Open",
  statusApproved: "Approved",
  statusClosed: "Closed",
  btnCancel: "Cancel",
  savingState: "Saving...",
  saveState: "Save",
  saveErrorDetail: "An error occurred while saving.",
};

const poSchema = z.object({
  po_number: z.string().min(1, "PO number is required"),
  vendor_name: z.string().min(1, "Vendor name is required"),
  vendor_gstin: z.string().min(1, "Vendor GSTIN is required"),
  po_amount: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number({ error: "Amount is required" }).positive("Amount must be positive")
  ),
  po_date: z.string().min(1, "Date is required"),
  status: z.enum(["open", "approved", "closed"]),
});

type FormValues = z.infer<typeof poSchema>;

export default function PurchaseOrderFormModal({
  isOpen,
  onClose,
  onSaveSuccess,
  purchaseOrder,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(poSchema) as any,
    defaultValues: {
      po_number: "",
      vendor_name: "",
      vendor_gstin: "",
      po_amount: 0,
      po_date: "",
      status: "open",
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (purchaseOrder) {
        reset({
          po_number: purchaseOrder.po_number || "",
          vendor_name: purchaseOrder.vendor_name || "",
          vendor_gstin: purchaseOrder.vendor_gstin || "",
          po_amount: purchaseOrder.po_amount || 0,
          po_date: purchaseOrder.po_date || "",
          status: purchaseOrder.status || "open",
        });
      } else {
        reset({
          po_number: "",
          vendor_name: "",
          vendor_gstin: "",
          po_amount: 0,
          po_date: new Date().toISOString().split("T")[0],
          status: "open",
        });
      }
    }
  }, [purchaseOrder, isOpen, reset]);

  const onSubmit = async (data: FormValues) => {
    try {
      if (purchaseOrder) {
        await updatePurchaseOrder(purchaseOrder.id, data as any);
      } else {
        await createPurchaseOrder(data as any);
      }
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      setError("root", {
        message: err.response?.data?.detail || TEXTS.saveErrorDetail,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={purchaseOrder ? TEXTS.modalTitleEdit : TEXTS.modalTitleAdd}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-[22px] p-7 max-w-md w-full shadow-2xl animate-scale-in mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-black text-zinc-900 dark:text-white">
            {purchaseOrder ? TEXTS.modalTitleEdit : TEXTS.modalTitleAdd}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
                       bg-zinc-100 dark:bg-zinc-800
                       text-zinc-500 hover:text-zinc-800 dark:hover:text-white
                       hover:bg-zinc-200 dark:hover:bg-zinc-700
                       transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {errors.root && (
          <div className="mb-4 px-4 py-3 bg-status-rejected/10 rounded-2xl">
            <p className="text-xs font-semibold text-status-rejected">{errors.root.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
          <Controller
            name="po_number"
            control={control}
            render={({ field }) => (
              <PillInput
                label={TEXTS.labelPoNumber}
                value={field.value}
                onChange={field.onChange}
                error={errors.po_number?.message}
                placeholder="e.g. PO-2026-001"
              />
            )}
          />

          <Controller
            name="vendor_name"
            control={control}
            render={({ field }) => (
              <PillInput
                label={TEXTS.labelVendorName}
                value={field.value}
                onChange={field.onChange}
                error={errors.vendor_name?.message}
                placeholder="e.g. Acme Corp"
              />
            )}
          />

          <Controller
            name="vendor_gstin"
            control={control}
            render={({ field }) => (
              <PillInput
                label={TEXTS.labelVendorGstin}
                value={field.value}
                onChange={field.onChange}
                error={errors.vendor_gstin?.message}
                placeholder="GSTIN"
              />
            )}
          />

          <Controller
            name="po_amount"
            control={control}
            render={({ field }) => (
              <PillInput
                label={TEXTS.labelAmount}
                type="number"
                value={field.value === 0 ? "" : String(field.value)}
                onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                error={errors.po_amount?.message}
                placeholder="0.00"
              />
            )}
          />

          <Controller
            name="po_date"
            control={control}
            render={({ field }) => (
              <PillInput
                label={TEXTS.labelDate}
                type="date"
                value={field.value}
                onChange={field.onChange}
                error={errors.po_date?.message}
              />
            )}
          />
          
          <div className="flex flex-col">
            <label htmlFor="po-status-select" className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 px-1">
              {TEXTS.labelStatus}
            </label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <select
                  id="po-status-select"
                  value={field.value}
                  onChange={field.onChange}
                  className="w-full min-h-[44px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-full px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
                >
                  <option value="open">{TEXTS.statusOpen}</option>
                  <option value="approved">{TEXTS.statusApproved}</option>
                  <option value="closed">{TEXTS.statusClosed}</option>
                </select>
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={isSubmitting}>
              {TEXTS.btnCancel}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={isSubmitting}>
              {isSubmitting ? TEXTS.savingState : TEXTS.saveState}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
