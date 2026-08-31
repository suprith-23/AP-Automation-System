import apiClient from "./api-client";
import { PurchaseOrder } from "../types/purchase_order";
import { PurchaseOrderCreate, PurchaseOrderUpdate } from "../types/api_schemas";

export const purchaseOrderService = {
  getPurchaseOrders: async (): Promise<PurchaseOrder[]> => {
    const response = await apiClient.get<PurchaseOrder[]>("/purchase-orders/");
    return response.data;
  },

  createPurchaseOrder: async (po: PurchaseOrderCreate): Promise<PurchaseOrder> => {
    const response = await apiClient.post<PurchaseOrder>("/purchase-orders/", po);
    return response.data;
  },

  updatePurchaseOrder: async (id: number, po: PurchaseOrderUpdate): Promise<PurchaseOrder> => {
    const response = await apiClient.put<PurchaseOrder>(`/purchase-orders/${id}`, po);
    return response.data;
  },

  deletePurchaseOrder: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/purchase-orders/${id}`);
    return response.data;
  },
};

export default purchaseOrderService;
