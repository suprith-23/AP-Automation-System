"use client";
import React from "react";
import authService from "../../../services/auth.service";

type GeneralTabProps = {
  isAdmin: boolean;
  canEdit: boolean;
  companyName: string;
  setCompanyName: (v: string) => void;
  financialYear: string;
  setFinancialYear: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
  onSaveSettings: (sectionName: string) => Promise<void>;
};

export default function GeneralTab({
  isAdmin,
  canEdit,
  companyName,
  setCompanyName,
  financialYear,
  setFinancialYear,
  timezone,
  setTimezone,
  currency,
  setCurrency,
  onSaveSettings,
}: GeneralTabProps) {
  if (!isAdmin) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Personal Information</h3>
        <div className="grid grid-cols-2 gap-4 col-span-2">
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Full Name</label>
            <input type="text" readOnly value={authService.getStoredUser()?.name || ""} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-550 dark:text-zinc-300 outline-none cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Email Address</label>
            <input type="text" readOnly value={authService.getStoredUser()?.email || ""} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-550 dark:text-zinc-300 outline-none cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Assigned Role</label>
            <input type="text" readOnly value={authService.getStoredUser()?.role || ""} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-550 dark:text-zinc-300 outline-none cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Designation</label>
            <input type="text" readOnly value={authService.getStoredUser()?.designation || ""} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-550 dark:text-zinc-300 outline-none cursor-not-allowed" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-zinc-955 dark:text-white">
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Company Info</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Company Name</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-[#39E35D]/50 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Financial Year</label>
            <input type="text" value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-[#39E35D]/50 transition-all outline-none" />
          </div>
        </div>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Regional Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Timezone</label>
            <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-[#39E35D]/50 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Default Currency</label>
            <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-[#39E35D]/50 transition-all outline-none" />
          </div>
        </div>
      </div>

      <button disabled={!canEdit} onClick={() => onSaveSettings("General")} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-xl shadow-sm transition-colors">Save General Settings</button>
    </div>
  );
}
