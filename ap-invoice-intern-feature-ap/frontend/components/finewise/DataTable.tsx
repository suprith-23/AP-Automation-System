"use client";
import React, { useState } from "react";
import Toolbar from "../ui/Toolbar";
import TableHeader from "../ui/TableHeader";
import GroupRowHeader from "../ui/GroupRowHeader";
import Button from "../ui/Button";
import DataTableRow, { TableRowData } from "./DataTableRow";
import DataTableDrawer from "./DataTableDrawer";

type GroupedRows = {
  groupLabel: string;
  rows: TableRowData[];
};

type DataTableProps = {
  groups:    GroupedRows[];
  onAction?: (id: string, action: string) => void;
  onRowClick?: (id: string) => void;
};

const TABLE_COLUMNS = [
  { label: "Workflow",       className: "flex-[2]"   },
  { label: "Submitted By",   className: "flex-[1.2]" },
  { label: "Date",           className: "flex-1"     },
  { label: "Status",         className: "flex-1"     },
  { label: "Reviewer",       className: "flex-[1.2]" },
  { label: "Environment",    className: "flex-1"     },
  { label: "",               className: "w-9"        },
];

const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
  </svg>
);
const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);
const AddIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

export default function DataTable({ groups, onAction, onRowClick }: DataTableProps) {
  const [search,    setSearch]    = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerRow, setDrawerRow] = useState<TableRowData | null>(null);
  const rowsPerPage = 8;

  const toggle = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));

  const filtered = groups
    .map((g) => ({
      ...g,
      rows: g.rows.filter(
        (r) =>
          r.workflow.toLowerCase().includes(search.toLowerCase()) ||
          r.submittedBy.toLowerCase().includes(search.toLowerCase()) ||
          r.reviewer.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((g) => g.rows.length > 0);

  const allFilteredRows = filtered.reduce<TableRowData[]>((acc, group) => [...acc, ...group.rows], []);
  const totalPages      = Math.ceil(allFilteredRows.length / rowsPerPage) || 1;
  const safePage        = Math.min(currentPage, totalPages);
  const paginatedRows   = allFilteredRows.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);
  const paginatedGroups = filtered
    .map((g) => ({ ...g, rows: g.rows.filter((r) => paginatedRows.some((pr) => pr.id === r.id)) }))
    .filter((g) => g.rows.length > 0);

  const toolbarActions = [
    { key: "filter",   label: "Filter",   icon: <FilterIcon />,   onClick: () => {} },
    { key: "download", label: "Download", icon: <DownloadIcon />, onClick: () => {} },
    { key: "add",      label: "Add",      icon: <AddIcon />,      onClick: () => {} },
  ];

  const handleRowClick = (row: TableRowData) => {
    if (onRowClick) {
      onRowClick(row.id);
    } else {
      setDrawerRow(row);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Toolbar */}
      <Toolbar
        search={search}
        onSearch={(v) => { setSearch(v); setCurrentPage(1); }}
        searchPlaceholder="Search workflows, requestors, reviewers…"
        actions={toolbarActions}
      />

      {/* Table container */}
      <div className="rounded-[22px] overflow-hidden bg-white dark:bg-zinc-900 shadow-sm w-full">
        {/* Pill table header */}
        <div className="px-3 pt-3">
          <TableHeader columns={TABLE_COLUMNS} color="bg-[#EC4899]" />
        </div>

        {/* Grouped rows */}
        {paginatedGroups.length === 0 && (
          <div className="py-14 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No results found
          </div>
        )}

        {paginatedGroups.map((group, gi) => (
          <div key={group.groupLabel}>
            <GroupRowHeader
              label={group.groupLabel}
              count={group.rows.length}
              collapsed={!!collapsed[group.groupLabel]}
              onToggle={() => toggle(group.groupLabel)}
            />

            {!collapsed[group.groupLabel] &&
              group.rows.map((row) => (
                <DataTableRow
                  key={row.id}
                  row={row}
                  onClick={() => handleRowClick(row)}
                  onAction={onAction}
                />
              ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
            Showing {allFilteredRows.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1}–{Math.min(safePage * rowsPerPage, allFilteredRows.length)} of {allFilteredRows.length}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Row detail drawer */}
      <DataTableDrawer
        drawerRow={drawerRow}
        onClose={() => setDrawerRow(null)}
        onAction={onAction}
      />
    </div>
  );
}
