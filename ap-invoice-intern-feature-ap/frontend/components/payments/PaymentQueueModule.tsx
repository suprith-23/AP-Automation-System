"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useAppStore } from "../../store/useAppStore";
import apiClient from "../../services/api-client";
import StatusPill from "../ui/StatusPill";
import Drawer from "../ui/Drawer";
import { formatIndianCurrency } from "../../utils/format";

type PaymentItem = {
  id: number;
  invoice_id: number;
  invoice_number: string;
  vendor: string;
  vendor_account: string;
  amount: number;
  currency: string;
  due_date: string;
  scheduled_date: string | null;
  status: string;
  priority: string;
  risk_level: string;
  approval_date: string;
  payment_method: string;
  erp_status: string;
  assigned_user: string;
  created_date: string;
  expected_date: string | null;
  days_until_due: number;
  sla_status: string;
  gateway_name: string;
  comments: string[];
};

export default function PaymentQueueModule() {
  const { role } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthorized =
    role === "Admin" ||
    role === "Super Admin" ||
    role === "Approver" ||
    role === "Auditor" ||
    role === "Finance Manager";

  console.log("DEBUG PaymentQueueModule:", { role, mounted, isAuthorized });

  const isReadOnly = role === "Auditor";

  // State Management
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState("due_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [activeTab, setActiveTab] = useState<"list" | "calendar">("list");
  const [calendarViewMode, setCalendarViewMode] = useState<"month" | "week" | "day">("month");
  const [vendors, setVendors] = useState<any[]>([]);

  // Dashboard Stats
  const [stats, setStats] = useState({
    awaitingSchedulingCount: 0,
    scheduledTodayCount: 0,
    paymentsTodayCount: 0,
    overdueCount: 0,
    failedPaymentsCount: 0,
    totalPaymentValue: 0.0,
    monthlyPaymentVolume: 0.0,
    averageProcessingTimeMin: 4.2,
    gatewayHealth: "Online",
  });

  // Drawer & Modal States
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [showBulkDateModal, setShowBulkDateModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [simulatedPaymentData, setSimulatedPaymentData] = useState<any | null>(null);
  
  const [processingPayment, setProcessingPayment] = useState<PaymentItem | null>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const [manualVendorForm, setManualVendorForm] = useState({
    name: "",
    bank_name: "",
    bank_account_number: "",
    ifsc_code: ""
  });

  // Forms
  const [scheduleForm, setScheduleForm] = useState({
    scheduled_date: "",
    payment_method: "Bank Transfer",
    priority: "Medium",
    gateway_name: "Razorpay",
  });
  const [newDateValue, setNewDateValue] = useState("");
  const [newAssigneeValue, setNewAssigneeValue] = useState("");
  const [commentText, setCommentText] = useState("");

  const fetchPayments = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const [queueRes, statsRes] = await Promise.all([
        apiClient.get("/payments/queue", {
          params: {
            search,
            status_filter: statusFilter,
            priority_filter: priorityFilter,
            sort_by: sortBy,
            sort_order: sortOrder,
          },
        }),
        apiClient.get("/payments/dashboard"),
      ]);
      setPayments(queueRes.data || []);
      setStats(statsRes.data || {});
    } catch (err) {
      toast.error("Failed to load payment queue records.");
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, search, statusFilter, priorityFilter, sortBy, sortOrder]);

  const fetchVendors = useCallback(async () => {
    try {
      const res = await apiClient.get("/vendors");
      setVendors(res.data || []);
    } catch (err) {
      console.error("Failed to load vendors for mapping", err);
    }
  }, []);

  const handleMapVendor = async (invoiceId: number, vendorId: number) => {
    try {
      const res = await apiClient.post(`/invoices/${invoiceId}/map-vendor`, { vendor_id: vendorId });
      toast.success("Vendor and bank account mapped successfully.");
      fetchPayments();
      if (selectedPayment && selectedPayment.invoice_id === invoiceId) {
        setSelectedPayment(prev => prev ? {
          ...prev,
          vendor_account: `${res.data.bank_name || 'Bank'} ·••• ${res.data.bank_account_number ? res.data.bank_account_number.slice(-4) : ''} (IFSC: ${res.data.ifsc_code})`
        } : null);
      }
    } catch (err: any) {
      toast.error("Failed to map vendor: " + (err.response?.data?.detail || err.message));
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchVendors();
  }, [fetchPayments, fetchVendors]);

  const handleStartProcess = (payment: PaymentItem) => {
    setProcessingPayment(payment);
    setManualVendorForm({
      name: payment.vendor || "",
      bank_name: "",
      bank_account_number: "",
      ifsc_code: ""
    });
    setShowProcessModal(true);
  };

  const matchingVendors = useMemo(() => {
    if (!processingPayment || !vendors) return [];
    const searchName = processingPayment.vendor.toLowerCase();
    return vendors.filter(v => 
      v.name.toLowerCase().includes(searchName) || 
      searchName.includes(v.name.toLowerCase()) ||
      v.name.toLowerCase().split(" ").some((word: string) => word.length > 3 && searchName.includes(word))
    );
  }, [vendors, processingPayment]);

  const handleMatchAndProceed = async (vendorId: number) => {
    if (!processingPayment) return;
    try {
      await handleMapVendor(processingPayment.invoice_id, vendorId);
      setShowProcessModal(false);
      const updated = payments.find(p => p.id === processingPayment.id);
      if (updated) {
        setSelectedPayment({
          ...updated,
          vendor_account: vendors.find(v => v.id === vendorId) 
            ? `${vendors.find(v => v.id === vendorId).bank_name} ·••• ${vendors.find(v => v.id === vendorId).bank_account_number.slice(-4)}`
            : updated.vendor_account
        } as any);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAndMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processingPayment) return;
    try {
      setIsCreatingVendor(true);
      const newVendorRes = await apiClient.post("/vendors", {
        name: manualVendorForm.name,
        bank_name: manualVendorForm.bank_name,
        bank_account_number: manualVendorForm.bank_account_number,
        ifsc_code: manualVendorForm.ifsc_code
      });
      await fetchVendors();
      await handleMapVendor(processingPayment.invoice_id, newVendorRes.data.id);
      setShowProcessModal(false);
    } catch (err: any) {
      toast.error("Failed to create vendor: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsCreatingVendor(false);
    }
  };

  // Bulk Operations
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(payments.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const executeBulkAction = async (actionUrl: string, body: any, successMsg: string) => {
    if (isReadOnly) {
      toast.error("Auditor has read-only access. Actions are restricted.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.warning("No payments selected.");
      return;
    }
    try {
      await apiClient.post(actionUrl, { payment_ids: selectedIds, ...body });
      toast.success(successMsg);
      setSelectedIds([]);
      fetchPayments();
    } catch {
      toast.error("Action execution failed.");
    }
  };

  const handleBulkScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.scheduled_date) {
      toast.warning("Please choose a schedule date");
      return;
    }
    await executeBulkAction("/payments/bulk-schedule", scheduleForm, `Successfully scheduled ${selectedIds.length} payments`);
    setShowBulkScheduleModal(false);
  };

  const handleBulkChangeDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDateValue) return;
    await executeBulkAction("/payments/bulk-change-date", { new_date: newDateValue }, `Shifted payout date for ${selectedIds.length} items`);
    setShowBulkDateModal(false);
  };

  const handleBulkAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssigneeValue) return;
    toast.success(`Assigned Finance User: ${newAssigneeValue} to ${selectedIds.length} items`);
    setSelectedIds([]);
    setShowBulkAssignModal(false);
    fetchPayments();
  };

  const handleBulkExport = () => {
    const selectedData = payments.filter((p) => selectedIds.includes(p.id));
    if (selectedData.length === 0) {
      toast.warning("No rows selected for export.");
      return;
    }
    const blob = new Blob([JSON.stringify(selectedData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-batch-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    toast.success(`Exported ${selectedData.length} records to JSON`);
  };

  const handleManualExecute = async (paymentId: number) => {
    if (isReadOnly) {
      toast.error("Auditors cannot trigger manual payouts.");
      return;
    }
    toast.info("Initializing gateway secure transaction...");
    try {
      const res = await apiClient.post(`/payments/${paymentId}/execute`);
      
      if (res.data.checkout_required) {
        
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => {
          const options: any = {
            key: res.data.key_id,
            amount: res.data.amount,
            currency: res.data.currency,
            name: "AutoFlow AP Payout",
            description: res.data.description,
            handler: async (response: any) => {
              toast.info("Payment authorized by gateway. Verifying transaction...");
              try {
                const verifyRes = await apiClient.post(`/payments/${paymentId}/verify-gateway-payment`, {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id || null,
                  razorpay_signature: response.razorpay_signature || null
                });
                toast.success(`Success! Ref: ${verifyRes.data.transaction_reference}`);
                fetchPayments();
                if (selectedPayment?.id === paymentId) {
                  setSelectedPayment(null);
                }
              } catch (err: any) {
                toast.error("Payment verification failed.");
              }
            },
            prefill: {
              name: "Approver",
              email: "approver@company.com"
            },
            theme: {
              color: "#EC4899"
            }
          };
          if (res.data.order_id) {
            options.order_id = res.data.order_id;
          }
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        };
        document.body.appendChild(script);
        return;
      }

      toast.success(`Success! Ref: ${res.data.transaction_reference}`);
      fetchPayments();
      if (selectedPayment?.id === paymentId) {
        setSelectedPayment(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Execution failed.");
    }
  };

  // Calendar timeline calculations
  const calendarDays = useMemo(() => {
    const start = new Date();
    const days = [];
    let startOffset = 0;
    let limit = 30;
    if (calendarViewMode === "month") {
      startOffset = -5;
      limit = 30;
    } else if (calendarViewMode === "week") {
      startOffset = -2;
      limit = 7;
    } else if (calendarViewMode === "day") {
      startOffset = 0;
      limit = 1;
    }
    for (let i = startOffset; i < startOffset + limit; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [calendarViewMode]);

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText || !selectedPayment) return;
    try {
      toast.success("Comment logged successfully");
      selectedPayment.comments.push(commentText);
      setCommentText("");
    } catch {
      toast.error("Failed to add comment");
    }
  };

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-10 h-10 border-4 border-zinc-200 border-t-zinc-950 rounded-full animate-spin"></div>
        <p className="text-xs text-zinc-400">Loading AP Payment Queue Console...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center border border-rose-100 dark:border-rose-900">
          <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-150">Access Restriction Gated</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-550 max-w-sm text-center">
          Your account profile does not possess necessary clearance roles to view AP Payment Queue dashboards.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-zinc-950 dark:text-white font-sans max-w-7xl mx-auto w-full animate-fade-in pb-12">
      {/* SECTION HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Payment Queue</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-normal uppercase tracking-wider">
            Enterprise AP Liquidity Management Console
          </p>
        </div>
        {/* VIEW TAB SELECTOR */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-700/80">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "list"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
            }`}
          >
            Queue List
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "calendar"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
            }`}
          >
            Payments Calendar
          </button>
        </div>
      </div>

      {/* DASHBOARD STATS WIDGETS */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          {
            label: "Awaiting Schedule",
            value: stats.awaitingSchedulingCount,
            color: "text-white dark:text-white",
            bg: "bg-fw-amber dark:bg-fw-amber-dark border-transparent shadow-sm",
          },
          {
            label: "Scheduled Today",
            value: stats.scheduledTodayCount,
            color: "text-white dark:text-white",
            bg: "bg-fw-blue dark:bg-fw-blue-dark border-transparent shadow-sm",
          },
          {
            label: "Payments Today",
            value: stats.paymentsTodayCount,
            color: "text-white dark:text-white",
            bg: "bg-fw-green dark:bg-fw-green-dark border-transparent shadow-sm",
          },
          {
            label: "Overdue",
            value: stats.overdueCount,
            color: "text-white dark:text-white",
            bg: "bg-fw-pink dark:bg-fw-pink-dark border-transparent shadow-sm",
          },
          {
            label: "Failed",
            value: stats.failedPaymentsCount,
            color: "text-white dark:text-white",
            bg: "bg-fw-red dark:bg-fw-red-dark border-transparent shadow-sm",
          },
          {
            label: "Total Pending Value",
            value: `₹${formatIndianCurrency(stats.totalPaymentValue)}`,
            color: "text-zinc-800 dark:text-zinc-200",
            bg: "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
          },
        ].map((s, idx) => (
          <div key={idx} className={`${s.bg} border rounded-3xl p-4 shadow-sm flex flex-col justify-between min-h-[90px]`}>
            <span className={`${s.color} opacity-80 text-[10px] uppercase tracking-widest font-black leading-tight`}>{s.label}</span>
            <span className={`text-base md:text-lg font-black tracking-tight mt-2 ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {activeTab === "list" ? (
        <div className="space-y-4">
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 gap-3 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search vendor, invoice..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-72 bg-zinc-550 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-xs text-zinc-900 dark:text-white outline-none"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-3 text-xs font-bold text-zinc-900 dark:text-white outline-none"
              >
                <option value="">All Statuses</option>
                <option value="Awaiting Scheduling">Awaiting Scheduling</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Processing">Processing</option>
                <option value="Completed">Completed</option>
                <option value="Failed">Failed</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-3 text-xs font-bold text-zinc-900 dark:text-white outline-none"
              >
                <option value="">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            {/* BULK ACTIONS TOOLBAR */}
            {selectedIds.length > 0 && (
              <div className="flex gap-2 w-full md:w-auto overflow-x-auto py-1 hide-scrollbar">
                <button
                  type="button"
                  onClick={() => setShowBulkScheduleModal(true)}
                  className="px-3 py-2 bg-[#39E35D] hover:bg-[#2fc44e] text-zinc-950 rounded-xl text-xs font-black uppercase tracking-wider shrink-0"
                >
                  Bulk Schedule
                </button>
                <button
                  type="button"
                  onClick={() => executeBulkAction("/payments/bulk-hold", {}, "Placed hold on selected payouts")}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shrink-0"
                >
                  Hold
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkAssignModal(true)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shrink-0"
                >
                  Assign User
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkDateModal(true)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shrink-0"
                >
                  Shift Date
                </button>
                <button
                  type="button"
                  onClick={() => executeBulkAction("/payments/bulk-cancel", {}, "Cancelled selected payment schedules")}
                  className="px-3 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkExport}
                  className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-770 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-black uppercase tracking-wider shrink-0"
                >
                  Export Selected
                </button>
              </div>
            )}
          </div>

          {/* MAIN DATATABLE */}
          {loading ? (
            <div className="text-xs text-zinc-400 py-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm">
              Loading payment queue...
            </div>
          ) : payments.length === 0 ? (
            <div className="text-xs text-zinc-400 py-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm">
              No payments awaiting action found matching criteria.
            </div>
          ) : (
            <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm bg-white dark:bg-zinc-900 w-full">
              <table className="min-w-full border-separate border-spacing-y-0 text-xs">
                <thead>
                  <tr className="text-white text-[10px] font-black uppercase tracking-wider border-none">
                    <th className="rounded-l-2xl px-4 py-3.5 text-left w-10 bg-[#EC4899] text-white">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === payments.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3.5 text-left font-black uppercase tracking-wider bg-[#EC4899] text-white">Invoice #</th>
                    <th className="px-4 py-3.5 text-left font-black uppercase tracking-wider bg-[#EC4899] text-white">Vendor</th>
                    <th className="px-4 py-3.5 text-left font-black uppercase tracking-wider bg-[#EC4899] text-white">Due Date</th>
                    <th className="px-4 py-3.5 text-left font-black uppercase tracking-wider bg-[#EC4899] text-white">Schedule Date</th>
                    <th className="px-4 py-3.5 text-left font-black uppercase tracking-wider bg-[#EC4899] text-white">Amount</th>
                    <th className="px-4 py-3.5 text-left font-black uppercase tracking-wider bg-[#EC4899] text-white">Status</th>
                    <th className="px-4 py-3.5 text-left font-black uppercase tracking-wider bg-[#EC4899] text-white">SLA Status</th>
                    <th className="px-4 py-3.5 text-left font-black uppercase tracking-wider bg-[#EC4899] text-white">Priority</th>
                    <th className="px-4 py-3.5 text-left font-black uppercase tracking-wider bg-[#EC4899] text-white">Risk</th>
                    <th className="rounded-r-2xl px-4 py-3.5 text-left font-black uppercase tracking-wider bg-[#EC4899] text-white">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPayment(p)}
                      className="hover:bg-zinc-50/40 dark:hover:bg-zinc-800/10 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={() => handleToggleSelect(p.id)}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">{p.invoice_number}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-zinc-800 dark:text-zinc-100">{p.vendor}</div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-550">{p.vendor_account}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-medium">{p.due_date}</td>
                      <td className="px-4 py-3 text-zinc-650 dark:text-zinc-350">{p.scheduled_date || "—"}</td>
                      <td className="px-4 py-3 font-black text-zinc-900 dark:text-zinc-100">
                        {p.currency} {formatIndianCurrency(p.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={p.status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={p.sla_status} />
                      </td>
                      <td className="px-4 py-3 font-bold">{p.priority}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            p.risk_level === "High"
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                          }`}
                        >
                          {p.risk_level}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {p.status !== "Completed" ? (
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => handleStartProcess(p)}
                            className="px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-black uppercase text-[10px] tracking-wider transition-all disabled:opacity-50"
                          >
                            Process
                          </button>
                        ) : (
                          <span className="text-zinc-400">Paid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
          {/* CALENDAR TIMELINE VIEW */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-850">Scheduled Payout Calendar</h3>
              <p className="text-[10px] text-zinc-500 font-normal mt-0.5">Timeline layout of upcoming corporate payouts and liquidity runs.</p>
            </div>
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
              {["month", "week", "day"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCalendarViewMode(mode as any)}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    calendarViewMode === mode ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" : "text-zinc-500"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 h-[420px] overflow-y-auto pr-1 hide-scrollbar">
            {calendarDays.map((day, idx) => {
              const formattedDate = day.toISOString().split("T")[0];
              const dayPayments = payments.filter((p) => p.scheduled_date === formattedDate);
              return (
                <div
                  key={idx}
                  className={`p-3.5 border rounded-2xl flex flex-col justify-between min-h-[120px] transition-all bg-zinc-50/20 dark:bg-[#000000]/60 hover:border-zinc-300 dark:hover:border-zinc-700 ${
                    day.toDateString() === new Date().toDateString() ? "border-rose-500 dark:border-rose-500" : "border-zinc-200 dark:border-zinc-800/80"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                      {day.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                    </span>
                    {day.toDateString() === new Date().toDateString() && (
                      <span className="text-[8px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase">Today</span>
                    )}
                  </div>
                  <div className="mt-2.5 space-y-1.5 flex-1">
                    {dayPayments.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPayment(p)}
                        className="p-1 px-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg text-[10px] font-bold cursor-pointer truncate text-rose-500 flex justify-between items-center"
                      >
                        <span className="truncate">{p.vendor}</span>
                        <span className="font-black">₹{formatIndianCurrency(p.amount)}</span>
                      </div>
                    ))}
                    {dayPayments.length > 3 && <span className="text-[9px] text-zinc-400 font-bold block">+{dayPayments.length - 3} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TIMELINE & COMMENTS DETAILS DRAWER */}
      <Drawer
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        title={selectedPayment ? `Invoice: ${selectedPayment.invoice_number}` : ""}
        subtitle={selectedPayment ? selectedPayment.vendor : ""}
        status={selectedPayment ? selectedPayment.status : ""}
        footer={
          selectedPayment ? (
            <div className="w-full">
              {selectedPayment.status !== "Completed" ? (
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => handleManualExecute(selectedPayment.id)}
                  className="w-full py-3 bg-[#EC4899] hover:bg-[#db3f88] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-md"
                >
                  Execute Payment
                </button>
              ) : (
                <span className="block text-center font-bold text-emerald-500 uppercase tracking-widest">Transaction fully Reconciled &amp; Paid</span>
              )}
            </div>
          ) : null
        }
      >
        {selectedPayment && (
          <div className="space-y-6">
            <div>
              <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 rounded-md text-[9px] font-black uppercase tracking-wider">
                {selectedPayment.priority} Priority
              </span>
            </div>
            {/* Timelines Tracker */}
            <div className="p-4 bg-zinc-550 dark:bg-zinc-800/40 border border-zinc-150 dark:border-zinc-800/80 rounded-[18px] space-y-3 font-semibold text-xs">
              <h4 className="text-[10px] text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-black leading-none">Workflow Audit timelines</h4>
              <div className="space-y-2.5 pt-2">
                <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
                  <span className="text-zinc-500 font-normal">Extraction Date</span>
                  <span className="text-zinc-800 dark:text-zinc-200">{selectedPayment.created_date}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
                  <span className="text-zinc-500 font-normal">Approver Authorized Date</span>
                  <span className="text-zinc-800 dark:text-zinc-200">{selectedPayment.approval_date}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
                  <span className="text-zinc-500 font-normal">Assigned Finance User</span>
                  <span className="text-zinc-850 dark:text-zinc-150">{selectedPayment.assigned_user}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
                  <span className="text-zinc-500 font-normal">Gateway Channel</span>
                  <span className="text-zinc-850 dark:text-zinc-150">{selectedPayment.gateway_name}</span>
                </div>
                <div className="flex justify-between py-1 last:border-0">
                  <span className="text-zinc-500 font-normal">ERP Sync Ref</span>
                  <span className="text-emerald-500 font-mono text-[10px]">Synced ({selectedPayment.erp_status})</span>
                </div>
              </div>
            </div>

            {/* Destination Bank Details & Mapping */}
            <div className="p-4 bg-zinc-550 dark:bg-zinc-800/40 border border-zinc-150 dark:border-zinc-800/80 rounded-[18px] space-y-3 font-semibold text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
                <h4 className="text-[10px] text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-black leading-none">Destination Bank Details</h4>
                {selectedPayment.vendor_account === "No Bank Details Mapped" ? (
                  <span className="text-[9px] bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-450 px-2 py-0.5 rounded font-black uppercase">
                    ⚠ Unmapped
                  </span>
                ) : (
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded font-black uppercase">
                    ✓ Mapped
                  </span>
                )}
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-normal">Account Destination</span>
                  <span className="text-zinc-850 dark:text-zinc-150 font-mono">{selectedPayment.vendor_account}</span>
                </div>
                
                {/* Approver Vendor mapping selector — only shown if no details are mapped */}
                {!isReadOnly && selectedPayment.vendor_account === "No Bank Details Mapped" && (
                  <div className="pt-3 border-t border-zinc-150 dark:border-zinc-800/80 space-y-2">
                    <label htmlFor="payout-vendor-select" className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                      Map/Update Vendor bank details
                    </label>
                    <select
                      id="payout-vendor-select"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          handleMapVendor(selectedPayment.invoice_id, parseInt(val));
                        }
                      }}
                      defaultValue=""
                      className="w-full px-3 py-2.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none dark:text-white"
                    >
                      <option value="" disabled>-- Select a Vendor to map to this payment --</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.bank_name || "Unknown Bank"} - •••• {v.bank_account_number?.slice(-4)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Comments log */}
            <div className="space-y-3">
              <h4 className="text-[10px] text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-black">Timeline Events &amp; Comments</h4>
              <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 hide-scrollbar">
                {selectedPayment.comments.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 font-normal">No commentary logged for this payout batch.</p>
                ) : (
                  selectedPayment.comments.map((c, i) => (
                    <div key={i} className="p-2 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/80">
                      <p className="text-[10px] text-zinc-750 dark:text-zinc-350 font-normal leading-normal">{c}</p>
                      <span className="text-[8px] text-zinc-400 font-normal block text-right mt-1">— logged recently</span>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={addComment} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Log comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none"
                />
                <button type="submit" className="px-3.5 py-2 bg-zinc-900 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white rounded-xl text-xs font-bold transition-all">
                  Send
                </button>
              </form>
            </div>
          </div>
        )}
      </Drawer>

      {/* MODALS */}
      {/* 1. BULK SCHEDULE MODAL */}
      {showBulkScheduleModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-[#000000]/60 backdrop-blur-[2px] ">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm mx-4 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-850 dark:text-zinc-150">Bulk Schedule Payments</h3>
            <form onSubmit={handleBulkScheduleSubmit} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Scheduled Date *</label>
                <input
                  required
                  type="date"
                  value={scheduleForm.scheduled_date}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Payment Method</label>
                <select
                  value={scheduleForm.payment_method}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, payment_method: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white outline-none"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="IMPS">IMPS</option>
                  <option value="UPI">UPI</option>
                  <option value="ACH">ACH</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Priority</label>
                  <select
                    value={scheduleForm.priority}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, priority: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Gateway API</label>
                  <select
                    value={scheduleForm.gateway_name}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, gateway_name: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white outline-none"
                  >
                    <option value="Razorpay">Razorpay</option>
                    <option value="Stripe">Stripe</option>
                    <option value="Wise">Wise</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-150 dark:border-zinc-800/80">
                <button type="button" onClick={() => setShowBulkScheduleModal(false)} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-750 dark:text-zinc-300 rounded-xl hover:bg-zinc-200">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#EC4899] hover:bg-[#db3f88] text-white rounded-xl shadow-md">
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CHANGE DATE MODAL */}
      {showBulkDateModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-[#000000]/60 backdrop-blur-[2px] ">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm mx-4 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-850">Shift Payout Scheduled Date</h3>
            <form onSubmit={handleBulkChangeDate} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">New Scheduled Payout Date *</label>
                <input
                  required
                  type="date"
                  value={newDateValue}
                  onChange={(e) => setNewDateValue(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white outline-none"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-150 dark:border-zinc-800/85">
                <button type="button" onClick={() => setShowBulkDateModal(false)} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-750 dark:text-zinc-300 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#EC4899] hover:bg-[#db3f88] text-white rounded-xl">
                  Update Date
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ASSIGN USER MODAL */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-[#000000]/60 backdrop-blur-[2px] ">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm mx-4 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-850">Assign Finance User</h3>
            <form onSubmit={handleBulkAssignUser} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Finance Controller Username *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. John Admin"
                  value={newAssigneeValue}
                  onChange={(e) => setNewAssigneeValue(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-white outline-none"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-150 dark:border-zinc-800/85">
                <button type="button" onClick={() => setShowBulkAssignModal(false)} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-750 dark:text-zinc-300 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#EC4899] hover:bg-[#db3f88] text-white rounded-xl">
                  Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. PROCESS/VENDOR MAPPING MODAL */}
      {showProcessModal && processingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/65 backdrop-blur-[1px] p-4 font-sans">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6 text-zinc-900 dark:text-zinc-100 animate-fade-in">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Map Vendor for Payout</h3>
                <p className="text-[11px] text-zinc-450 dark:text-zinc-400 font-bold uppercase tracking-wider mt-1">
                  Invoice: {processingPayment.invoice_number} | Expected Vendor: {processingPayment.vendor}
                </p>
              </div>
              <button onClick={() => setShowProcessModal(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
              {/* Left Column: Search & Match Existing Vendor */}
              <div className="space-y-4 pr-0 md:pr-4">
                <h4 className="text-[10px] text-zinc-450 dark:text-zinc-400 uppercase tracking-widest font-black">Matching Seeded Vendors</h4>
                <p className="text-[10px] text-zinc-500 leading-normal font-semibold">
                  Fuzzy matches found in your verified corporate vendors list:
                </p>
                <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1 hide-scrollbar">
                  {matchingVendors.length === 0 ? (
                    <div className="py-6 text-center text-[10px] text-zinc-400 font-black bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 uppercase tracking-wider">
                      No matching vendors found in registry.
                    </div>
                  ) : (
                    matchingVendors.map((v) => (
                      <div 
                        key={v.id} 
                        className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                      >
                        <div className="text-left space-y-1">
                          <span className="font-extrabold text-xs block text-zinc-900 dark:text-white">{v.name}</span>
                          <span className="text-[10px] text-zinc-400 font-bold block">{v.bank_name}</span>
                          <span className="text-[9px] font-mono text-zinc-500 block">A/C: ••••{v.bank_account_number?.slice(-4)} | IFSC: {v.ifsc_code}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMatchAndProceed(v.id)}
                          className="px-2.5 py-1 bg-[#10b981] hover:bg-emerald-600 text-zinc-950 font-black uppercase text-[9px] tracking-wider rounded-lg shadow-sm"
                        >
                          Select
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Manually Create Vendor */}
              <div className="space-y-4 pl-0 md:pl-6 pt-6 md:pt-0">
                <h4 className="text-[10px] text-zinc-450 dark:text-zinc-400 uppercase tracking-widest font-black">Manually Create New Vendor</h4>
                <p className="text-[10px] text-zinc-500 leading-normal font-semibold">
                  If this is a new partner, create their banking profile to map the invoice automatically:
                </p>
                <form onSubmit={handleCreateAndMatch} className="space-y-3">
                  <div>
                    <label className="block text-[9px] text-zinc-400 uppercase tracking-widest mb-1 font-black" htmlFor="manual-vendor-name">Vendor Name *</label>
                    <input
                      id="manual-vendor-name"
                      required
                      type="text"
                      value={manualVendorForm.name}
                      onChange={(e) => setManualVendorForm({ ...manualVendorForm, name: e.target.value })}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-zinc-400 uppercase tracking-widest mb-1 font-black" htmlFor="manual-vendor-bank">Bank Name *</label>
                    <input
                      id="manual-vendor-bank"
                      required
                      type="text"
                      placeholder="e.g. ICICI Bank"
                      value={manualVendorForm.bank_name}
                      onChange={(e) => setManualVendorForm({ ...manualVendorForm, bank_name: e.target.value })}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[9px] text-zinc-400 uppercase tracking-widest mb-1 font-black" htmlFor="manual-vendor-account">Account Number *</label>
                      <input
                        id="manual-vendor-account"
                        required
                        type="text"
                        value={manualVendorForm.bank_account_number}
                        onChange={(e) => setManualVendorForm({ ...manualVendorForm, bank_account_number: e.target.value })}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-400 uppercase tracking-widest mb-1 font-black" htmlFor="manual-vendor-ifsc">IFSC Code *</label>
                      <input
                        id="manual-vendor-ifsc"
                        required
                        type="text"
                        value={manualVendorForm.ifsc_code}
                        onChange={(e) => setManualVendorForm({ ...manualVendorForm, ifsc_code: e.target.value })}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isCreatingVendor}
                    className="w-full py-2.5 mt-2 bg-[#EC4899] hover:bg-[#db3f88] text-white font-black uppercase text-[10px] tracking-wider rounded-xl shadow-md transition-colors"
                  >
                    {isCreatingVendor ? "Creating & Mapping..." : "Create & Map Vendor"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Simulated Sandbox Payment Gateway Modal */}
      {simulatedPaymentData && (
        <div className="fixed inset-0 bg-[#000000]/60 backdrop-blur-[2px] z-[999] flex items-center justify-center p-4 font-sans">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[22px] p-7 max-w-md w-full shadow-2xl animate-scale-in relative mx-4 space-y-6 text-zinc-900 dark:text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-505 bg-amber-500 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  AutoFlow Sandbox Gateway
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSimulatedPaymentData(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-4">
              <div>
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-black">Payee / Vendor</span>
                <p className="text-sm font-bold text-zinc-850 dark:text-zinc-100">{simulatedPaymentData.name}</p>
              </div>
              <div>
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-black">Description</span>
                <p className="text-xs text-zinc-550 dark:text-zinc-450">{simulatedPaymentData.description}</p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-black">Payout Amount</span>
                <p className="text-base font-black text-[#EC4899]">
                  INR {(simulatedPaymentData.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={async () => {
                  const paymentId = simulatedPaymentData.payment_id;
                  setSimulatedPaymentData(null);
                  toast.info("Authorizing sandbox transaction...");
                  try {
                    const verifyRes = await apiClient.post(`/payments/${paymentId}/verify-gateway-payment`, {
                      razorpay_payment_id: `pay_sim_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                      razorpay_order_id: null,
                      razorpay_signature: null
                    });
                    toast.success(`Success! Ref: ${verifyRes.data.transaction_reference}`);
                    fetchPayments();
                    if (selectedPayment?.id === paymentId) {
                      setSelectedPayment(null);
                    }
                  } catch (err: any) {
                    toast.error("Payment verification failed.");
                  }
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl shadow-md transition-colors"
              >
                Simulate Successful Payment
              </button>
              <button
                onClick={() => {
                  setSimulatedPaymentData(null);
                  toast.error("Sandbox transaction declined by user.");
                }}
                className="w-full py-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 font-black uppercase text-[10px] tracking-wider rounded-xl transition-colors"
              >
                Decline Payout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
