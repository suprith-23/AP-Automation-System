"use client";
import React from "react";
import Drawer from "../ui/Drawer";
import Button from "../ui/Button";
import { TableRowData } from "./DataTableRow";

type DataTableDrawerProps = {
  drawerRow: TableRowData | null;
  onClose: () => void;
  onAction?: (id: string, action: string) => void;
};

export default function DataTableDrawer({ drawerRow, onClose, onAction }: DataTableDrawerProps) {
  return (
    <Drawer
      isOpen={!!drawerRow}
      onClose={onClose}
      title={drawerRow?.workflow}
      subtitle={`${drawerRow?.submittedBy} · ${drawerRow?.date}`}
      status={drawerRow?.status}
      footer={
        <div className="flex gap-2 justify-end flex-wrap">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          <Button variant="danger" size="sm" onClick={() => { onAction?.(drawerRow!.id, "Reject"); onClose(); }}>Reject</Button>
          <Button variant="primary" size="sm" onClick={() => { onAction?.(drawerRow!.id, "Approve"); onClose(); }}>Approve</Button>
        </div>
      }
    >
      {drawerRow && (
        <div className="space-y-4">
          <div className="rounded-[18px] bg-zinc-50 dark:bg-zinc-800/40 px-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {[
              { label: "Workflow ID",  value: drawerRow.id },
              { label: "Submitted By", value: drawerRow.submittedBy },
              { label: "Date",         value: drawerRow.date },
              { label: "Reviewer",     value: drawerRow.reviewer },
              { label: "Environment",  value: drawerRow.environment },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</span>
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}
