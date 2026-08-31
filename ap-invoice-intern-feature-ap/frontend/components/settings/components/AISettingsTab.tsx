"use client";
import React, { useState } from "react";
import { useConfirmStore } from "../../../store/useConfirmStore";

type AISettingsTabProps = {
  canEdit: boolean;
  aiModel: string;
  setAiModel: (v: string) => void;
  aiExtractionVersion: string;
  setAiExtractionVersion: (v: string) => void;
  aiConfidenceThreshold: number;
  setAiConfidenceThreshold: (v: number) => void;
  aiTemperature: number;
  setAiTemperature: (v: number) => void;
  onSaveSettings: (sectionName: string) => Promise<void>;

  providers?: any[];
  onShowAddProviderModal?: () => void;
  onEditProvider?: (prov: any) => void;
  onDeleteProvider?: (id: number) => Promise<void>;
  onSeedProviders?: () => Promise<void>;
  onTestProvider?: (id: number) => Promise<void>;
};

export default function AISettingsTab({
  canEdit,
  aiModel,
  setAiModel,
  aiExtractionVersion,
  setAiExtractionVersion,
  aiConfidenceThreshold,
  setAiConfidenceThreshold,
  aiTemperature,
  setAiTemperature,
  onSaveSettings,

  providers = [],
  onShowAddProviderModal,
  onEditProvider,
  onDeleteProvider,
  onSeedProviders,
  onTestProvider,
}: AISettingsTabProps) {
  const [testingId, setTestingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  const handleTest = async (id: number) => {
    if (!onTestProvider) return;
    setTestingId(id);
    try {
      await onTestProvider(id);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!onDeleteProvider) return;
    const confirmed = await useConfirmStore.getState().confirm({
      title: "Remove AI Provider",
      message: "Are you sure you want to remove this AI provider?",
      roleAccent: "red"
    });
    if (!confirmed) return;
    setDeletingId(id);
    try {
      await onDeleteProvider(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSeed = async () => {
    if (!onSeedProviders) return;
    setSeeding(true);
    try {
      await onSeedProviders();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-zinc-950 dark:text-white">
      {/* Prediction Parameters */}
      <div className="border border-[#9B6BFF]/20 rounded-3xl p-6 bg-gradient-to-br from-[#9B6BFF]/10 to-[#FF3EA5]/10 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Prediction Parameters</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Preferred AI Model (Priority Hint)</label>
            <input type="text" value={aiModel} onChange={(e) => setAiModel(e.target.value)} placeholder="e.g. Gemini, DeepSeek, Llama" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#9B6BFF]/50" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Extraction Pipeline version</label>
            <input type="text" value={aiExtractionVersion} onChange={(e) => setAiExtractionVersion(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#9B6BFF]/50" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Confidence threshold</label>
            <input type="number" step="0.05" min="0.5" max="1.0" value={aiConfidenceThreshold} onChange={(e) => setAiConfidenceThreshold(parseFloat(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#9B6BFF]/50" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">AI Temperature</label>
            <input type="number" step="0.1" min="0" max="1.0" value={aiTemperature} onChange={(e) => setAiTemperature(parseFloat(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#9B6BFF]/50" />
          </div>
        </div>
        <button disabled={!canEdit} onClick={() => onSaveSettings("AI")} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-xl shadow-sm transition-colors font-bold">Save AI Parameters</button>
      </div>

      {/* AI Providers Management */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">AI Provider Connections</h3>
            <p className="text-[10px] text-zinc-500 font-normal mt-0.5">Configure endpoints, API formats, and prioritize extraction LLMs.</p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding}
                className="px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
              >
                {seeding ? "Seeding..." : "Seed from Env"}
              </button>
              <button
                type="button"
                onClick={onShowAddProviderModal}
                className="px-3.5 py-1.5 bg-[#39E35D] hover:bg-[#2fc44e] text-zinc-955 font-bold text-xs rounded-xl transition-all"
              >
                + Add Provider
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {["Provider Name", "API URL", "Model", "Format", "Priority", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400 font-normal">
                    No custom AI providers configured. Click "Add Provider" or "Seed from Env".
                  </td>
                </tr>
              ) : (
                providers.map((p: any) => (
                  <tr key={p.id} className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-2 font-black text-zinc-800 dark:text-zinc-100">{p.name}</td>
                    <td className="py-2.5 px-2 text-zinc-500 dark:text-zinc-400 font-mono font-normal max-w-[200px] truncate" title={p.api_url}>
                      {p.api_url}
                    </td>
                    <td className="py-2.5 px-2 text-zinc-650 dark:text-zinc-350 font-normal">{p.model || "—"}</td>
                    <td className="py-2.5 px-2">
                      <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-350 text-[9px] rounded-md font-bold uppercase tracking-wider">
                        {p.response_format}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-bold text-zinc-700 dark:text-zinc-300">{p.priority}</td>
                    <td className="py-2.5 px-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        p.enabled 
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50"
                          : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.enabled ? "bg-emerald-500" : "bg-zinc-400"}`} />
                        {p.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex gap-1.5 items-center">
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTest(p.id)}
                              disabled={testingId === p.id}
                              className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-750 dark:text-zinc-200 rounded-lg transition-all font-bold disabled:opacity-50"
                            >
                              {testingId === p.id ? "Testing..." : "Test"}
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditProvider && onEditProvider(p)}
                              className="px-2.5 py-1 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-300 rounded-lg transition-all font-bold"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              disabled={deletingId === p.id}
                              className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all font-bold disabled:opacity-50"
                            >
                              {deletingId === p.id ? "..." : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
