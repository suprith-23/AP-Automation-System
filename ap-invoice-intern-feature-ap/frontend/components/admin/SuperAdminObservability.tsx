"use client";
import React, { useState, useEffect, useCallback } from "react";
import organizationService from "../../services/organization.service";
import { MetricsService } from "../../services/metrics.service";
import Card from "../ui/Card";
import Button from "../ui/Button";
import SearchBar from "../ui/SearchBar";
import TableHeader from "../ui/TableHeader";
import StatusPill from "../ui/StatusPill";
import CapsuleStatRow from "../finewise/CapsuleStatRow";
import { toast } from "sonner";
interface Organization {
  id: string;
  name: string;
  code: string;
  status: string;
}
interface TenureMetric {
  organization_id: string;
  organization_name: string;
  organization_code: string;
  active_users_count: number;
  dormant_users_count: number;
  avg_tenure_days: number;
  roles_breakdown: Record<string, number>;
  last_activity: string | null;
}
interface SearchResults {
  organizations: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
  }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    organization_name: string;
    status: string;
  }>;
  invoices: Array<{
    id: number;
    invoice_number: string;
    seller_name: string;
    total_amount: number;
    status: string;
    organization_name: string;
  }>;
} /** Canonical stat card matching DashboardStats.tsx pattern */
function StatCard({
  icon,
  value,
  label,
  sub,
  accent,
  colorClass = "bg-zinc-100 dark:bg-zinc-800 text-zinc-500",
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  sub?: React.ReactNode;
  accent?: string;
  colorClass?: string;
}) {
  return (
    <div className="fw-card-role flex flex-col gap-3">
      {" "}
      <div className="flex items-center justify-between">
        {" "}
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          {" "}
          {label}{" "}
        </span>{" "}
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}
        >
          {" "}
          {icon}{" "}
        </span>{" "}
      </div>{" "}
      <div
        className={`text-2xl font-black tracking-tight ${accent ?? "text-zinc-900 dark:text-white"}`}
      >
        {" "}
        {value}{" "}
      </div>{" "}
      {sub && (
        <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
          {sub}
        </div>
      )}{" "}
    </div>
  );
}
export default function SuperAdminObservability(): React.JSX.Element {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tenureMetrics, setTenureMetrics] = useState<TenureMetric[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [refreshInterval] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [p95Latency, setP95Latency] = useState<number>(0);
  const [p50Latency, setP50Latency] = useState<number>(0);
  const [p99Latency, setP99Latency] = useState<number>(0);
  const [dbConnections, setDbConnections] = useState<number>(0);
  const [queueDepth, setQueueDepth] = useState<number>(0);
  const [slaBreaches, setSlaBreaches] = useState<number>(0);
  const [stageDurations, setStageDurations] = useState<Record<string, number>>(
    {},
  );
  /* Support / Impersonation Mode State */ const [
    supportSession,
    setSupportSession,
  ] = useState<{ orgId: string; orgName: string; active: boolean } | null>(
    null,
  );
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const [supportOrgId, setSupportOrgId] = useState<string>("");
  const [supportReason, setSupportReason] = useState<string>("");
  const [supportTicket, setSupportTicket] = useState<string>("");
  /* Search State */ const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchCategory, setSearchCategory] = useState<string>("all");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(
    null,
  );
  const [searching, setSearching] = useState<boolean>(false);
  /* Org Provisioning */ const [showOrgModal, setShowOrgModal] =
    useState<boolean>(false);
  const [newOrgName, setNewOrgName] = useState<string>("");
  const [newOrgCode, setNewOrgCode] = useState<string>("");
  const [newOrgGst, setNewOrgGst] = useState<string>("");
  const [newOrgAddress, setNewOrgAddress] = useState<string>("");
  const [activeDetailTenant, setActiveDetailTenant] = useState<string | null>(
    null,
  );
  const fetchTenureMetrics = async () => {
    try {
      const data = await organizationService.getTenureMetrics();
      if (data && data.length > 0) {
        setTenureMetrics(data);
      } else {
        setTenureMetrics([]); /* No data available */
      }
    } catch {
      toast.error("Failed to load user tenure metrics rollup.");
      setTenureMetrics([]);
    }
  };
  const loadOrganizations = useCallback(async () => {
    try {
      const res = await organizationService.getOrganizations();
      if (res) setOrganizations(res);
    } catch {
      toast.error("Failed to load multi-tenant registry.");
    }
  }, []);
  const fetchMetrics = useCallback(async () => {
    setError(null);
    try {
      const tenantArg = selectedTenant;
      const [lat95Res, lat50Res, lat99Res, dbRes, queueRes, slaRes, stagesRes] =
        await Promise.all([
          MetricsService.queryInstant(
            "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            tenantArg,
          ),
          MetricsService.queryInstant(
            "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            tenantArg,
          ),
          MetricsService.queryInstant(
            "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            tenantArg,
          ),
          MetricsService.queryInstant("db_connection_pool_active", tenantArg),
          MetricsService.queryInstant("celery_queue_depth", tenantArg),
          MetricsService.queryInstant(
            "sum(workflow_sla_breach_total)",
            tenantArg,
          ),
          MetricsService.queryInstant(
            "sum(rate(extraction_stage_duration_seconds_sum[5m])) by (stage) / sum(rate(extraction_stage_duration_seconds_count[5m])) by (stage)",
            tenantArg,
          ),
        ]);
      const getVal = (res: any) => {
        const v = res?.data?.result?.[0]?.value?.[1];
        if (v === undefined || v === null) return 0.0;
        return parseFloat(v);
      };
      setP95Latency(getVal(lat95Res));
      setP50Latency(getVal(lat50Res));
      setP99Latency(getVal(lat99Res));
      setDbConnections(getVal(dbRes));
      setQueueDepth(getVal(queueRes));
      setSlaBreaches(getVal(slaRes));
      const newStages: Record<string, number> = {};
      if (stagesRes?.data?.result) {
        stagesRes.data.result.forEach((item: any) => {
          const st = item.metric.stage;
          const val = parseFloat(item.value[1]);
          if (st && !isNaN(val)) newStages[st] = val;
        });
      }
      setStageDurations(newStages);
    } catch (err: any) {
      console.error(err);
      setError(
        "Failed to query live system metrics. The Prometheus backend service may be offline.",
      );
      setP95Latency(0);
      setP50Latency(0);
      setP99Latency(0);
      setDbConnections(0);
      setQueueDepth(0);
      setSlaBreaches(0);
      setStageDurations({});
    } finally {
      setLoading(false);
    }
  }, [selectedTenant]);
  useEffect(() => {
    loadOrganizations();
    fetchTenureMetrics();
  }, [loadOrganizations]);
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);
  const handleStartImpersonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportOrgId || !supportReason) {
      toast.error("Organization and reason are required.");
      return;
    }
    const targetOrg = organizations.find((o) => o.id === supportOrgId);
    if (!targetOrg) return;
    try {
      await organizationService.initiateSupportSession(
        supportOrgId,
        supportReason,
        supportTicket,
      );
      setSupportSession({
        orgId: supportOrgId,
        orgName: targetOrg.name,
        active: true,
      });
      setShowSupportModal(false);
      setSupportReason("");
      setSupportTicket("");
      toast.success(`Active support mode initiated for ${targetOrg.name}.`);
    } catch {
      toast.error("Failed to log and start support impersonation session.");
    }
  };
  const handleStopImpersonation = async () => {
    if (!supportSession) return;
    try {
      await organizationService.terminateSupportSession(supportSession.orgId);
      toast.success(
        `Support session for ${supportSession.orgName} terminated.`,
      );
      setSupportSession(null);
    } catch {
      toast.error("Failed to terminate support session.");
    }
  };
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await organizationService.crossTenantSearch(
        searchQuery,
        searchCategory,
      );
      setSearchResults(data);
    } catch {
      toast.error("Error executing cross-tenant audit search.");
    } finally {
      setSearching(false);
    }
  };
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgCode) {
      toast.error("Name and Code are required.");
      return;
    }
    try {
      await organizationService.createOrg({
        name: newOrgName,
        code: newOrgCode,
        gst_number: newOrgGst || undefined,
        address: newOrgAddress || undefined,
      });
      toast.success("Organization provisioned and settings templates seeded.");
      setShowOrgModal(false);
      setNewOrgName("");
      setNewOrgCode("");
      setNewOrgGst("");
      setNewOrgAddress("");
      loadOrganizations();
      fetchTenureMetrics();
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Failed to provision organization.",
      );
    }
  };
  const toggleOrgStatus = async (org: Organization) => {
    try {
      if (org.status === "Active") {
        await organizationService.suspendOrg(org.id);
        toast.success(`${org.code} suspended.`);
      } else {
        await organizationService.activateOrg(org.id);
        toast.success(`${org.code} activated.`);
      }
      loadOrganizations();
    } catch {
      toast.error("Failed to toggle organization status.");
    }
  };
  /* Icons */ const IconLatency = () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
  const IconDB = () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5"
      />
    </svg>
  );
  const IconAlert = () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );
  const IconQueue = () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16"
      />
    </svg>
  );
  return (
    <div className="space-y-6 font-sans">
      {" "}
      {/* ── Impersonation Active Banner ─────────────────────────────────── */}{" "}
      {supportSession?.active && (
        <div className="bg-fw-amber/10 border border-fw-amber/40 text-fw-amber-deep dark:text-fw-amber p-4 rounded-2xl flex items-center justify-between shadow-sm">
          {" "}
          <div className="flex items-center gap-3">
            {" "}
            <span className="text-lg">⚠️</span>{" "}
            <div>
              {" "}
              <span className="font-black text-sm uppercase tracking-wide">
                Support Mode Active
              </span>{" "}
              <p className="text-xs opacity-75 mt-0.5">
                {" "}
                Privileged access in <strong>{supportSession.orgName}</strong>.
                All requests logged.{" "}
              </p>{" "}
            </div>{" "}
          </div>{" "}
          <Button variant="danger" size="sm" onClick={handleStopImpersonation}>
            {" "}
            End Session{" "}
          </Button>{" "}
        </div>
      )}{" "}
      {/* ── Top bar ─────────────────────────────────────────────────────── */}{" "}
      <div className="fw-card flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {" "}
        <div>
          {" "}
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
            Super Admin Hub
          </h1>{" "}
          <p className="text-xs text-zinc-500 mt-1">
            Tenant provisioning, support-mode auditing, cross-tenant
            observability.
          </p>{" "}
        </div>{" "}
        <div className="flex flex-wrap items-center gap-3">
          {" "}
          {/* Primary action — matches existing "primary" button variant */}{" "}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowOrgModal(true)}
          >
            {" "}
            + Provision Tenant{" "}
          </Button>{" "}
          {/* Warning action — uses canonical warning button, not a bespoke amber */}{" "}
          <Button
            variant="warning"
            size="sm"
            onClick={() => setShowSupportModal(true)}
          >
            {" "}
            Support Impersonation{" "}
          </Button>{" "}
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-xs font-bold border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-full focus:outline-none"
          >
            {" "}
            <option value="all">Global (All Tenants)</option>{" "}
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.code})
              </option>
            ))}{" "}
          </select>{" "}
        </div>{" "}
      </div>{" "}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold shadow-sm">
          {" "}
          ⚠️ {error}{" "}
        </div>
      )}{" "}
      {/* ── Stat Cards — match DashboardStats.tsx fw-card pattern ─────── */}{" "}
      <CapsuleStatRow
        chips={[
          {
            color: "amber",
            label: "P50 / P95 / P99 Latency",
            value: error ? "Offline" : `${p95Latency.toFixed(2)}s`,
            sub: error
              ? "Metrics server unreachable"
              : `p50: ${p50Latency.toFixed(2)}s · p99: ${p99Latency.toFixed(2)}s`,
            icon: <IconLatency />,
          },
          {
            color: "amber",
            label: "Database Pool",
            value: error ? "Offline" : `${dbConnections} active`,
            sub: error ? "Metrics server unreachable" : "Pooled checkout connections",
            icon: <IconDB />,
          },
          {
            color: "amber",
            label: "Global SLA Breaches",
            value: error ? "Offline" : `${slaBreaches}`,
            sub: error ? "Metrics server unreachable" : "Requiring escalation override",
            icon: <IconAlert />,
          },
          {
            color: "amber",
            label: "Celery Queue Backlog",
            value: error ? "Offline" : `${queueDepth} files`,
            sub: error ? "Metrics server unreachable" : "Pending worker ingestion runs",
            icon: <IconQueue />,
          },
        ]}
      />{" "}
      {/* ── Cross-Tenant Global Search ──────────────────────────────────── */}{" "}
      <Card title="Cross-Tenant Global Search (Audited)">
        {" "}
        <form
          onSubmit={handleSearch}
          className="flex flex-col md:flex-row gap-3 mt-2"
        >
          {" "}
          {/* Canonical SearchBar component — same height/icon/placeholder as rest of app */}{" "}
          <SearchBar
            id="super-admin-search"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search invoice number, user email, vendor name, or tenant code..."
            className="flex-1"
          />{" "}
          <select
            value={searchCategory}
            onChange={(e) => setSearchCategory(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-4 py-2 text-xs font-bold focus:outline-none"
          >
            {" "}
            <option value="all">All Items</option>{" "}
            <option value="organizations">Organizations</option>{" "}
            <option value="users">Users</option>{" "}
            <option value="invoices">Invoices</option>{" "}
          </select>{" "}
          <Button type="submit" variant="primary" size="sm" loading={searching}>
            {" "}
            Search{" "}
          </Button>{" "}
        </form>{" "}
        {searchResults && (
          <div className="mt-6 space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
            {" "}
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">
              Results
            </h3>{" "}
            {searchResults.organizations.length === 0 &&
              searchResults.users.length === 0 &&
              searchResults.invoices.length === 0 && (
                <div className="text-center py-8 text-zinc-400 text-xs font-medium">
                  No results matching query.
                </div>
              )}{" "}
            {searchResults.organizations.length > 0 && (
              <div>
                {" "}
                <span className="text-[10px] font-black uppercase text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                  Tenants
                </span>{" "}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {" "}
                  {searchResults.organizations.map((org) => (
                    <div
                      key={org.id}
                      className="p-3 border border-zinc-100 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      {" "}
                      <div>
                        {" "}
                        <div className="font-bold text-zinc-800 dark:text-zinc-200">
                          {org.name}
                        </div>{" "}
                        <div className="text-zinc-400 font-mono text-[10px]">
                          {org.code}
                        </div>{" "}
                      </div>{" "}
                      <StatusPill status={org.status} />{" "}
                    </div>
                  ))}{" "}
                </div>{" "}
              </div>
            )}{" "}
            {searchResults.users.length > 0 && (
              <div className="mt-4">
                {" "}
                <span className="text-[10px] font-black uppercase text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                  Users
                </span>{" "}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {" "}
                  {searchResults.users.map((user) => (
                    <div
                      key={user.id}
                      className="p-3 border border-zinc-100 dark:border-zinc-800 rounded-xl text-xs"
                    >
                      {" "}
                      <div className="font-bold text-zinc-800 dark:text-zinc-200">
                        {user.name} ({user.role})
                      </div>{" "}
                      <div className="text-zinc-500">{user.email}</div>{" "}
                      <div className="text-[10px] text-indigo-500 font-bold mt-1">
                        Tenant: {user.organization_name}
                      </div>{" "}
                    </div>
                  ))}{" "}
                </div>{" "}
              </div>
            )}{" "}
            {searchResults.invoices.length > 0 && (
              <div className="mt-4">
                {" "}
                <span className="text-[10px] font-black uppercase text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                  Invoices
                </span>{" "}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {" "}
                  {searchResults.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 border border-zinc-100 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      {" "}
                      <div>
                        {" "}
                        <div className="font-bold text-zinc-800 dark:text-zinc-200">
                          #{inv.invoice_number}
                        </div>{" "}
                        <div className="text-zinc-500">
                          {inv.seller_name} · ₹
                          {(inv.total_amount || 0).toLocaleString("en-IN")}
                        </div>{" "}
                        <div className="text-[10px] text-indigo-500 font-bold mt-0.5">
                          Tenant: {inv.organization_name}
                        </div>{" "}
                      </div>{" "}
                      <StatusPill status={inv.status} />{" "}
                    </div>
                  ))}{" "}
                </div>{" "}
              </div>
            )}{" "}
          </div>
        )}{" "}
      </Card>{" "}
      {/* ── Tenant Registry + Detail Panel ─────────────────────────────── */}{" "}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {" "}
        <div className="xl:col-span-2">
          {" "}
          <Card title="Tenant Organization Registry">
            {" "}
            <div className="overflow-x-auto mt-2">
              {" "}
              <div className="min-w-[650px]">
                {" "}
                {/* Canonical TableHeader — pink band matching Reviewer dashboard */}{" "}
                <TableHeader
                  color="bg-[#FFB800] dark:bg-[#FFCB3D] !text-[#451A03] dark:!text-[#000000]"
                  columns={[
                    { label: "Organization", className: "flex-[2]" },
                    { label: "Code", className: "w-24 shrink-0" },
                    { label: "Status", className: "w-28 shrink-0" },
                    { label: "Actions", className: "w-56 shrink-0" },
                  ]}
                />{" "}
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 mt-1">
                  {" "}
                  {organizations.length === 0 && !loading && (
                    <div className="text-center py-12 text-zinc-400 text-xs font-medium">
                      {" "}
                      No tenant organizations found.{" "}
                    </div>
                  )}{" "}
                  {organizations.map((org) => {
                    const metric = tenureMetrics.find(
                      (m) => m.organization_id === org.id,
                    );
                    return (
                      <div
                        key={org.id}
                        className="flex items-center px-5 py-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 text-xs transition-colors"
                      >
                        {" "}
                        <div className="flex-[2] pr-4">
                          {" "}
                          <div className="font-bold text-zinc-800 dark:text-zinc-200">
                            {org.name}
                          </div>{" "}
                          {metric && (
                            <div className="text-[10px] text-zinc-400 font-medium mt-0.5">
                              {" "}
                              {metric.active_users_count} active · avg tenure{" "}
                              {metric.avg_tenure_days}d{" "}
                            </div>
                          )}{" "}
                        </div>{" "}
                        <div className="w-24 shrink-0 font-mono font-black text-indigo-500 text-[11px]">
                          {org.code}
                        </div>{" "}
                        <div className="w-28 shrink-0">
                          {" "}
                          <StatusPill status={org.status} />{" "}
                        </div>{" "}
                        <div className="w-56 shrink-0 flex gap-2">
                          {" "}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setActiveDetailTenant(org.id)}
                          >
                            {" "}
                            Details{" "}
                          </Button>{" "}
                          <Button
                            variant={
                              org.status === "Active" ? "danger" : "success"
                            }
                            size="sm"
                            onClick={() => toggleOrgStatus(org)}
                          >
                            {" "}
                            {org.status === "Active"
                              ? "Suspend"
                              : "Activate"}{" "}
                          </Button>{" "}
                        </div>{" "}
                      </div>
                    );
                  })}{" "}
                </div>{" "}
              </div>{" "}
            </div>{" "}
          </Card>{" "}
        </div>{" "}
        <div>
          {" "}
          <Card title="Tenant Details & Pipeline Breakdown">
            {" "}
            {activeDetailTenant ? (
              (() => {
                const metric = tenureMetrics.find(
                  (m) => m.organization_id === activeDetailTenant,
                );
                if (!metric)
                  return (
                    <div className="text-center py-12">
                      {" "}
                      <p className="text-xs text-zinc-400 font-medium">
                        Metrics rollup unavailable for this tenant.
                      </p>{" "}
                    </div>
                  );
                return (
                  <div className="space-y-4 mt-2">
                    {" "}
                    <div>
                      {" "}
                      <h4 className="text-sm font-black text-zinc-800 dark:text-zinc-200">
                        {metric.organization_name}
                      </h4>{" "}
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1">
                        Tenant Health Rollup
                      </p>{" "}
                    </div>{" "}
                    <div className="grid grid-cols-2 gap-4 border-y border-zinc-100 dark:border-zinc-800 py-3">
                      {" "}
                      <div>
                        {" "}
                        <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                          Dormant Users
                        </div>{" "}
                        <div className="text-xl font-black mt-1 text-fw-amber">
                          {metric.dormant_users_count}
                        </div>{" "}
                      </div>{" "}
                      <div>
                        {" "}
                        <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                          Last Activity
                        </div>{" "}
                        <div className="text-xs font-bold mt-1">
                          {" "}
                          {metric.last_activity
                            ? new Date(
                                metric.last_activity,
                              ).toLocaleDateString()
                            : "Never"}{" "}
                        </div>{" "}
                      </div>{" "}
                    </div>{" "}
                    <div>
                      {" "}
                      <h5 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                        Roles Distribution
                      </h5>{" "}
                      <div className="mt-2 space-y-1">
                        {" "}
                        {Object.entries(metric.roles_breakdown).map(
                          ([role, count]) => (
                            <div
                              key={role}
                              className="flex justify-between text-xs font-bold"
                            >
                              {" "}
                              <span className="text-zinc-500">{role}</span>{" "}
                              <span className="text-zinc-800 dark:text-zinc-200">
                                {count}
                              </span>{" "}
                            </div>
                          ),
                        )}{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      {" "}
                      <h5 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                        OCR Extraction Stages
                      </h5>{" "}
                      {error ? (
                        <div className="text-zinc-400 text-xs py-3 font-medium">
                          Pipeline stage metrics unavailable (Offline)
                        </div>
                      ) : (
                        <div className="space-y-2.5 mt-3">
                          {" "}
                          {[
                            { s: "1", name: "Text Cleaning" },
                            { s: "4", name: "Table Detection" },
                            { s: "8", name: "LLM Semantic" },
                          ].map((stage) => {
                            const dur = stageDurations[stage.s] || 0.0;
                            return (
                              <div key={stage.s}>
                                {" "}
                                <div className="flex justify-between text-[11px] font-bold text-zinc-500 mb-1">
                                  {" "}
                                  <span>{stage.name}</span>{" "}
                                  <span>{dur.toFixed(2)}s</span>{" "}
                                </div>{" "}
                                <div className="progress-track">
                                  {" "}
                                  <div
                                    className="progress-fill bg-indigo-500"
                                    style={{
                                      width: `${Math.min((dur / 2) * 100, 100)}%`,
                                    }}
                                  />{" "}
                                </div>{" "}
                              </div>
                            );
                          })}{" "}
                        </div>
                      )}{" "}
                    </div>{" "}
                  </div>
                );
              })()
            ) : (
              /* ── Empty state — matches app-wide icon + centered text pattern ── */ <div className="flex flex-col items-center justify-center py-14 gap-3">
                {" "}
                <svg
                  className="w-10 h-10 text-zinc-200 dark:text-zinc-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {" "}
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />{" "}
                </svg>{" "}
                <p className="text-xs text-zinc-400 font-medium text-center">
                  {" "}
                  Select a tenant row to inspect user distribution and
                  extraction pipeline stages.{" "}
                </p>{" "}
              </div>
            )}{" "}
          </Card>{" "}
        </div>{" "}
      </div>{" "}
      {/* ── Support Mode Modal ──────────────────────────────────────────── */}{" "}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          {" "}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            {" "}
            <h3 className="text-base font-black text-zinc-900 dark:text-white">
              {" "}
              Support Impersonation Audit
            </h3>{" "}
            <p className="text-xs text-zinc-500 mt-1">
              All access is logged to the audit trail. Written justification is
              mandatory.
            </p>{" "}
            <form
              onSubmit={handleStartImpersonation}
              className="space-y-3 mt-4"
            >
              {" "}
              <div>
                {" "}
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">
                  Target Organization *
                </label>{" "}
                <select
                  value={supportOrgId}
                  onChange={(e) => setSupportOrgId(e.target.value)}
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none font-bold"
                >
                  {" "}
                  <option value="">Select Tenant</option>{" "}
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}{" "}
                </select>{" "}
              </div>{" "}
              <div>
                {" "}
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">
                  Logged Support Reason *
                </label>{" "}
                <textarea
                  value={supportReason}
                  onChange={(e) => setSupportReason(e.target.value)}
                  required
                  placeholder="e.g. Debugging line item matching mismatch with PO..."
                  rows={3}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none resize-none"
                />{" "}
              </div>{" "}
              <div>
                {" "}
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">
                  System Ticket Reference (Optional)
                </label>{" "}
                <input
                  type="text"
                  value={supportTicket}
                  onChange={(e) => setSupportTicket(e.target.value)}
                  placeholder="e.g. TICKET-1049"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />{" "}
              </div>{" "}
              <div className="flex justify-end gap-2 pt-1">
                {" "}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowSupportModal(false)}
                >
                  Cancel
                </Button>{" "}
                <Button type="submit" variant="warning" size="sm">
                  Confirm & Log Access
                </Button>{" "}
              </div>{" "}
            </form>{" "}
          </div>{" "}
        </div>
      )}{" "}
      {/* ── Org Provisioning Modal ──────────────────────────────────────── */}{" "}
      {showOrgModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          {" "}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            {" "}
            <h3 className="text-base font-black text-zinc-900 dark:text-white">
              {" "}
              Provision New Tenant
            </h3>{" "}
            <p className="text-xs text-zinc-500 mt-1">
              Initialize workspace with template SLA thresholds and settings
              config.
            </p>{" "}
            <form onSubmit={handleCreateOrg} className="space-y-3 mt-4">
              {" "}
              {[
                {
                  label: "Organization Name *",
                  value: newOrgName,
                  onChange: setNewOrgName,
                  required: true,
                  placeholder: "e.g. Gamma Systems India",
                },
                {
                  label: "Organization Code *",
                  value: newOrgCode,
                  onChange: setNewOrgCode,
                  required: true,
                  placeholder: "e.g. GAMMA",
                  mono: true,
                },
                {
                  label: "GST Identification Number (Optional)",
                  value: newOrgGst,
                  onChange: setNewOrgGst,
                  placeholder: "e.g. 29GGGCG1234G1Z3",
                },
                {
                  label: "Office Address (Optional)",
                  value: newOrgAddress,
                  onChange: setNewOrgAddress,
                  placeholder: "e.g. Phase 2 Electronic City, Bangalore",
                },
              ].map((f) => (
                <div key={f.label}>
                  {" "}
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">
                    {f.label}
                  </label>{" "}
                  <input
                    type="text"
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                    required={f.required}
                    placeholder={f.placeholder}
                    className={`w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none ${f.mono ? "font-mono" : ""}`}
                  />{" "}
                </div>
              ))}{" "}
              <div className="flex justify-end gap-2 pt-1">
                {" "}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowOrgModal(false)}
                >
                  Cancel
                </Button>{" "}
                <Button type="submit" variant="primary" size="sm">
                  Provision Workspace
                </Button>{" "}
              </div>{" "}
            </form>{" "}
          </div>{" "}
        </div>
      )}{" "}
    </div>
  );
}
