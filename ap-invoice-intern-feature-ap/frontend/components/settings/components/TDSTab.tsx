"use client";
import React from "react";

type TDSTabProps = {
  canEdit: boolean;
  tdsRules: any[];
  tdsLoading: boolean;
  tdsError: string | null;
  openAddTds: () => void;
  openEditTds: (rule: any) => void;
  handleTdsDelete: (id: number) => Promise<void>;
  showTdsModal: boolean;
  editingTdsRule: any | null;
  tdsForm: any;
  setTdsForm: React.Dispatch<React.SetStateAction<any>>;
  setShowTdsModal: (v: boolean) => void;
  handleTdsSubmit: (e: React.FormEvent) => Promise<void>;
};

export default function TDSTab({
  canEdit,
  tdsRules,
  tdsLoading,
  tdsError,
  openAddTds,
  openEditTds,
  handleTdsDelete,
  showTdsModal,
  editingTdsRule,
  tdsForm,
  setTdsForm,
  setShowTdsModal,
  handleTdsSubmit,
}: TDSTabProps) {
  return (
    <div className="space-y-6 animate-fade-in text-zinc-950 dark:text-white">
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">TDS Sections &amp; Rates</h3>
            <p className="text-[10px] text-zinc-500 font-normal mt-0.5">Income Tax Act deduction rules applied per invoice. Changes take effect on next invoice processing.</p>
          </div>
          {canEdit && (
            <button onClick={openAddTds} className="px-3.5 py-1.5 bg-[#39E35D] hover:bg-[#2fc44e] text-zinc-950 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5">
              + Add Section
            </button>
          )}
        </div>

        {tdsLoading && <div className="text-xs text-zinc-400 py-4 text-center">Loading TDS rules…</div>}
        {tdsError && <div className="text-xs text-red-500 py-4 text-center">{tdsError}</div>}

        {!tdsLoading && !tdsError && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  {["Section", "Description", "Rate (w/ PAN)", "Rate (w/o PAN)", "Single ₹", "Aggregate ₹", "Effective", ""].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tdsRules.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-zinc-400 font-normal">No TDS rules configured. Click "Add Section" above.</td></tr>
                ) : tdsRules.map(rule => (
                  <tr key={rule.id} className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-2 font-black text-zinc-800 dark:text-zinc-100">{rule.section_code}</td>
                    <td className="py-2.5 px-2 text-zinc-600 dark:text-zinc-400 max-w-[180px] truncate font-normal">{rule.description || "—"}</td>
                    <td className="py-2.5 px-2 font-bold text-emerald-600 dark:text-emerald-400">{rule.rate_with_pan}%</td>
                    <td className="py-2.5 px-2 font-bold text-amber-600 dark:text-amber-400">{rule.rate_without_pan}%</td>
                    <td className="py-2.5 px-2 font-normal text-zinc-600 dark:text-zinc-400">₹{rule.single_threshold?.toLocaleString()}</td>
                    <td className="py-2.5 px-2 font-normal text-zinc-600 dark:text-zinc-400">₹{rule.aggregate_threshold?.toLocaleString()}</td>
                    <td className="py-2.5 px-2 font-normal text-zinc-500 text-[10px]">{rule.effective_from ? `${rule.effective_from}${rule.effective_to ? ` → ${rule.effective_to}` : "+"}` : "Always"}</td>
                    <td className="py-2.5 px-2">
                      {canEdit && (
                        <div className="flex gap-1.5">
                          <button onClick={() => openEditTds(rule)} className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg transition-all font-bold">Edit</button>
                          <button onClick={() => handleTdsDelete(rule.id)} className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all font-bold">Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit TDS Rule Modal */}
      {showTdsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-lg mx-4 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              {editingTdsRule ? `Edit — ${editingTdsRule.section_code}` : "Add TDS Section"}
            </h3>
            <form onSubmit={handleTdsSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Section Code *</label>
                  <input required value={tdsForm.section_code} onChange={e => setTdsForm((f: any) => ({...f, section_code: e.target.value}))} placeholder="e.g. 194C" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Description</label>
                  <input value={tdsForm.description} onChange={e => setTdsForm((f: any) => ({...f, description: e.target.value}))} placeholder="e.g. Contractor payments" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Rate with PAN (%)</label>
                  <input required type="number" step="0.01" min="0" max="100" value={tdsForm.rate_with_pan} onChange={e => setTdsForm((f: any) => ({...f, rate_with_pan: Number(e.target.value)}))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Rate without PAN (%)</label>
                  <input required type="number" step="0.01" min="0" max="100" value={tdsForm.rate_without_pan} onChange={e => setTdsForm((f: any) => ({...f, rate_without_pan: Number(e.target.value)}))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Single Threshold (₹)</label>
                  <input required type="number" min="0" value={tdsForm.single_threshold} onChange={e => setTdsForm((f: any) => ({...f, single_threshold: Number(e.target.value)}))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Aggregate Threshold (₹)</label>
                  <input required type="number" min="0" value={tdsForm.aggregate_threshold} onChange={e => setTdsForm((f: any) => ({...f, aggregate_threshold: Number(e.target.value)}))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Effective From (YYYY-MM-DD)</label>
                  <input type="date" value={tdsForm.effective_from} onChange={e => setTdsForm((f: any) => ({...f, effective_from: e.target.value}))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Effective To (YYYY-MM-DD)</label>
                  <input type="date" value={tdsForm.effective_to} onChange={e => setTdsForm((f: any) => ({...f, effective_to: e.target.value}))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Vendor Categories (comma-separated)</label>
                <input value={tdsForm.vendor_categories} onChange={e => setTdsForm((f: any) => ({...f, vendor_categories: e.target.value}))} placeholder="e.g. Contractor, Sub-contractor" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Expense Categories (comma-separated)</label>
                <input value={tdsForm.expense_categories} onChange={e => setTdsForm((f: any) => ({...f, expense_categories: e.target.value}))} placeholder="e.g. Operations, Maintenance" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100" />
              </div>
              <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-150 dark:border-zinc-800/80">
                <button 
                  type="button" 
                  onClick={() => setShowTdsModal(false)}
                  className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-250 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
