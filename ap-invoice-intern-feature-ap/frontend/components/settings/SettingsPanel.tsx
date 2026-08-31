import React, { useState, useEffect, useCallback } from "react";
import { Role } from "../../store/useAppStore";
import { toast } from "sonner";
import { useConfirmStore } from "../../store/useConfirmStore";
import KeyPoolPanel from "./KeyPoolPanel";
import GeneralTab from "./components/GeneralTab";
import SecurityTab from "./components/SecurityTab";
import AISettingsTab from "./components/AISettingsTab";
import PromptTab from "./components/PromptTab";
import ValidationTab from "./components/ValidationTab";
import WorkflowTab from "./components/WorkflowTab";
import SLATab from "./components/SLATab";
import TDSTab from "./components/TDSTab";
import PaymentsTab from "./components/PaymentsTab";
import WebhookTab from "./components/WebhookTab";
import HSNMasterTab from "./components/HSNMasterTab";

type SettingsPanelProps = {
  role: Role;
  settingsSection: "general" | "security" | "ai" | "prompt" | "workflow" | "validation" | "sla" | "pool" | "tds" | "payments" | "webhooks" | "hsn-master";
  setSettingsSection: (section: "general" | "security" | "ai" | "prompt" | "workflow" | "validation" | "sla" | "pool" | "tds" | "payments" | "webhooks" | "hsn-master") => void;
  // general settings states & setters
  companyName: string; setCompanyName: (v: string) => void;
  timezone: string; setTimezone: (v: string) => void;
  currency: string; setCurrency: (v: string) => void;
  financialYear: string; setFinancialYear: (v: string) => void;
  language: string; setLanguage: (v: string) => void;
  // ai settings states & setters
  aiModel: string; setAiModel: (v: string) => void;
  aiTemperature: number; setAiTemperature: (v: number) => void;
  aiConfidenceThreshold: number; setAiConfidenceThreshold: (v: number) => void;
  aiExtractionVersion: string; setAiExtractionVersion: (v: string) => void;
  aiPromptVersion: string; setAiPromptVersion: (v: string) => void;
  aiPromptNotes: string; setAiPromptNotes: (v: string) => void;
  // prompt states & setters
  currentPrompt: string; setCurrentPrompt: (v: string) => void;
  promptHistory: any[];
  newPromptVersionName: string; setNewPromptVersionName: (v: string) => void;
  newPromptVersionNotes: string; setNewPromptVersionNotes: (v: string) => void;
  promptTestResult: any | null;
  // workflow states & setters
  workflowReviewerRequired: boolean; setWorkflowReviewerRequired: (v: boolean) => void;
  workflowApproverRequired: boolean; setWorkflowApproverRequired: (v: boolean) => void;
  workflowAutoReviewer: boolean; setWorkflowAutoReviewer: (v: boolean) => void;
  workflowAutoApprover: boolean; setWorkflowAutoApprover: (v: boolean) => void;
  workflowApprovalLevels: number; setWorkflowApprovalLevels: (v: number) => void;
  workflowManualOverride: boolean; setWorkflowManualOverride: (v: boolean) => void;
  // validation states & setters
  rulesRequiredFields: any; setRulesRequiredFields: (v: any) => void;
  rulesDuplicateDetection: boolean; setRulesDuplicateDetection: (v: boolean) => void;
  rulesGstValidation: boolean; setRulesGstValidation: (v: boolean) => void;
  rulesPoMatching: boolean; setRulesPoMatching: (v: boolean) => void;
  rulesAmountTolerance: number; setRulesAmountTolerance: (v: number) => void;

  // GST compliance settings states & setters
  gstToleranceAmount: number; setGstToleranceAmount: (v: number) => void;
  gstReconciliationThresholdPct: number; setGstReconciliationThresholdPct: (v: number) => void;
  gstMaxPastDays: number; setGstMaxPastDays: (v: number) => void;
  gstPreventDuplicateIrn: boolean; setGstPreventDuplicateIrn: (v: boolean) => void;
  gstCheckDateConsistency: boolean; setGstCheckDateConsistency: (v: boolean) => void;

  // PO match compliance parameters states & setters
  poQtyTolerancePct: number; setPoQtyTolerancePct: (v: number) => void;
  poPriceTolerancePct: number; setPoPriceTolerancePct: (v: number) => void;
  poTaxTolerancePct: number; setPoTaxTolerancePct: (v: number) => void;
  poFreightToleranceAmount: number; setPoFreightToleranceAmount: (v: number) => void;
  poVendorNameThresholdPct: number; setPoVendorNameThresholdPct: (v: number) => void;
  poMinMatchScore: number; setPoMinMatchScore: (v: number) => void;

  // sla states & setters
  slaReview: number; setSlaReview: (v: number) => void;
  slaApproval: number; setSlaApproval: (v: number) => void;
  slaProcessing: number; setSlaProcessing: (v: number) => void;
  slaReminderTime: number; setSlaReminderTime: (v: number) => void;
  slaEscalationTime: number; setSlaEscalationTime: (v: number) => void;
  slaCriticalThreshold: number; setSlaCriticalThreshold: (v: number) => void;
  escalationRole: string; setEscalationRole: (v: string) => void;
  slaGracePeriodHours: number; setSlaGracePeriodHours: (v: number) => void;
  // webhooks
  webhookEnabled: boolean; setWebhookEnabled: (v: boolean) => void;
  webhookUrl: string; setWebhookUrl: (v: string) => void;
  webhookSecret: string; setWebhookSecret: (v: string) => void;
  webhookProvider: string; setWebhookProvider: (v: string) => void;
  webhookEvents: string[]; setWebhookEvents: (v: string[]) => void;
  discordWebhookUrl: string; setDiscordWebhookUrl: (v: string) => void;
  notificationEvents: string[]; setNotificationEvents: (v: string[]) => void;
  // save function
  onSaveSettings: (sectionName: string) => Promise<void>;
  onTestPrompt: () => Promise<void>;
  onCreatePromptVersion: (e: React.FormEvent) => Promise<void>;
  onRollbackPrompt: (id: number) => Promise<void>;

  // Optional props for AI providers management
  providers?: any[];
  onShowAddProviderModal?: () => void;
  onEditProvider?: (prov: any) => void;
  onDeleteProvider?: (id: number) => Promise<void>;
  onSeedProviders?: () => Promise<void>;
  onTestProvider?: (id: number) => Promise<void>;
};

