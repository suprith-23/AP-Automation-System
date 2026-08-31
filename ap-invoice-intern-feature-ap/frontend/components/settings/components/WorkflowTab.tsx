"use client";
import React from "react";

type WorkflowTabProps = {
  canEdit: boolean;
  workflowReviewerRequired: boolean;
  setWorkflowReviewerRequired: (v: boolean) => void;
  workflowApproverRequired: boolean;
  setWorkflowApproverRequired: (v: boolean) => void;
  workflowAutoReviewer: boolean;
  setWorkflowAutoReviewer: (v: boolean) => void;
  workflowAutoApprover: boolean;
  setWorkflowAutoApprover: (v: boolean) => void;
  workflowManualOverride: boolean;
  setWorkflowManualOverride: (v: boolean) => void;
  workflowApprovalLevels: number;
  setWorkflowApprovalLevels: (v: number) => void;
  escalationRole: string;
  setEscalationRole: (v: string) => void;
  approvalRules: any[];
  approvalRulesLoading: boolean;
  approvalRulesError: string | null;
  openAddApprovalRule: () => void;
  openEditApprovalRule: (rule: any) => void;
  handleApprovalRuleDelete: (id: number) => Promise<void>;
  onSaveSettings: (sectionName: string) => Promise<void>;
};

export default function WorkflowTab({
  canEdit,
  workflowReviewerRequired,
  setWorkflowReviewerRequired,
  workflowApproverRequired,
  setWorkflowApproverRequired,
  workflowAutoReviewer,
  setWorkflowAutoReviewer,
  workflowAutoApprover,
  setWorkflowAutoApprover,
  workflowManualOverride,
  setWorkflowManualOverride,
  workflowApprovalLevels,
  setWorkflowApprovalLevels,
  escalationRole,
  setEscalationRole,
  approvalRules,
  approvalRulesLoading,
  approvalRulesError,
  openAddApprovalRule,
  openEditApprovalRule,
  handleApprovalRuleDelete,
  onSaveSettings,
}: WorkflowTabProps) {
  return (
    <div className="space-y-6 animate-fade-in text-zinc-950 dark:text-white">
      {/* General Workflow Routing parameters */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Approval Workflow Routing Config</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            {[
              { state: workflowReviewerRequired, setter: setWorkflowReviewerRequired, title: "Reviewer stage required", desc: "Forces invoice validation and review step before moving to approval queue" },
              { state: workflowApproverRequired, setter: setWorkflowApproverRequired, title: "Approver stage required", desc: "Forces multi-tiered approval checks by authorized financial heads" },
              { state: workflowAutoReviewer, setter: setWorkflowAutoReviewer, title: "Auto-Review validated invoices", desc: "Automatically passes the validation stage if confidence matches threshold" },
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

          <div className="space-y-3">
            {[
              { state: workflowAutoApprover, setter: setWorkflowAutoApprover, title: "Auto-Approve matched low-risk invoices", desc: "Enables instant auto-approval for invoices matching PO perfectly and under low amount limit" },
              { state: workflowManualOverride, setter: setWorkflowManualOverride, title: "Manual Override / Admin Bypass", desc: "Allows system administrators to manually mark any invoice as approved or override failures" },
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

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-250">Approval levels</label>
                <input type="number" min="1" max="5" value={workflowApprovalLevels} onChange={(e) => setWorkflowApprovalLevels(parseInt(e.target.value))} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl font-bold w-full text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50" />
              </div>

              <div className="p-4 bg-[#F7F7F7] dark:bg-[#1A1A1A] rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-250">Escalation Role</label>
                <select value={escalationRole} onChange={(e) => setEscalationRole(e.target.value)} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs rounded-xl font-bold w-full text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50">
                  {["Admin", "Reviewer", "Approver", "Finance Manager", "Auditor"].map(roleName => (
                    <option key={roleName} value={roleName}>{roleName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        <button disabled={!canEdit} onClick={() => onSaveSettings("Workflow Configurations")} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-xl shadow-sm transition-colors">Save Workflow Config</button>
      </div>

      {/* Approval Rules Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Custom Approval Routing Rules</h3>
            <p className="text-[10px] text-zinc-500 font-normal mt-0.5">Define amount ranges, department mappings, and multi-tier approver roles.</p>
          </div>
          <button onClick={openAddApprovalRule} className="px-3.5 py-1.5 bg-[#39E35D] hover:bg-[#2fc44e] text-zinc-950 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5">
            + Add Rule
          </button>
        </div>

        {approvalRulesLoading && <div className="text-xs text-zinc-400 py-4 text-center">Loading approval rules…</div>}
        {approvalRulesError && <div className="text-xs text-red-500 py-4 text-center">{approvalRulesError}</div>}

        {!approvalRulesLoading && !approvalRulesError && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  {["Amt Range (₹)", "Department", "Cost Center", "Approvers", "SLA", "Auto-Approve", "Actions"].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {approvalRules.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-zinc-400 font-normal">No custom routing rules configured. Falling back to default system matrix.</td></tr>
                ) : approvalRules.map(rule => (
                  <tr key={rule.id} className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-2 font-black text-zinc-800 dark:text-zinc-100">
                      ₹{rule.min_amount.toLocaleString()} {rule.max_amount ? `to ₹${rule.max_amount.toLocaleString()}` : "+"}
                    </td>
                    <td className="py-2.5 px-2 text-zinc-650 dark:text-zinc-350">{rule.department || "All"}</td>
                    <td className="py-2.5 px-2 text-zinc-650 dark:text-zinc-350">{rule.cost_center || "All"}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex flex-wrap gap-1">
                        {(rule.approvers || []).map((appRole: string, idx: number) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-350 text-[9px] rounded-md font-bold uppercase tracking-wider">
                            {idx + 1}. {appRole}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-normal text-zinc-600 dark:text-zinc-400">{rule.sla_hours} Hrs</td>
                    <td className="py-2.5 px-2 font-normal">
                      {rule.auto_approve !== null && rule.auto_approve !== undefined && rule.auto_approve > 0 ? (
                        <span className="px-1.5 py-0.5 bg-[#39E35D] dark:bg-[#123B22] text-[#123B22] dark:text-[#4AFF7A] rounded-md text-[9px] font-black uppercase tracking-wider">Yes</span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-[#22D3EE] dark:bg-[#053A44] text-[#053A44] dark:text-[#67E8F9] rounded-md text-[9px] font-black uppercase tracking-wider">No</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      {canEdit && (
                        <div className="flex gap-1.5">
                          <button onClick={() => openEditApprovalRule(rule)} className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg transition-all font-bold">Edit</button>
                          <button onClick={() => handleApprovalRuleDelete(rule.id)} className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all font-bold">Delete</button>
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
    </div>
  );
}
