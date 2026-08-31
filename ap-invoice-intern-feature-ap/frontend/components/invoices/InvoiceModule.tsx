"use client";
import React, { useState } from "react";
import InvoiceTable from "../InvoiceTable";
import ApprovalsKanban from "../ApprovalsKanban";
import { Invoice } from "../../types/invoice";
import { Role } from "../../store/useAppStore";

type Props = {
  invoices: Invoice[];
  onRefresh: () => void;
  role: Role;
  users: any[];
};

export default function InvoiceModule({ invoices, onRefresh, role, users }: Props) {
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Invoices Processing Core</h2>
          <p className="text-xs text-zinc-500 mt-1">Review validation states, PO matching logs, and manage payment queues.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              viewMode === "list"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-650"
            }`}
          >
            Ledger List
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              viewMode === "kanban"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-650"
            }`}
          >
            Kanban Boards
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        <InvoiceTable invoices={invoices} onRefresh={onRefresh} userRole={role} users={users} />
      ) : (
        <ApprovalsKanban invoices={invoices} onRefresh={onRefresh} />
      )}
    </div>
  );
}
