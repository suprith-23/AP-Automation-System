"use client";
import React from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "../../../store/useAppStore";

const EnterpriseModule = dynamic(() => import("../../../components/enterprise/EnterpriseModule"), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-zinc-500 animate-pulse font-sans">Loading Enterprise Analytics...</div>
});

export default function EnterprisePage() {
  const { invoices, fetchAllData } = useAppStore();

  return (
    <div className="space-y-6 animate-fade-in">
      <EnterpriseModule invoices={invoices} onRefresh={fetchAllData} />
    </div>
  );
}