export default function SettingsPanel({
  role,
  settingsSection,
  setSettingsSection,
  companyName, setCompanyName,
  timezone, setTimezone,
  currency, setCurrency,
  financialYear, setFinancialYear,
  language, setLanguage,
  aiModel, setAiModel,
  aiTemperature, setAiTemperature,
  aiConfidenceThreshold, setAiConfidenceThreshold,
  aiExtractionVersion, setAiExtractionVersion,
  aiPromptVersion, setAiPromptVersion,
  aiPromptNotes, setAiPromptNotes,
  currentPrompt, setCurrentPrompt,
  promptHistory,
  newPromptVersionName, setNewPromptVersionName,
  newPromptVersionNotes, setNewPromptVersionNotes,
  promptTestResult,
  workflowReviewerRequired, setWorkflowReviewerRequired,
  workflowApproverRequired, setWorkflowApproverRequired,
  workflowAutoReviewer, setWorkflowAutoReviewer,
  workflowAutoApprover, setWorkflowAutoApprover,
  workflowApprovalLevels, setWorkflowApprovalLevels,
  workflowManualOverride, setWorkflowManualOverride,
  rulesRequiredFields, setRulesRequiredFields,
  rulesDuplicateDetection, setRulesDuplicateDetection,
  rulesGstValidation, setRulesGstValidation,
  rulesPoMatching, setRulesPoMatching,
  rulesAmountTolerance, setRulesAmountTolerance,

  gstToleranceAmount, setGstToleranceAmount,
  gstReconciliationThresholdPct, setGstReconciliationThresholdPct,
  gstMaxPastDays, setGstMaxPastDays,
  gstPreventDuplicateIrn, setGstPreventDuplicateIrn,
  gstCheckDateConsistency, setGstCheckDateConsistency,

  poQtyTolerancePct, setPoQtyTolerancePct,
  poPriceTolerancePct, setPoPriceTolerancePct,
  poTaxTolerancePct, setPoTaxTolerancePct,
  poFreightToleranceAmount, setPoFreightToleranceAmount,
  poVendorNameThresholdPct, setPoVendorNameThresholdPct,
  poMinMatchScore, setPoMinMatchScore,

  slaReview, setSlaReview,
  slaApproval, setSlaApproval,
  slaProcessing, setSlaProcessing,
  slaReminderTime, setSlaReminderTime,
  slaEscalationTime, setSlaEscalationTime,
  slaCriticalThreshold, setSlaCriticalThreshold,
  escalationRole, setEscalationRole,
  slaGracePeriodHours, setSlaGracePeriodHours,
  webhookEnabled, setWebhookEnabled,
  webhookUrl, setWebhookUrl,
  webhookSecret, setWebhookSecret,
  webhookProvider, setWebhookProvider,
  webhookEvents, setWebhookEvents,
  discordWebhookUrl, setDiscordWebhookUrl,
  notificationEvents, setNotificationEvents,
  onSaveSettings,
  onTestPrompt,
  onCreatePromptVersion,
  onRollbackPrompt,
  ...props
}: SettingsPanelProps) {

  // TDS Rules local state — fetched from /api/v1/settings/tds-rules
  const [tdsRules, setTdsRules] = useState<any[]>([]);
  const [tdsLoading, setTdsLoading] = useState(false);
  const [tdsError, setTdsError] = useState<string | null>(null);
  const [showTdsModal, setShowTdsModal] = useState(false);
  const [editingTdsRule, setEditingTdsRule] = useState<any | null>(null);
  const defaultTdsForm = {
    section_code: "", description: "",
    rate_with_pan: 1.0, rate_without_pan: 20.0,
    single_threshold: 30000, aggregate_threshold: 100000,
    vendor_categories: "", expense_categories: "",
    effective_from: "", effective_to: "",
  };
  const [tdsForm, setTdsForm] = useState(defaultTdsForm);

  const fetchTdsRules = useCallback(async () => {
    setTdsLoading(true); setTdsError(null);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/v1/settings/tds-rules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTdsRules(await res.json());
    } catch (e: any) {
      setTdsError(e.message || "Failed to load TDS rules");
    } finally {
      setTdsLoading(false);
    }
  }, []);

  // GST HSN Rules local state — fetched from /api/v1/settings/gst-hsn-rules
  const [gstHsnRules, setGstHsnRules] = useState<any[]>([]);
  const [gstHsnLoading, setGstHsnLoading] = useState(false);
  const [gstHsnError, setGstHsnError] = useState<string | null>(null);
  const [showGstHsnModal, setShowGstHsnModal] = useState(false);
  const defaultGstHsnForm = {
    hsn_prefix: "",
    rule_type: "RCM" as "RCM" | "BLOCKED_ITC",
  };
  const [gstHsnForm, setGstHsnForm] = useState(defaultGstHsnForm);

  const fetchGstHsnRules = useCallback(async () => {
    setGstHsnLoading(true); setGstHsnError(null);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/v1/settings/gst-hsn-rules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGstHsnRules(await res.json());
    } catch (e: any) {
      setGstHsnError(e.message || "Failed to load GST HSN rules");
    } finally {
      setGstHsnLoading(false);
    }
  }, []);

  // Approval Rules local state
  const [approvalRules, setApprovalRules] = useState<any[]>([]);
  const [approvalRulesLoading, setApprovalRulesLoading] = useState(false);
  const [approvalRulesError, setApprovalRulesError] = useState<string | null>(null);
  const [showApprovalRuleModal, setShowApprovalRuleModal] = useState(false);
  const [editingApprovalRule, setEditingApprovalRule] = useState<any | null>(null);

  const defaultApprovalRuleForm = {
    department: "",
    cost_center: "",
    min_amount: 0,
    max_amount: "" as string | number,
    auto_approve_enabled: false,
    approvers: [] as string[],
    sla_hours: 48,
  };
  const [approvalRuleForm, setApprovalRuleForm] = useState(defaultApprovalRuleForm);

  const fetchApprovalRules = useCallback(async () => {
    setApprovalRulesLoading(true);
    setApprovalRulesError(null);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/v1/settings/approval-rules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setApprovalRules(await res.json());
    } catch (e: any) {
      setApprovalRulesError(e.message || "Failed to load approval rules");
    } finally {
      setApprovalRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (settingsSection === "tds") fetchTdsRules();
    if (settingsSection === "validation") fetchGstHsnRules();
    if (settingsSection === "workflow") fetchApprovalRules();
  }, [settingsSection, fetchTdsRules, fetchGstHsnRules, fetchApprovalRules]);

  const openAddTds = () => { setEditingTdsRule(null); setTdsForm(defaultTdsForm); setShowTdsModal(true); };
  const openEditTds = (rule: any) => {
    setEditingTdsRule(rule);
    setTdsForm({
      section_code: rule.section_code,
      description: rule.description || "",
      rate_with_pan: rule.rate_with_pan,
      rate_without_pan: rule.rate_without_pan,
      single_threshold: rule.single_threshold,
      aggregate_threshold: rule.aggregate_threshold,
      vendor_categories: (rule.vendor_categories || []).join(", "),
      expense_categories: (rule.expense_categories || []).join(", "),
      effective_from: rule.effective_from || "",
      effective_to: rule.effective_to || "",
    });
    setShowTdsModal(true);
  };

  const handleTdsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("access_token");
    const body = {
      ...tdsForm,
      rate_with_pan: Number(tdsForm.rate_with_pan),
      rate_without_pan: Number(tdsForm.rate_without_pan),
      single_threshold: Number(tdsForm.single_threshold),
      aggregate_threshold: Number(tdsForm.aggregate_threshold),
      vendor_categories: tdsForm.vendor_categories.split(",").map(s => s.trim()).filter(Boolean),
      expense_categories: tdsForm.expense_categories.split(",").map(s => s.trim()).filter(Boolean),
      effective_from: tdsForm.effective_from || null,
      effective_to: tdsForm.effective_to || null,
    };
    const url = editingTdsRule
      ? `/api/v1/settings/tds-rules/${editingTdsRule.id}`
      : "/api/v1/settings/tds-rules";
    const method = editingTdsRule ? "PUT" : "POST";
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) { setShowTdsModal(false); fetchTdsRules(); }
    else { toast.error(`Error: ${await res.text()}`); }
  };

  const handleTdsDelete = async (id: number) => {
    const confirmed = await useConfirmStore.getState().confirm({
      title: "Delete TDS Rule",
      message: "Are you sure you want to delete this TDS rule?",
      roleAccent: "red"
    });
    if (!confirmed) return;
    const token = localStorage.getItem("access_token");
    await fetch(`/api/v1/settings/tds-rules/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    fetchTdsRules();
  };
  const openAddGstHsn = () => {
    setGstHsnForm(defaultGstHsnForm);
    setShowGstHsnModal(true);
  };

  const handleGstHsnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("access_token");
    const res = await fetch("/api/v1/settings/gst-hsn-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(gstHsnForm),
    });
    if (res.ok) {
      setShowGstHsnModal(false);
      fetchGstHsnRules();
    } else {
      toast.error(`Error: ${await res.text()}`);
    }
  };

  const handleGstHsnDelete = async (id: number) => {
    const confirmed = await useConfirmStore.getState().confirm({
      title: "Delete GST HSN Rule",
      message: "Are you sure you want to delete this GST HSN rule?",
      roleAccent: "red"
    });
    if (!confirmed) return;
    const token = localStorage.getItem("access_token");
    await fetch(`/api/v1/settings/gst-hsn-rules/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchGstHsnRules();
  };

  const openAddApprovalRule = () => {
    setEditingApprovalRule(null);
    setApprovalRuleForm(defaultApprovalRuleForm);
    setShowApprovalRuleModal(true);
  };

  const openEditApprovalRule = (rule: any) => {
    setEditingApprovalRule(rule);
    setApprovalRuleForm({
      department: rule.department || "",
      cost_center: rule.cost_center || "",
      min_amount: rule.min_amount,
      max_amount: rule.max_amount !== null ? rule.max_amount : "",
      auto_approve_enabled: rule.auto_approve !== null && rule.auto_approve !== undefined && rule.auto_approve > 0,
      approvers: rule.approvers || [],
      sla_hours: rule.sla_hours || 48,
    });
    setShowApprovalRuleModal(true);
  };

  const handleApprovalRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("access_token");

    const max_amt = approvalRuleForm.max_amount === "" ? null : Number(approvalRuleForm.max_amount);
    
    const auto_approve_val = approvalRuleForm.auto_approve_enabled
      ? (max_amt !== null ? max_amt : 999999999.0)
      : null;

    const body = {
      department: approvalRuleForm.department || null,
      cost_center: approvalRuleForm.cost_center || null,
      min_amount: Number(approvalRuleForm.min_amount),
      max_amount: max_amt,
      auto_approve: auto_approve_val,
      approvers: approvalRuleForm.approvers,
      sla_hours: Number(approvalRuleForm.sla_hours),
    };

    const url = editingApprovalRule
      ? `/api/v1/settings/approval-rules/${editingApprovalRule.id}`
      : "/api/v1/settings/approval-rules";
    const method = editingApprovalRule ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowApprovalRuleModal(false);
      fetchApprovalRules();
    } else {
      toast.error(`Error: ${await res.text()}`);
    }
  };

  const handleApprovalRuleDelete = async (id: number) => {
    const confirmed = await useConfirmStore.getState().confirm({
      title: "Delete Approval Rule",
      message: "Are you sure you want to delete this approval rule?",
      roleAccent: "red"
    });
    if (!confirmed) return;
    const token = localStorage.getItem("access_token");
    const res = await fetch(`/api/v1/settings/approval-rules/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      fetchApprovalRules();
    } else {
      toast.error("Failed to delete rule");
    }
  };

  const isAdmin = role === "Admin" || role === "Super Admin";
  const isApprover = role === "Approver";
  const isAuditor = role === "Auditor";
  const visibleTabs = [
    { key: "general", label: "General" },
    { key: "security", label: "Security" },
    ...(isAdmin ? [
      { key: "tds", label: "TDS Rules" },
      { key: "hsn-master", label: "HSN Master" },
      { key: "workflow", label: "Workflow Config" },
      { key: "sla", label: "SLA Settings" },
      { key: "ai", label: "AI Settings" },
      { key: "prompt", label: "Prompt Management" },
      { key: "validation", label: "Validation Rules" },
      { key: "pool", label: "Key Pool" },
      { key: "webhooks", label: "Webhooks & Events" },
      ...(role !== "Super Admin" ? [{ key: "payments", label: "Payments" }] : []),
    ] : []),
    ...(isAuditor ? [
      { key: "tds", label: "TDS Rules" },
      { key: "hsn-master", label: "HSN Master" },
    ] : []),
    ...(!isAdmin && isApprover ? [
      { key: "payments", label: "Payments" },
    ] : []),
  ];

  const currentSection = visibleTabs.some((tab) => tab.key === settingsSection)
    ? settingsSection
    : "general";

  // Approver can edit the payments tab only; Admin can edit everything
  const canEdit = isAdmin || (isApprover && currentSection === "payments");

  return (
    <div className="space-y-6 animate-fade-in text-xs font-bold max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">System Settings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-normal">
          Configure systemic operations parameters, validation math, and SLAs {!canEdit && "(Read-Only)"}
        </p>
      </div>

      <div className="flex space-x-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto hide-scrollbar">
        {visibleTabs.map((sec) => (
          <button
            key={sec.key}
            onClick={() => setSettingsSection(sec.key as any)}
            className={`px-4 py-2.5 rounded-xl transition-all ${
              currentSection === sec.key
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {sec.label}
          </button>
        ))}
      </div>

      <div className="w-full space-y-6">
        {currentSection === "general" && (
          <GeneralTab
            isAdmin={isAdmin}
            canEdit={canEdit}
            companyName={companyName}
            setCompanyName={setCompanyName}
            financialYear={financialYear}
            setFinancialYear={setFinancialYear}
            timezone={timezone}
            setTimezone={setTimezone}
            currency={currency}
            setCurrency={setCurrency}
            onSaveSettings={onSaveSettings}
          />
        )}

        {currentSection === "security" && (
          <SecurityTab />
        )}

        {currentSection === "payments" && (
          <PaymentsTab canEdit={canEdit} />
        )}

        {currentSection === "ai" && (
          <AISettingsTab
            canEdit={canEdit}
            aiModel={aiModel}
            setAiModel={setAiModel}
            aiExtractionVersion={aiExtractionVersion}
            setAiExtractionVersion={setAiExtractionVersion}
            aiConfidenceThreshold={aiConfidenceThreshold}
            setAiConfidenceThreshold={setAiConfidenceThreshold}
            aiTemperature={aiTemperature}
            setAiTemperature={setAiTemperature}
            onSaveSettings={onSaveSettings}
            providers={props.providers}
            onShowAddProviderModal={props.onShowAddProviderModal}
            onEditProvider={props.onEditProvider}
            onDeleteProvider={props.onDeleteProvider}
            onSeedProviders={props.onSeedProviders}
            onTestProvider={props.onTestProvider}
          />
        )}

        {currentSection === "validation" && (
          <ValidationTab
            canEdit={canEdit}
            rulesRequiredFields={rulesRequiredFields}
            setRulesRequiredFields={setRulesRequiredFields}
            rulesDuplicateDetection={rulesDuplicateDetection}
            setRulesDuplicateDetection={setRulesDuplicateDetection}
            rulesGstValidation={rulesGstValidation}
            setRulesGstValidation={setRulesGstValidation}
            rulesPoMatching={rulesPoMatching}
            setRulesPoMatching={setRulesPoMatching}
            rulesAmountTolerance={rulesAmountTolerance}
            setRulesAmountTolerance={setRulesAmountTolerance}
            gstToleranceAmount={gstToleranceAmount}
            setGstToleranceAmount={setGstToleranceAmount}
            poQtyTolerancePct={poQtyTolerancePct}
            setPoQtyTolerancePct={setPoQtyTolerancePct}
            poPriceTolerancePct={poPriceTolerancePct}
            setPoPriceTolerancePct={setPoPriceTolerancePct}
            poTaxTolerancePct={poTaxTolerancePct}
            setPoTaxTolerancePct={setPoTaxTolerancePct}
            poFreightToleranceAmount={poFreightToleranceAmount}
            setPoFreightToleranceAmount={setPoFreightToleranceAmount}
            poVendorNameThresholdPct={poVendorNameThresholdPct}
            setPoVendorNameThresholdPct={setPoVendorNameThresholdPct}
            poMinMatchScore={poMinMatchScore}
            setPoMinMatchScore={setPoMinMatchScore}
            gstReconciliationThresholdPct={gstReconciliationThresholdPct}
            setGstReconciliationThresholdPct={setGstReconciliationThresholdPct}
            gstMaxPastDays={gstMaxPastDays}
            setGstMaxPastDays={setGstMaxPastDays}
            gstPreventDuplicateIrn={gstPreventDuplicateIrn}
            setGstPreventDuplicateIrn={setGstPreventDuplicateIrn}
            gstCheckDateConsistency={gstCheckDateConsistency}
            setGstCheckDateConsistency={setGstCheckDateConsistency}
            gstHsnRules={gstHsnRules}
            gstHsnLoading={gstHsnLoading}
            gstHsnError={gstHsnError}
            openAddGstHsn={openAddGstHsn}
            handleGstHsnDelete={handleGstHsnDelete}
            onSaveSettings={onSaveSettings}
          />
        )}

        {currentSection === "workflow" && (
          <WorkflowTab
            canEdit={canEdit}
            workflowReviewerRequired={workflowReviewerRequired}
            setWorkflowReviewerRequired={setWorkflowReviewerRequired}
            workflowApproverRequired={workflowApproverRequired}
            setWorkflowApproverRequired={setWorkflowApproverRequired}
            workflowAutoReviewer={workflowAutoReviewer}
            setWorkflowAutoReviewer={setWorkflowAutoReviewer}
            workflowAutoApprover={workflowAutoApprover}
            setWorkflowAutoApprover={setWorkflowAutoApprover}
            workflowManualOverride={workflowManualOverride}
            setWorkflowManualOverride={setWorkflowManualOverride}
            workflowApprovalLevels={workflowApprovalLevels}
            setWorkflowApprovalLevels={setWorkflowApprovalLevels}
            escalationRole={escalationRole}
            setEscalationRole={setEscalationRole}
            approvalRules={approvalRules}
            approvalRulesLoading={approvalRulesLoading}
            approvalRulesError={approvalRulesError}
            openAddApprovalRule={openAddApprovalRule}
            openEditApprovalRule={openEditApprovalRule}
            handleApprovalRuleDelete={handleApprovalRuleDelete}
            onSaveSettings={onSaveSettings}
          />
        )}

        {currentSection === "sla" && (
          <SLATab
            canEdit={canEdit}
            slaReview={slaReview}
            setSlaReview={setSlaReview}
            slaApproval={slaApproval}
            setSlaApproval={setSlaApproval}
            slaProcessing={slaProcessing}
            setSlaProcessing={setSlaProcessing}
            slaReminderTime={slaReminderTime}
            setSlaReminderTime={setSlaReminderTime}
            slaEscalationTime={slaEscalationTime}
            setSlaEscalationTime={setSlaEscalationTime}
            slaCriticalThreshold={slaCriticalThreshold}
            setSlaCriticalThreshold={setSlaCriticalThreshold}
            slaGracePeriodHours={slaGracePeriodHours}
            setSlaGracePeriodHours={setSlaGracePeriodHours}
            onSaveSettings={onSaveSettings}
          />
        )}

        {currentSection === "pool" && (
          <div className="animate-fade-in">
            <KeyPoolPanel />
          </div>
        )}

        {currentSection === "prompt" && (
          <PromptTab
            canEdit={canEdit}
            currentPrompt={currentPrompt}
            setCurrentPrompt={setCurrentPrompt}
            promptHistory={promptHistory}
            newPromptVersionName={newPromptVersionName}
            setNewPromptVersionName={setNewPromptVersionName}
            newPromptVersionNotes={newPromptVersionNotes}
            setNewPromptVersionNotes={setNewPromptVersionNotes}
            promptTestResult={promptTestResult}
            onTestPrompt={onTestPrompt}
            onCreatePromptVersion={onCreatePromptVersion}
            onRollbackPrompt={onRollbackPrompt}
          />
        )}

        {currentSection === "webhooks" && (
          <WebhookTab
            canEdit={canEdit}
            webhookEnabled={webhookEnabled} setWebhookEnabled={setWebhookEnabled}
            webhookUrl={webhookUrl} setWebhookUrl={setWebhookUrl}
            webhookSecret={webhookSecret} setWebhookSecret={setWebhookSecret}
            webhookProvider={webhookProvider} setWebhookProvider={setWebhookProvider}
            webhookEvents={webhookEvents} setWebhookEvents={setWebhookEvents}
            discordWebhookUrl={discordWebhookUrl} setDiscordWebhookUrl={setDiscordWebhookUrl}
            notificationEvents={notificationEvents} setNotificationEvents={setNotificationEvents}
            onSaveSettings={onSaveSettings}
          />
        )}





          {currentSection === "tds" && (
            <TDSTab
              canEdit={isAdmin} // Auditor is read-only
              tdsRules={tdsRules}
              tdsLoading={tdsLoading}
              tdsError={tdsError}
              openAddTds={openAddTds}
              openEditTds={openEditTds}
              handleTdsDelete={handleTdsDelete}
              showTdsModal={showTdsModal}
              editingTdsRule={editingTdsRule}
              tdsForm={tdsForm}
              setTdsForm={setTdsForm}
              setShowTdsModal={setShowTdsModal}
              handleTdsSubmit={handleTdsSubmit}
            />
          )}

          {currentSection === "hsn-master" && (
            <HSNMasterTab
              canEdit={isAdmin} // Auditor is read-only
            />
          )}
        </div>

      {/* Add / Edit Approval Rule Modal */}
      {showApprovalRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-lg mx-4 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              {editingApprovalRule ? "Edit Approval Routing Rule" : "Add Approval Routing Rule"}
            </h3>
            <form onSubmit={handleApprovalRuleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-zinc-900 dark:text-zinc-100">
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Department</label>
                  <input value={approvalRuleForm.department} onChange={e => setApprovalRuleForm(f => ({...f, department: e.target.value}))} placeholder="e.g. Finance, HR" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Cost Center</label>
                  <input value={approvalRuleForm.cost_center} onChange={e => setApprovalRuleForm(f => ({...f, cost_center: e.target.value}))} placeholder="e.g. CC001" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Min Amount (₹) *</label>
                  <input required type="number" min="0" value={approvalRuleForm.min_amount} onChange={e => setApprovalRuleForm(f => ({...f, min_amount: Number(e.target.value)}))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Max Amount (₹, leave blank for no limit)</label>
                  <input type="number" min="0" value={approvalRuleForm.max_amount} onChange={e => setApprovalRuleForm(f => ({...f, max_amount: e.target.value}))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">SLA Target (Hours) *</label>
                  <input required type="number" min="1" value={approvalRuleForm.sla_hours} onChange={e => setApprovalRuleForm(f => ({...f, sla_hours: Number(e.target.value)}))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Approver Roles (comma-separated, in order) *</label>
                <input required value={approvalRuleForm.approvers.join(", ")} onChange={e => setApprovalRuleForm(f => ({...f, approvers: e.target.value.split(",").map(s => s.trim()).filter(Boolean)}))} placeholder="e.g. Approver, Finance Manager" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
              </div>

              <div className="flex items-center gap-3 py-2">
                <input type="checkbox" id="rule-auto-approve" checked={approvalRuleForm.auto_approve_enabled} onChange={e => setApprovalRuleForm(f => ({...f, auto_approve_enabled: e.target.checked}))} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700 cursor-pointer" />
                <label htmlFor="rule-auto-approve" className="text-xs text-zinc-600 dark:text-zinc-350 cursor-pointer select-none">Auto-approve invoices matching this rule</label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-150 dark:border-zinc-800/80">
                <button type="button" onClick={() => setShowApprovalRuleModal(false)} className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-250 dark:hover:bg-zinc-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-colors">
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit GST HSN Rule Modal */}
      {showGstHsnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm mx-4 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Add GST HSN Compliance Rule</h3>
            <form onSubmit={handleGstHsnSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">HSN Code Prefix *</label>
                <input required value={gstHsnForm.hsn_prefix} onChange={e => setGstHsnForm(f => ({...f, hsn_prefix: e.target.value}))} placeholder="e.g. 9965" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">GST Rule Type *</label>
                <select value={gstHsnForm.rule_type} onChange={e => setGstHsnForm(f => ({...f, rule_type: e.target.value as any}))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100">
                  <option value="RCM">Reverse Charge (RCM)</option>
                  <option value="BLOCKED_ITC">Blocked ITC (Ineligible Credit)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-150 dark:border-zinc-800/80">
                <button type="button" onClick={() => setShowGstHsnModal(false)} className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-350 rounded-xl hover:bg-zinc-250 dark:hover:bg-zinc-700 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-colors">Create Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
