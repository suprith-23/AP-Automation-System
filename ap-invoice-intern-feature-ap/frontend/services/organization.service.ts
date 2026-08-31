import apiClient from "./api-client";

export interface OrganizationStats {
  user_count: number;
  invoice_count: number;
}

class OrganizationService {
  async getOverallStats() {
    const response = await apiClient.get("/organizations/stats/all");
    return response.data;
  }

  async getOrganizations() {
    const response = await apiClient.get("/organizations");
    return response.data;
  }

  async getOrgStatsById(id: string | number) {
    const response = await apiClient.get(`/organizations/${id}/stats`);
    return response.data;
  }

  async initiateSupportSession(orgId: string, reason: string, ticketReference?: string) {
    const response = await apiClient.post("/super-admin/support-session/initiate", {
      organization_id: orgId,
      reason,
      ticket_reference: ticketReference
    });
    return response.data;
  }

  async terminateSupportSession(orgId: string) {
    const response = await apiClient.post(`/super-admin/support-session/terminate/${orgId}`);
    return response.data;
  }

  async crossTenantSearch(query: string, category: string) {
    const response = await apiClient.get(`/super-admin/search?query=${encodeURIComponent(query)}&category=${category}`);
    return response.data;
  }

  async getTenureMetrics() {
    const response = await apiClient.get("/super-admin/tenure-metrics");
    return response.data;
  }

  async suspendOrg(orgId: string) {
    const response = await apiClient.post(`/organizations/${orgId}/suspend`);
    return response.data;
  }

  async activateOrg(orgId: string) {
    const response = await apiClient.post(`/organizations/${orgId}/activate`);
    return response.data;
  }

  async createOrg(data: { name: string; code: string; gst_number?: string; address?: string; email?: string; phone?: string }) {
    const response = await apiClient.post("/organizations", data);
    return response.data;
  }
}

const organizationService = new OrganizationService();
export default organizationService;

