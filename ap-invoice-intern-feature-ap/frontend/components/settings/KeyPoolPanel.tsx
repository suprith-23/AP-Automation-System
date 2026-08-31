"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAppStore } from "../../store/useAppStore";
import {
  orgKeyService,
  OrgAPIKey,
  OrgAPIKeyCreate,
  OrgAPIKeyUpdate,
  ProviderName,
} from "../../services/org-key.service";

// ─── Provider metadata ────────────────────────────────────────────────────────

const PROVIDERS: { value: ProviderName; label: string }[] = [
  { value: "groq",   label: "Groq" },
  { value: "gemini", label: "Gemini" },
  { value: "nvidia", label: "NVIDIA" },
  { value: "hf",     label: "HuggingFace" },
  { value: "colab",  label: "Colab" },
];

function getProviderLabel(name: string) {
  return PROVIDERS.find((p) => p.value === name.toLowerCase())?.label ?? name;
}

// ─── Status chip ─────────────────────────────────────────────────────────────

function StatusChip({ status, cooldownUntil }: { status: string; cooldownUntil?: string | null }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (status !== "rate_limited" || !cooldownUntil) return;
    const tick = () => {
      const diff = new Date(cooldownUntil).getTime() - Date.now();
      if (diff <= 0) { setRemaining(""); return; }
      const s = Math.ceil(diff / 1000);
      setRemaining(s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status, cooldownUntil]);

  const map: Record<string, { label: string; textClass: string; dotClass: string }> = {
    active: { 
      label: "Active", 
      textClass: "bg-emerald-600 text-white border-emerald-700 dark:bg-[#4AFF7A] dark:text-[#0A0A0A] dark:border-[#4AFF7A]", 
      dotClass: "bg-white dark:bg-[#0A0A0A] shadow-[0_0_6px_rgba(255,255,255,0.5)]" 
    },
    rate_limited: { 
      label: remaining ? `Cooldown ${remaining}` : "Rate limited", 
      textClass: "bg-amber-500 text-zinc-950 border-amber-600 dark:bg-[#FFCB3D] dark:text-[#0A0A0A] dark:border-[#FFCB3D]", 
      dotClass: "bg-zinc-950 dark:bg-[#0A0A0A] shadow-[0_0_6px_rgba(10,10,10,0.5)]" 
    },
    expired: { 
      label: "Expired", 
      textClass: "bg-red-650 text-white border-red-750 dark:bg-[#FF5C5C] dark:text-[#0A0A0A] dark:border-[#FF5C5C]", 
      dotClass: "bg-white dark:bg-[#0A0A0A] shadow-[0_0_6px_rgba(255,255,255,0.5)]" 
    },
  };
  const s = map[status] ?? { 
    label: status, 
    textClass: "bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700", 
    dotClass: "bg-zinc-450" 
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-full text-[9px] font-bold uppercase tracking-wider ${s.textClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dotClass} ${status === "active" ? "animate-pulse" : ""}`} />
      {s.label}
    </span>
  );
}

// ─── Provider badge ───────────────────────────────────────────────────────────

function ProviderBadge({ name }: { name: string }) {
  const map: Record<string, string> = {
    groq: "bg-emerald-600 text-white border-emerald-700 dark:bg-[#4AFF7A] dark:text-[#0A0A0A] dark:border-[#4AFF7A]",
    gemini: "bg-indigo-600 text-white border-indigo-700 dark:bg-[#B388FF] dark:text-[#0A0A0A] dark:border-[#B388FF]",
    nvidia: "bg-cyan-600 text-white border-cyan-700 dark:bg-[#1FF5DB] dark:text-[#0A0A0A] dark:border-[#1FF5DB]",
    hf: "bg-amber-500 text-zinc-950 border-amber-600 dark:bg-[#FFCB3D] dark:text-[#0A0A0A] dark:border-[#FFCB3D]",
    colab: "bg-orange-600 text-white border-orange-700 dark:bg-[#FB923C] dark:text-[#0A0A0A] dark:border-[#FB923C]",
  };
  const badgeClass = map[name.toLowerCase()] ?? "bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700";
  return (
    <span className={`px-2.5 py-0.5 border rounded-lg text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>
      {getProviderLabel(name)}
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface KeyModalProps {
  mode: "add" | "edit";
  initial?: Partial<OrgAPIKey & { api_key?: string }>;
  onClose: () => void;
  onSave: (data: OrgAPIKeyCreate | OrgAPIKeyUpdate) => Promise<void>;
}

function KeyModal({ mode, initial, onClose, onSave }: KeyModalProps) {
  const [form, setForm] = useState({
    provider_name: initial?.provider_name ?? "groq",
    key_name: initial?.key_name ?? "",
    api_key: "",
    priority_order: initial?.priority_order ?? 10,
    enabled: initial?.enabled ?? true,
    status: initial?.status ?? "active",
  });
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSave = async () => {
    if (!form.key_name.trim()) { toast.error("Key name is required"); return; }
    if (mode === "add" && !form.api_key.trim()) { toast.error("API key is required"); return; }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, children: React.ReactNode) => (
    <div className="mb-4">
      <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 dark:bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in text-zinc-800 dark:text-zinc-100">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            {mode === "add" ? "Add API Key" : "Edit API Key"}
          </h3>
          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {mode === "add" && field("Provider",
          <select
            value={form.provider_name}
            onChange={e => setForm(f => ({ ...f, provider_name: e.target.value }))}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium"
          >
            {PROVIDERS.map(p => (
              <option key={p.value} value={p.value} className="bg-white dark:bg-zinc-950">{p.label}</option>
            ))}
          </select>
        )}

        {field("Key Name",
          <input
            value={form.key_name}
            onChange={e => setForm(f => ({ ...f, key_name: e.target.value }))}
            placeholder="e.g. Primary Groq Key #1"
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          />
        )}

        {field(`API Key${mode === "edit" ? " (leave blank to keep current)" : ""}`,
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={form.api_key}
              onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
              placeholder={mode === "edit" ? "Leave blank to keep unchanged" : "sk-…"}
              className="w-full pr-10 px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
            <button
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm transition-colors"
            >
              {showKey ? "🙈" : "👁"}
            </button>
          </div>
        )}

        {field("Priority Order (lower = tried first)",
          <input
            type="number" min={1} max={999}
            value={form.priority_order}
            onChange={e => setForm(f => ({ ...f, priority_order: parseInt(e.target.value) || 10 }))}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          />
        )}

        {mode === "edit" && field("Force Status Reset",
          <select
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium"
          >
            <option value="active" className="bg-white dark:bg-zinc-950">Active</option>
            <option value="rate_limited" className="bg-white dark:bg-zinc-950">Rate Limited</option>
            <option value="expired" className="bg-white dark:bg-zinc-950">Expired</option>
          </select>
        )}

        <div className="flex items-center gap-3 mb-6 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800/40 p-3 rounded-xl">
          <div
            onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
            className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${form.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-800'}`}
          >
            <div 
              className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm"
              style={{ left: form.enabled ? "18px" : "2px" }}
            />
          </div>
          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            {form.enabled ? "Enabled — included in active pool" : "Disabled — excluded from pool"}
          </span>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-805/50 text-zinc-500 dark:text-zinc-400 text-xs font-bold rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function KeyPoolPanel() {
  const [keys, setKeys] = useState<OrgAPIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "add" | "edit"; key?: OrgAPIKey } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInitialLoad = useRef(true);

  const load = useCallback(async () => {
    if (isInitialLoad.current) {
      setLoading(true);
    }
    try {
      const data = await orgKeyService.listKeys();
      setKeys(data);
    } catch {
      // silently ignore background poll errors
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  // ── Derived stats ────────────────────────────────────────────────────────
  const activeCount = keys.filter(k => k.enabled && k.status === "active").length;
  const totalCount = keys.length;
  
  // Health color styling classes
  const healthBadgeStyle = activeCount === 0 
    ? "bg-red-650 text-white border-red-750 dark:bg-[#FF5C5C] dark:text-[#0A0A0A] dark:border-[#FF5C5C]" 
    : activeCount < totalCount 
      ? "bg-amber-500 text-zinc-950 border-amber-600 dark:bg-[#FFCB3D] dark:text-[#0A0A0A] dark:border-[#FFCB3D]" 
      : "bg-emerald-600 text-white border-emerald-700 dark:bg-[#4AFF7A] dark:text-[#0A0A0A] dark:border-[#4AFF7A]";

  const healthDotColor = activeCount === 0 
    ? "bg-white dark:bg-[#0A0A0A]" 
    : activeCount < totalCount 
      ? "bg-zinc-950 dark:bg-[#0A0A0A]" 
      : "bg-white dark:bg-[#0A0A0A]";

  // ── CRUD handlers ────────────────────────────────────────────────────────
  const handleAdd = async (data: OrgAPIKeyCreate | OrgAPIKeyUpdate) => {
    try {
      await orgKeyService.addKey(data as OrgAPIKeyCreate);
      toast.success("Key added to pool ✓");
      setModal(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Failed to add key");
    }
  };

  const handleEdit = async (data: OrgAPIKeyCreate | OrgAPIKeyUpdate) => {
    if (!modal?.key) return;
    const update: OrgAPIKeyUpdate = {
      key_name: (data as any).key_name,
      priority_order: (data as any).priority_order,
      enabled: (data as any).enabled,
      status: (data as any).status,
    };
    if ((data as any).api_key) update.api_key = (data as any).api_key;
    try {
      await orgKeyService.updateKey(modal.key.id, update);
      toast.success("Key updated ✓");
      setModal(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Failed to update key");
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await orgKeyService.deleteKey(id);
      toast.success("Key removed from pool");
      setKeys(k => k.filter(r => r.id !== id));
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Failed to delete key");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleEnabled = async (key: OrgAPIKey) => {
    try {
      const nextVal = !key.enabled;
      // Optimistic update
      setKeys(k => k.map(r => r.id === key.id ? { ...r, enabled: nextVal } : r));
      await orgKeyService.updateKey(key.id, { enabled: nextVal });
    } catch {
      toast.error("Failed to toggle key status");
      load(); // rollback to DB state
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const { role } = useAppStore();
  const canEdit = role === "Admin" || role === "Super Admin";

  return (
    <div className="py-1">
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
            API Key Pool {!canEdit && "(Read-Only)"}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xl">
            Manage hot-swappable provider keys. The pipeline tries keys in priority order, skipping rate-limited or expired ones automatically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Pool health badge */}
          <div className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors shadow-sm ${healthBadgeStyle}`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${healthDotColor} animate-pulse`} />
            {activeCount} active / {totalCount} total
          </div>
          {canEdit && (
            <button
              onClick={() => setModal({ mode: "add" })}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>+</span> Add Key
            </button>
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
        {/* Table header */}
        <div className="hidden md:grid md:grid-cols-[120px_1fr_110px_90px_80px_120px_140px] gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-150 dark:border-zinc-800/80 items-center">
          {["Provider", "Key Name / Masked", "Status", "Priority", "Enabled", "Last Used", "Actions"].map(h => (
            <span key={h} className="text-[10px] font-bold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
            Loading key pool…
          </div>
        ) : keys.length === 0 ? (
          <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
            <div className="mb-3 text-zinc-400 dark:text-zinc-650">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-4">No API keys in pool yet.</p>
            <button
              onClick={() => setModal({ mode: "add" })}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              + Add Your First Key
            </button>
          </div>
        ) : (
          keys.map((key, i) => (
            <div
              key={key.id}
              className={`grid grid-cols-1 md:grid-cols-[120px_1fr_110px_90px_80px_120px_140px] gap-3 md:gap-2 px-4 py-4 md:py-3.5 items-center hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors ${
                i < keys.length - 1 ? "border-b border-zinc-150 dark:border-zinc-800/50" : ""
              } ${!key.enabled ? "opacity-60" : "opacity-100"}`}
            >
              {/* Provider */}
              <div className="flex md:block items-center justify-between">
                <span className="md:hidden text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Provider</span>
                <ProviderBadge name={key.provider_name} />
              </div>

              {/* Key name + masked */}
              <div className="flex flex-col">
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-150 mb-0.5">{key.key_name}</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-450 font-mono tracking-wide">{key.masked_key}</div>
                {key.last_error && (
                  <div
                    title={key.last_error}
                    className="text-[9px] text-red-500 font-bold mt-1.5 flex items-center gap-1 cursor-help max-w-sm truncate"
                  >
                    <svg className="w-3 h-3 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg> {key.last_error}
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="flex md:block items-center justify-between">
                <span className="md:hidden text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Status</span>
                <StatusChip status={key.status} cooldownUntil={key.cooldown_until} />
              </div>

              {/* Priority */}
              <div className="flex md:block items-center justify-between">
                <span className="md:hidden text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Priority</span>
                <span className="text-xs text-zinc-700 dark:text-zinc-300 font-bold">#{key.priority_order}</span>
              </div>

              {/* Enabled toggle */}
              <div className="flex md:block items-center justify-between">
                <span className="md:hidden text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Enabled</span>
                <div
                  onClick={() => canEdit && handleToggleEnabled(key)}
                  className={`w-9 h-5 rounded-full relative transition-colors ${key.enabled ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"} ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div 
                    className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm"
                    style={{ left: key.enabled ? "18px" : "2px" }}
                  />
                </div>
              </div>

              {/* Last used */}
              <div className="flex md:block items-center justify-between">
                <span className="md:hidden text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Last Used</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  {key.last_used_at
                    ? new Date(key.last_used_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end md:justify-start border-t md:border-none pt-3 md:pt-0 border-zinc-100 dark:border-zinc-800/80 items-center">
                {canEdit ? (
                  <>
                    <button
                      onClick={async () => {
                        toast.info("Testing connection...");
                        try {
                          const data = await orgKeyService.testKey(key.id);
                          if (data.status === "success" || data.status === "ok") {
                            toast.success(`Connection test succeeded! (${data.latency_ms ?? 0}ms)`);
                            load();
                          } else {
                            toast.error(`Connection test failed: ${data.error || "Unknown Error"}`);
                            load();
                          }
                        } catch (e: any) {
                          toast.error(`Test failed: ${e.message}`);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => setModal({ mode: "edit", key })}
                      className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 bg-transparent text-zinc-600 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(key.id)}
                      disabled={deletingId === key.id}
                      className="px-3 py-1.5 border border-red-500/20 bg-transparent hover:bg-red-500/10 text-red-500 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      {deletingId === key.id ? "…" : "Del"}
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] text-zinc-400 font-normal">No Actions</span>
                )}
              </div>
            </div>
          ))
        )
}
      </div>

      {/* ── Info footer ─────────────────────────────────────────────────── */}
      <div className="mt-4 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-150/40 dark:border-indigo-950/20 flex gap-3 items-start">
        <span className="text-lg mt-0.5">ℹ️</span>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
          <strong className="text-indigo-600 dark:text-indigo-400 font-bold">Hot-swap:</strong> Changes take effect within 30 seconds (cache TTL). 
          Rate-limited keys auto-recover when their cooldown expires. 
          Keys with <em className="underline decoration-red-400/50">expired</em> status are skipped permanently until manually reset. 
          Priority 1 = tried first. Pool falls back to env-var config if no pool keys are active.
        </div>
      </div>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      {modal && (
        <KeyModal
          mode={modal.mode}
          initial={modal.key}
          onClose={() => setModal(null)}
          onSave={modal.mode === "add" ? handleAdd : handleEdit}
        />
      )}
    </div>
  );
}
