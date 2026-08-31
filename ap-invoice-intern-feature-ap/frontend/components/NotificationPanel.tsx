import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../store/useAppStore";
import Button from "./ui/Button";
import authService from "../services/auth.service";
import apiClient from "../services/api-client";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const getRelativeTime = (timestampString: string, currentTick: number) => {
  try {
    const now = new Date();
    const then = new Date(timestampString);
    const diffMs = now.getTime() - then.getTime();
    if (diffMs < 0) return "Just now";
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch (e) {
    return "Recently";
  }
};

export default function NotificationPanel({ isOpen, onClose }: Props) {
  const { auditLogs, role } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update relative timestamps every 15 seconds
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const notifications = React.useMemo(() => {
    const currentUser = authService.getStoredUser();
    const userEmail = currentUser?.email || "anonymous";

    let readIds: string[] = [];
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`ap_read_logs_${userEmail}`);
        if (stored) readIds = JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
    }

    // Filter logs depending on user role
    const filteredLogs = (auditLogs || []).filter((log) => {
      if (role === "Reviewer") {
        // Reviewer sees newly created/validation check logs
        return log.action === "INVOICE_CREATED" || log.action === "VALIDATION_COMPLETED" || log.action === "INVOICE_REVIEWER_ASSIGNED";
      }
      if (role === "Approver") {
        // Approver sees invoices passed by reviewer or awaiting approval
        return log.action === "INVOICE_SUBMITTED_FOR_APPROVAL" || (log.action === "STATUS_CHANGED" && log.status_after === "PENDING_APPROVAL");
      }
      // Admin sees invoice lifecycle actions + seen receipts, excluding logins/logouts
      if (role === "Admin") {
        return (
          log.action === "INVOICE_CREATED" ||
          log.action === "VALIDATION_COMPLETED" ||
          log.action === "INVOICE_SUBMITTED_FOR_APPROVAL" ||
          log.action === "NOTIFICATION_SEEN" ||
          log.action === "APPROVER_APPROVED" ||
          log.action === "APPROVER_REJECTED"
        );
      }
      return log.action !== "USER_LOGIN" && log.action !== "USER_LOGOUT";
    });

    return filteredLogs.slice(0, 15).map((log) => {
      let title = "System Event";
      let desc = "";
      let type = "info";

      const action = log.action || "";
      if (action.includes("FAIL") || action.includes("ERROR") || action.includes("REJECT") || action.includes("SUSPEND")) {
        type = "alert";
      } else if (action.includes("WARNING") || action.includes("UPDATE") || action.includes("CHANGE")) {
        type = "warning";
      }

      if (action === "INVOICE_CREATED" || action === "VALIDATION_COMPLETED") {
        title = "Invoice Ingested";
        desc = `Invoice #${log.invoice_id || "Draft"} was successfully ingested and is pending review.`;
      } else if (action === "VALIDATION_FAILED") {
        title = "Validation Failure";
        const errors = log.details?.errors || [];
        desc = `Invoice #${log.invoice_id} failed validations: ${errors.join(", ") || "Unknown anomalies"}`;
        type = "alert";
      } else if (action === "VALIDATION_COMPLETED") {
        title = "Validation Passed";
        desc = `Invoice #${log.invoice_id} passed compliance validation checks.`;
        type = "info";
      } else if (action === "PO_MATCH_SUCCESS") {
        title = "PO Match Success";
        desc = `Invoice #${log.invoice_id} successfully matched with corresponding Purchase Order.`;
        type = "info";
      } else if (action === "STATUS_CHANGED") {
        title = "Status Transition";
        desc = `Invoice #${log.invoice_id} status changed from ${log.status_before || "Draft"} to ${log.status_after}.`;
        type = "info";
      } else if (action === "INVOICE_REVIEWER_ASSIGNED") {
        title = "Invoice Assigned";
        desc = `Invoice #${log.invoice_id} was assigned to Reviewer ${log.details?.assigned_to} by ${log.performed_by}.`;
        type = "info";
      } else if (action === "INVOICE_SUBMITTED_FOR_APPROVAL") {
        title = "Awaiting Approval";
        desc = `Invoice #${log.invoice_id} was passed and submitted for approval by Reviewer ${log.performed_by}.`;
        type = "warning";
      } else if (action === "NOTIFICATION_SEEN") {
        const uRole = log.details?.user_role || "User";
        title = `${uRole} Read Notification`;
        desc = `${uRole} (${log.performed_by}) opened the notification panel for Invoice #${log.invoice_id}.`;
        type = "info";
      } else if (action === "APPROVER_APPROVED") {
        title = "Invoice Approved";
        desc = `Invoice #${log.invoice_id} was approved for payment by ${log.performed_by}.`;
        type = "info";
      } else if (action === "APPROVER_REJECTED") {
        title = "Invoice Rejected";
        desc = `Invoice #${log.invoice_id} was rejected and returned by ${log.performed_by}.`;
        type = "alert";
      } else {
        const cleanAction = action.replace(/_/g, " ");
        title = cleanAction.charAt(0).toUpperCase() + cleanAction.slice(1).toLowerCase();
        desc = `Invoice #${log.invoice_id || "System"}: Performed by ${log.performed_by || "system"}.`;
      }

      return {
        id: String(log.id || Math.random()),
        invoiceId: log.invoice_id,
        title,
        desc,
        time: getRelativeTime(log.timestamp, tick),
        type,
        isRead: readIds.includes(String(log.id)),
      };
    });
  }, [auditLogs, role, tick]);

  const handleMarkAllAsRead = () => {
    if (notifications.length === 0) return;

    const currentUser = authService.getStoredUser();
    const userEmail = currentUser?.email || "anonymous";
    const userRole = role;

    let readIds: string[] = [];
    try {
      const stored = localStorage.getItem(`ap_read_logs_${userEmail}`);
      if (stored) readIds = JSON.parse(stored);
    } catch (e) {}

    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    const updatedReadIds = [...readIds];
    unread.forEach((n) => {
      if (!updatedReadIds.includes(n.id)) {
        updatedReadIds.push(n.id);
      }
      
      // Notify Admin if Reviewer or Approver reads their notification
      if (n.invoiceId && (userRole === "Reviewer" || userRole === "Approver")) {
        apiClient.post("/audit-logs/log-seen", {
          invoice_id: Number(n.invoiceId),
          user_role: userRole
        }).catch((err) => console.error("Seen logging failed:", err));
      }
    });

    localStorage.setItem(`ap_read_logs_${userEmail}`, JSON.stringify(updatedReadIds));
    
    // Trigger relative render updates
    setTick((t) => t + 1);
  };

  const criticalCount = React.useMemo(() => {
    return notifications.filter((n) => n.type === "alert").length;
  }, [notifications]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 font-sans" role="dialog" aria-modal="true" aria-label="Notifications Panel">
      {/* Solid opaque backdrop - matching organization detail modals */}
      <div className="absolute inset-0 bg-[#000000]/60 transition-opacity duration-300" onClick={onClose} aria-hidden="true"></div>

      {/* Modal Container - Center aligned stacked overlay */}
      <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col justify-between overflow-hidden transform scale-100 shadow-2xl text-zinc-900 dark:text-zinc-100 animate-fade-in">
        
        {/* Header */}
        <div className="h-16 px-6 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80">
          <div className="flex items-center space-x-2.5">
            <span className="text-zinc-900 dark:text-zinc-50 font-black text-sm uppercase tracking-wider">Action Required Center</span>
            {criticalCount > 0 && (
              <span className="bg-[#FF3B3B] dark:bg-[#3D1414] text-[#FFFFFF] dark:text-[#FF5C5C] text-[10px] font-bold px-1.5 py-0.5 rounded-full border-none">
                {criticalCount} Critical
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close notifications"
            className="p-1.5 rounded-xl hover:bg-zinc-150 dark:hover:bg-zinc-800 border border-zinc-150 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/30 dark:bg-zinc-900/20 max-h-[50vh]">
          {notifications.length === 0 ? (
            <div className="text-center text-zinc-400 dark:text-zinc-500 py-16 text-xs font-normal">
              No active notifications.
            </div>
          ) : (
            notifications.map((item) => {
              const colors: Record<string, string> = {
                alert: "bg-fw-red/10 text-fw-red dark:bg-fw-red-deep/30 dark:text-fw-red-dark border border-fw-red/20 dark:border-fw-red-dark/20",
                warning: "bg-fw-amber/10 text-fw-amber dark:bg-fw-amber-deep/30 dark:text-fw-amber-dark border border-fw-amber/20 dark:border-fw-amber-dark/20",
                info: "bg-fw-blue/10 text-fw-blue dark:bg-fw-blue-deep/30 dark:text-fw-blue-dark border border-fw-blue/20 dark:border-fw-blue-dark/20",
              };

              return (
                <div
                  key={item.id}
                  className={`p-4 bg-white dark:bg-zinc-950 border rounded-2xl shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 space-y-2.5 ${
                    item.isRead 
                      ? "border-zinc-200 dark:border-zinc-800 opacity-80" 
                      : "border-[#FF3EA5]/40 dark:border-[#FF3EA5]/40 ring-1 ring-[#FF3EA5]/15 bg-[#FF3EA5]/[0.02]"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-zinc-850 dark:text-zinc-100 leading-tight">{item.title}</span>
                      {!item.isRead && (
                        <span className="w-1.5 h-1.5 bg-[#FF3EA5] rounded-full shrink-0 animate-pulse" title="Unread" />
                      )}
                    </div>
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold shrink-0">{item.time}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                    {item.desc}
                  </p>
                  <div className="pt-1 flex justify-between items-center border-t border-zinc-50 dark:border-zinc-900/60 pt-2.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${colors[item.type]}`}>
                      {item.type}
                    </span>
                    <button className="text-[10px] text-fw-blue dark:text-fw-blue-dark hover:underline font-bold transition-all">
                      View Log &rarr;
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-150 dark:border-zinc-800 flex gap-2">
          {notifications.some((n) => !n.isRead) && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex-1 py-2 px-4 bg-[#FF3EA5] hover:bg-[#db3f88] text-white font-bold text-xs rounded-2xl transition-all shadow-sm font-sans"
            >
              Mark all as read
            </button>
          )}
          <Button onClick={onClose} variant="secondary" size="sm" className="flex-1">
            Dismiss Panel
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

