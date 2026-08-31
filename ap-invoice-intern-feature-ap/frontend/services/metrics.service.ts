import apiClient from "./api-client";

export class MetricsService {
  static async queryInstant(query: string, tenantId: string = "all") {
    const response = await apiClient.get("/admin/metrics/query", {
      params: { query, tenant_id: tenantId }
    });
    return response.data;
  }

  static async queryRange(query: string, start: number, end: number, step: string = "60s", tenantId: string = "all") {
    const response = await apiClient.get("/admin/metrics/query_range", {
      params: {
        query,
        start: start.toString(),
        end: end.toString(),
        step,
        tenant_id: tenantId
      }
    });
    return response.data;
  }
}
