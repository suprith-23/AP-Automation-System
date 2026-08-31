"use client";
import { useState, useEffect, useRef } from "react";
import authService from "../../services/auth.service";

type TopNavProps = {
  role: "Admin" | "Reviewer" | "Approver" | "Finance Manager" | "Auditor" | "Super Admin";
  setRole: (role: "Admin" | "Reviewer" | "Approver" | "Finance Manager" | "Auditor" | "Super Admin") => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  allowedTabs: string[];
  onRefresh: () => void;
  loading: boolean;
  onNotificationClick?: () => void;
};

const NAV_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  dashboard: {
    label: "Dashboard",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  },
  "document-intake": {
    label: "Intake",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  },
  "my-queue": {
    label: "My Queue",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  },
  "queue-management": {
    label: "Queues",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
  },
  "approval-queue": {
    label: "Approvals",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  },
  invoices: {
    label: "Invoices",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  "purchase-orders": {
    label: "POs",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  },
  exceptions: {
    label: "Exceptions",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  },
  "users-roles": {
    label: "Users",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  organizations: {
    label: "Organizations",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  },
  analytics: {
    label: "Analytics",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  enterprise: {
    label: "Enterprise",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  },
  "audit-logs": {
    label: "Audit",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  settings: {
    label: "Settings",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
};

const ROLE_CONFIG: Record<"Admin" | "Reviewer" | "Approver" | "Finance Manager" | "Auditor" | "Super Admin", { bg: string; text: string; ring: string; initial: string }> = {
  Admin:    { bg: "bg-[#39E35D] dark:bg-[#4AFF7A]", text: "text-[#123B22] dark:text-[#000000]", ring: "ring-[#39E35D] dark:ring-[#4AFF7A]", initial: "A" },
  Reviewer: { bg: "bg-[#FF3EA5] dark:bg-[#FF5CB8]", text: "text-[#3A1B2E] dark:text-[#000000]", ring: "ring-[#FF3EA5] dark:ring-[#FF5CB8]", initial: "R" },
  Approver: { bg: "bg-[#9B6BFF] dark:bg-[#B388FF]", text: "text-[#241B3D] dark:text-[#000000]", ring: "ring-[#9B6BFF] dark:ring-[#B388FF]", initial: "AP" },
  "Finance Manager": { bg: "bg-[#f97316] dark:bg-[#FB923C]", text: "text-white dark:text-[#000000]", ring: "ring-[#f97316] dark:ring-[#FB923C]", initial: "FM" },
  Auditor: { bg: "bg-[#0ea5e9] dark:bg-[#38BDF8]", text: "text-white dark:text-[#000000]", ring: "ring-[#0ea5e9] dark:ring-[#38BDF8]", initial: "AU" },
  "Super Admin": { bg: "bg-[#FFB800] dark:bg-[#FFCB3D]", text: "text-[#451A03] dark:text-[#000000]", ring: "ring-[#FFB800] dark:ring-[#FFCB3D]", initial: "SA" },
};

export default function TopNav({
  role,
  setRole,
  activeTab,
  setActiveTab,
  allowedTabs,
  onRefresh,
  loading,
  onNotificationClick,
}: TopNavProps) {
  const [dark, setDark]             = useState(false);
  const [roleOpen, setRoleOpen]     = useState(false);
  const roleDropdownRef             = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const u = authService.getStoredUser();
      setCurrentUser(u);
    }
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    window.location.href = "/login";
  };

  // Load theme preference
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    } else {
      setDark(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Close role dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleOpen(false);
      }
    }
    if (roleOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [roleOpen]);

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return next;
    });
  };

  const visibleTabs = allowedTabs.filter((t) => NAV_LABELS[t]);
  const rc = ROLE_CONFIG[role] || ROLE_CONFIG["Admin"];

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-[#0A0A0A] border-b border-zinc-100 dark:border-zinc-800/60 flex items-center gap-4 px-6 h-16">

      {/* Logo mark */}
      <div key={activeTab} className="flex items-center gap-2.5 shrink-0 mr-4 animate-logo-pop">
        <div className="w-9 h-9 rounded-full bg-[#22C55E] flex items-center justify-center shadow-sm">
          <span className="text-[#14532d] font-black text-sm leading-none">AP</span>
        </div>
        <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-800 dark:text-zinc-100 hidden sm:block">
          AutoFlow
        </span>
      </div>

      {/* Horizontal pill nav */}
      <nav className="flex items-center gap-1 flex-1 overflow-x-auto hide-scrollbar" aria-label="Main navigation">
        {visibleTabs.map((tabId) => {
          const item = NAV_LABELS[tabId];
          if (!item) return null;
          const isActive = activeTab === tabId;
          const roleActiveClass = {
            Admin: "bg-[#39E35D] text-[#123B22] dark:bg-[#4AFF7A] dark:text-[#0A0A0A] shadow-sm",
            Reviewer: "bg-[#FF3EA5] text-white dark:bg-[#FF5CB8] dark:text-[#0A0A0A] shadow-sm",
            Approver: "bg-[#9B6BFF] text-white dark:bg-[#B388FF] dark:text-[#0A0A0A] shadow-sm",
            "Finance Manager": "bg-[#3B82F6] text-white shadow-sm",
            Auditor: "bg-[#EC4899] text-white shadow-sm",
            "Super Admin": "bg-[#F59E0B] text-zinc-950 dark:bg-[#FBBF24] dark:text-zinc-950 shadow-sm",
          }[role] || "bg-[#0A0A0A] text-white dark:bg-white dark:text-[#0A0A0A] shadow-sm";

          return (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 outline-none ${
                isActive
                  ? roleActiveClass
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-2.5 shrink-0 ml-2">

        {/* Dark/Light toggle pill */}
        <button
          onClick={toggleTheme}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          className="flex items-center justify-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:py-1.5 hover:scale-[1.04] transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 outline-none"
        >
          {dark ? (
            <>
              <svg className="w-3.5 h-3.5 text-[#22C55E] dark:text-[#4ADE80]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3a1 1 0 011 1v1a1 1 0 11-2 0V4a1 1 0 011-1zm4.243 2.757a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707zM21 12a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zm-2.757 4.243a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0zM12 21a1 1 0 01-1-1v-1a1 1 0 112 0v1a1 1 0 01-1 1zm-4.243-2.757a1 1 0 01-1.414 0l-.707-.707a1 1 0 011.414-1.414l.707.707a1 1 0 010 1.414zM3 12a1 1 0 011-1h1a1 1 0 110 2H4a1 1 0 01-1-1zm2.757-4.243a1 1 0 010-1.414l.707-.707A1 1 0 117.878 7.05l-.707.707a1 1 0 01-1.414 0zM12 7a5 5 0 100 10A5 5 0 0012 7z" />
              </svg>
              <span className="text-[10px] font-bold text-[#22C55E] dark:text-[#4ADE80] hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-zinc-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
              </svg>
              <span className="text-[10px] font-bold text-zinc-600 hidden sm:inline">Dark</span>
            </>
          )}
        </button>

        {/* Notification bell */}
        <button
          onClick={onNotificationClick}
          aria-label="Notifications"
          className="relative w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-[#0A0A0A] dark:bg-white flex items-center justify-center hover:scale-[1.04] transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 outline-none"
        >
          <svg className="w-4 h-4 text-white dark:text-[#0A0A0A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span
            aria-label="3 unread notifications"
            className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[#EF4444] ring-2 ring-white dark:ring-[#0A0A0A] text-[0px]"
          >·</span>
        </button>

        {/* Profile Dropdown */}
        <div className="flex items-center gap-2" ref={roleDropdownRef}>
          <button
            onClick={() => setRoleOpen((o) => !o)}
            aria-label="User menu"
            className="flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800/80 rounded-full pl-1.5 pr-3 min-h-[44px] sm:min-h-0 sm:py-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <div
              className={`w-7 h-7 rounded-full ${rc.bg} ${rc.text} flex items-center justify-center font-black text-[10px] shrink-0`}
              aria-hidden
            >
              {rc.initial}
            </div>
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 max-w-[80px] truncate">
              {currentUser?.name ? currentUser.name.split(" ")[0] : role}
            </span>
            <svg
              className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${roleOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {roleOpen && (
            <div
              className="absolute right-0 top-14 z-50 animate-scale-in
                         bg-white dark:bg-zinc-900
                         border border-zinc-100 dark:border-zinc-800/80
                         rounded-2xl shadow-xl overflow-hidden
                         min-w-[200px] p-2"
            >
              <div className="px-3 py-2 border-b border-zinc-50 dark:border-zinc-800/60 mb-1">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{currentUser?.name || "User Session"}</p>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{currentUser?.email || "active session"}</p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
                  {role}
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2
                           text-xs font-bold text-rose-600 dark:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20
                           rounded-xl transition-colors duration-150 text-left"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
