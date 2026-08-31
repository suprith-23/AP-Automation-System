"use client";
import React from "react";

type ValidationTabProps = {
  canEdit: boolean;
  rulesRequiredFields: any;
  setRulesRequiredFields: (v: any) => void;
  rulesDuplicateDetection: boolean;
  setRulesDuplicateDetection: (v: boolean) => void;
  rulesGstValidation: boolean;
  setRulesGstValidation: (v: boolean) => void;
  rulesPoMatching: boolean;
  setRulesPoMatching: (v: boolean) => void;
  rulesAmountTolerance: number;
  setRulesAmountTolerance: (v: number) => void;
  gstToleranceAmount: number;
  setGstToleranceAmount: (v: number) => void;
  poQtyTolerancePct: number;
  setPoQtyTolerancePct: (v: number) => void;
  poPriceTolerancePct: number;
  setPoPriceTolerancePct: (v: number) => void;
  poTaxTolerancePct: number;
  setPoTaxTolerancePct: (v: number) => void;
  poFreightToleranceAmount: number;
  setPoFreightToleranceAmount: (v: number) => void;
  poVendorNameThresholdPct: number;
  setPoVendorNameThresholdPct: (v: number) => void;
  poMinMatchScore: number;
  setPoMinMatchScore: (v: number) => void;
  gstReconciliationThresholdPct: number;
  setGstReconciliationThresholdPct: (v: number) => void;
  gstMaxPastDays: number;
  setGstMaxPastDays: (v: number) => void;
  gstPreventDuplicateIrn: boolean;
  setGstPreventDuplicateIrn: (v: boolean) => void;
  gstCheckDateConsistency: boolean;
  setGstCheckDateConsistency: (v: boolean) => void;
  gstHsnRules: any[];
  gstHsnLoading: boolean;
  gstHsnError: string | null;
  openAddGstHsn: () => void;
  handleGstHsnDelete: (id: number) => Promise<void>;
  onSaveSettings: (sectionName: string) => Promise<void>;
};

