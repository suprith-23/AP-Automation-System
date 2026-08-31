import apiClient from "./api-client";
import { Invoice } from "../types/invoice";

export const invoiceService = {
  getInvoices: async (): Promise<Invoice[]> => {
    const response = await apiClient.get<Invoice[]>("/invoices/");
    return response.data;
  },

  getDashboardStats: async (): Promise<any> => {
    const response = await apiClient.get<any>("/dashboard/stats");
    return response.data;
  },

  getReviewerQueue: async (): Promise<Invoice[]> => {
    const response = await apiClient.get<Invoice[]>("/invoices/reviewer-queue");
    return response.data;
  },

  getApproverQueue: async (): Promise<Invoice[]> => {
    const response = await apiClient.get<Invoice[]>("/invoices/approver-queue");
    return response.data;
  },

  getInvoiceById: async (id: number): Promise<Invoice> => {
    const response = await apiClient.get<Invoice>(`/invoices/${id}`);
    return response.data;
  },

  updateInvoice: async (id: number, data: any): Promise<Invoice> => {
    const response = await apiClient.put<Invoice>(`/invoices/${id}`, data);
    return response.data;
  },

  uploadInvoiceDocument: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post("/extract-invoice", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 120000, // 2 minutes timeout for slow OCR + LLM extraction
    });
    return response.data;
  },

  submitInvoiceForApproval: async (id: number): Promise<Invoice> => {
    const response = await apiClient.post<Invoice>(`/invoices/${id}/submit-for-approval`);
    return response.data;
  },

  rejectInvoice: async (id: number, reason?: string): Promise<Invoice> => {
    const url = reason ? `/invoices/${id}/reject?reason=${encodeURIComponent(reason)}` : `/invoices/${id}/reject`;
    const response = await apiClient.post<Invoice>(url);
    return response.data;
  },

  approveInvoice: async (id: number, justification?: string): Promise<Invoice> => {
    const url = justification ? `/invoices/${id}/approve?justification=${encodeURIComponent(justification)}` : `/invoices/${id}/approve`;
    const response = await apiClient.post<Invoice>(url);
    return response.data;
  },

  matchInvoice: async (id: number): Promise<Invoice> => {
    const response = await apiClient.post<Invoice>(`/invoices/${id}/match`);
    return response.data;
  },

  deleteInvoice: async (id: number): Promise<any> => {
    const response = await apiClient.delete<any>(`/invoices/${id}`);
    return response.data;
  },

  reprocessInvoice: async (id: number): Promise<Invoice> => {
    const response = await apiClient.post<Invoice>(`/invoices/${id}/reprocess`);
    return response.data;
  },

  reopenInvoice: async (id: number): Promise<Invoice> => {
    const response = await apiClient.post<Invoice>(`/invoices/${id}/reopen`);
    return response.data;
  },

  downloadDocument: (documentId: number) => {
    const token = localStorage.getItem("token") || "";
    const baseUrl = apiClient.defaults.baseURL || "";
    // Open in a new tab with authorization token in query if needed, or simply window.open
    // To ensure authorization passes, we can construct the url.
    // If the download route is authenticated: we can pass token as query parameter,
    // or we can fetch as blob and trigger browser download. Fetching as blob is safer for CORS/Auth!
    return apiClient.get(`/documents/${documentId}/download`, {
      responseType: "blob"
    }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `document_${documentId}.pdf`); // fallback name, browser respects content-disposition if possible
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    });
  },

  releaseInvoiceForPayment: async (id: number): Promise<Invoice> => {
    const response = await apiClient.post<Invoice>(`/invoices/${id}/release`);
    return response.data;
  },

  confirmInvoicePayment: async (id: number): Promise<Invoice> => {
    const response = await apiClient.post<Invoice>(`/invoices/${id}/confirm-payment`);
    return response.data;
  },

  updateInvoiceFields: async (id: number, updates: any): Promise<Invoice> => {
    const response = await apiClient.patch<Invoice>(`/invoices/${id}/fields`, { updates });
    return response.data;
  },

  getInvoiceComments: async (id: number): Promise<any[]> => {
    const response = await apiClient.get<any[]>(`/invoices/${id}/comments`);
    return response.data;
  },

  postInvoiceComment: async (id: number, text: string): Promise<any> => {
    const response = await apiClient.post<any>(`/invoices/${id}/comments`, { text });
    return response.data;
  }
};

export default invoiceService;
