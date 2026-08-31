"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import SettingsPanel from "../../../components/settings/SettingsPanel";
import { useAppStore } from "../../../store/useAppStore";
import { getSettings, updateSettings, getPrompts, createPrompt, activatePrompt, testPrompt, aiProviderService } from "../../../services/api";
import { toast } from "sonner";
import { useConfirmStore } from "../../../store/useConfirmStore";

export default function SettingsPage() {
  const { role, fetchAllData, invoices } = useAppStore();

  const [settingsSection, setSettingsSection] = useState<"general" | "security" | "ai" | "prompt" | "workflow" | "validation" | "sla" | "pool" | "tds" | "payments" | "webhooks" | "hsn-master">("general");

  const [companyName, setCompanyName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [currency, setCurrency] = useState("");
  const [financialYear, setFinancialYear] = useState("");
  const [language, setLanguage] = useState("");

  const [aiModel, setAiModel] = useState("");
  const [aiTemperature, setAiTemperature] = useState(0.0);
  const [aiConfidenceThreshold, setAiConfidenceThreshold] = useState(0.0);
  const [aiExtractionVersion, setAiExtractionVersion] = useState("");
  const [aiPromptVersion, setAiPromptVersion] = useState("");
  const [aiPromptNotes, setAiPromptNotes] = useState("");

  const [currentPrompt, setCurrentPrompt] = useState("");
  const [promptHistory, setPromptHistory] = useState<any[]>([]);
  const [newPromptVersionName, setNewPromptVersionName] = useState("");
  const [newPromptVersionNotes, setNewPromptVersionNotes] = useState("");
  const [promptTestResult, setPromptTestResult] = useState<any | null>(null);

  const [providers, setProviders] = useState<any[]>([]);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [providerForm, setProviderForm] = useState({
    name: "", api_url: "", api_key: "", model: "", response_format: "openai", priority: 100, enabled: true
  });

  const [workflowReviewerRequired, setWorkflowReviewerRequired] = useState(false);
  const [workflowApproverRequired, setWorkflowApproverRequired] = useState(false);
  const [workflowAutoReviewer, setWorkflowAutoReviewer] = useState(false);
  const [workflowAutoApprover, setWorkflowAutoApprover] = useState(false);
  const [workflowApprovalLevels, setWorkflowApprovalLevels] = useState(0);
  const [workflowManualOverride, setWorkflowManualOverride] = useState(false);

  const [rulesRequiredFields, setRulesRequiredFields] = useState<any>({
    invoice_number: false, invoice_date: false, seller_gstin: false, buyer_gstin: false, total_amount: false,
  });
  const [rulesDuplicateDetection, setRulesDuplicateDetection] = useState(false);
  const [rulesGstValidation, setRulesGstValidation] = useState(false);
  const [rulesPoMatching, setRulesPoMatching] = useState(false);
  const [rulesAmountTolerance, setRulesAmountTolerance] = useState(0.0);

  // GST compliance settings states
  const [gstToleranceAmount, setGstToleranceAmount] = useState(1.0);
  const [gstReconciliationThresholdPct, setGstReconciliationThresholdPct] = useState(98.0);
  const [gstMaxPastDays, setGstMaxPastDays] = useState(30);
  const [gstPreventDuplicateIrn, setGstPreventDuplicateIrn] = useState(true);
  const [gstCheckDateConsistency, setGstCheckDateConsistency] = useState(true);

  // PO match tolerances states
  const [poQtyTolerancePct, setPoQtyTolerancePct] = useState(5.0);
  const [poPriceTolerancePct, setPoPriceTolerancePct] = useState(2.0);
  const [poTaxTolerancePct, setPoTaxTolerancePct] = useState(0.0);
  const [poFreightToleranceAmount, setPoFreightToleranceAmount] = useState(50.0);
  const [poVendorNameThresholdPct, setPoVendorNameThresholdPct] = useState(85.0);
  const [poMinMatchScore, setPoMinMatchScore] = useState(80.0);

  const [slaReview, setSlaReview] = useState(0);
  const [slaApproval, setSlaApproval] = useState(0);
  const [slaProcessing, setSlaProcessing] = useState(0);
  const [slaReminderTime, setSlaReminderTime] = useState(0);
  const [slaEscalationTime, setSlaEscalationTime] = useState(0);
  const [slaCriticalThreshold, setSlaCriticalThreshold] = useState(0);

  const [escalationRole, setEscalationRole] = useState("Admin");
  const [slaGracePeriodHours, setSlaGracePeriodHours] = useState(2);

  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookProvider, setWebhookProvider] = useState("INTERNAL_SANDBOX");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [notificationEvents, setNotificationEvents] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [settingsData, promptsData, providersData] = await Promise.all([
          getSettings().catch(() => null),
          getPrompts().catch(() => []),
          aiProviderService.getProviders().catch(() => [])
        ]);

        if (settingsData) {
          setCompanyName(settingsData.company_name);
          setTimezone(settingsData.timezone);
          setCurrency(settingsData.currency);
          setFinancialYear(settingsData.financial_year);
          setLanguage(settingsData.language);
          setAiModel(settingsData.ai_model);
          setAiTemperature(settingsData.ai_temperature);
          setAiConfidenceThreshold(settingsData.ai_confidence_threshold);
          setAiExtractionVersion(settingsData.ai_extraction_version);
          setAiPromptVersion(settingsData.ai_prompt_version);
          setAiPromptNotes(settingsData.ai_prompt_notes || "");
          setWorkflowReviewerRequired(settingsData.workflow_reviewer_required);
          setWorkflowApproverRequired(settingsData.workflow_approver_required);
          setWorkflowAutoReviewer(settingsData.workflow_auto_reviewer);
          setWorkflowAutoApprover(settingsData.workflow_auto_approver);
          setWorkflowApprovalLevels(settingsData.workflow_approval_levels);
          setWorkflowManualOverride(settingsData.workflow_manual_override);
          setRulesRequiredFields(settingsData.rules_required_fields);
          setRulesDuplicateDetection(settingsData.rules_duplicate_detection);
          setRulesGstValidation(settingsData.rules_gst_validation);
          setRulesPoMatching(settingsData.rules_po_matching);
          setRulesAmountTolerance(settingsData.rules_amount_tolerance);
          setGstToleranceAmount(settingsData.gst_tolerance_amount ?? 1.0);
          setGstReconciliationThresholdPct(settingsData.gst_reconciliation_threshold_pct ?? 98.0);
          setGstMaxPastDays(settingsData.gst_max_past_days ?? 30);
          setGstPreventDuplicateIrn(settingsData.gst_prevent_duplicate_irn ?? true);
          setGstCheckDateConsistency(settingsData.gst_check_date_consistency ?? true);

          setPoQtyTolerancePct(settingsData.po_qty_tolerance_pct ?? 5.0);
          setPoPriceTolerancePct(settingsData.po_price_tolerance_pct ?? 2.0);
          setPoTaxTolerancePct(settingsData.po_tax_tolerance_pct ?? 0.0);
          setPoFreightToleranceAmount(settingsData.po_freight_tolerance_amount ?? 50.0);
          setPoVendorNameThresholdPct(settingsData.po_vendor_name_threshold_pct ?? 85.0);
          setPoMinMatchScore(settingsData.po_min_match_score ?? 80.0);

          setSlaReview(settingsData.sla_review);
          setSlaApproval(settingsData.sla_approval);
          setSlaProcessing(settingsData.sla_processing);
          setSlaReminderTime(settingsData.sla_reminder_time);
          setSlaEscalationTime(settingsData.sla_escalation_time);
          setSlaCriticalThreshold(settingsData.sla_critical_threshold);
          setEscalationRole(settingsData.escalation_role ?? "Admin");
          setSlaGracePeriodHours(settingsData.sla_grace_period_hours ?? 2);

          setWebhookEnabled(settingsData.webhook_enabled ?? false);
          setWebhookUrl(settingsData.webhook_url ?? "");
          setWebhookSecret(settingsData.webhook_secret ?? "");
          setWebhookProvider(settingsData.webhook_provider ?? "INTERNAL_SANDBOX");
          setWebhookEvents(settingsData.webhook_events ?? []);
          setDiscordWebhookUrl(settingsData.discord_webhook_url ?? "");
          setNotificationEvents(settingsData.notification_events ?? []);
        }

        if (promptsData && promptsData.length > 0) {
          setPromptHistory(promptsData.map((p: any) => ({
            id: p.id, version: p.version, date: new Date(p.created_at).toLocaleDateString(),
            author: p.author, notes: p.notes || "", content: p.content, is_active: p.is_active
          })));
          const active = promptsData.find((p: any) => p.is_active);
          if (active) {
            setCurrentPrompt(active.content);
            setAiPromptVersion(active.version);
          }
        }
        
        if (providersData) {
          setProviders(providersData);
        }
      } catch (err) {
        console.error("Settings load failed", err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSaveSettings = async (sectionName: string) => {
    try {
      const payload = {
        company_name: companyName, timezone, currency, financial_year: financialYear, language,
        ai_model: aiModel, ai_temperature: aiTemperature, ai_confidence_threshold: aiConfidenceThreshold,
        ai_extraction_version: aiExtractionVersion, ai_prompt_version: aiPromptVersion, ai_prompt_notes: aiPromptNotes,
        workflow_reviewer_required: workflowReviewerRequired, workflow_approver_required: workflowApproverRequired,
        workflow_auto_reviewer: workflowAutoReviewer, workflow_auto_approver: workflowAutoApprover,
        workflow_approval_levels: workflowApprovalLevels, workflow_manual_override: workflowManualOverride,
        rules_required_fields: rulesRequiredFields, rules_duplicate_detection: rulesDuplicateDetection,
        rules_gst_validation: rulesGstValidation, rules_po_matching: rulesPoMatching, rules_amount_tolerance: rulesAmountTolerance,
        gst_tolerance_amount: gstToleranceAmount,
        gst_reconciliation_threshold_pct: gstReconciliationThresholdPct,
        gst_max_past_days: gstMaxPastDays,
        gst_prevent_duplicate_irn: gstPreventDuplicateIrn,
        gst_check_date_consistency: gstCheckDateConsistency,
        po_qty_tolerance_pct: poQtyTolerancePct,
        po_price_tolerance_pct: poPriceTolerancePct,
        po_tax_tolerance_pct: poTaxTolerancePct,
        po_freight_tolerance_amount: poFreightToleranceAmount,
        po_vendor_name_threshold_pct: poVendorNameThresholdPct,
        po_min_match_score: poMinMatchScore,
        sla_review: slaReview, sla_approval: slaApproval, sla_processing: slaProcessing,
        sla_reminder_time: slaReminderTime, sla_escalation_time: slaEscalationTime, sla_critical_threshold: slaCriticalThreshold,
        escalation_role: escalationRole,
        sla_grace_period_hours: Number(slaGracePeriodHours),
        webhook_enabled: webhookEnabled,
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        webhook_provider: webhookProvider,
        webhook_events: webhookEvents,
        discord_webhook_url: discordWebhookUrl,
        notification_events: notificationEvents,
      };
      await updateSettings(payload);
      toast.success(`${sectionName} Settings saved successfully!`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to save ${sectionName} Settings: ` + (err.response?.data?.detail || err.message));
    }
  };

  const handleTestPrompt = async () => {
    try {
      const sampleInvoice = invoices.find(inv => inv.raw_ocr_text);
      if (!sampleInvoice) {
        toast.warning("No invoices with raw OCR text found to test against.");
        return;
      }
      toast.info("Testing prompt with sample invoice...");
      const res = await testPrompt(currentPrompt, sampleInvoice.raw_ocr_text);
      if (res.success) {
        setPromptTestResult({ status: "success", parsedOutput: res.extracted_json });
        toast.success("System prompt tested successfully!");
      } else {
        toast.error("Prompt test failed: " + (res.error || "Invalid response"));
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Prompt test connection failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreatePromptVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromptVersionName) return;
    try {
      await createPrompt({
        version: newPromptVersionName,
        content: currentPrompt,
        notes: newPromptVersionNotes || "Updated AI prompt version constraints",
        is_active: true
      });
      toast.success(`Prompt version ${newPromptVersionName} created and activated!`);
      setNewPromptVersionName("");
      setNewPromptVersionNotes("");
      
      // Refresh prompt list
      const promptsData = await getPrompts();
      if (promptsData) {
        setPromptHistory(promptsData.map((p: any) => ({
          id: p.id, version: p.version, date: new Date(p.created_at).toLocaleDateString(),
          author: p.author, notes: p.notes || "", content: p.content, is_active: p.is_active
        })));
        const active = promptsData.find((p: any) => p.is_active);
        if (active) {
          setCurrentPrompt(active.content);
          setAiPromptVersion(active.version);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to create prompt version: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleRollbackPrompt = async (id: number) => {
    const promptVer = promptHistory.find(p => p.id === id);
    if (!promptVer) return;
    const confirmed = await useConfirmStore.getState().confirm({
      title: "Activate Prompt Version",
      message: `Activate prompt version ${promptVer.version || ""}?`,
      roleAccent: "blue"
    });
    if (confirmed) {
      try {
        await activatePrompt(id);
        toast.success(`Prompt version ${promptVer.version || ""} activated successfully!`);
        // Refresh prompts
        const promptsData = await getPrompts();
        if (promptsData) {
          setPromptHistory(promptsData.map((p: any) => ({
            id: p.id, version: p.version, date: new Date(p.created_at).toLocaleDateString(),
            author: p.author, notes: p.notes || "", content: p.content, is_active: p.is_active
          })));
          const active = promptsData.find((p: any) => p.is_active);
          if (active) {
            setCurrentPrompt(active.content);
            setAiPromptVersion(active.version);
          }
        }
      } catch (err: any) {
        console.error(err);
        toast.error("Failed to activate prompt version.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
        <svg className="animate-spin h-8 w-8 text-rose-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-zinc-550 text-xs font-bold tracking-wider uppercase select-none">Retrieving Settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SettingsPanel
        role={role}
        settingsSection={settingsSection} setSettingsSection={setSettingsSection}
        companyName={companyName} setCompanyName={setCompanyName}
        timezone={timezone} setTimezone={setTimezone}
        currency={currency} setCurrency={setCurrency}
        financialYear={financialYear} setFinancialYear={setFinancialYear}
        language={language} setLanguage={setLanguage}
        aiModel={aiModel} setAiModel={setAiModel}
        aiTemperature={aiTemperature} setAiTemperature={setAiTemperature}
        aiConfidenceThreshold={aiConfidenceThreshold} setAiConfidenceThreshold={setAiConfidenceThreshold}
        aiExtractionVersion={aiExtractionVersion} setAiExtractionVersion={setAiExtractionVersion}
        aiPromptVersion={aiPromptVersion} setAiPromptVersion={setAiPromptVersion}
        aiPromptNotes={aiPromptNotes} setAiPromptNotes={setAiPromptNotes}
        currentPrompt={currentPrompt} setCurrentPrompt={setCurrentPrompt}
        promptHistory={promptHistory}
        newPromptVersionName={newPromptVersionName} setNewPromptVersionName={setNewPromptVersionName}
        newPromptVersionNotes={newPromptVersionNotes} setNewPromptVersionNotes={setNewPromptVersionNotes}
        promptTestResult={promptTestResult}
        workflowReviewerRequired={workflowReviewerRequired} setWorkflowReviewerRequired={setWorkflowReviewerRequired}
        workflowApproverRequired={workflowApproverRequired} setWorkflowApproverRequired={setWorkflowApproverRequired}
        workflowAutoReviewer={workflowAutoReviewer} setWorkflowAutoReviewer={setWorkflowAutoReviewer}
        workflowAutoApprover={workflowAutoApprover} setWorkflowAutoApprover={setWorkflowAutoApprover}
        workflowApprovalLevels={workflowApprovalLevels} setWorkflowApprovalLevels={setWorkflowApprovalLevels}
        workflowManualOverride={workflowManualOverride} setWorkflowManualOverride={setWorkflowManualOverride}
        rulesRequiredFields={rulesRequiredFields} setRulesRequiredFields={setRulesRequiredFields}
        rulesDuplicateDetection={rulesDuplicateDetection} setRulesDuplicateDetection={setRulesDuplicateDetection}
        rulesGstValidation={rulesGstValidation} setRulesGstValidation={setRulesGstValidation}
        rulesPoMatching={rulesPoMatching} setRulesPoMatching={setRulesPoMatching}
        rulesAmountTolerance={rulesAmountTolerance} setRulesAmountTolerance={setRulesAmountTolerance}
        gstToleranceAmount={gstToleranceAmount} setGstToleranceAmount={setGstToleranceAmount}
        gstReconciliationThresholdPct={gstReconciliationThresholdPct} setGstReconciliationThresholdPct={setGstReconciliationThresholdPct}
        gstMaxPastDays={gstMaxPastDays} setGstMaxPastDays={setGstMaxPastDays}
        gstPreventDuplicateIrn={gstPreventDuplicateIrn} setGstPreventDuplicateIrn={setGstPreventDuplicateIrn}
        gstCheckDateConsistency={gstCheckDateConsistency} setGstCheckDateConsistency={setGstCheckDateConsistency}
        poQtyTolerancePct={poQtyTolerancePct} setPoQtyTolerancePct={setPoQtyTolerancePct}
        poPriceTolerancePct={poPriceTolerancePct} setPoPriceTolerancePct={setPoPriceTolerancePct}
        poTaxTolerancePct={poTaxTolerancePct} setPoTaxTolerancePct={setPoTaxTolerancePct}
        poFreightToleranceAmount={poFreightToleranceAmount} setPoFreightToleranceAmount={setPoFreightToleranceAmount}
        poVendorNameThresholdPct={poVendorNameThresholdPct} setPoVendorNameThresholdPct={setPoVendorNameThresholdPct}
        poMinMatchScore={poMinMatchScore} setPoMinMatchScore={setPoMinMatchScore}
        slaReview={slaReview} setSlaReview={setSlaReview}
        slaApproval={slaApproval} setSlaApproval={setSlaApproval}
        slaProcessing={slaProcessing} setSlaProcessing={setSlaProcessing}
        slaReminderTime={slaReminderTime} setSlaReminderTime={setSlaReminderTime}
        slaEscalationTime={slaEscalationTime} setSlaEscalationTime={setSlaEscalationTime}
        slaCriticalThreshold={slaCriticalThreshold} setSlaCriticalThreshold={setSlaCriticalThreshold}
        escalationRole={escalationRole} setEscalationRole={setEscalationRole}
        slaGracePeriodHours={slaGracePeriodHours} setSlaGracePeriodHours={setSlaGracePeriodHours}
        webhookEnabled={webhookEnabled} setWebhookEnabled={setWebhookEnabled}
        webhookUrl={webhookUrl} setWebhookUrl={setWebhookUrl}
        webhookSecret={webhookSecret} setWebhookSecret={setWebhookSecret}
        webhookProvider={webhookProvider} setWebhookProvider={setWebhookProvider}
        webhookEvents={webhookEvents} setWebhookEvents={setWebhookEvents}
        discordWebhookUrl={discordWebhookUrl} setDiscordWebhookUrl={setDiscordWebhookUrl}
        notificationEvents={notificationEvents} setNotificationEvents={setNotificationEvents}
        onSaveSettings={handleSaveSettings}
        onTestPrompt={handleTestPrompt}
        onCreatePromptVersion={handleCreatePromptVersion}
        onRollbackPrompt={handleRollbackPrompt}
        providers={providers}
        onShowAddProviderModal={() => {
          setSelectedProvider(null);
          setProviderForm({ name: "", api_url: "", api_key: "", model: "", response_format: "openai", priority: 100, enabled: true });
          setShowProviderModal(true);
        }}
        onEditProvider={(prov) => {
          setSelectedProvider(prov);
          setProviderForm({
            name: prov.name, api_url: prov.api_url, api_key: "", model: prov.model || "",
            response_format: prov.response_format, priority: prov.priority, enabled: prov.enabled,
          });
          setShowProviderModal(true);
        }}
        onDeleteProvider={async (id) => {
          try {
            await aiProviderService.deleteProvider(id);
            toast.success("AI Provider deleted successfully");
            const data = await aiProviderService.getProviders();
            setProviders(data);
          } catch (err: any) {
            toast.error(err.response?.data?.detail || "Failed to delete provider");
          }
        }}
        onSeedProviders={async () => {
          try {
            await aiProviderService.seedProviders();
            toast.success("AI Providers seeded successfully");
            const data = await aiProviderService.getProviders();
            setProviders(data);
          } catch (err: any) {
            toast.error("Failed to seed providers from environment");
          }
        }}
        onTestProvider={async (id) => {
          try {
            const res = await aiProviderService.testProvider(id);
            if (res.success) {
              toast.success(`Connection succeeded! ${res.response || ""}`);
            } else {
              toast.error(`Connection failed: ${res.error || "Invalid response"}`);
            }
          } catch (err: any) {
            toast.error("Connection test failed: " + (err.response?.data?.detail || err.message));
          }
        }}
      />

      {/* React Portal Modal for adding/editing AI Provider */}
      {showProviderModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div 
            onClick={() => {
              setShowProviderModal(false);
              setSelectedProvider(null);
            }}
            className="absolute inset-0 bg-black/60 transition-opacity duration-300"
          />

          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-3xl p-6 overflow-hidden flex flex-col space-y-4 animate-scale-in text-xs font-bold text-zinc-900 dark:text-white">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider">
                {selectedProvider ? "Edit AI Provider" : "Add AI Provider"}
              </h3>
              <button 
                onClick={() => {
                  setShowProviderModal(false);
                  setSelectedProvider(null);
                }}
                className="text-zinc-400 hover:text-zinc-650 transition-colors"
              >
                ✕
              </button>
            </div>

            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const payload = {
                    name: providerForm.name,
                    api_url: providerForm.api_url,
                    api_key: providerForm.api_key || undefined,
                    model: providerForm.model || undefined,
                    response_format: providerForm.response_format,
                    priority: Number(providerForm.priority),
                    enabled: providerForm.enabled
                  };
                  if (selectedProvider) {
                    await aiProviderService.updateProvider(selectedProvider.id, payload);
                    toast.success("AI Provider updated successfully");
                  } else {
                    await aiProviderService.addProvider(payload);
                    toast.success("AI Provider created successfully");
                  }
                  setShowProviderModal(false);
                  setSelectedProvider(null);
                  const data = await aiProviderService.getProviders();
                  setProviders(data);
                } catch (err: any) {
                  toast.error(err.response?.data?.detail || "Failed to save AI provider config");
                }
              }} 
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] text-zinc-450 uppercase tracking-widest mb-1">Provider Name</label>
                <input 
                  type="text" 
                  required 
                  value={providerForm.name} 
                  onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                  placeholder="e.g. OpenAI GPT-4o" 
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#3B82F6]/50 transition-all text-zinc-900 dark:text-zinc-100" 
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-450 uppercase tracking-widest mb-1">API URL</label>
                <input 
                  type="url" 
                  required 
                  value={providerForm.api_url} 
                  onChange={(e) => setProviderForm({ ...providerForm, api_url: e.target.value })}
                  placeholder="e.g. https://api.openai.com/v1" 
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#3B82F6]/50 transition-all text-zinc-900 dark:text-zinc-100" 
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-450 uppercase tracking-widest mb-1">API Secret Key (Leave blank to keep current)</label>
                <input 
                  type="password" 
                  value={providerForm.api_key} 
                  onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
                  placeholder="••••••••••••" 
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#3B82F6]/50 transition-all text-zinc-900 dark:text-zinc-100" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-450 uppercase tracking-widest mb-1">Model Name</label>
                  <input 
                    type="text" 
                    value={providerForm.model} 
                    onChange={(e) => setProviderForm({ ...providerForm, model: e.target.value })}
                    placeholder="e.g. gpt-4o" 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#3B82F6]/50 transition-all text-zinc-900 dark:text-zinc-100" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-450 uppercase tracking-widest mb-1">Response Format</label>
                  <select 
                    value={providerForm.response_format} 
                    onChange={(e) => setProviderForm({ ...providerForm, response_format: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#3B82F6]/50 transition-all text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="openai">OpenAI JSON</option>
                    <option value="gemini">Gemini Structure</option>
                    <option value="groq">Groq JSON Schema</option>
                    <option value="colab">Colab OCR Proxy</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center pt-2">
                <div>
                  <label className="block text-[10px] text-zinc-450 uppercase tracking-widest mb-1">Priority Order</label>
                  <input 
                    type="number" 
                    required 
                    value={providerForm.priority} 
                    onChange={(e) => setProviderForm({ ...providerForm, priority: Number(e.target.value) })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#3B82F6]/50 transition-all text-zinc-900 dark:text-zinc-100" 
                  />
                </div>
                <div className="flex items-center gap-2 pt-4 select-none">
                  <input 
                    type="checkbox" 
                    id="provider-enabled"
                    checked={providerForm.enabled} 
                    onChange={(e) => setProviderForm({ ...providerForm, enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700 cursor-pointer" 
                  />
                  <label htmlFor="provider-enabled" className="text-xs text-zinc-600 dark:text-zinc-350 cursor-pointer">Enabled</label>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-150 dark:border-zinc-800/80">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowProviderModal(false);
                    setSelectedProvider(null);
                  }}
                  className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-250 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-colors"
                >
                  {selectedProvider ? "Save Changes" : "Create Provider"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