export default function ValidationTab({
  canEdit,
  rulesRequiredFields,
  setRulesRequiredFields,
  rulesDuplicateDetection,
  setRulesDuplicateDetection,
  rulesGstValidation,
  setRulesGstValidation,
  rulesPoMatching,
  setRulesPoMatching,
  rulesAmountTolerance,
  setRulesAmountTolerance,
  gstToleranceAmount,
  setGstToleranceAmount,
  poQtyTolerancePct,
  setPoQtyTolerancePct,
  poPriceTolerancePct,
  setPoPriceTolerancePct,
  poTaxTolerancePct,
  setPoTaxTolerancePct,
  poFreightToleranceAmount,
  setPoFreightToleranceAmount,
  poVendorNameThresholdPct,
  setPoVendorNameThresholdPct,
  poMinMatchScore,
  setPoMinMatchScore,
  gstReconciliationThresholdPct,
  setGstReconciliationThresholdPct,
  gstMaxPastDays,
  setGstMaxPastDays,
  gstPreventDuplicateIrn,
  setGstPreventDuplicateIrn,
  gstCheckDateConsistency,
  setGstCheckDateConsistency,
  gstHsnRules,
  gstHsnLoading,
  gstHsnError,
  openAddGstHsn,
  handleGstHsnDelete,
  onSaveSettings,
}: ValidationTabProps) {
  return (
    <div className="space-y-6 animate-fade-in text-zinc-950 dark:text-white">
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Compliance Verification</h3>
        <div className="space-y-3">
          {[
            { state: rulesDuplicateDetection, setter: setRulesDuplicateDetection, title: "Enable duplicate invoice detection", desc: "Checks database for duplicate combinations of seller GSTIN and invoice number" },
            { state: rulesGstValidation, setter: setRulesGstValidation, title: "Strict GST match checks", desc: "Verifies structure of vendor GSTIN codes against GST standards" },
            { state: rulesPoMatching, setter: setRulesPoMatching, title: "Purchase order compliance (3-Way Matching)", desc: "Enforces link verification with active Purchase Orders in the ledger database" },
          ].map((item, idx) => (
            <div key={idx} className="flex justify-between items-center p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl">
              <div className="flex-1 pr-4">
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-250">{item.title}</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">{item.desc}</div>
              </div>
              <button type="button" onClick={() => canEdit && item.setter(!item.state)} className={`w-11 h-6 rounded-full relative transition-colors ${item.state ? "bg-[#39E35D]" : "bg-zinc-250 dark:bg-zinc-700"} ${!canEdit && "opacity-50 cursor-not-allowed"}`}>
                <span className={`inline-block w-4 h-4 rounded-full bg-white transform transition-transform absolute left-1 top-1 ${item.state ? "translate-x-5" : ""}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Tolerance Thresholds</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">PO Matching Amount Tolerance (%)</label>
            <input type="number" step="0.1" value={rulesAmountTolerance} onChange={(e) => setRulesAmountTolerance(parseFloat(e.target.value))} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl font-bold w-full text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50" />
          </div>
          <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">GST Value Calculation Tolerance (₹)</label>
            <input type="number" min="0" step="0.01" value={gstToleranceAmount} onChange={(e) => setGstToleranceAmount(parseFloat(e.target.value))} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl font-bold w-full text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50" />
          </div>
        </div>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">PO Match Tolerances</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-250">Quantity Tolerance (%)</label>
            <input type="number" min="0" max="100" step="0.1" value={poQtyTolerancePct} onChange={(e) => setPoQtyTolerancePct(parseFloat(e.target.value))} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl font-bold w-full text-zinc-900 dark:text-zinc-100 outline-none" />
          </div>
          <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-250">Unit Price Tolerance (%)</label>
            <input type="number" min="0" max="100" step="0.1" value={poPriceTolerancePct} onChange={(e) => setPoPriceTolerancePct(parseFloat(e.target.value))} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl font-bold w-full text-zinc-900 dark:text-zinc-100 outline-none" />
          </div>
          <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-250">Tax Rate Tolerance (%)</label>
            <input type="number" min="0" max="100" step="0.1" value={poTaxTolerancePct} onChange={(e) => setPoTaxTolerancePct(parseFloat(e.target.value))} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl font-bold w-full text-zinc-900 dark:text-zinc-100 outline-none" />
          </div>
          <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-250">Freight Tolerance (₹)</label>
            <input type="number" min="0" step="0.01" value={poFreightToleranceAmount} onChange={(e) => setPoFreightToleranceAmount(parseFloat(e.target.value))} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl font-bold w-full text-zinc-900 dark:text-zinc-100 outline-none" />
          </div>
          <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-250">Vendor Name Similarity (%)</label>
            <input type="number" min="0" max="100" step="0.1" value={poVendorNameThresholdPct} onChange={(e) => setPoVendorNameThresholdPct(parseFloat(e.target.value))} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl font-bold w-full text-zinc-900 dark:text-zinc-100 outline-none" />
          </div>
          <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-250">Minimum Match Score (%)</label>
            <input type="number" min="0" max="100" step="0.1" value={poMinMatchScore} onChange={(e) => setPoMinMatchScore(parseFloat(e.target.value))} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl font-bold w-full text-zinc-900 dark:text-zinc-100 outline-none" />
          </div>
        </div>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">GST compliance Parameters</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-250">Reconciliation Pass Threshold (%)</label>
            <input type="number" min="0" max="100" step="0.1" value={gstReconciliationThresholdPct} onChange={(e) => setGstReconciliationThresholdPct(parseFloat(e.target.value))} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl font-bold w-full text-zinc-900 dark:text-zinc-100 outline-none" />
          </div>
          <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-250">Max IRN Allowed Past Days</label>
            <input type="number" min="1" step="1" value={gstMaxPastDays} onChange={(e) => setGstMaxPastDays(parseInt(e.target.value))} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl font-bold w-full text-zinc-900 dark:text-zinc-100 outline-none" />
          </div>
          <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl flex flex-col justify-center space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-250">Prevent Duplicate IRN</div>
              </div>
              <button type="button" onClick={() => canEdit && setGstPreventDuplicateIrn(!gstPreventDuplicateIrn)} className={`w-11 h-6 rounded-full relative transition-colors ${gstPreventDuplicateIrn ? "bg-[#39E35D]" : "bg-zinc-250 dark:bg-zinc-700"} ${!canEdit && "opacity-50 cursor-not-allowed"}`}>
                <span className={`inline-block w-4 h-4 rounded-full bg-white transform transition-transform absolute left-1 top-1 ${gstPreventDuplicateIrn ? "translate-x-5" : ""}`} />
              </button>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
              <div>
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-250">Check IRN Date Consistency</div>
              </div>
              <button type="button" onClick={() => canEdit && setGstCheckDateConsistency(!gstCheckDateConsistency)} className={`w-11 h-6 rounded-full relative transition-colors ${gstCheckDateConsistency ? "bg-[#39E35D]" : "bg-zinc-250 dark:bg-zinc-700"} ${!canEdit && "opacity-50 cursor-not-allowed"}`}>
                <span className={`inline-block w-4 h-4 rounded-full bg-white transform transition-transform absolute left-1 top-1 ${gstCheckDateConsistency ? "translate-x-5" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RCM & Blocked ITC HSN Prefix Rules Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">RCM / Blocked-ITC HSN Rules</h3>
            <p className="text-[10px] text-zinc-500 font-normal mt-0.5">HSN prefix definitions for automatic GST verification checks applied to next invoice.</p>
          </div>
          {canEdit && (
            <button onClick={openAddGstHsn} className="px-3.5 py-1.5 bg-[#39E35D] hover:bg-[#2fc44e] text-zinc-950 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5">
              + Add HSN Rule
            </button>
          )}
        </div>

        {gstHsnLoading && <div className="text-xs text-zinc-400 py-4 text-center">Loading HSN rules…</div>}
        {gstHsnError && <div className="text-xs text-red-500 py-4 text-center">{gstHsnError}</div>}

        {!gstHsnLoading && !gstHsnError && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  {["HSN Prefix", "Rule Type / Status", "Actions"].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gstHsnRules.length === 0 ? (
                  <tr><td colSpan={3} className="py-8 text-center text-zinc-400 font-normal">No GST HSN rules configured. Click "Add HSN Rule" above.</td></tr>
                ) : gstHsnRules.map(rule => (
                  <tr key={rule.id} className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-2 font-black text-zinc-800 dark:text-zinc-100">{rule.hsn_prefix}</td>
                    <td className="py-2.5 px-2">
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md tracking-wider ${rule.rule_type === "RCM" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}>
                        {rule.rule_type === "RCM" ? "Reverse Charge (RCM)" : "Blocked ITC"}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      {canEdit && (
                        <button onClick={() => handleGstHsnDelete(rule.id)} className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all font-bold">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button disabled={!canEdit} onClick={() => onSaveSettings("Validation Rules")} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-xl shadow-sm transition-colors">Save Rules Config</button>
    </div>
  );
}
