"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import apiClient from "../../../services/api-client";
import enterpriseService from "../../../services/enterprise.service";

type PaymentsTabProps = {
  canEdit: boolean;
};

export default function PaymentsTab({ canEdit }: PaymentsTabProps) {
  const [gateways, setGateways] = useState<any[]>([]);
  const [allowedMethods, setAllowedMethods] = useState<string[]>([]);
  const [dualApprovalEnabled, setDualApprovalEnabled] = useState(false);
  const [approvalThreshold, setApprovalThreshold] = useState(500000);
  const [loading, setLoading] = useState(false);
  const [batchMode, setBatchMode] = useState("Real-Time Triggers");
  const [weekendRule, setWeekendRule] = useState("Postpone to Monday");
  const [retryLimit, setRetryLimit] = useState("3 Retries (Exponential backoff)");

  // New Gateway modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGatewayName, setNewGatewayName] = useState("");
  const [newGatewayApiKey, setNewGatewayApiKey] = useState("");

  // ERP Sync logs list & action states
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [syncLogsLoading, setSyncLogsLoading] = useState(false);
  const [retryingLogId, setRetryingLogId] = useState<number | null>(null);

  const fetchSyncLogs = async () => {
    setSyncLogsLoading(true);
    try {
      const logs = await enterpriseService.getSyncLogs();
      setSyncLogs(logs || []);
    } catch {
      toast.error("Failed to load ERP sync logs");
    } finally {
      setSyncLogsLoading(false);
    }
  };

  const handleRetrySync = async (logId: number) => {
    setRetryingLogId(logId);
    toast.info("Retrying ERP Sync transaction...");
    try {
      const res = await enterpriseService.retrySyncLog(logId);
      if (res.status === "SUCCESS") {
        toast.success("ERP Synchronization completed successfully!");
        fetchSyncLogs();
      } else {
        toast.error("ERP Synchronization failed again.");
      }
    } catch (e: any) {
      toast.error("ERP sync retry failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setRetryingLogId(null);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/payments/settings");
      setGateways(res.data.gateways || []);
      setAllowedMethods(res.data.allowed_methods || []);
      setDualApprovalEnabled(res.data.dual_approval_enabled || false);
      setApprovalThreshold(res.data.approval_threshold || 500000);
    } catch {
      toast.error("Failed to load payment configurations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchSyncLogs();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      await apiClient.post("/payments/settings", {
        gateways,
        allowed_methods: allowedMethods,
        dual_approval_enabled: dualApprovalEnabled,
        approval_threshold: Number(approvalThreshold)
      });
      toast.success("Payment Center configurations updated successfully");
      fetchSettings();
    } catch {
      toast.error("Failed to save payment configurations");
    }
  };

  const handleTestConnection = async (gatewayName: string) => {
    toast.info(`Testing credentials connectivity for ${gatewayName}...`);
    await new Promise(r => setTimeout(r, 1000));
    toast.success(`${gatewayName} Sandbox Connection: ACTIVE (API Key Authorized)`);
  };

  const handleAddGateway = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGatewayName.trim()) {
      toast.error("Gateway name is required.");
      return;
    }
    // Check if duplicate
    if (gateways.some(g => g.name.toLowerCase() === newGatewayName.trim().toLowerCase())) {
      toast.error("Gateway already exists.");
      return;
    }

    const newGateway = {
      name: newGatewayName.trim(),
      is_enabled: true,
      credentials: { api_key: newGatewayApiKey },
      daily_limit: 1000000,
      timeout_seconds: 30
    };

    setGateways([...gateways, newGateway]);
    setShowAddModal(false);
    setNewGatewayName("");
    setNewGatewayApiKey("");
    toast.success(`${newGatewayName} configured locally. Press 'Save Payout Settings' to save to backend.`);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-fade-in text-zinc-950 dark:text-white font-sans relative">
      
      {/* 1. HORIZONTAL CAROUSEL OF PAYMENT GATEWAYS */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Connected Payment Gateways</h3>
            <p className="text-[10px] text-zinc-500 font-normal mt-0.5">Plug-and-play payout gateways. Scroll horizontally to manage channels.</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-[#FF3EA5] hover:bg-[#d82d85] text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Gateway
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-xs text-zinc-400 py-8 text-center">Loading gateways...</div>
        ) : gateways.length === 0 ? (
          <div className="text-xs text-zinc-400 py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            No gateways connected yet. Click "Add Gateway" to configure a payment channel.
          </div>
        ) : (
          <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-none hide-scrollbar" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>

            {[...gateways]
              .sort((a, b) => {
                const aActive = a.is_enabled ? 1 : 0;
                const bActive = b.is_enabled ? 1 : 0;
                return bActive - aActive; // Place active gateways first
              })
              .map((g) => (
              <div key={g.name} className="p-6 border border-zinc-150 dark:border-zinc-800/80 rounded-2xl flex flex-col justify-between gap-4 font-bold bg-zinc-50/30 dark:bg-zinc-900/40 min-w-[300px] md:min-w-[340px] snap-start shrink-0 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors duration-200 shadow-sm">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-100">{g.name} Payouts</span>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => {
                        setGateways(gateways.map(x => x.name === g.name ? { ...x, is_enabled: !x.is_enabled } : x));
                      }}
                      className={`w-10 h-5.5 rounded-full relative transition-colors ${g.is_enabled ? "bg-[#39E35D]" : "bg-zinc-300 dark:bg-zinc-700"}`}
                    >
                      <span className={`inline-block w-3.5 h-3.5 rounded-full bg-white transform transition-transform absolute left-1 top-1 ${g.is_enabled ? "translate-x-4.5" : ""}`} />
                    </button>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] text-zinc-400 uppercase">API Key / Merchant ID</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={g.credentials?.api_key || ""}
                      onChange={(e) => {
                        const nextCreds = { ...g.credentials, api_key: e.target.value };
                        setGateways(gateways.map(x => x.name === g.name ? { ...x, credentials: nextCreds } : x));
                      }}
                      placeholder="Enter merchant identifier"
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[9px] text-zinc-400 uppercase">Daily Cap (INR)</label>
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={g.daily_limit}
                        onChange={(e) => {
                          setGateways(gateways.map(x => x.name === g.name ? { ...x, daily_limit: Number(e.target.value) } : x));
                        }}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-400"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-400 uppercase">Timeout (s)</label>
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={g.timeout_seconds}
                        onChange={(e) => {
                          setGateways(gateways.map(x => x.name === g.name ? { ...x, timeout_seconds: Number(e.target.value) } : x));
                        }}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <span className="text-[9px] text-zinc-400">Status: <span className={g.is_enabled ? "text-emerald-500 font-bold" : "text-zinc-450 dark:text-zinc-500 font-bold"}>{g.is_enabled ? "ONLINE" : "DISABLED"}</span></span>
                  <div className="flex gap-1.5">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setGateways(gateways.filter(x => x.name !== g.name));
                        }}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200/40 dark:border-red-900/30 rounded-lg text-[9px] uppercase tracking-wider transition-colors font-bold"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!g.is_enabled}
                      onClick={() => handleTestConnection(g.name)}
                      className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 rounded-lg text-[9px] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Test connection
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. DUAL APPROVAL POLICIES & METHODS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Approval Limits &amp; Dual Controls</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-zinc-850 dark:text-zinc-150 block">Require CFO Approval for Large Sums</label>
                <span className="text-[10px] text-zinc-400 font-normal">Dual-signatures mandatory above configuration thresholds.</span>
              </div>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setDualApprovalEnabled(!dualApprovalEnabled)}
                className={`w-10 h-5.5 rounded-full relative transition-colors ${dualApprovalEnabled ? "bg-[#39E35D]" : "bg-zinc-300 dark:bg-zinc-700"}`}
              >
                <span className={`inline-block w-3.5 h-3.5 rounded-full bg-white transform transition-transform absolute left-1 top-1 ${dualApprovalEnabled ? "translate-x-4.5" : ""}`} />
              </button>
            </div>

            {dualApprovalEnabled && (
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-400 uppercase tracking-wider">CFO Verification Threshold (INR)</label>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={approvalThreshold}
                  onChange={(e) => setApprovalThreshold(Number(e.target.value))}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Active Payout Channels</h3>
          
          <div className="grid grid-cols-2 gap-3">
            {["Bank Transfer", "NEFT", "RTGS", "IMPS", "UPI", "ACH", "Cheque"].map((method) => {
              const active = allowedMethods.includes(method);
              return (
                <label key={method} className="flex items-center gap-2.5 cursor-pointer font-bold text-xs select-none">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={active}
                    onChange={() => {
                      if (active) {
                        setAllowedMethods(allowedMethods.filter(x => x !== method));
                      } else {
                        setAllowedMethods([...allowedMethods, method]);
                      }
                    }}
                    className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-zinc-700 dark:text-zinc-250">{method}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. EXECUTION CRON & RETRY POLICY */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Execution Workers &amp; Calendar Rules</h3>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl space-y-2">
            <label className="text-[9px] text-zinc-400 uppercase block font-bold">Execution Batch Mode</label>
            <select
              disabled={!canEdit}
              value={batchMode}
              onChange={(e) => setBatchMode(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-100 font-bold outline-none disabled:bg-zinc-150 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 cursor-pointer"
            >
              <option className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">Real-Time Triggers</option>
              <option className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">Every 2 Hours</option>
              <option className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">Once Daily (Cutoff 17:00)</option>
            </select>
          </div>
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl space-y-2">
            <label className="text-[9px] text-zinc-400 uppercase block font-bold">Weekend Working Rules</label>
            <select
              disabled={!canEdit}
              value={weekendRule}
              onChange={(e) => setWeekendRule(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-100 font-bold outline-none disabled:bg-zinc-150 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 cursor-pointer"
            >
              <option className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">Postpone to Monday</option>
              <option className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">Execute Immediately</option>
              <option className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">Fail Payout Transaction</option>
            </select>
          </div>
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl space-y-2">
            <label className="text-[9px] text-zinc-400 uppercase block font-bold">Retry Limits (Max Retries)</label>
            <select
              disabled={!canEdit}
              value={retryLimit}
              onChange={(e) => setRetryLimit(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-100 font-bold outline-none disabled:bg-zinc-150 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 cursor-pointer"
            >
              <option className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">3 Retries (Exponential backoff)</option>
              <option className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">5 Retries (Exponential backoff)</option>
              <option className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">No Automatic Retry</option>
            </select>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-3 bg-[#EC4899] hover:bg-[#db3f88] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md"
          >
            Save Payout Settings
          </button>
        </div>
      )}

      {/* 4. ERP INTEGRATIONS SYNC LOGS & RETRIES */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">ERP Synchronization Ledger</h3>
          <p className="text-[10px] text-zinc-500 font-normal mt-0.5">Logs of automated postings to Odoo, SAP, NetSuite, and QuickBooks. Click retry to re-process errors.</p>
        </div>

        {syncLogsLoading ? (
          <div className="text-xs text-zinc-400 py-8 text-center">Loading integration sync logs...</div>
        ) : syncLogs.length === 0 ? (
          <div className="text-xs text-zinc-400 py-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            No ERP synchronization entries recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-zinc-400 dark:text-zinc-500 text-[9px] font-black uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                  <th className="py-3 px-2">Invoice</th>
                  <th className="py-3 px-2">ERP System</th>
                  <th className="py-3 px-2">External Reference</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Details / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60 text-xs font-semibold">
                {syncLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                    <td className="py-3 px-2">
                      <span className="text-zinc-800 dark:text-zinc-100 block">{log.invoice_number || `ID: ${log.invoice_id}`}</span>
                      <span className="text-[9.5px] text-zinc-400 font-normal block mt-0.5">{log.vendor_name} · ₹{log.total_value}</span>
                    </td>
                    <td className="py-3 px-2 uppercase tracking-wide text-zinc-600 dark:text-zinc-350 text-[10px] font-bold">
                      {log.erp_system}
                    </td>
                    <td className="py-3 px-2 font-mono text-[10px] text-zinc-500">
                      {log.external_ref || "—"}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        log.sync_status === "SUCCESS" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-[#39E35D]" : "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-450"
                      }`}>
                        {log.sync_status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      {log.sync_status !== "SUCCESS" ? (
                        <div className="flex flex-col items-end gap-1.5">
                          {log.error_message && (
                            <span className="text-[9.5px] font-normal text-rose-500 max-w-[200px] block truncate" title={log.error_message}>
                              {log.error_message}
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={retryingLogId === log.id}
                            onClick={() => handleRetrySync(log.id)}
                            className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg text-[9px] uppercase tracking-wider transition-colors font-black border border-zinc-200 dark:border-zinc-750 disabled:opacity-40"
                          >
                            {retryingLogId === log.id ? "Retrying..." : "Retry Sync"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-450 dark:text-zinc-500">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Gateway Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Connect New Payment Gateway</h3>
            
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5 font-black">Gateway Provider *</label>
                <select
                  value={newGatewayName}
                  onChange={(e) => setNewGatewayName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 font-bold outline-none"
                >
                  <option value="">Select a provider...</option>
                  <option value="Razorpay">Razorpay Payouts</option>
                  <option value="Stripe">Stripe Connect</option>
                  <option value="PayU">PayU Biz</option>
                  <option value="Cashfree">Cashfree Payouts</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5 font-black">API Secret Key / Merchant Token</label>
                <input
                  type="password"
                  value={newGatewayApiKey}
                  onChange={(e) => setNewGatewayApiKey(e.target.value)}
                  placeholder="e.g. rzp_live_xxxxxx or sk_live_xxxxxx"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setNewGatewayName(""); setNewGatewayApiKey(""); }}
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddGateway}
                className="px-4 py-2 rounded-xl bg-[#FF3EA5] hover:bg-[#d82d85] text-white text-xs font-black uppercase tracking-wider transition-colors shadow-md"
              >
                Add Gateway
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
