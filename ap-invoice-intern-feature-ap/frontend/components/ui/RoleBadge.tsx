"use client";

import React from "react";

type RoleConfig = { bg: string; text: string };

const ROLE_MAP: Record<string, RoleConfig> = {
  admin: { bg: "bg-fw-green dark:bg-fw-green-deep", text: "text-fw-green-deep dark:text-fw-green-dark" }, // Green
  "super admin": { bg: "bg-fw-amber dark:bg-fw-amber-deep", text: "text-fw-amber-deep dark:text-fw-amber-dark" }, // Amber/Gold
  approver: { bg: "bg-fw-purple dark:bg-fw-purple-deep", text: "text-fw-purple-deep dark:text-fw-purple-dark" }, // Purple
  reviewer: { bg: "bg-fw-pink dark:bg-fw-pink-deep", text: "text-fw-pink-deep dark:text-fw-pink-dark" }, // Pink/Magenta
  auditor: { bg: "bg-fw-teal dark:bg-fw-teal-deep", text: "text-fw-teal-deep dark:text-fw-teal-dark" }, // Cyan/Blue
  "finance manager": { bg: "bg-fw-amber dark:bg-fw-amber-deep", text: "text-fw-amber-deep dark:text-fw-amber-dark" }, // Amber (mapped to Super Admin / Finance Manager)
};

const FALLBACK: RoleConfig = { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-600 dark:text-zinc-300" }; 

type Props = {
  role?: string;
  className?: string;
};

export default function RoleBadge({ role = "", className = "" }: Props) {
  const key = role.toLowerCase().trim();
  // Filter out system/bot to use neutral fallback
  const isSystemOrBot = key === "system" || key === "bot";
  const cfg = isSystemOrBot ? FALLBACK : (ROLE_MAP[key] ?? FALLBACK);
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider fw-texture-grain ${cfg.bg} ${cfg.text} ${className}`}>
      {role}
    </span>
  );
}
