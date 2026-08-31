"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import apiClient from "../../services/api-client";
import { Invoice } from "../../types/invoice";
import StatusPill from "../ui/StatusPill";
import WorkflowStepper from "../WorkflowStepper";
import { formatIndianCurrency } from "../../utils/format";
import vendorService, { Vendor } from "../../services/vendor.service";

type WorkbenchProps = {
  invoice: Invoice;
  onClose: () => void;
  onRefresh: () => void;
  userRole: string;
};

export default function ValidationWorkbench({
  invoice,
  onClose,
  onRefresh,
  userRole,
}: WorkbenchProps) {
  // Admin is fully editable; Auditor is read-only; Reviewer is editable
  const isReadOnly = userRole === "Auditor";
  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Field Overrides & Edits
  const [fields, setFields] = useState<Record<string, any>>({
    seller_name: invoice.seller_name || "",
    invoice_number: invoice.invoice_number || "",
    seller_gstin: invoice.seller_gstin || "",
    buyer_gstin: invoice.buyer_gstin || "",
    invoice_date: invoice.invoice_date ? String(invoice.invoice_date).split("T")[0] : "",
    po_number: invoice.po_number || "",
    total_taxable_value: invoice.total_taxable_value || 0.0,
    total_cgst_value: invoice.total_cgst_value || 0.0,
    total_sgst_value: invoice.total_sgst_value || 0.0,
    total_igst_value: invoice.total_igst_value || 0.0,
    total_invoice_value: invoice.total_invoice_value || 0.0,
    currency: invoice.currency || "INR",
    bank_account_number: invoice.bank_account_number || "",
    ifsc_code: invoice.ifsc_code || "",
    bank_name: invoice.bank_name || "",
  });
  const [items, setItems] = useState<any[]>(invoice.items || []);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  useEffect(() => {
    let active = true;
    const loadVendors = async () => {
      try {
        setLoadingVendors(true);
        const data = await vendorService.getVendors();
        if (active) setVendors(data);
      } catch (err) {
        console.error("Failed to load vendors", err);
      } finally {
        if (active) setLoadingVendors(false);
      }
    };
    loadVendors();
    return () => { active = false; };
  }, []);

  const handleMapVendor = async (vendorId: number) => {
    try {
      const res = await vendorService.mapVendorToInvoice(invoice.id, vendorId);
      toast.success("Vendor and bank details mapped successfully.");
      setFields((prev) => ({
        ...prev,
        seller_name: res.seller_name || prev.seller_name,
        bank_account_number: res.bank_account_number || prev.bank_account_number,
        ifsc_code: res.ifsc_code || prev.ifsc_code,
        bank_name: res.bank_name || prev.bank_name,
      }));
      onRefresh();
    } catch (err: any) {
      toast.error("Failed to map vendor: " + (err.response?.data?.detail || err.message));
    }
  };

  // State of fields acceptance/checklist
  const [acceptedFields, setAcceptedFields] = useState<Record<string, boolean>>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  // Comments / Rejections
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [freeTextComment, setFreeTextComment] = useState("");
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReasons, setRejectReasons] = useState<string[]>([]);
  const [rejectText, setRejectText] = useState("");
  const [returnToVendor, setReturnToVendor] = useState(false);

  // Left Panel Tabs & zoom/rotation
  const [previewTab, setPreviewTab] = useState<"document" | "ocr" | "ai_fields">("document");
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Split-pane resize state
  const [splitPercent, setSplitPercent] = useState(50);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDownDivider = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = Math.min(Math.max(((ev.clientX - rect.left) / rect.width) * 100, 25), 75);
      setSplitPercent(Math.round(pct));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // PDF Blob URL for document preview
  const [docBlobUrl, setDocBlobUrl] = useState<string | null>(null);
  const [docBlobIsImage, setDocBlobIsImage] = useState(false);
  const [docBlobLoading, setDocBlobLoading] = useState(false);
  const [docBlobError, setDocBlobError] = useState<string | null>(null);

  // Track Review Duration
  const [secondsSpent, setSecondsSpent] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    timerRef.current = setInterval(() => {
      setSecondsSpent((prev) => prev + 1);
    }, 1000);

    apiClient
      .get("/settings")
      .then((res) => {
        if (!active) return;
        setSettings(res.data);
        const itemsList = res.data.reviewer_checklist_items || [];
        const initialChecklist: Record<string, boolean> = {};
        itemsList.forEach((item: string) => {
          initialChecklist[item] = !!(
            invoice.reviewer_checklist_completed &&
            (invoice.reviewer_checklist_completed as any)[item]
          );
        });
        setChecklist(initialChecklist);
      })
      .catch(() => {
        if (active) toast.error("Failed to load workbench settings.");
      })
      .finally(() => {
        if (active) setLoadingSettings(false);
      });

    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [invoice]);

  // Load document blob URL for preview
  useEffect(() => {
    let active = true;
    let url: string | null = null;
    if (invoice?.document_id) {
      setDocBlobLoading(true);
      setDocBlobError(null);
      apiClient
        .get(`/documents/${invoice.document_id}/download`, {
          responseType: "blob",
        })
        .then((response) => {
          if (!active) return;
          const blobType = response.headers["content-type"] || "application/pdf";
          const blob = new Blob([response.data], { type: blobType as string });
          url = window.URL.createObjectURL(blob);
          setDocBlobUrl(url);
          setDocBlobIsImage(typeof blobType === "string" && blobType.startsWith("image/"));
        })
        .catch(() => {
          if (!active) return;
          setDocBlobError("Failed to load document preview.");
        })
        .finally(() => {
          if (active) setDocBlobLoading(false);
        });
    } else {
      setDocBlobUrl(null);
      setDocBlobLoading(false);
    }
    return () => {
      active = false;
      if (url) window.URL.revokeObjectURL(url);
    };
  }, [invoice?.document_id]);

  const threshold = settings?.ai_confidence_threshold ?? 0.85;

  const confidenceMap = useMemo(() => {
    if (typeof invoice.confidence_json === "string") {
      try {
        return JSON.parse(invoice.confidence_json);
      } catch (e) {
        return {};
      }
    }
    return (invoice.confidence_json as Record<string, number>) || {};
  }, [invoice]);

  // Edits detector
  const modifiedFields = useMemo(() => {
    const edits: Record<string, any> = {};
    Object.keys(fields).forEach((key) => {
      let original: any = (invoice as any)[key];
      if (key === "invoice_date" && original) {
        original = String(original).split("T")[0];
      }
      if (original != fields[key]) {
        edits[key] = fields[key];
      }
    });
    if (JSON.stringify(invoice.items) !== JSON.stringify(items)) {
      edits["items"] = items;
    }
    return edits;
  }, [fields, invoice, items]);

  const hasEdits = Object.keys(modifiedFields).length > 0;

  // Inline Validation Mathematics Check
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    
    const cgstRaw = fields.total_cgst_value;
    const sgstRaw = fields.total_sgst_value;
    const igstRaw = fields.total_igst_value;
    const subtotalRaw = fields.total_taxable_value;
    const totalRaw = fields.total_invoice_value;

    const isNumeric = (val: any) => {
      if (val === undefined || val === null || val === "") return true;
      return !isNaN(parseFloat(val)) && isFinite(Number(val));
    };

    if (!isNumeric(cgstRaw) || !isNumeric(sgstRaw) || !isNumeric(igstRaw) || !isNumeric(subtotalRaw) || !isNumeric(totalRaw)) {
      errors.push("Financial amounts must be valid numeric formats");
    }

    const cgst = parseFloat(cgstRaw) || 0;
    const sgst = parseFloat(sgstRaw) || 0;
    const igst = parseFloat(igstRaw) || 0;
    const subtotal = parseFloat(subtotalRaw) || 0;
    const total = parseFloat(totalRaw) || 0;

    const sumTaxes = cgst + sgst + igst;
    const calculatedTotal = subtotal + sumTaxes;

    if (isNumeric(subtotalRaw) && isNumeric(totalRaw) && isNumeric(cgstRaw) && isNumeric(sgstRaw) && isNumeric(igstRaw)) {
      if (Math.abs(calculatedTotal - total) > 1.0) {
        errors.push(
          `Tax Sum discrepancy: Subtotal (₹${subtotal.toFixed(2)}) + Taxes (₹${sumTaxes.toFixed(2)}) does not equal Total Value (₹${total.toFixed(2)})`
        );
      }
    }

    if (!fields.invoice_number) errors.push("Invoice Number is a mandatory required field");
    if (!fields.invoice_date) errors.push("Invoice Date is a mandatory required field");
    if (!fields.seller_gstin) errors.push("Vendor GSTIN is required for tax processing compliance");
    if (isNumeric(totalRaw) && total <= 0)
      errors.push("Invoice total amount must be a positive non-zero value");
    return errors;
  }, [fields]);

  // Dynamic Real-time Verification Checklist Compiler
  const verificationChecks = useMemo(() => {
    const allErrors = [...validationErrors, ...(invoice.validation_errors || [])];
    return [
      {
        name: "Totals Plausibility Check",
        description: "Checks if total is < ₹10 or deviates significantly from historical average.",
        passed: !allErrors.some(
          (e) => e.toLowerCase().includes("floor of ₹10") || e.toLowerCase().includes("deviates significantly")
        ),
        critical: true,
      },
      {
        name: "Duplicate Invoice Detection",
        description: "Verifies if this invoice already exists in system records.",
        passed: !allErrors.some((e) => e.toLowerCase().includes("duplicate invoice")),
        critical: true,
      },
      {
        name: "Date Validity Check",
        description: "Checks if dates are valid, non-future, and not stale.",
        passed: !allErrors.some((e) => e.toLowerCase().includes("future") || e.toLowerCase().includes("stale")),
        critical: false,
      },
      {
        name: "Vendor Match",
        description: "Matches vendor identifier in past invoices or PO databases.",
        passed: !allErrors.some((e) => e.toLowerCase().includes("unrecognized vendor")),
        critical: false,
      },
      {
        name: "PO Match Check",
        description: "Validates provided PO number exists in active system POs.",
        passed: !allErrors.some((e) => e.toLowerCase().includes("purchase order")),
        critical: false,
      },
      {
        name: "Amount Consistency Check",
        description: "Verifies header totals logic (subtotal + taxes = grand total).",
        passed: !allErrors.some((e) => e.toLowerCase().includes("header math mismatch")),
        critical: false,
      },
      {
        name: "Line-Item Sum Consistency",
        description: "Verifies line item totals sum equals grand total value.",
        passed: !allErrors.some((e) => e.toLowerCase().includes("line items total sum")),
        critical: false,
      },
    ];
  }, [validationErrors, invoice]);

  const criticalCheckFailed = useMemo(() => {
    return verificationChecks.some((c) => c.critical && !c.passed);
  }, [verificationChecks]);

  const hasComment = freeTextComment.trim().length > 0 || selectedReasons.length > 0;
  const canSubmit = !criticalCheckFailed || hasComment;

  const isChecklistCompleted = useMemo(() => {
    const requiredList = settings?.reviewer_checklist_items || [];
    return requiredList.every((item: string) => checklist[item]);
  }, [checklist, settings]);

  const handleSaveDraft = async () => {
    if (isReadOnly) return;
    try {
      await apiClient.patch(`/invoices/${invoice.id}/fields`, { updates: modifiedFields });
      toast.success("Draft edits saved successfully.");
      onRefresh();
    } catch {
      toast.error("Failed to save draft edits.");
    }
  };

  const handleSubmitToApprover = async () => {
    if (isReadOnly) return;
    if (validationErrors.length > 0) {
      toast.warning("Cannot submit. Resolve validation warnings first.");
      return;
    }
    if (!isChecklistCompleted) {
      toast.warning("Please complete all verification checklist items first.");
      return;
    }
    if (criticalCheckFailed && !hasComment) {
      toast.warning("Override comment is mandatory when critical checks fail.");
      return;
    }
    const commentReq = settings?.reviewer_comment_requirements?.force_on_edits ?? true;
    if (hasEdits && commentReq && !hasComment) {
      toast.warning("Comments are mandatory when manually overriding AI extraction fields.");
      return;
    }
    try {
      // First save draft fields updates
      if (hasEdits) {
        await apiClient.patch(`/invoices/${invoice.id}/fields`, { updates: modifiedFields });
      }
      // Log review metadata and checklist details with backend
      await apiClient.post(`/reviewer/invoices/${invoice.id}/reviewer-submit`, {
        updates: {}, // edits are already saved to draft fields above
        checklist_completed: checklist,
        comments: selectedReasons,
        free_text_comment: freeTextComment,
        duration_seconds: secondsSpent,
      });
      // Submit the invoice for managers approval
      await apiClient.post(`/invoices/${invoice.id}/submit-for-approval`);
      toast.success("Invoice validated and submitted to Approver queue!");
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Submission failed.");
    }
  };

  const handleApproveInvoice = async () => {
    if (isReadOnly) return;
    try {
      const justificationText = freeTextComment || "Approved via review workbench";
      const url = `/invoices/${invoice.id}/approve?justification=${encodeURIComponent(justificationText)}`;
      await apiClient.post(url);
      toast.success("Invoice approved successfully. Moving to payment queue.");
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Approval failed.");
    }
  };

  const handleRejectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (rejectReasons.length === 0 && !rejectText.trim()) {
      toast.warning("Please choose a rejection reason or specify details.");
      return;
    }
    try {
      // Transition invoice status to rejected using the common route
      const reasonParam = encodeURIComponent(rejectReasons.join(", ") + " - " + rejectText);
      await apiClient.post(`/invoices/${invoice.id}/reject?reason=${reasonParam}`);
      toast.success("Invoice rejected successfully");
      onRefresh();
      onClose();
    } catch {
      toast.error("Rejection execution failed.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-zinc-900/80 dark:bg-zinc-950/90 backdrop-blur-sm animate-fade-in text-xs font-bold text-zinc-900 dark:text-zinc-100">
      <div
        ref={containerRef}
        className="flex flex-col w-full h-full bg-zinc-50 dark:bg-[#050506] p-4 gap-4 overflow-hidden"
      >
        {/* Header Workflow Stepper Panel */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2.5 bg-zinc-105 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider">
                  Review Workbench — Invoice #{fields.invoice_number || invoice.id}
                </h2>
                {(invoice as any).payment_status && (
                  <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[9px] uppercase tracking-wider">
                    Payout: {(invoice as any).payment_status}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 font-normal">
                Reviewer Mode · Extracted from {invoice.source_type || "Upload"}
              </p>
            </div>
          </div>
          <div className="flex-1 max-w-lg">
            <WorkflowStepper invoice={invoice} />
          </div>
        </div>

        <div className="flex flex-row w-full flex-1 overflow-hidden gap-0">
          {/* LEFT PANEL: DOCUMENT / OCR / CONFIDENCE TAB VIEW */}
          <div
            className={`flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm h-full transition-all duration-150 ${
              isFullscreen ? "w-full" : ""
            }`}
            style={isFullscreen ? undefined : { width: `${splitPercent}%`, minWidth: "25%", maxWidth: "75%" }}
          >
            {/* View Tab Selector Header */}
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/20 dark:bg-zinc-900 shrink-0">
              <div className="flex gap-2">
                {[
                  { key: "document", label: "Original Document" },
                  { key: "ocr", label: "OCR Output" },
                  { key: "ai_fields", label: "AI Extracted Fields" },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setPreviewTab(t.key as any)}
                    className={`px-3 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-wider transition-colors ${
                      previewTab === t.key
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* View Actions Toolbar (Only for document view) */}
              {previewTab === "document" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setZoom((z) => Math.max(z - 25, 50))}
                    className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200"
                    title="Zoom Out"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setZoom((z) => Math.min(z + 25, 200))}
                    className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200"
                    title="Zoom In"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200"
                    title="Rotate"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200"
                    title="Toggle Fullscreen"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M4 8V4h4m12 0h-4v4m0 8h4v4m-12 0H4v-4"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Preview Body Container */}
            <div className="flex-1 bg-zinc-100 dark:bg-[#050506] overflow-auto relative p-5 flex items-center justify-center">
              {previewTab === "document" && (
                docBlobLoading ? (
                  <div className="text-zinc-400 font-normal text-xs">Loading document preview...</div>
                ) : docBlobError ? (
                  <div className="text-rose-500 font-bold text-xs">{docBlobError}</div>
                ) : docBlobUrl ? (
                  <div
                    style={{
                      transform: `rotate(${rotation}deg) scale(${zoom / 100})`,
                      transformOrigin: "center center",
                      transition: "transform 0.2s ease-in-out",
                    }}
                    className="w-full h-full min-h-[480px]"
                  >
                    {docBlobIsImage ? (
                      <img
                        src={docBlobUrl}
                        alt="Invoice Document"
                        className="max-w-full max-h-full object-contain mx-auto"
                      />
                    ) : (
                      <iframe
                        src={docBlobUrl}
                        className="w-full h-full border-none rounded-xl"
                        title="Invoice Original PDF"
                      />
                    )}
                  </div>
                ) : (
                  <div className="text-zinc-400 font-normal text-xs">No source document attached to this record.</div>
                )
              )}

              {previewTab === "ocr" && (
                <div className="w-full h-full overflow-y-auto p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 font-mono text-[10px] whitespace-pre-wrap text-zinc-600 dark:text-zinc-400 text-left">
                  {invoice.raw_ocr_text || "No OCR Output text extracted for this document."}
                </div>
              )}

              {previewTab === "ai_fields" && (
                <div className="w-full h-full overflow-y-auto p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-250 dark:border-zinc-800 pb-2">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                      Extracted Field Confidences
                    </span>
                    <span className="text-[9px] font-bold text-zinc-450">
                      Threshold: {Math.round(threshold * 100)}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(confidenceMap).map(([fieldName, score]: any) => {
                      const scoreVal = Number(score) ?? 0.0;
                      const passed = scoreVal >= threshold;
                      const color = passed
                        ? "bg-emerald-500"
                        : scoreVal >= 0.6
                        ? "bg-amber-400"
                        : "bg-rose-500";
                      return (
                        <div
                          key={fieldName}
                          className="bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-xl p-3 flex justify-between items-center shadow-sm"
                        >
                          <div className="space-y-0.5 text-left">
                            <span className="text-zinc-805 dark:text-zinc-200 font-bold uppercase text-[10px]">
                              {fieldName.replace(/_/g, " ")}
                            </span>
                            <div className="text-[9px] text-zinc-400 font-normal">
                              Value:{" "}
                              <span className="font-semibold text-zinc-600 dark:text-zinc-350">
                                {String((fields as any)[fieldName] || (invoice as any)[fieldName] || "—")}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24 bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full ${color}`} style={{ width: `${scoreVal * 100}%` }} />
                            </div>
                            <span
                              className={`text-[10px] font-black tracking-wider ${
                                passed
                                  ? "text-emerald-500"
                                  : scoreVal >= 0.6
                                  ? "text-amber-500"
                                  : "text-rose-500"
                              }`}
                            >
                              {Math.round(scoreVal * 100)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RESIZE DIVIDER — draggable, hidden in fullscreen */}
          {!isFullscreen && (
            <div
              onMouseDown={onMouseDownDivider}
              className="w-2 mx-1 flex-shrink-0 flex items-center justify-center cursor-col-resize group self-stretch"
              title="Drag to resize panels"
            >
              <div className="w-0.5 h-16 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-[#EC4899] group-hover:h-24 transition-all duration-150" />
            </div>
          )}

          {/* RIGHT PANEL: EDITABLE AI EXTRACTED DATA */}
          {!isFullscreen && (
            <div
              className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm h-full justify-between animate-slide-in-right"
              style={{ flex: 1, minWidth: "25%" }}
            >
              {/* Sidebar Header */}
              <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/20 dark:bg-zinc-900 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider">AI Extraction Fields</h3>
                    {Object.keys(modifiedFields).length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#EC4899] text-white text-[9px] font-black uppercase tracking-wider animate-pulse">
                        {Object.keys(modifiedFields).length} change
                        {Object.keys(modifiedFields).length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 font-normal mt-0.5">
                    Active review time:{" "}
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
                      {Math.floor(secondsSpent / 60)}m {secondsSpent % 60}s
                    </span>
                  </p>
                </div>
              </div>

              {/* Pending changes banner */}
              {Object.keys(modifiedFields).length > 0 && !isReadOnly && !hasComment && (
                <div className="mx-5 mt-3 px-4 py-3 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-center gap-2.5 shrink-0">
                  <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    />
                  </svg>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                    {Object.keys(modifiedFields).length} field{Object.keys(modifiedFields).length > 1 ? "s" : ""} modified — comments are required before submission.
                  </span>
                </div>
              )}

              {/* Main Fields Form */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 hide-scrollbar">
                {/* Field Warnings overlay */}
                {validationErrors.length > 0 && (
                  <div className="p-4 bg-rose-500/10 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-2xl space-y-2">
                    <span className="text-[10px] text-rose-500 uppercase tracking-wider font-black">
                      Validation Warnings ({validationErrors.length})
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-[10px] text-rose-600 dark:text-rose-400 font-normal text-left">
                      {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Real-time Verification Panel */}
                <div className="border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30">
                  <h4 className="text-[10px] text-zinc-400 uppercase tracking-widest font-black leading-none">
                    Real-time Verification Panel
                  </h4>
                  <div className="space-y-2">
                    {verificationChecks.map((check, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-2.5 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm"
                      >
                        <div className="space-y-0.5 text-left">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                check.passed
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                              }`}
                            >
                              {check.passed ? "✓ Passed" : "✗ Failed"}
                            </span>
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                              {check.name}
                            </span>
                            {check.critical && (
                              <span className="text-[8px] bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 px-1 py-0.2 rounded font-black tracking-wider">
                                CRITICAL
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-zinc-400 font-normal">{check.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Extracted Fields Input Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { field: "seller_name", label: "Vendor / Seller Name" },
                    { field: "invoice_number", label: "Invoice Number" },
                    { field: "seller_gstin", label: "Vendor GSTIN" },
                    { field: "buyer_gstin", label: "Buyer GSTIN" },
                    { field: "invoice_date", label: "Invoice Date", type: "date" },
                    { field: "po_number", label: "PO Number" },
                    { field: "total_taxable_value", label: "Taxable Subtotal (INR)", type: "number" },
                    { field: "total_cgst_value", label: "CGST Amount (INR)", type: "number" },
                    { field: "total_sgst_value", label: "SGST Amount (INR)", type: "number" },
                    { field: "total_igst_value", label: "IGST Amount (INR)", type: "number" },
                    { field: "total_invoice_value", label: "Total Invoice Value (INR)", type: "number" },
                    { field: "currency", label: "Currency Code" },
                  ].map((item) => {
                    const conf = confidenceMap[item.field] ?? 1.0;
                    const isLow = conf < threshold;
                    const confColor =
                      conf >= 0.85
                        ? "text-emerald-500"
                        : conf >= 0.6
                        ? "text-amber-500"
                        : "text-rose-500";
                    const confDot =
                      conf >= 0.85
                        ? "bg-emerald-500"
                        : conf >= 0.6
                        ? "bg-amber-400"
                        : "bg-rose-500";
                    const isAccepted = acceptedFields[item.field] ?? false;
                    const isEdited = modifiedFields.hasOwnProperty(item.field);
                    return (
                      <div
                        key={item.field}
                        className={`space-y-1.5 rounded-xl p-2 transition-colors ${
                          isEdited
                            ? "bg-amber-500/10 dark:bg-amber-950/20 border border-amber-300/40 dark:border-amber-700/40"
                            : "border border-transparent"
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px]">
                          <label className="text-zinc-750 dark:text-zinc-200 uppercase tracking-widest leading-none font-bold flex items-center gap-1.5">
                            {isEdited && <span className="w-1 h-3 rounded-full bg-amber-400" />}
                            {item.label}
                          </label>
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className={`flex items-center gap-1 ${confColor}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${confDot}`} />
                              {Math.round(conf * 100)}%
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setAcceptedFields({ ...acceptedFields, [item.field]: !isAccepted })
                              }
                              className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold transition-all ${
                                isAccepted
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                                  : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500"
                              }`}
                            >
                              {isAccepted ? "Accepted" : "Accept"}
                            </button>
                          </div>
                        </div>
                        <div className="relative">
                          <input
                            type={item.type || "text"}
                            disabled={isReadOnly}
                            value={fields[item.field]}
                            onChange={(e) => {
                              const val = item.type === "number" ? Number(e.target.value) : e.target.value;
                              setFields({ ...fields, [item.field]: val });
                            }}
                         className={`w-full bg-white dark:bg-zinc-800 border rounded-xl px-3.5 py-3 text-xs text-zinc-900 dark:text-zinc-100 outline-none transition-colors text-left ${
                              isEdited
                                ? "border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                                : isLow
                                ? "border-amber-300/80 focus:ring-2 focus:ring-amber-400/20"
                                : "border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-[#EC4899]/30"
                            }`}
                          />
                          {invoice[item.field as keyof Invoice] !== fields[item.field] && (
                            <button
                              type="button"
                              onClick={() => {
                                let orig: any = invoice[item.field as keyof Invoice];
                                if (item.field === "invoice_date" && orig) {
                                  orig = String(orig).split("T")[0];
                                }
                                setFields({ ...fields, [item.field]: orig || "" });
                              }}
                              className="absolute right-3 top-2.5 text-[9px] text-[#EC4899] font-bold uppercase tracking-wider"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Editable Line Items */}
                <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-4 space-y-3">
                  <h4 className="text-[10px] text-zinc-400 uppercase tracking-widest font-black leading-none">
                    Line Items overrides
                  </h4>
                  <div className="space-y-2 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-black uppercase tracking-wider text-[10px]">
                          <th className="pb-2">Description</th>
                          <th className="pb-2 w-16">Qty</th>
                          <th className="pb-2 w-20">Unit Price</th>
                          <th className="pb-2 w-20">Total (INR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800">
                            <td className="py-2 pr-2">
                              <input
                                type="text"
                                value={item.description || ""}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[idx] = { ...item, description: e.target.value };
                                  setItems(newItems);
                                }}
                                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-[#EC4899] text-left"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                value={item.quantity || 0}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  const qty = Number(e.target.value);
                                  newItems[idx] = {
                                    ...item,
                                    quantity: qty,
                                    total_amount: qty * (item.unit_price || 0),
                                  };
                                  setItems(newItems);
                                }}
                                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-[#EC4899] text-left"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                value={item.unit_price || 0}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  const price = Number(e.target.value);
                                  newItems[idx] = {
                                    ...item,
                                    unit_price: price,
                                    total_amount: (item.quantity || 0) * price,
                                  };
                                  setItems(newItems);
                                }}
                                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-[#EC4899] text-left"
                              />
                            </td>
                            <td className="py-2 text-zinc-600 dark:text-zinc-400 font-bold">
                              ₹{(Number(item.quantity || 0) * Number(item.unit_price || 0)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Review checklist gates */}
                <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-4 space-y-3">
                  <h4 className="text-[10px] text-zinc-400 uppercase tracking-widest font-black leading-none">
                    Review checklist gates
                  </h4>
                  <div className="space-y-2">
                    {(settings?.reviewer_checklist_items || []).map((item: string) => (
                      <label
                        key={item}
                        className="flex items-start gap-2.5 cursor-pointer font-bold text-xs select-none text-left"
                      >
                        <input
                          type="checkbox"
                          disabled={isReadOnly}
                          checked={!!checklist[item]}
                          onChange={() => setChecklist({ ...checklist, [item]: !checklist[item] })}
                          className="w-4 h-4 mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-zinc-600 dark:text-zinc-350">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Correction reasons & comments */}
                <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-4 space-y-3">
                  <h4 className="text-[10px] text-zinc-400 uppercase tracking-widest font-black leading-none">
                    Correction comments &amp; reasons
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5 text-left">
                    {[
                      "OCR Error",
                      "AI Extraction Error",
                      "GST Corrected",
                      "Amount Corrected",
                      "Vendor Corrected",
                      "Duplicate Removed",
                      "Missing PO",
                      "Other",
                    ].map((reason) => {
                      const active = selectedReasons.includes(reason);
                      return (
                        <label
                          key={reason}
                          className="flex items-center gap-2 cursor-pointer font-bold text-xs select-none"
                        >
                          <input
                            type="checkbox"
                            disabled={isReadOnly}
                            checked={active}
                            onChange={() => {
                              if (active) {
                                setSelectedReasons(selectedReasons.filter((r) => r !== reason));
                              } else {
                                setSelectedReasons([...selectedReasons, reason]);
                              }
                            }}
                            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-zinc-600 dark:text-zinc-450">{reason}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="pt-2">
                    <textarea
                      disabled={isReadOnly}
                      placeholder="Provide override reasons or clarification comments (required for edits or overrides)..."
                      value={freeTextComment}
                      onChange={(e) => setFreeTextComment(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 text-xs text-zinc-900 dark:text-zinc-100 outline-none h-20 resize-none focus:ring-2 focus:ring-[#EC4899]/30 text-left"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/10 dark:bg-zinc-900 flex justify-between items-center shrink-0">
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsRejectOpen(true)}
                    disabled={isReadOnly}
                    className="px-4 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl uppercase text-[10px] tracking-wider transition-all font-black cursor-pointer"
                  >
                    Reject Invoice
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isReadOnly}
                    className="px-4 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl uppercase text-[10px] tracking-wider transition-all font-black border border-zinc-200 dark:border-zinc-800 cursor-pointer disabled:opacity-50"
                  >
                    Save Draft
                  </button>
                  {userRole === "Admin" && (
                    <button
                      type="button"
                      onClick={handleApproveInvoice}
                      className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl uppercase text-[10px] tracking-wider transition-all font-black shadow-md cursor-pointer"
                    >
                      Approve Invoice
                    </button>
                  )}
                </div>
                {userRole !== "Admin" && (
                  <button
                    type="button"
                    onClick={handleSubmitToApprover}
                    disabled={!canSubmit}
                    className={`px-5 py-3 rounded-xl uppercase text-[10px] tracking-wider transition-all font-black shadow-md ${
                      canSubmit
                        ? "bg-[#EC4899] hover:bg-[#db3f88] text-white cursor-pointer"
                        : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed"
                    }`}
                  >
                    Submit to Approver
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* REJECTION MODAL */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 ">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm mx-4 space-y-4 text-zinc-900 dark:text-white">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-left">Reject Invoice</h3>
              <p className="text-[10px] text-zinc-400 font-normal mt-0.5 text-left">
                Please specify rejection reasons for timeline records.
              </p>
            </div>
            <form onSubmit={handleRejectionSubmit} className="space-y-4 font-bold text-xs">
              <div className="space-y-2 text-left">
                {["Mathematical Error", "Invalid Vendor", "Duplicate", "Missing Information", "Other"].map(
                  (reason) => {
                    const active = rejectReasons.includes(reason);
                    return (
                      <label
                        key={reason}
                        className="flex items-center gap-2.5 cursor-pointer font-bold text-xs select-none"
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => {
                            if (active) {
                              setRejectReasons(rejectReasons.filter((r) => r !== reason));
                            } else {
                              setRejectReasons([...rejectReasons, reason]);
                            }
                          }}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>{reason}</span>
                      </label>
                    );
                  }
                )}
              </div>
              <textarea
                placeholder="Details of rejection..."
                required
                value={rejectText}
                onChange={(e) => setRejectText(e.target.value)}
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-xs text-zinc-900 dark:text-zinc-100 outline-none h-20 resize-none focus:ring-2 focus:ring-rose-500/30 text-left"
              />
              <div className="flex items-center gap-2.5 py-1 text-left">
                <input
                  type="checkbox"
                  id="return-vendor"
                  checked={returnToVendor}
                  onChange={(e) => setReturnToVendor(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 cursor-pointer"
                />
                <label htmlFor="return-vendor" className="cursor-pointer select-none font-semibold">
                  Return to Vendor via communication provider
                </label>
              </div>
              <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-150 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsRejectOpen(false)}
                  className="px-4 py-2 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer">
                  Reject Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
