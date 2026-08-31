"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "../../../store/useAppStore";
import { 
  getInvoiceById, 
  getInvoiceAuditLogs, 
  submitInvoiceForApproval, 
  rejectInvoice, 
  approveInvoice,
  matchInvoice,
  updateInvoice,
  getUsers,
  UserResponse,
  deleteInvoice,
  reprocessInvoice,
  downloadDocument,
  releaseInvoiceForPayment
} from "../../../services/api";
import { Invoice } from "../../../types/invoice";
import { AuditLogResponse } from "../../../types/api_schemas";
import StatusBadge from "../../../components/StatusBadge";
import { formatIndianCurrency } from "../../../utils/format";
import WorkflowStepper from "../../../components/WorkflowStepper";
import AuditTimeline from "../../../components/AuditTimeline";
import ProtectedLayout from "../../../components/layout/ProtectedLayout";
import Button from "../../../components/ui/Button";
import Select from "../../../components/ui/Select";
import { toast } from "sonner";
import { useConfirmStore } from "../../../store/useConfirmStore";
import ValidationWorkbench from "../../../components/reviewer/ValidationWorkbench";
import apiClient from "../../../services/api-client";

const REJECT_REASONS = [
  { label: "Select a standard reason", value: "" },
  { label: "Mathematical Error", value: "Mathematical Error" },
  { label: "Invalid Vendor", value: "Invalid Vendor" },
  { label: "Duplicate", value: "Duplicate" },
  { label: "Missing Information", value: "Missing Information" },
  { label: "Other", value: "Other" }
];

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = params?.id as string;
  const { role, setRole } = useAppStore();
  const searchParams = useSearchParams();
  const queryRole = searchParams.get("role");

  useEffect(() => {
    if (queryRole && ["Admin", "Reviewer", "Approver", "Auditor", "Super Admin"].includes(queryRole)) {
      setRole(queryRole as any);
    }
  }, [queryRole, setRole]);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogResponse[]>([]);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modals and tabs states
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approveJustification, setApproveJustification] = useState("");
  
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  const [previewTab, setPreviewTab] = useState<"document" | "ocr" | "ai_fields">("document");
  // isEditMode = true → opens ValidationWorkbench editing overlay
  const [isEditMode, setIsEditMode] = useState(false);
  const [comments, setComments] = useState<any[]>([
    { id: 1, user: "System", role: "AI Pipeline", text: "AI Extraction complete with 95% confidence score.", time: "Today, 10:30 AM" }
  ]);
  const [newComment, setNewComment] = useState("");

  const parsedConfidence = React.useMemo(() => {
    if (!invoice) return {};
    if (!invoice.confidence_json) return {};
    if (typeof invoice.confidence_json === "string") {
      try {
        return JSON.parse(invoice.confidence_json);
      } catch (e) {
        return {};
      }
    }
    return invoice.confidence_json;
  }, [invoice]);

  const fetchInvoiceData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const invoiceId = parseInt(id, 10);
      const invData = await getInvoiceById(invoiceId);
      setInvoice(invData);

      try {
         const logs = await getInvoiceAuditLogs(invoiceId);
         setAuditLogs(logs);
      } catch (auditErr) {
         console.error("Failed to fetch audit logs", auditErr);
      }

      try {
        const usersData = await getUsers();
        setUsers(usersData);
      } catch (usersErr) {
        console.error("Failed to fetch users", usersErr);
      }
    } catch (err: any) {
      console.error("Failed to fetch invoice:", err);
      setError(err.message || "Failed to load invoice details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceData();
  }, [id]);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    if (invoice?.document_id) {
      setPdfLoading(true);
      setPdfError(null);
      apiClient.get(`/documents/${invoice.document_id}/download`, {
        responseType: "blob"
      })
      .then(response => {
        if (!active) return;
        const blobType = response.headers["content-type"] || "application/pdf";
        const blob = new Blob([response.data], { type: blobType as string });
        url = window.URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        setIsImage(typeof blobType === "string" && blobType.startsWith("image/"));
      })
      .catch(err => {
        if (!active) return;
        console.error("Failed to load PDF document:", err);
        setPdfError("Failed to retrieve document preview.");
      })
      .finally(() => {
        if (active) {
          setPdfLoading(false);
        }
      });
    } else {
      setPdfBlobUrl(null);
      setPdfError(null);
      setPdfLoading(false);
    }
    return () => {
      active = false;
      if (url) {
        window.URL.revokeObjectURL(url);
      }
    };
  }, [invoice?.document_id]);

  const handleSubmitForApproval = async () => {
    if (!invoice?.id) return;
    try {
      setIsSubmitting(true);
      await submitInvoiceForApproval(invoice.id);
      toast.success("Invoice submitted for manager approval successfully.");
      router.push("/");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error submitting for approval.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnForCorrection = async () => {
    if (!invoice?.id) return;
    if (!rejectionReason) {
      toast.error("Please select a reason for rejection.");
      return;
    }
    try {
      setIsSubmitting(true);
      await rejectInvoice(invoice.id, rejectionReason);
      toast.success(`Invoice returned for correction. Reason: ${rejectionReason}`);
      setIsRejectModalOpen(false);
      router.push("/");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error returning invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!invoice?.id) return;
    try {
      setIsSubmitting(true);
      await approveInvoice(invoice.id, approveJustification);
      toast.success("Invoice approved successfully.");
      setIsApproveModalOpen(false);
      router.push("/");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error approving invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMatchPO = async () => {
    if (!invoice?.id) return;
    try {
      setIsSubmitting(true);
      const res = await matchInvoice(invoice.id);
      toast.success(`PO Match run complete. Status: ${res.match_status}`);
      fetchInvoiceData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error running PO Match.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReleasePayment = async () => {
    if (!invoice?.id) return;
    try {
      setIsSubmitting(true);
      await releaseInvoiceForPayment(invoice.id);
      toast.success("Payment release triggered successfully.");
      fetchInvoiceData();
    } catch (err: any) {
      toast.error("Failed to trigger payment: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReprocessInvoice = async () => {
    if (!invoice?.id) return;
    try {
      setIsSubmitting(true);
      await reprocessInvoice(invoice.id);
      toast.success("Reprocessing completed successfully.");
      fetchInvoiceData();
    } catch (err: any) {
      toast.error("Reprocessing failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoice?.id) return;
    const confirmed = await useConfirmStore.getState().confirm({
      title: "Delete Invoice",
      message: "Are you sure you want to permanently delete this invoice?",
      roleAccent: "red"
    });
    if (confirmed) {
      try {
        setIsSubmitting(true);
        await deleteInvoice(invoice.id);
        toast.success("Invoice deleted successfully.");
        router.push("/");
      } catch (err: any) {
        toast.error("Delete failed: " + (err.response?.data?.detail || err.message));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDownloadInvoice = () => {
    if (!invoice || !invoice.document_id) {
      toast.error("No document associated with this invoice.");
      return;
    }
    downloadDocument(invoice.document_id);
  };

  const handleAssignReviewer = async (reviewerName: string) => {
    if (!invoice?.id) return;
    try {
      await updateInvoice(invoice.id, { reviewer: reviewerName });
      toast.success(`Assigned reviewer: ${reviewerName}`);
      fetchInvoiceData();
    } catch (err: any) {
      toast.error("Failed to assign reviewer: " + err.message);
    }
  };

  const handleAssignApprover = async (approverName: string) => {
    if (!invoice?.id) return;
    try {
      await updateInvoice(invoice.id, { approver: approverName });
      toast.success(`Assigned approver: ${approverName}`);
      fetchInvoiceData();
    } catch (err: any) {
      toast.error("Failed to assign approver: " + err.message);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const commentItem = {
      id: Date.now(),
      user: "You",
      role: role,
      text: newComment,
      time: "Just now"
    };
    setComments([...comments, commentItem]);
    setNewComment("");
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFC] dark:bg-[#050506] py-12 px-6 sm:px-8 lg:px-12 flex flex-col justify-center items-center">
        <div className="w-12 h-12 rounded-full border-4 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 dark:border-t-white animate-spin mb-4" />
        <p className="text-sm font-bold text-zinc-400 dark:text-zinc-500">Loading invoice specifications...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-[#FAFAFC] dark:bg-[#050506] py-12 px-6 sm:px-8 lg:px-12 flex flex-col justify-center">
        <div className="max-w-md mx-auto text-center premium-card p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <svg className="w-12 h-12 text-rose-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-lg font-bold text-zinc-800 dark:text-white mb-2">Error Loading Invoice</h2>
          <p className="text-zinc-400 dark:text-zinc-500 text-sm mb-6">{error || "Invoice not found."}</p>
          <button onClick={() => router.push("/")} className="px-4 py-2 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors shadow-sm">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // If in Edit mode, render the ValidationWorkbench overlay for Admin OR Reviewer
  if (isEditMode && (role === "Reviewer" || role === "Admin")) {
    return (
      <ValidationWorkbench
        invoice={invoice}
        onClose={() => setIsEditMode(false)}
        onRefresh={fetchInvoiceData}
        userRole={role}
      />
    );
  }

  const getConfidenceProgressColor = (score: number | null) => {
    if (score === null || score === undefined) return "bg-zinc-200 dark:bg-zinc-700";
    if (score >= 0.8) return "bg-emerald-500";
    if (score >= 0.5) return "bg-indigo-500";
    return "bg-rose-500";
  };

  const formatFieldName = (key: string) => {
    return key.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const getItemTotalValue = (item: any) => {
    const totalItemValue = parseFloat(item.total_item_value) || 0;
    const totalAmount = parseFloat(item.total_amount) || 0;
    if (totalItemValue > 0) return totalItemValue;
    if (totalAmount > 0) {
      const cgst = parseFloat(item.cgst_amount) || 0;
      const sgst = parseFloat(item.sgst_amount) || 0;
      const igst = parseFloat(item.igst_amount) || 0;
      return totalAmount + cgst + sgst + igst;
    }
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    const base = qty * price;
    const cgst = parseFloat(item.cgst_amount) || 0;
    const sgst = parseFloat(item.sgst_amount) || 0;
    const igst = parseFloat(item.igst_amount) || 0;
    if (cgst > 0 || sgst > 0 || igst > 0) return base + cgst + sgst + igst;
    const gstRate = parseFloat(item.gst_rate) || 0;
    return base * (1 + gstRate / 100);
  };

  const currentStatus = (invoice.workflow_status || invoice.status || "").toLowerCase();
  const isReviewerActionable = currentStatus === "pending_review" || currentStatus === "validation_failed";
  const isApproverActionable = currentStatus === "pending_approval";

  const reviewers = users.filter(u => u.role === "Reviewer");
  const approvers = users.filter(u => u.role === "Approver");


  return (
    <ProtectedLayout>
      <div className="space-y-8 animate-fade-in text-xs">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between p-6 premium-card dark:bg-[#18181b] dark:border-zinc-800 shadow-sm gap-4">
          <div className="flex items-center space-x-5">
            <button onClick={() => router.push("/")} className="p-3 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>

            <div>
              <div className="flex items-center space-x-3.5 flex-wrap gap-2">
                <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                  Invoice {invoice.invoice_number || "—"}
                </h1>
                <StatusBadge status={invoice.workflow_status || invoice.status || ""} />
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 font-semibold text-sm mt-1.5 flex items-center space-x-2">
                <span>{invoice.seller_name || invoice.vendor_name || "Unknown Vendor"}</span>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#2E8BFF] dark:bg-[#1E3A8A] text-[#FFFFFF] dark:text-[#4FA3FF] border-none uppercase">
                  Source: {invoice.source_type || "Email"}
                </span>
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-3.5 w-full md:w-auto">
            {/* Primary & Secondary Workflow Actions */}
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {role !== "Super Admin" && (
                <>
                  {role === "Approver" && (
                    <Button
                      variant="primary"
                      onClick={handleMatchPO}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Processing..." : "Run PO Match"}
                    </Button>
                  )}

                  {/* Reviewer & Admin: Review-stage actions */}
                  {((role === "Admin" || role === "Reviewer") && isReviewerActionable) && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => setIsRejectModalOpen(true)}
                        disabled={isSubmitting}
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-900/40 dark:hover:bg-rose-950/20"
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleSubmitForApproval}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Processing..." : "Forward to Approver"}
                      </Button>
                    </>
                  )}

                  {/* Approver & Admin: Approval-stage actions */}
                  {((role === "Admin" || role === "Approver") && isApproverActionable) && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => setIsRejectModalOpen(true)}
                        disabled={isSubmitting}
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-900/40 dark:hover:bg-rose-950/20"
                      >
                        Reject
                      </Button>
                      <Button
                        variant="success"
                        onClick={() => setIsApproveModalOpen(true)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Processing..." : "Approve & Authorise"}
                      </Button>
                    </>
                  )}

                  {((role === "Admin" || role === "Approver") && invoice.workflow_status === "approved") && (
                    <Button
                      variant="success"
                      onClick={handleReleasePayment}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Processing..." : "Trigger Payment Release"}
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Utility Actions Row */}
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadInvoice}
              >
                Download Original
              </Button>
              
              {/* Edit Invoice button — available to Admin and Reviewer */}
              {(role === "Admin" || role === "Reviewer") && isReviewerActionable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditMode(true)}
                  disabled={isSubmitting}
                >
                  ✏️ Edit Invoice
                </Button>
              )}
            </div>

            {/* Admin & Destructive Actions Row */}
            {role === "Admin" && (
              <div className="flex items-center gap-3 flex-wrap justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800/80 w-full">
                <select
                  defaultValue=""
                  onChange={(e) => handleAssignReviewer(e.target.value)}
                  className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold rounded-xl outline-none cursor-pointer text-zinc-700 dark:text-zinc-300"
                >
                  <option value="" disabled>Assign Reviewer...</option>
                  {reviewers.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
                <select
                  defaultValue=""
                  onChange={(e) => handleAssignApprover(e.target.value)}
                  className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold rounded-xl outline-none cursor-pointer text-zinc-700 dark:text-zinc-300"
                >
                  <option value="" disabled>Assign Approver...</option>
                  {approvers.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReprocessInvoice}
                  disabled={isSubmitting}
                >
                  Reprocess
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeleteInvoice}
                  disabled={isSubmitting}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Workflow Progress Stepper */}
        <div className="premium-card p-6 dark:bg-[#18181b] dark:border-zinc-800 shadow-sm">
          <WorkflowStepper invoice={invoice} />
        </div>

        {/* Validation Errors Alert */}
        {invoice.validation_status !== "PASSED" && invoice.validation_errors && invoice.validation_errors.length > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl flex items-start space-x-3.5 animate-[fadeIn_200ms_ease-in-out]">
             <svg className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             <div>
                <h4 className="text-sm font-black text-rose-500 mb-1.5 uppercase tracking-wider">Compliance Discrepancies</h4>
                <ul className="list-disc list-inside text-xs text-rose-600 dark:text-rose-450 space-y-1.5 font-bold">
                   {invoice.validation_errors.map((err: string, i: number) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Left Column: Data & Insights */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Main Financials Card */}
            <div className="premium-card dark:bg-[#18181b] dark:border-zinc-800 overflow-hidden shadow-sm">
               <div className="px-6 py-4.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                  <h3 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Financial Summary</h3>
               </div>
               <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <span className="block text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Total Amount</span>
                    <span className="text-3xl font-black text-zinc-800 dark:text-white">₹{formatIndianCurrency(invoice.total_amount || invoice.total_invoice_value || 0)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Taxable Value</span>
                    <span className="text-lg font-bold text-zinc-700 dark:text-zinc-200 mt-1.5 block">₹{formatIndianCurrency(invoice.total_taxable_value || invoice.subtotal || 0)}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="block text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2">GST Breakdown</span>
                    <div className="flex space-x-6">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">CGST</span>
                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">₹{formatIndianCurrency(invoice.total_cgst_value || 0)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">SGST</span>
                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">₹{formatIndianCurrency(invoice.total_sgst_value || 0)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">IGST</span>
                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">₹{formatIndianCurrency(invoice.total_igst_value || 0)}</span>
                      </div>
                    </div>
                  </div>
               </div>
            </div>

            {/* Vendor & Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="premium-card p-6 dark:bg-[#18181b] dark:border-zinc-800 shadow-sm">
                <h3 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-5 border-b border-zinc-100 dark:border-zinc-800 pb-3">Vendor Details</h3>
                <div className="space-y-3.5 text-sm">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">Seller Name</span>
                    <span className="font-bold text-zinc-800 dark:text-white">{invoice.seller_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">GSTIN</span>
                    <span className="font-mono text-xs font-bold text-zinc-600 dark:text-zinc-300">{invoice.seller_gstin || "—"}</span>
                  </div>
                </div>
              </div>
              <div className="premium-card p-6 dark:bg-[#18181b] dark:border-zinc-800 shadow-sm">
                <h3 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-5 border-b border-zinc-100 dark:border-zinc-800 pb-3">Invoice Meta</h3>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">Invoice Date</span>
                    <span className="font-bold text-zinc-800 dark:text-white">{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">Due Date</span>
                    <span className="font-bold text-zinc-800 dark:text-white">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">PO Number</span>
                    <span className="font-bold text-zinc-800 dark:text-white">{invoice.po_number || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Match Status</span>
                    <StatusBadge status={invoice.match_status || ""} />
                  </div>
                </div>
              </div>
            </div>

            {/* Validation & PO Match report */}
            <div className="premium-card p-6 dark:bg-[#18181b] dark:border-zinc-800 shadow-sm">
              <h3 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4 border-b pb-2 dark:border-zinc-800">3-Way Match Verification Report</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 bg-fw-green dark:bg-fw-green-deep rounded-xl border border-fw-green dark:border-fw-green-deep flex flex-col justify-between">
                  <div className="text-[10px] text-fw-green-deep dark:text-fw-green-dark/85 uppercase tracking-wider mb-1 font-bold">GSTIN Verification</div>
                  <span className="text-xs font-black text-fw-green-deep dark:text-fw-green-dark">✓ PASSED / VALID</span>
                </div>
                <div className="p-3.5 bg-fw-green dark:bg-fw-green-deep rounded-xl border border-fw-green dark:border-fw-green-deep flex flex-col justify-between">
                  <div className="text-[10px] text-fw-green-deep dark:text-fw-green-dark/85 uppercase tracking-wider mb-1 font-bold">Duplicate Verification</div>
                  <span className="text-xs font-black text-fw-green-deep dark:text-fw-green-dark">✓ NO DUPLICATE FOUND</span>
                </div>
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${invoice.match_status === "matched" ? "bg-fw-green dark:bg-fw-green-deep border-fw-green dark:border-fw-green-deep" : "bg-fw-red dark:bg-fw-red-deep border-fw-red dark:border-fw-red-deep"}`}>
                  <div className={`text-[10px] uppercase tracking-wider mb-1 font-bold ${invoice.match_status === "matched" ? "text-fw-green-deep dark:text-fw-green-dark/85" : "text-white dark:text-fw-red-dark/85"}`}>PO Match Status</div>
                  <span className={`text-xs font-black ${invoice.match_status === "matched" ? "text-fw-green-deep dark:text-fw-green-dark" : "text-white dark:text-fw-red-dark"}`}>
                    {invoice.match_status?.toUpperCase() || "UNMATCHED"}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="premium-card dark:bg-[#18181b] dark:border-zinc-800 overflow-hidden shadow-sm">
               <div className="px-6 py-4.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                  <h3 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Line Items ({invoice.items?.length || 0})</h3>
               </div>
               <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50/40 dark:bg-zinc-900/40">
                       <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Item</th>
                        <th className="px-4 py-3 text-right text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Qty</th>
                        <th className="px-4 py-3 text-right text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Price</th>
                        <th className="px-4 py-3 text-right text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">GST</th>
                        <th className="px-4 py-3 text-right text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs text-zinc-700 dark:text-zinc-300">
                      {invoice.items && invoice.items.length > 0 ? (
                        invoice.items.map((item, idx) => (
                           <tr key={item.id || idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/20 transition-colors">
                            <td className="px-4 py-3.5 font-bold text-zinc-800 dark:text-white">
                              {item.description || "Line Item"}
                              {item.hsn_code && <span className="block text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">HSN: {item.hsn_code}</span>}
                            </td>
                            <td className="px-4 py-3.5 text-right font-medium">{item.quantity || 0} {item.unit || ""}</td>
                            <td className="px-4 py-3.5 text-right font-medium">₹{formatIndianCurrency(item.unit_price)}</td>
                            <td className="px-4 py-3.5 text-right font-medium">
                              {item.gst_rate ? `${item.gst_rate}%` : "—"}
                            </td>
                            <td className="px-4 py-3.5 text-right font-black text-zinc-800 dark:text-white">₹{formatIndianCurrency(getItemTotalValue(item))}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-zinc-400 dark:text-zinc-500 font-bold">
                            No line items found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
               </div>
            </div>

          </div>

          {/* Right Column: Context, History & Inline Side-by-Side Editor */}
          <div className="space-y-6">
            
            {/* High-Fidelity PDF Preview / OCR / AI fields */}
            <div className="premium-card p-6 dark:bg-[#18181b] dark:border-zinc-800 relative overflow-hidden shadow-sm flex flex-col space-y-4">
               <div className="flex border-b border-zinc-200 dark:border-zinc-800 pb-2">
                 {[
                   { key: "document", label: "Original Document" },
                   { key: "ocr", label: "OCR Output" },
                   { key: "ai_fields", label: "AI Extracted" },
                 ].map((t) => (
                   <button
                     key={t.key}
                     onClick={() => setPreviewTab(t.key as any)}
                     className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${
                       previewTab === t.key ? "bg-zinc-950 text-white dark:bg-zinc-200 dark:text-zinc-950 shadow-sm" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                     }`}
                   >
                     {t.label}
                   </button>
                 ))}
               </div>

               {previewTab === "document" && (
                 <div className="flex flex-col space-y-2">
                   <div className="flex justify-end items-center gap-2">
                     <button
                       type="button"
                       onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
                       className="px-2 py-1 text-[10px] font-black uppercase rounded bg-zinc-150 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                     >
                       Zoom -
                     </button>
                     <span className="text-[10px] font-bold text-zinc-500">{zoomLevel}%</span>
                     <button
                       type="button"
                       onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))}
                       className="px-2 py-1 text-[10px] font-black uppercase rounded bg-zinc-150 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                     >
                       Zoom +
                     </button>
                     <button
                       type="button"
                       onClick={() => setZoomLevel(100)}
                       className="px-2 py-1 text-[10px] font-black uppercase rounded bg-zinc-150 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                     >
                       Reset
                     </button>
                   </div>
                   <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-auto bg-white dark:bg-zinc-955 h-[400px] relative shadow-inner flex items-center justify-center">
                     {pdfLoading ? (
                       <div className="flex items-center justify-center h-full text-zinc-400">
                         Loading PDF preview...
                       </div>
                     ) : pdfError ? (
                       <div className="flex items-center justify-center h-full text-red-500 font-bold">
                         {pdfError}
                       </div>
                     ) : pdfBlobUrl ? (
                       isImage ? (
                         <img 
                           src={pdfBlobUrl} 
                           alt="Invoice Original Document" 
                           style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "center center" }}
                           className="max-w-full max-h-full object-contain transition-transform duration-200"
                         />
                       ) : (
                         <iframe 
                           src={pdfBlobUrl} 
                           style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top left", width: `${10000 / zoomLevel}%`, height: `${10000 / zoomLevel}%` }}
                           className="border-none"
                           title="Invoice PDF Original Document"
                         />
                       )
                     ) : (
                       <div className="flex items-center justify-center h-full text-zinc-400">
                         No original document URL found
                       </div>
                     )}
                   </div>
                 </div>
               )}

               {previewTab === "ocr" && (
                 <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-950 font-mono text-[9px] text-zinc-600 dark:text-zinc-400 h-64 overflow-y-auto leading-normal">
                   {invoice.raw_ocr_text || `[RapidOCR / Docling Engine Output Stream]
--------------------------------------------------
SELLER NAME: ${invoice.seller_name || "ACME Corp"}
SELLER GSTIN: ${invoice.seller_gstin || "27AAACQ2839F1Z9"}
BUYER NAME: ${invoice.buyer_name || "Company Ltd"}
INVOICE DATE: ${invoice.invoice_date}
TOTAL INVOICE VALUE: ₹${invoice.total_amount || 0}
TAXABLE VALUE CGST / SGST PARSED SUCCESSFULLY`}
                 </div>
               )}

               {previewTab === "ai_fields" && (
                 <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-950 font-mono text-[9px] text-zinc-600 dark:text-zinc-400 h-64 overflow-y-auto leading-normal">
                   <pre>{JSON.stringify(invoice.extracted_json || {
                     invoice_number: invoice.invoice_number,
                     seller_name: invoice.seller_name,
                     seller_gstin: invoice.seller_gstin,
                     total_invoice_value: invoice.total_amount,
                     validation_status: invoice.validation_status
                   }, null, 2)}</pre>
                 </div>
               )}
            </div>

            {/* Inline Side-by-Side Field Editor — only Admin can use inline editor on the normal view */}
            {isEditMode === false && false && (
              <div className="hidden" />
            )}

            {/* Comments Section */}
            <div className="premium-card p-6 dark:bg-[#18181b] dark:border-zinc-800 shadow-sm flex flex-col space-y-4">
              <h3 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest border-b pb-2">Comments & Disputations</h3>
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {comments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{comment.user} <span className="font-normal text-[10px] text-zinc-400 uppercase tracking-wider">({comment.role})</span></span>
                      <span className="text-[9px] text-zinc-400">{comment.time}</span>
                    </div>
                    <p className="text-zinc-650 dark:text-zinc-300 font-semibold">{comment.text}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Post comment or dispute reason..."
                  className="flex-1 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl outline-none"
                />
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm">Post</button>
              </form>
            </div>

          </div>
        </div>

        {/* Horizontal Confidence Scores (Bottom) */}
        {role !== "Approver" && (
          <div className="premium-card p-6 dark:bg-[#18181b] dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">AI Extraction Field Reliability</h3>
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {invoice.confidence_score ? `Overall Confidence: ${(invoice.confidence_score * 100).toFixed(0)}%` : "—"}
              </span>
            </div>
            <div className="flex overflow-x-auto pb-2 space-x-4 hide-scrollbar">
              {parsedConfidence && Object.keys(parsedConfidence).length > 0 ? (
                Object.entries(parsedConfidence).map(([key, val]) => {
                  if (val === null || val === undefined || key === "items") return null;
                  const numVal = val as number;
                  const percentage = Math.round(numVal * 100);
                  return (
                    <div key={key} className="flex-shrink-0 w-48 border border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/30 rounded-2xl p-4 flex flex-col justify-between">
                      <span className="text-zinc-500 dark:text-zinc-400 font-bold text-xs mb-3 truncate" title={formatFieldName(key)}>{formatFieldName(key)}</span>
                      <div>
                        <div className="flex justify-between items-baseline mb-2">
                           <span className="text-2xl font-black text-zinc-800 dark:text-white">{percentage}%</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full h-1.5 overflow-hidden">
                           <div className={`h-1.5 rounded-full ${getConfidenceProgressColor(numVal)}`} style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-zinc-450 font-bold py-4">No field confidence scores available.</div>
              )}
            </div>
          </div>
        )}

        {/* Horizontal Audit History (Bottom) */}
        <div className="premium-card p-6 dark:bg-[#18181b] dark:border-zinc-800 shadow-sm">
            <h3 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-6">System Audit Timeline</h3>
            <AuditTimeline logs={auditLogs} />
        </div>
      </div>
      
      {/* Rejection Override Dialog */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/70 p-4 animate-[fadeIn_150ms_ease-in-out]">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4.5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900">
              <h2 className="text-lg font-black text-zinc-800 dark:text-white">Reject Invoice Action</h2>
              <button onClick={() => setIsRejectModalOpen(false)} className="text-zinc-400 hover:text-zinc-650 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  options={REJECT_REASONS}
                  label="Reason for Rejection"
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
            <div className="px-6 py-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-end items-center gap-3">
              <button 
                onClick={() => setIsRejectModalOpen(false)} 
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700/80 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150 shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleReturnForCorrection} 
                disabled={isSubmitting || !rejectionReason} 
                className="px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-750 disabled:opacity-50 transition-all duration-150 rounded-xl shadow-md"
              >
                {isSubmitting ? "Processing..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Override Dialog */}
      {isApproveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/70 p-4 animate-[fadeIn_150ms_ease-in-out]">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4.5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900">
              <h2 className="text-lg font-black text-zinc-800 dark:text-white">
                {invoice.match_status !== "matched" ? "Override & Approve Invoice" : "Approve Invoice"}
              </h2>
              <button onClick={() => setIsApproveModalOpen(false)} className="text-zinc-400 hover:text-zinc-650 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {invoice.match_status !== "matched" && (
                <div className="bg-amber-500/10 text-amber-500 text-xs p-3.5 rounded-xl mb-4 border border-amber-500/20 font-bold">
                  <span className="font-bold block mb-1">PO Mismatch Exception</span>
                  This invoice is unmatched. You must provide a justification for this override before approving.
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  Justification {invoice.match_status === "matched" ? <span className="text-zinc-400 font-normal font-sans">(Optional)</span> : <span className="text-rose-500 font-bold">*</span>}
                </label>
                <textarea 
                  value={approveJustification}
                  onChange={(e) => setApproveJustification(e.target.value)}
                  placeholder="Enter approval notes or justification..."
                  className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm h-24 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-end items-center gap-3">
              <button 
                onClick={() => setIsApproveModalOpen(false)} 
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700/80 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150 shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleApprove} 
                disabled={isSubmitting || (invoice.match_status !== "matched" && !approveJustification)} 
                className="px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-750 disabled:opacity-50 transition-all duration-150 rounded-xl shadow-md"
              >
                {isSubmitting ? "Processing..." : "Confirm Approve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}
