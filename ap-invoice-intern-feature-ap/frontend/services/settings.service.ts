import apiClient from "./api-client";

export interface SettingsData {
  company_name: string;
  timezone: string;
  currency: string;
  financial_year: string;
  language: string;
  
  ai_model: string;
  ai_temperature: number;
  ai_confidence_threshold: number;
  ai_extraction_version: string;
  ai_prompt_version: string;
  ai_prompt_notes: string | null;

  workflow_reviewer_required: boolean;
  workflow_approver_required: boolean;
  workflow_auto_reviewer: boolean;
  workflow_auto_approver: boolean;
  workflow_approval_levels: number;
  workflow_manual_override: boolean;

  rules_required_fields: Record<string, boolean>;
  rules_duplicate_detection: boolean;
  rules_gst_validation: boolean;
  rules_po_matching: boolean;
  rules_amount_tolerance: number;

  // DB-backed GST Compliance Settings
  gst_tolerance_amount: number;
  gst_reconciliation_threshold_pct: number;
  gst_max_past_days: number;
  gst_prevent_duplicate_irn: boolean;
  gst_check_date_consistency: boolean;

  sla_review: number;
  sla_approval: number;
  sla_processing: number;
  sla_reminder_time: number;
  sla_escalation_time: number;
  sla_critical_threshold: number;
  escalation_role: string;
  sla_grace_period_hours: number;

  // DB-backed PO Match Compliance Settings
  po_qty_tolerance_pct: number;
  po_price_tolerance_pct: number;
  po_tax_tolerance_pct: number;
  po_freight_tolerance_amount: number;
  po_vendor_name_threshold_pct: number;
  po_min_match_score: number;
}

export interface GSTConfigData {
  gst_tolerance_amount: number;
  gst_reconciliation_threshold_pct: number;
  gst_max_past_days: number;
  gst_prevent_duplicate_irn: boolean;
  gst_check_date_consistency: boolean;
}

export interface POMatchConfigData {
  po_qty_tolerance_pct: number;
  po_price_tolerance_pct: number;
  po_tax_tolerance_pct: number;
  po_freight_tolerance_amount: number;
  po_vendor_name_threshold_pct: number;
  po_min_match_score: number;
}

export interface GSTHsnRule {
  id: number;
  organization_id: string | null;
  hsn_prefix: string;
  rule_type: "RCM" | "BLOCKED_ITC";
}

export interface GSTHsnRuleCreate {
  hsn_prefix: string;
  rule_type: "RCM" | "BLOCKED_ITC";
}

export const settingsService = {
  getSettings: async (organizationId?: string): Promise<SettingsData> => {
    const url = organizationId ? `/settings/?organization_id=${organizationId}` : "/settings/";
    const response = await apiClient.get<SettingsData>(url);
    return response.data;
  },

  updateSettings: async (settings: SettingsData, organizationId?: string): Promise<SettingsData> => {
    const url = organizationId ? `/settings/?organization_id=${organizationId}` : "/settings/";
    const response = await apiClient.put<SettingsData>(url, settings);
    return response.data;
  },

  getGstConfig: async (organizationId?: string): Promise<GSTConfigData> => {
    const url = organizationId ? `/settings/gst-config?organization_id=${organizationId}` : "/settings/gst-config";
    const response = await apiClient.get<GSTConfigData>(url);
    return response.data;
  },

  updateGstConfig: async (config: Partial<GSTConfigData>, organizationId?: string): Promise<GSTConfigData> => {
    const url = organizationId ? `/settings/gst-config?organization_id=${organizationId}` : "/settings/gst-config";
    const response = await apiClient.put<GSTConfigData>(url, config);
    return response.data;
  },

  getPoMatchConfig: async (organizationId?: string): Promise<POMatchConfigData> => {
    const url = organizationId ? `/settings/po-match-config?organization_id=${organizationId}` : "/settings/po-match-config";
    const response = await apiClient.get<POMatchConfigData>(url);
    return response.data;
  },

  updatePoMatchConfig: async (config: Partial<POMatchConfigData>, organizationId?: string): Promise<POMatchConfigData> => {
    const url = organizationId ? `/settings/po-match-config?organization_id=${organizationId}` : "/settings/po-match-config";
    const response = await apiClient.put<POMatchConfigData>(url, config);
    return response.data;
  },
};

export const gstHsnRuleService = {
  getRules: async (): Promise<GSTHsnRule[]> => {
    const response = await apiClient.get<GSTHsnRule[]>("/settings/gst-hsn-rules");
    return response.data;
  },

  createRule: async (rule: GSTHsnRuleCreate): Promise<GSTHsnRule> => {
    const response = await apiClient.post<GSTHsnRule>("/settings/gst-hsn-rules", rule);
    return response.data;
  },

  deleteRule: async (id: number): Promise<void> => {
    await apiClient.delete(`/settings/gst-hsn-rules/${id}`);
  },
};

export interface ApprovalRule {
  id: number;
  department: string | null;
  cost_center: string | null;
  min_amount: number;
  max_amount: number | null;
  auto_approve: number | null;
  approvers: string[];
  sla_hours: number;
}

export interface ApprovalRuleCreate {
  department?: string | null;
  cost_center?: string | null;
  min_amount: number;
  max_amount?: number | null;
  auto_approve?: number | null;
  approvers: string[];
  sla_hours: number;
}

export const approvalRuleService = {
  getRules: async (): Promise<ApprovalRule[]> => {
    const response = await apiClient.get<ApprovalRule[]>("/settings/approval-rules");
    return response.data;
  },

  createRule: async (rule: ApprovalRuleCreate): Promise<ApprovalRule> => {
    const response = await apiClient.post<ApprovalRule>("/settings/approval-rules", rule);
    return response.data;
  },

  updateRule: async (id: number, rule: Partial<ApprovalRuleCreate>): Promise<ApprovalRule> => {
    const response = await apiClient.put<ApprovalRule>(`/settings/approval-rules/${id}`, rule);
    return response.data;
  },

  deleteRule: async (id: number): Promise<void> => {
    await apiClient.delete(`/settings/approval-rules/${id}`);
  },
};

export default settingsService;
