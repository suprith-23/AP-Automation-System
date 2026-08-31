"use client";
import React from "react";
import InvoiceModule from "../../../components/invoices/InvoiceModule";
import { useAppStore } from "../../../store/useAppStore";

export default function InvoicesPage() {
  const { invoices, fetchAllData, role, users } = useAppStore();

  return (
    <div className="space-y-6 animate-fade-in">
      <InvoiceModule invoices={invoices} onRefresh={fetchAllData} role={role} users={users} />
    </div>
  );
}
