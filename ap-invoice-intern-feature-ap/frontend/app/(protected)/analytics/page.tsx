"use client";
import React from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "../../../store/useAppStore";

const AnalyticsModule = dynamic(() => import("../../../components/analytics/AnalyticsModule"), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-zinc-500 animate-pulse font-sans">Loading Analytics...</div>
});

export default function AnalyticsPage() {
  const { purchaseOrders, invoices, enterpriseAnalytics, loading, fetchAllData } = useAppStore();

  return (
    <div className="space-y-6 animate-fade-in">
      <AnalyticsModule 
        purchaseOrders={purchaseOrders} 
        invoices={invoices} 
        enterpriseAnalytics={enterpriseAnalytics} 
        loading={loading} 
        onRefresh={fetchAllData} 
      />
    </div>
  );
}
