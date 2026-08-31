"use client";
import React from "react";
import InvoiceTable from "../../../components/InvoiceTable";
import { useAppStore } from "../../../store/useAppStore";

export default function MyQueuePage() {
  const { invoices, fetchAllData, role, users } = useAppStore();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">My Queue</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-normal">Pending items awaiting your reviewer verification</p>
      </div>
      <InvoiceTable
        invoices={invoices.filter((i) => i.workflow_status === "pending_review" || i.workflow_status === "validation_failed")}
        onRefresh={fetchAllData}
        userRole={role}
        users={users}
      />
    </div>
  );
}
