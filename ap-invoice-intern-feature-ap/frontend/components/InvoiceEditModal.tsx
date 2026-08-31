"use client";
import { useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Invoice } from "../types/invoice";
import { updateInvoice } from "../services/api";
import PillInput from "./ui/PillInput";
import Button from "./ui/Button";
import { useFocusTrap } from "../hooks/useFocusTrap";

const invoiceSchema = z.object({
  invoice_number: z.string().min(1, "Invoice number is required"),
  po_number: z.string().optional(),
  seller_name: z.string().min(1, "Seller name is required"),
  total_invoice_value: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number({ error: "Amount is required" }).positive("Amount must be positive")
  ),
});

type FormValues = z.infer<typeof invoiceSchema>;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (updatedInvoice: Invoice) => void;
  invoice: Invoice | null;
};

export default function InvoiceEditModal({
  isOpen,
  onClose,
  onSaveSuccess,
  invoice,
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
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      invoice_number: "",
      po_number: "",
      seller_name: "",
      total_invoice_value: 0,
    },
  });

  useEffect(() => {
    if (invoice && isOpen) {
      reset({
        invoice_number: invoice.invoice_number || "",
        po_number: invoice.po_number || "",
        seller_name: invoice.seller_name || "",
        total_invoice_value: invoice.total_invoice_value || invoice.total_amount || 0,
      });
    }
  }, [invoice, isOpen, reset]);

  const onSubmit = async (data: FormValues) => {
    if (!invoice) return;
    try {
      const updated = await updateInvoice(invoice.id, data);
      onSaveSuccess(updated);
      onClose();
    } catch (err: any) {
      setError("root", {
        message: err.response?.data?.detail || "An error occurred while saving.",
      });
    }
  };

  if (!isOpen || !invoice) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Edit Invoice"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-[22px] p-7 max-w-md w-full shadow-2xl animate-scale-in mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-black text-zinc-900 dark:text-white">Edit Invoice Fields</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center
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
            name="invoice_number"
            control={control}
            render={({ field }) => (
              <PillInput
                label="Invoice Number"
                value={field.value}
                onChange={field.onChange}
                error={errors.invoice_number?.message}
                placeholder="e.g. INV-2026-001"
              />
            )}
          />

          <Controller
            name="po_number"
            control={control}
            render={({ field }) => (
              <PillInput
                label="PO Number"
                value={field.value}
                onChange={field.onChange}
                error={errors.po_number?.message}
                placeholder="e.g. PO-2026-042"
              />
            )}
          />

          <Controller
            name="seller_name"
            control={control}
            render={({ field }) => (
              <PillInput
                label="Seller Name"
                value={field.value}
                onChange={field.onChange}
                error={errors.seller_name?.message}
                placeholder="Vendor or supplier name"
              />
            )}
          />

          <Controller
            name="total_invoice_value"
            control={control}
            render={({ field }) => (
              <PillInput
                label="Total Invoice Value"
                type="number"
                value={field.value === 0 ? "" : String(field.value)}
                onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                error={errors.total_invoice_value?.message}
                placeholder="0.00"
              />
            )}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
