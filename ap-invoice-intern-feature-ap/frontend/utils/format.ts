/**
 * Formats a numeric amount (or string representation of a number) into the Indian Numbering System currency format.
 * Example: 198560.00 -> "1,98,560.00"
 */
export function formatIndianCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "0.00";
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return "0.00";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

/**
 * Calculates the average review/processing time from invoice data in formatted string form (m or h).
 */
export function calculateAverageReviewTime(invoices: any[]): string {
  const processed = invoices.filter((inv: any) => inv.processed_at && inv.invoice_date);
  if (processed.length === 0) return "—";
  const hoursArr = processed
    .map((inv: any) => Math.abs((new Date(inv.processed_at).getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60)))
    .filter((h: number) => h >= 0 && h < 720);
  if (hoursArr.length === 0) return "—";
  const avg = hoursArr.reduce((s: number, h: number) => s + h, 0) / hoursArr.length;
  return avg < 1 ? `${Math.round(avg * 60)}m` : `${avg.toFixed(1)}h`;
}

/**
 * Maps invoice records to grouped DataTable rows.
 */
export function mapInvoicesToGroupedTableRows(invoices: any[], currentUserIdOrName?: string, usersList: any[] = []) {
  if (!invoices || invoices.length === 0) {
    return [
      {
        groupLabel: "My Active Queue",
        rows: [],
      },
    ];
  }
  const groupsMap: Record<string, any[]> = {};
  invoices.forEach((inv) => {
    const dt = inv.invoice_date ? new Date(inv.invoice_date) : new Date();
    const dateStr = dt.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    if (!groupsMap[dateStr]) groupsMap[dateStr] = [];
    
    const cleanWf = (inv.workflow_status || inv.status || "").toLowerCase();
    let mappedStatus: "approved" | "rejected" | "pending" | "in_review" = "pending";
    if (cleanWf === "approved") mappedStatus = "approved";
    else if (cleanWf === "rejected") mappedStatus = "rejected";
    else if (cleanWf === "pending_approval") mappedStatus = "in_review";

    // Resolve reviewer name dynamically
    let resolvedReviewer = "Unassigned";
    if (inv.assigned_reviewer_id) {
      if (currentUserIdOrName && String(inv.assigned_reviewer_id) === String(currentUserIdOrName)) {
        resolvedReviewer = "You";
      } else {
        const matchingUser = usersList.find(u => String(u.id) === String(inv.assigned_reviewer_id));
        resolvedReviewer = matchingUser ? (matchingUser.name || matchingUser.email || "Unknown") : "Assigned";
      }
    } else if (currentUserIdOrName && usersList.length === 0) {
      resolvedReviewer = currentUserIdOrName;
    }

    groupsMap[dateStr].push({
      id: `WF-${inv.id}`,
      workflow: `Invoice Validation — ${inv.seller_name || inv.vendor_name || "Unknown"}`,
      submittedBy: inv.source_type ? inv.source_type.toUpperCase() : "EMAIL",
      date: dt.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      status: mappedStatus,
      reviewer: resolvedReviewer,
      environment: "production" as const,
    });
  });
  return Object.entries(groupsMap)
    .map(([groupLabel, rows]) => ({ groupLabel, rows }))
    .sort((a, b) => new Date(b.groupLabel).getTime() - new Date(a.groupLabel).getTime());
}

/**
 * Safely parses a UTC timestamp string (e.g. from backend database) and returns a local Date object.
 * Corrects parsing bugs where browsers interpret 'YYYY-MM-DD HH:MM:SS.mmmmmm' as local time instead of UTC.
 */
export function parseUTCTimestamp(tsString: string | null | undefined): Date {
  if (!tsString) return new Date();
  
  // If it already has a timezone indicator (Z or +), parse it directly
  if (tsString.includes("Z") || tsString.includes("+")) {
    return new Date(tsString);
  }
  
  // Check if it has a minus sign after the time separator (e.g. 2026-08-14T05:12:23-05:00)
  const tIndex = tsString.indexOf("T");
  const spaceIndex = tsString.indexOf(" ");
  const timeSeparatorIndex = tIndex !== -1 ? tIndex : spaceIndex;
  
  if (timeSeparatorIndex !== -1) {
    const timePart = tsString.slice(timeSeparatorIndex);
    if (timePart.includes("-")) {
      return new Date(tsString);
    }
  }
  
  // No timezone specified. Standardize space to T and append Z
  const isoString = tsString.replace(" ", "T");
  return new Date(isoString.endsWith("Z") ? isoString : isoString + "Z");
}


