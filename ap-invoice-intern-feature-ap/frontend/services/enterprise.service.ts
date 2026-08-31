import apiClient from "./api-client";

class EnterpriseService {
  async configureTdsSection(data: {
    section_code: string;
    description?: string;
    rate_with_pan: number;
    rate_without_pan: number;
    single_threshold: number;
    aggregate_threshold: number;
  }) {
    const response = await apiClient.post("/enterprise/tds/config", data);
    return response.data;
  }

  async calculateTds(data: { invoice_id: number; section_code: string; vendor_pan?: string }) {
    const response = await apiClient.post("/enterprise/tds/calculate", data);
    return response.data;
  }

  async verifyGst(data: { invoice_id: number }) {
    const response = await apiClient.post("/enterprise/gst/verify", data);
    return response.data;
  }

  async poMatch(data: { invoice_id: number; is_three_way: boolean }) {
    const response = await apiClient.post("/enterprise/po-match", data);
    return response.data;
  }

  async checkDuplicate(invoiceId: number) {
    const response = await apiClient.get(`/enterprise/duplicate-check/${invoiceId}`);
    return response.data;
  }

  async createApprovalRule(data: {
    department?: string;
    cost_center?: string;
    min_amount: number;
    max_amount?: number;
    auto_approve?: number;
    approvers: string[];
    sla_hours: number;
  }) {
    const response = await apiClient.post("/enterprise/approvals/rule", data);
    return response.data;
  }

  async submitApprovalDecision(data: {
    invoice_id: number;
    actor: string;
    action: string;
    rejection_reason?: string;
    comments?: string;
  }) {
    const response = await apiClient.post("/enterprise/approvals/decision", data);
    return response.data;
  }

  async runSlaCheck() {
    const response = await apiClient.post("/enterprise/approvals/sla-check");
    return response.data;
  }

  async schedulePayment(data: { invoice_id: number; scheduled_date: string }) {
    const response = await apiClient.post("/enterprise/payments/schedule", data);
    return response.data;
  }

  async recordPayment(data: {
    invoice_id: number;
    amount_paid: number;
    payment_method: string;
    reference_number?: string;
  }) {
    const response = await apiClient.post("/enterprise/payments/record", data);
    return response.data;
  }

  async postCreditDebitNote(data: {
    invoice_id: number;
    note_number: string;
    note_type: string;
    amount: number;
    reason?: string;
  }) {
    const response = await apiClient.post("/enterprise/payments/credit-debit-note", data);
    return response.data;
  }

  async getPendingExceptions() {
    const response = await apiClient.get("/enterprise/exceptions/pending");
    return response.data;
  }

  async resolveException(data: {
    exception_id: number;
    resolved_by: string;
    corrections?: Record<string, any>;
  }) {
    const response = await apiClient.post("/enterprise/exceptions/resolve", data);
    return response.data;
  }

  async getAnalyticsDashboard() {
    const response = await apiClient.get("/enterprise/analytics/dashboard");
    return response.data;
  }

  async getIntegrationsStatus() {
    const response = await apiClient.get("/integrations/status");
    return response.data;
  }

  async getSyncLogs() {
    const response = await apiClient.get("/integrations/logs");
    return response.data;
  }

  async retrySyncLog(logId: number) {
    const response = await apiClient.post(`/integrations/retry/${logId}`);
    return response.data;
  }

  getCSVReportUrl(reportType: string) {
    const baseUrl = apiClient.defaults.baseURL || "";
    return `${baseUrl}/enterprise/reports/csv?report_type=${reportType}`;
  }
}

const enterpriseService = new EnterpriseService();
export default enterpriseService;
