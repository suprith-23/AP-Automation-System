/**
 * Purpose: Defines TypeScript interfaces for Purchase Orders returned by the database.
 */
export interface PurchaseOrder {
  id: number;
  po_number: string;
  vendor_name: string;
  vendor_gstin?: string | null;
  po_amount: number;
  po_date: string;
  status: "open" | "approved" | "closed";
}
