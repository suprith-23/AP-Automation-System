"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import apiClient from "../../services/api-client";
import { useAppStore } from "../../store/useAppStore";
import { toast } from "sonner";
import CapsuleStatRow from "../finewise/CapsuleStatRow";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { useConfirmStore } from "../../store/useConfirmStore";

interface Organization {
  id: string;
  name: string;
  code: string;
  gst_number?: string;
  address?: string;
  status: string;
  created_at: string;
  admin_assigned?: string;
  // Dynamic stats
  user_count?: number;
  invoice_count?: number;
  processing_success_rate?: number;
  storage_usage_mb?: number;
}

interface OverallStats {
  total_organizations: number;
  total_users: number;
  total_invoices: number;
  processing_success_rate: number;
  storage_usage_mb: number;
  total_api_requests: number;
}

export default function OrganizationManagement() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [mounted, setMounted] = useState(false);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  // Form states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Cached state from app store
  const { users, invoices, fetchAllData } = useAppStore();

  // Edit details and role change states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGst, setEditGst] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<number | string | null>(null);

  // Initialize edit fields when selectedOrg changes
  useEffect(() => {
    if (selectedOrg) {
      setEditName(selectedOrg.name || "");
      setEditGst(selectedOrg.gst_number || "");
      setEditAddress(selectedOrg.address || "");
      setIsEditMode(false);
    }
  }, [selectedOrg]);

  const handleUpdateRole = async (userId: number, newRole: string) => {
    setUpdatingRoleUserId(userId);
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    try {
      await apiClient.put(`/users/${userId}`, {
        name: targetUser.name,
        email: targetUser.email,
        role: newRole,
        designation: targetUser.designation,
        status: targetUser.status
      });
      toast.success("User role updated successfully");
      await fetchAllData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update user role");
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  const handleSaveOrgDetails = async () => {
    if (!selectedOrg) return;
    setSavingOrg(true);
    try {
      const res = await apiClient.put<Organization>(`/organizations/${selectedOrg.id}`, {
        name: editName,
        gst_number: editGst || null,
        address: editAddress || null
      });
      toast.success("Organization details updated successfully");
      setSelectedOrg(res.data);
      setIsEditMode(false);
      fetchOrgsAndStats();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save organization details");
    } finally {
      setSavingOrg(false);
    }
  };

  const fetchOrgsAndStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch overall stats
      const statsRes = await apiClient.get<OverallStats>("/organizations/stats/all");
      setOverallStats(statsRes.data);

      // 2. Fetch organizations list
      const listRes = await apiClient.get<Organization[]>("/organizations");
      const baseOrgs = listRes.data;

      // 3. Enrich with dynamic metrics in parallel
      const enrichedOrgs = await Promise.all(
        baseOrgs.map(async (org) => {
          try {
            const orgStatsRes = await apiClient.get<any>(`/organizations/${org.id}/stats`);
            return {
              ...org,
              user_count: orgStatsRes.data.user_count,
              invoice_count: orgStatsRes.data.invoice_count,
              processing_success_rate: orgStatsRes.data.processing_success_rate,
              storage_usage_mb: orgStatsRes.data.storage_usage_mb,
            };
          } catch (e) {
            console.error(`Failed to fetch stats for org ${org.id}`, e);
            return org;
          }
        })
      );

      setOrgs(enrichedOrgs);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to load organizations data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgsAndStats();
    setMounted(true);
  }, []);

  // Lock screen scroll when any modal is open
  useEffect(() => {
    if (isAddOpen || selectedOrg) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isAddOpen, selectedOrg]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    setSubmitting(true);
    try {
      await apiClient.post("/organizations", {
        name,
        code,
        gst_number: gstNumber || null,
        address: address || null
      });
      setIsAddOpen(false);
      setName("");
      setCode("");
      setGstNumber("");
      setAddress("");
      toast.success("Organization created successfully");
      fetchOrgsAndStats();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to create organization");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (org: Organization, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening drawer on action click
    try {
      if (org.status === "Active") {
        const confirmed = await useConfirmStore.getState().confirm({
          title: "Suspend Organization",
          message: `Suspend organization "${org.name}"? This blocks access for all users in this tenant.`,
          roleAccent: "red"
        });
        if (confirmed) {
          await apiClient.post(`/organizations/${org.id}/suspend`);
        } else {
          return;
        }
      } else {
        const confirmed = await useConfirmStore.getState().confirm({
          title: "Reactivate Organization",
          message: `Reactivate organization "${org.name}"?`,
          roleAccent: "green"
        });
        if (confirmed) {
          await apiClient.post(`/organizations/${org.id}/reactivate`);
        } else {
          return;
        }
      }
      toast.success("Organization status updated successfully");
      // If currently selected, update status locally
      if (selectedOrg?.id === org.id) {
        setSelectedOrg({ ...selectedOrg, status: org.status === "Active" ? "Suspended" : "Active" });
      }
      fetchOrgsAndStats();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to change organization status");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
        <svg className="animate-spin h-8 w-8 text-rose-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-zinc-500 text-xs font-bold tracking-wider uppercase select-none">Loading Registry...</span>
      </div>
    );
  }

  // Filter users & invoices belonging to the selected organization
  const filteredUsers = selectedOrg ? users.filter(u => (u as any).organization_id === selectedOrg.id) : [];
  const filteredInvoices = selectedOrg ? invoices.filter(inv => (inv as any).organization_id === selectedOrg.id) : [];

  // Compute status breakdown
  const statusCounts = { paid: 0, pending: 0, exception: 0 };
  filteredInvoices.forEach(inv => {
    const status = (inv.status || "").toLowerCase();
    if (status.includes("paid") || status.includes("approved")) statusCounts.paid++;
    else if (status.includes("fail") || status.includes("exception") || status.includes("rejected")) statusCounts.exception++;
    else statusCounts.pending++;
  });
  const totalFiltered = filteredInvoices.length || 1;

  // Maximum invoice count across organizations for chart scale
  const maxInvoiceCount = Math.max(...orgs.map(o => o.invoice_count || 0), 1);

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight uppercase">
            Tenant Hub
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
            Manage multi-tenant enterprise organizations, status registry, and system diagnostics
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-600/10 hover:shadow-rose-600/20 active:scale-95 transition-all duration-200 uppercase tracking-widest"
        >
          Create Organization
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Overview Cards with CapsuleStatRow */}
      {overallStats && (
        <CapsuleStatRow
          chips={[
            {
              color: "pink",
              label: "Active Orgs",
              value: `${overallStats.total_organizations}`,
              sub: "Multi-tenant Registry",
              icon: (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              )
            },
            {
              color: "blue",
              label: "Registered Users",
              value: `${overallStats.total_users}`,
              sub: "Across all tenants",
              icon: (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20H2v-2a3 3 0 015.356-1.857" />
                </svg>
              )
            },
            {
              color: "purple",
              label: "Invoices Processed",
              value: `${overallStats.total_invoices}`,
              sub: "All processed logs",
              icon: (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )
            },
            {
              color: "green",
              label: "Success Rate",
              value: `${(overallStats.processing_success_rate || 0).toFixed(1)}%`,
              sub: "System reliability",
              icon: (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )
            }
          ]}
        />
      )}

      {/* Visual Analytics / Organization Comparison Chart */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm">
        <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider mb-5">Enterprise Activity & Scale</h3>
        <div className="space-y-4">
          {orgs.map((org) => {
            const pct = ((org.invoice_count || 0) / maxInvoiceCount) * 100;
            return (
              <div key={org.id} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-850 dark:text-zinc-200">{org.name} <span className="font-mono text-zinc-400 text-[10px]">({org.code})</span></span>
                  <span className="font-semibold text-zinc-500 dark:text-zinc-400">{org.invoice_count ?? 0} invoices</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800/80 h-3 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-gradient-to-r from-rose-500 to-pink-500 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Registry Table List */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="text-white text-[10px] font-black uppercase tracking-wider border-none">
                <th className="rounded-l-full py-3.5 px-4 bg-[#EC4899] text-white">Code</th>
                <th className="py-3.5 px-4 bg-[#EC4899] text-white">Name</th>
                <th className="py-3.5 px-4 bg-[#EC4899] text-white">GSTIN</th>
                <th className="py-3.5 px-4 bg-[#EC4899] text-white">Users</th>
                <th className="py-3.5 px-4 bg-[#EC4899] text-white">Invoices</th>
                <th className="py-3.5 px-4 bg-[#EC4899] text-white">Approval Rate</th>
                <th className="py-3.5 px-4 bg-[#EC4899] text-white">Status</th>
                <th className="rounded-r-full py-3.5 px-4 bg-[#EC4899] text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {orgs.map((org) => (
                <tr 
                  key={org.id} 
                  onClick={() => setSelectedOrg(org)}
                  className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors duration-150 group"
                >
                  <td className="py-4 pl-5 font-mono font-bold text-rose-600 dark:text-rose-450">{org.code}</td>
                  <td className="py-4">
                    <div className="font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-rose-500 transition-colors">{org.name}</div>
                    <div className="text-[10px] text-zinc-400 font-normal">{org.address || "—"}</div>
                  </td>
                  <td className="py-4 text-zinc-500 dark:text-zinc-400 font-mono">{org.gst_number || "—"}</td>
                  <td className="py-4 text-right font-bold text-zinc-800 dark:text-zinc-100">{org.user_count ?? 0}</td>
                  <td className="py-4 text-right font-bold text-zinc-800 dark:text-zinc-100">{org.invoice_count ?? 0}</td>
                  <td className="py-4 text-right font-bold text-emerald-500">
                    {`${(org.processing_success_rate ?? 100.0).toFixed(1)}%`}
                  </td>
                  <td className="py-4 pl-8">
                    <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-355 font-bold">
                      <span className={`w-1.5 h-1.5 rounded-full ${org.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {org.status}
                    </span>
                  </td>
                  <td className="py-4 pr-5 text-right">
                    <button
                      onClick={(e) => handleToggleStatus(org, e)}
                      className={`text-xs font-black uppercase tracking-wider hover:underline ${org.status === "Active" ? "text-rose-500 hover:text-rose-600" : "text-emerald-500 hover:text-emerald-600"}`}
                    >
                      {org.status === "Active" ? "Suspend" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500 font-medium">
                    No organizations registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Centered details modal for selected organization */}
      {selectedOrg && mounted && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div 
            onClick={() => setSelectedOrg(null)}
            className="absolute inset-0 bg-[#000000]/60 backdrop-blur-[2px] transition-opacity duration-300"
          />

          <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[85vh] rounded-3xl overflow-hidden transform transition-all duration-200 scale-100 text-zinc-900 dark:text-zinc-100">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2 py-0.5 rounded-md bg-[#FF3B3B] dark:bg-[#3D1414] text-[#FFFFFF] dark:text-[#FF5C5C] font-mono font-bold text-[9px] uppercase tracking-widest">{selectedOrg.code}</span>
                  <h2 className="text-xl font-black mt-2 text-zinc-900 dark:text-white uppercase tracking-tight">{selectedOrg.name}</h2>
                </div>
                <button 
                  onClick={() => setSelectedOrg(null)}
                  className="p-1.5 rounded-full hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-300 hover:text-zinc-650 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              
              {/* Organization Metadata Profile */}
              <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/50 rounded-2xl p-4 space-y-3 font-semibold text-zinc-600 dark:text-zinc-200">
                {isEditMode ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Organization Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">GSTIN (Tax ID)</label>
                      <input
                        type="text"
                        value={editGst}
                        onChange={(e) => setEditGst(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Address Details</label>
                      <textarea
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20"
                        rows={3}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[9px]">GSTIN (Tax ID)</span>
                      <span className="font-mono text-zinc-800 dark:text-white">{selectedOrg.gst_number || "Not Configured"}</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[9px]">Status</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase ${selectedOrg.status === "Active" ? "bg-[#39E35D] dark:bg-[#123B22] text-[#123B22] dark:text-[#4AFF7A]" : "bg-[#FF3B3B] dark:bg-[#3D1414] text-[#FFFFFF] dark:text-[#FF5C5C]"}`}>{selectedOrg.status}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400 block pb-1 font-bold uppercase tracking-wider text-[9px]">Address Details</span>
                      <p className="text-zinc-850 dark:text-zinc-200 leading-relaxed font-normal">{selectedOrg.address || "No address added."}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Invoices Status Ratio Tracker */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-300 tracking-wider">Invoice Processing Ratios</h4>
                {filteredInvoices.length === 0 ? (
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800/80 h-3 rounded-full flex items-center justify-center text-[8px] font-bold text-zinc-400">
                    No Invoices Registered
                  </div>
                ) : (
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-3 rounded-full overflow-hidden flex font-bold text-[9px] text-white">
                    <div 
                      title="Paid/Approved" 
                      className="bg-emerald-500 h-full flex items-center justify-center transition-all duration-500" 
                      style={{ width: `${(statusCounts.paid / totalFiltered) * 100}%` }}
                    />
                    <div 
                      title="Pending" 
                      className="bg-amber-500 h-full flex items-center justify-center transition-all duration-500" 
                      style={{ width: `${(statusCounts.pending / totalFiltered) * 100}%` }}
                    />
                    <div 
                      title="Exception/Rejected" 
                      className="bg-rose-500 h-full flex items-center justify-center transition-all duration-500" 
                      style={{ width: `${(statusCounts.exception / totalFiltered) * 100}%` }}
                    />
                  </div>
                )}
                <div className="flex gap-4 text-[10px] font-bold text-zinc-550 dark:text-zinc-400 pt-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Approved: {statusCounts.paid}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Pending: {statusCounts.pending}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />Exceptions: {statusCounts.exception}</span>
                </div>
              </div>

              {/* Tenant Users List */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-300 tracking-wider">Tenant Users ({filteredUsers.length})</h4>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-150 dark:border-zinc-800/80 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900/40">
                  {filteredUsers.map(user => (
                    <div key={user.id} className="p-3 flex justify-between items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="font-bold text-zinc-850 dark:text-zinc-200 truncate">{user.name}</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-455 font-normal truncate">{user.email}</div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#22D3EE] dark:bg-[#053A44] text-[#053A44] dark:text-[#67E8F9]">
                        {user.role}
                      </span>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="p-4 text-center text-zinc-450 dark:text-zinc-400 font-medium">No users mapped to this tenant.</div>
                  )}
                </div>
              </div>

              {/* Tenant Invoices List */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-zinc-555 dark:text-zinc-300 tracking-wider">Recent Invoices ({filteredInvoices.length})</h4>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-150 dark:border-zinc-800/80 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900/40">
                  {filteredInvoices.slice(0, 5).map(inv => (
                    <div key={inv.id} className="p-3 flex justify-between items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="font-bold text-zinc-850 dark:text-zinc-200 truncate">{inv.invoice_number || "Draft"}</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-455 font-normal truncate">{inv.seller_name || "Unknown Seller"}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-zinc-800 dark:text-zinc-100">₹{(inv.total_amount || 0).toLocaleString()}</div>
                        <div className={`text-[9px] uppercase font-black tracking-wider ${
                          (inv.status || "").toLowerCase().includes("paid") || (inv.status || "").toLowerCase().includes("approved") ? "text-emerald-500" :
                          (inv.status || "").toLowerCase().includes("fail") || (inv.status || "").toLowerCase().includes("exception") ? "text-rose-500" : "text-amber-500"
                        }`}>{inv.status}</div>
                      </div>
                    </div>
                  ))}
                  {filteredInvoices.length === 0 && (
                    <div className="p-4 text-center text-zinc-450 dark:text-zinc-450 font-medium">No invoices registered.</div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-zinc-150 dark:border-zinc-800/80 flex justify-end gap-2 text-xs font-bold">
              {isEditMode ? (
                <>
                  <button
                    onClick={() => setIsEditMode(false)}
                    disabled={savingOrg}
                    className="px-4 py-2 border border-zinc-200 dark:border-zinc-855 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 text-xs font-bold rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveOrgDetails}
                    disabled={savingOrg || !editName}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                  >
                    {savingOrg ? "Saving..." : "Save Details"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedOrg(null)}
                    className="px-4 py-2 border border-zinc-200 dark:border-zinc-855 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 text-xs font-bold rounded-xl transition-all"
                  >
                    Close Details
                  </button>
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-855 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all"
                  >
                    Edit Details
                  </button>
                  <button 
                    onClick={(e) => handleToggleStatus(selectedOrg, e)}
                    className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all ${
                      selectedOrg.status === "Active" ? 
                      "bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-600 dark:bg-rose-955/20 dark:border-rose-900/30 dark:hover:bg-rose-955/40 dark:text-rose-450" : 
                      "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-955/20 dark:border-emerald-900/30 dark:hover:bg-emerald-955/40 dark:text-emerald-450"
                    }`}
                  >
                    {selectedOrg.status === "Active" ? "Suspend Organization" : "Reactivate Organization"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Org Modal */}
      {isAddOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div 
            onClick={() => setIsAddOpen(false)}
            className="absolute inset-0 bg-[#000000]/60 backdrop-blur-[2px] transition-opacity duration-300"
          />
          {/* Modal Container: Solid background styled like UserManagement.tsx:183 */}
          <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden transform transition-all duration-200 scale-100 shadow-2xl text-zinc-900 dark:text-zinc-100">
            <div className="p-6 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex justify-between items-center text-zinc-900 dark:text-white">
              <h3 className="text-lg font-black uppercase tracking-tight">Create Organization</h3>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 rounded-full hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-300 hover:text-zinc-650 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <Input
                label="Organization Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Beverly"
              />
              <Input
                label="Org Unique Code (Short)"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. BEVERLY"
                className="font-mono uppercase"
              />
              <Input
                label="GST Number (GSTIN)"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="e.g. 29GGGGG1314R1Z0"
                className="font-mono uppercase"
              />
              <div className="flex flex-col gap-1 w-full text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-[#0F0F11] text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  placeholder="e.g. Bangalore, India"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Button variant="ghost" onClick={() => setIsAddOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={submitting}>
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
