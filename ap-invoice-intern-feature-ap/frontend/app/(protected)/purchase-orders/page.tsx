"use client";
import React from "react";
import PurchaseOrderManager from "../../../components/purchase_orders/PurchaseOrderManager";
import { useAppStore } from "../../../store/useAppStore";
import { createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } from "../../../services/api";
import { toast } from "sonner";
import { useConfirmStore } from "../../../store/useConfirmStore";

export default function PurchaseOrdersPage() {
  const { purchaseOrders, invoices, role, fetchAllData } = useAppStore();

  const handleCreatePo = async (payload: any) => {
    try {
      await createPurchaseOrder(payload);
      toast.success("Purchase Order created successfully.");
      await fetchAllData();
    } catch (err: any) {
      toast.error("Failed to create Purchase Order: " + err.message);
    }
  };

  const handleUpdatePo = async (id: number, payload: any) => {
    try {
      await updatePurchaseOrder(id, payload);
      toast.success("Purchase Order updated.");
      await fetchAllData();
    } catch (err: any) {
      toast.error("Failed to update Purchase Order: " + err.message);
    }
  };

  const handleDeletePo = async (id: number) => {
    const confirmed = await useConfirmStore.getState().confirm({
      title: "Delete Purchase Order",
      message: "Are you sure you want to delete this Purchase Order?",
      roleAccent: "red"
    });
    if (confirmed) {
      try {
        await deletePurchaseOrder(id);
        toast.success("Purchase Order deleted.");
        await fetchAllData();
      } catch (err: any) {
        toast.error("Failed to delete Purchase Order: " + err.message);
      }
    }
  };

  const handleImportPo = () => {
    toast.success("Purchase Orders imported successfully.");
    fetchAllData();
  };

  const handleExportPo = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(purchaseOrders, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `po_export_${Date.now()}.json`);
    dlAnchorElem.click();
  };

  return (
    <PurchaseOrderManager
      purchaseOrders={purchaseOrders}
      invoices={invoices}
      role={role}
      onCreatePo={handleCreatePo}
      onUpdatePo={handleUpdatePo}
      onDeletePo={handleDeletePo}
      onImportPo={handleImportPo}
      onExportPo={handleExportPo}
    />
  );
}
