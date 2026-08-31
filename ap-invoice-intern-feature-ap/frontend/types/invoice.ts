import { InvoiceResponse } from "./api_schemas";

// Shape of an invoice returned by the backend API.
export interface Invoice extends InvoiceResponse {
  invoice_number: string;
  vendor_name: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: string;
  confidence_json?: Record<string, number | null> | null;
  raw_ocr_text?: string | null;
  extracted_json?: any | null;
  reviewer?: string | null;
  approver?: string | null;
  extraction_timestamp?: string | null;
  processed_at?: string | null;
  document_id?: number | null;
  organization_id?: string | null;
  reviewer_checklist_completed?: Record<string, boolean> | null;
  reviewer_confidence_before?: number | null;
  reviewer_confidence_after?: number | null;
  review_duration_seconds?: number | null;
}

