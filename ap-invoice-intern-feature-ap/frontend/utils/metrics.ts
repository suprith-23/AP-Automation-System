import { Invoice } from "../types/invoice";
import { PurchaseOrder } from "../types/purchase_order";

/**
 * Purpose: Calculates the sum of total amounts for a list of invoices.
 * Inputs: invoices - array of Invoice objects
 * Outputs: number representing the total invoice volume
 */
export function calculateTotalInvoiceVolume(invoices: Invoice[]): number {
  let total = 0;
  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];
    total += invoice.total_amount || 0;
  }
  return total;
}

/**
 * Purpose: Counts how many invoices require manual review or validation correction.
 * Inputs: invoices - array of Invoice objects
 * Outputs: number of invoices needing attention
 */
export function countInvoicesNeedingAttention(invoices: Invoice[]): number {
  let count = 0;
  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];
    
    // Convert statuses to lowercase or uppercase for reliable checking
    const workflowStatus = (invoice.workflow_status || "").toLowerCase();
    const validationStatus = (invoice.validation_status || "").toUpperCase();
    const basicStatus = (invoice.status || "").toLowerCase();

    // Check if the invoice is in an intermediate, failed, or pending state
    const isValidationPending = workflowStatus === "validation_pending";
    const isValidationFailed = workflowStatus === "validation_failed" || validationStatus === "FAILED";
    const isPendingReview = workflowStatus === "pending_review" || basicStatus === "pending";
    const isPendingApproval = workflowStatus === "pending_approval";

    if (isValidationPending || isValidationFailed || isPendingReview || isPendingApproval) {
      count++;
    }
  }
  return count;
}

/**
 * Purpose: Calculates the total amount committed in active (non-closed) purchase orders.
 * Inputs: purchaseOrders - array of PurchaseOrder objects
 * Outputs: number representing the total active PO commitments
 */
export function calculateActivePOCommitments(purchaseOrders: PurchaseOrder[]): number {
  let total = 0;
  for (let i = 0; i < purchaseOrders.length; i++) {
    const po = purchaseOrders[i];
    
    // Active purchase orders are those that are open or approved
    if (po.status === "open" || po.status === "approved") {
      total += po.po_amount || 0;
    }
  }
  return total;
}

/**
 * Purpose: Calculates the count of active (non-closed) purchase orders.
 * Inputs: purchaseOrders - array of PurchaseOrder objects
 * Outputs: number representing the count of active POs
 */
export function countActivePOs(purchaseOrders: PurchaseOrder[]): number {
  let count = 0;
  for (let i = 0; i < purchaseOrders.length; i++) {
    const po = purchaseOrders[i];
    if (po.status === "open" || po.status === "approved") {
      count++;
    }
  }
  return count;
}

/**
 * Purpose: Calculates the percentage of invoices successfully matched to purchase orders.
 * Inputs: invoices - array of Invoice objects
 * Outputs: number representing the match rate percentage (0 to 100)
 */
export function calculateMatchRate(invoices: Invoice[]): number {
  if (invoices.length === 0) {
    return 0;
  }

  let matchedCount = 0;
  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];
    if ((invoice.status || "").toLowerCase() === "matched") {
      matchedCount++;
    }
  }

  return (matchedCount / invoices.length) * 100;
}

/**
 * Purpose: Formats a numeric value into an Indian Rupees currency string.
 * Inputs: amount - number to format
 * Outputs: string formatted as currency (e.g., "₹1,234.56")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}
