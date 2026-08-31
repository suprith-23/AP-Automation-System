"use client";
import React from "react";

type SLATabProps = {
  canEdit: boolean;
  slaReview: number;
  setSlaReview: (v: number) => void;
  slaApproval: number;
  setSlaApproval: (v: number) => void;
  slaProcessing: number;
  setSlaProcessing: (v: number) => void;
  slaReminderTime: number;
  setSlaReminderTime: (v: number) => void;
  slaEscalationTime: number;
  setSlaEscalationTime: (v: number) => void;
  slaCriticalThreshold: number;
  setSlaCriticalThreshold: (v: number) => void;
  slaGracePeriodHours: number;
  setSlaGracePeriodHours: (v: number) => void;
  onSaveSettings: (sectionName: string) => Promise<void>;
};

export default function SLATab({
  canEdit,
  slaReview,
  setSlaReview,
  slaApproval,
  setSlaApproval,
  slaProcessing,
  setSlaProcessing,
  slaReminderTime,
  setSlaReminderTime,
  slaEscalationTime,
  setSlaEscalationTime,
  slaCriticalThreshold,
  setSlaCriticalThreshold,
  slaGracePeriodHours,
  setSlaGracePeriodHours,
  onSaveSettings,
}: SLATabProps) {
  return (
    <div className="space-y-6 animate-fade-in text-zinc-950 dark:text-white">
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">SLA Processing Targets</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Reviewer SLA (Hours)</label>
            <input type="number" value={slaReview} onChange={(e) => setSlaReview(parseInt(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Approver SLA (Hours)</label>
            <input type="number" value={slaApproval} onChange={(e) => setSlaApproval(parseInt(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">System Processing SLA (Hours)</label>
            <input type="number" value={slaProcessing} onChange={(e) => setSlaProcessing(parseInt(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50" />
          </div>
        </div>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Notification & Escalations</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Send Reminder (Hours before SLA)</label>
            <input type="number" value={slaReminderTime} onChange={(e) => setSlaReminderTime(parseInt(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Escalate (Hours after SLA)</label>
            <input type="number" value={slaEscalationTime} onChange={(e) => setSlaEscalationTime(parseInt(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Critical Threshold (%)</label>
            <input type="number" value={slaCriticalThreshold} onChange={(e) => setSlaCriticalThreshold(parseInt(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">SLA Grace Period (Hours)</label>
            <input type="number" value={slaGracePeriodHours} onChange={(e) => setSlaGracePeriodHours(parseInt(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50" />
          </div>
        </div>
      </div>

      <button disabled={!canEdit} onClick={() => onSaveSettings("SLA Target")} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-xl shadow-sm transition-colors">Save SLA Settings</button>
    </div>
  );
}
