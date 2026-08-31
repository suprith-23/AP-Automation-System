import apiClient from "./api-client";

export interface Vendor {
  id: number;
  name: string;
  bank_account_number?: string;
  ifsc_code?: string;
  bank_name?: string;
}

const vendorService = {
  getVendors: async (): Promise<Vendor[]> => {
    const res = await apiClient.get("/vendors");
    return res.data;
  },

  createVendor: async (data: {
    name: string;
    bank_account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
  }): Promise<Vendor> => {
    const res = await apiClient.post("/vendors", data);
    return res.data;
  },

  mapVendorToInvoice: async (invoiceId: number, vendorId: number): Promise<any> => {
    const res = await apiClient.post(`/invoices/${invoiceId}/map-vendor`, {
      vendor_id: vendorId,
    });
    return res.data;
  },
};

export default vendorService;
