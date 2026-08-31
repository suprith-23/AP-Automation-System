import React from "react";
import { Role } from "../../store/useAppStore";

type HeaderProps = {
  role: Role;
  setRole: (role: Role) => void;
  onRefresh: () => void;
  loading: boolean;
  onNotificationClick?: () => void;
};

export default function Header({ role, setRole, onRefresh, loading, onNotificationClick }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-15 sticky top-0">
      
      {/* Left side: Search Bar */}
      <div className="flex-1 max-w-lg">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="h-4.5 w-4.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search invoices, POs, vendors, exceptions..."
            className="block w-full pl-10 pr-12 py-1.5 border border-slate-200 rounded-xl bg-slate-50/50 placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 sm:text-sm transition-all duration-200"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-md">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Center Section: System Status Pill */}
      <div className="hidden lg:flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 shadow-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          SYSTEM ACTIVE
        </span>
      </div>

      {/* Right side: Actions, Theme, Role, Profile */}
      <div className="flex items-center space-x-4">
        {/* Refresh Data */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all duration-200 border border-transparent hover:border-slate-100 disabled:opacity-50"
          title="Refresh Data"
        >
          <svg className={`w-5 h-5 ${loading ? "animate-spin text-blue-600" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Theme Toggle Placeholder */}
        <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all duration-200 border border-transparent hover:border-slate-100" title="Toggle Theme">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728L19 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Notification Bell */}
        <button
          onClick={onNotificationClick}
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all duration-200 border border-transparent hover:border-slate-100"
          title="Notifications"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white"></span>
        </button>

        {/* Vertical Divider */}
        <div className="h-5 border-l border-slate-200"></div>

        {/* Role Selector / Simulation */}
        <div className="flex items-center space-x-2.5 pl-1">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm shadow-inner shrink-0 border border-blue-100">
            {role.charAt(0)}
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider leading-none">Context</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="text-xs font-semibold text-slate-700 bg-transparent border-none p-0 cursor-pointer focus:outline-none focus:ring-0 w-auto mt-1"
              style={{ appearance: 'none' }}
            >
              <option value="Admin">Administrator</option>
              <option value="Reviewer">Reviewer Role</option>
              <option value="Approver">Approver Role</option>
              <option value="Finance Manager">Finance Manager</option>
              <option value="Auditor">Auditor</option>
            </select>
          </div>
          <svg className="w-3.5 h-3.5 text-slate-400 pointer-events-none ml-[-4px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </header>
  );
}
