"use client";
import React, { useCallback, memo } from "react";
import { useAppStore } from "../../../store/useAppStore";
import AdminDashboard from "../../../components/finewise/AdminDashboard";
import ReviewerDashboard from "../../../components/finewise/ReviewerDashboard";
import ApproverDashboard from "../../../components/finewise/ApproverDashboard";
import SuperAdminDashboard from "../../../components/finewise/SuperAdminDashboard";
import AuditorDashboard from "../../../components/finewise/AuditorDashboard";

/**
 * Skeleton that matches the Admin dashboard spatial layout.
 * Replaces the previous full-screen spinner — preserves space so no layout
 * shift occurs when data arrives.
 */
const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" aria-label="Loading dashboard">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl shimmer" />
        ))}
      </div>
      {/* Hero chart */}
      <div className="h-72 rounded-2xl shimmer" />
      {/* Secondary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 h-56 rounded-2xl shimmer" />
        <div className="h-56 rounded-2xl shimmer" />
      </div>
      {/* Table */}
      <div className="rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800/50">
        <div className="h-12 shimmer" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-[60px] border-t border-zinc-100 dark:border-zinc-800/50 px-5 flex items-center gap-4">
            <div className="h-3 w-6 rounded-full shimmer shrink-0" />
            <div className="h-3 flex-1 max-w-[180px] rounded-full shimmer" />
            <div className="h-3 w-28 rounded-full shimmer hidden md:block" />
            <div className="h-6 w-24 rounded-full shimmer ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
});

export default function DashboardPage() {
  const { role, dashboardStats, enterpriseAnalytics, auditLogs, invoices, loading, fetchAllData } =
    useAppStore();

  // Stable callback — not recreated on every render, preventing nav re-renders
  const handleRefresh = useCallback(() => fetchAllData(false), [fetchAllData]);

  // Only flash the skeleton on the very first cold load (no data in store yet).
  // Background refreshes are invisible — never unmount existing content.
  const hasData = invoices.length > 0 || dashboardStats !== null;
  if (loading && !hasData) {
    return <DashboardSkeleton />;
  }

  if (role === "Super Admin") {
    return <SuperAdminDashboard />;
  }

  if (role === "Admin") {
    return (
      <AdminDashboard
        stats={dashboardStats}
        enterpriseAnalytics={enterpriseAnalytics}
        auditLogs={auditLogs}
        invoices={invoices}
        onRefresh={handleRefresh}
      />
    );
  }

  if (role === "Reviewer") {
    return (
      <ReviewerDashboard
        invoices={invoices}
        stats={dashboardStats}
        enterpriseAnalytics={enterpriseAnalytics}
        auditLogs={auditLogs}
      />
    );
  }

  

  if (role === "Auditor") {
    return (
      <AuditorDashboard
        invoices={invoices}
        stats={dashboardStats}
        enterpriseAnalytics={enterpriseAnalytics}
        auditLogs={auditLogs}
      />
    );
  }

  if (role === "Approver") {
    return (
      <ApproverDashboard
        invoices={invoices}
        stats={dashboardStats}
        enterpriseAnalytics={enterpriseAnalytics}
      />
    );
  }

  return <div>Access Denied</div>;
}
