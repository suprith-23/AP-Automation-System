import apiClient from "./api-client";
import { AuditLogResponse } from "../types/api_schemas";

export const auditService = {
  getInvoiceAuditLogs: async (id: number): Promise<AuditLogResponse[]> => {
    const response = await apiClient.get<AuditLogResponse[]>(`/audit-logs/invoice/${id}`);
    return response.data;
  },

  getAllAuditLogs: async (limit: number = 50): Promise<AuditLogResponse[]> => {
    const response = await apiClient.get<AuditLogResponse[]>(`/audit-logs/?limit=${limit}`);
    return response.data;
  },
};

export default auditService;
