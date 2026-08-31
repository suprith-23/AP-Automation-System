"use client";
import React from "react";

type PromptTabProps = {
  canEdit: boolean;
  currentPrompt: string;
  setCurrentPrompt: (v: string) => void;
  promptHistory: any[];
  newPromptVersionName: string;
  setNewPromptVersionName: (v: string) => void;
  newPromptVersionNotes: string;
  setNewPromptVersionNotes: (v: string) => void;
  promptTestResult: any | null;
  onTestPrompt: () => Promise<void>;
  onCreatePromptVersion: (e: React.FormEvent) => Promise<void>;
  onRollbackPrompt: (id: number) => Promise<void>;
};

export default function PromptTab({
  canEdit,
  currentPrompt,
  setCurrentPrompt,
  promptHistory,
  newPromptVersionName,
  setNewPromptVersionName,
  newPromptVersionNotes,
  setNewPromptVersionNotes,
  promptTestResult,
  onTestPrompt,
  onCreatePromptVersion,
  onRollbackPrompt,
}: PromptTabProps) {
  return (
    <div className="space-y-6 animate-fade-in text-zinc-950 dark:text-white">
      {/* Active Prompt View / Edit Card */}
      <div className="border border-[#9B6BFF]/20 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Active Extraction Prompt</h3>
            <p className="text-[10px] text-zinc-500 font-normal mt-0.5">Edit prompt template guidelines applied for AI extraction pipeline processing.</p>
          </div>
          {canEdit && (
            <button 
              onClick={onTestPrompt} 
              className="px-3.5 py-1.5 bg-[#9B6BFF] hover:bg-[#8553eb] text-white font-bold text-xs rounded-xl transition-all"
            >
              Test Prompt
            </button>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] text-zinc-400 uppercase tracking-widest font-bold">System Prompt Instructions</label>
          <textarea
            rows={8}
            value={currentPrompt}
            onChange={(e) => setCurrentPrompt(e.target.value)}
            disabled={!canEdit}
            placeholder="Enter prompt instructions for OCR extraction..."
            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-[#9B6BFF]/50 transition-all outline-none"
          />
        </div>

        {promptTestResult && (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2 text-xs">
            <div className="font-bold text-zinc-700 dark:text-zinc-300">Test Run Output:</div>
            <pre className="text-[10px] font-mono text-zinc-650 dark:text-zinc-400 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(promptTestResult.parsedOutput || promptTestResult, null, 2)}
            </pre>
          </div>
        )}

        {canEdit && (
          <form onSubmit={onCreatePromptVersion} className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-750 dark:text-zinc-250">Create New Version / Commit changes</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Version Name *</label>
                <input
                  type="text"
                  required
                  value={newPromptVersionName}
                  onChange={(e) => setNewPromptVersionName(e.target.value)}
                  placeholder="e.g. v3.9"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Release Notes</label>
                <input
                  type="text"
                  value={newPromptVersionNotes}
                  onChange={(e) => setNewPromptVersionNotes(e.target.value)}
                  placeholder="e.g. Added item table parsing fallback"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>
            </div>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl shadow-sm transition-colors font-bold">Save New Prompt Version</button>
          </form>
        )}
      </div>

      {/* Version History Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Version Control History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {["Version", "Notes", "Date Created", "Author", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {promptHistory.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-zinc-400 font-normal">No prompt version history loaded.</td></tr>
              ) : promptHistory.map((v: any) => (
                <tr key={v.id} className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="py-2.5 px-2 font-black text-zinc-800 dark:text-zinc-100">{v.version}</td>
                  <td className="py-2.5 px-2 text-zinc-600 dark:text-zinc-450 font-normal">{v.notes}</td>
                  <td className="py-2.5 px-2 text-zinc-500 font-normal">{v.date}</td>
                  <td className="py-2.5 px-2 text-zinc-550 dark:text-zinc-350">{v.author}</td>
                  <td className="py-2.5 px-2">
                    {v.is_active ? (
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-md tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-450">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-md tracking-wider bg-zinc-100 text-zinc-550 dark:bg-zinc-800 dark:text-zinc-400">Inactive</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    {canEdit && !v.is_active && (
                      <button onClick={() => onRollbackPrompt(v.id)} className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg transition-all font-bold">Activate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
