import { useState, useEffect, useCallback } from "react";
import organizationService from "../services/organization.service";
import { getAllAuditLogs, getInvoices } from "../services/api";

export function useSuperAdminDashboard() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [overallStats, setOverallStats] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [invoicesCount, setInvoicesCount] = useState<number>(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch overall stats
      const stats = await organizationService.getOverallStats();
      setOverallStats(stats);

      // 2. Fetch invoices to calculate system-wide pending approvals
      const invs = await getInvoices();
      setInvoicesCount(invs.length);
      const pendingApprovals = invs.filter((i: any) => i.workflow_status === "pending_approval").length;
      setPendingApprovalsCount(pendingApprovals);

      // 3. Fetch audit logs for the feed
      const logs = await getAllAuditLogs(50);
      setAuditLogs(logs);

      // 4. Fetch organizations list
      const baseOrgs = await organizationService.getOrganizations();
      if (baseOrgs) {
        // Enrichment
        const enriched = await Promise.all(
          baseOrgs.map(async (org: any) => {
            try {
              const orgStats = await organizationService.getOrgStatsById(org.id);
              return {
                ...org,
                user_count: orgStats.user_count,
                invoice_count: orgStats.invoice_count,
              };
            } catch (e) {
              return org;
            }
          })
        );
        setOrgs(enriched);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || "Failed to load Super Admin dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    orgs,
    overallStats,
    auditLogs,
    invoicesCount,
    pendingApprovalsCount,
    loading,
    error,
    refresh: fetchDashboardData,
  };
}
