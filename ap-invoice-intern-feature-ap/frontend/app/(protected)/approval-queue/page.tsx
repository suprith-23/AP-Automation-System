"use client";
import React from "react";
import ApprovalsKanban from "../../../components/ApprovalsKanban";
import { useAppStore } from "../../../store/useAppStore";

export default function ApprovalQueuePage() {
  const { invoices, fetchAllData } = useAppStore();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Approval Queue</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-normal">Authorize payments and approve matching vendor invoices</p>
      </div>
      <ApprovalsKanban invoices={invoices} onRefresh={fetchAllData} />
    </div>
  );
}
