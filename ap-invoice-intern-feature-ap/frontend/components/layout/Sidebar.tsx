import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import authService, { User } from "../../services/auth.service";
import { useAppStore } from "../../store/useAppStore";

type SidebarProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  allowedTabs: string[];
};

const ROLE_BG_CLASSES: Record<string, string> = {
  admin: "bg-fw-green/10 text-fw-green-deep border-fw-green/20 dark:bg-fw-green-deep/20 dark:text-fw-green-dark dark:border-fw-green-deep/40 shadow-sm font-semibold",
  "super admin": "bg-fw-amber/10 text-fw-amber-deep border-fw-amber/20 dark:bg-fw-amber-deep/20 dark:text-fw-amber-dark dark:border-fw-amber-deep/40 shadow-sm font-semibold",
  "finance manager": "bg-fw-amber/10 text-fw-amber-deep border-fw-amber/20 dark:bg-fw-amber-deep/20 dark:text-fw-amber-dark dark:border-fw-amber-deep/40 shadow-sm font-semibold",
  approver: "bg-fw-purple/10 text-fw-purple-deep border-fw-purple/20 dark:bg-fw-purple-deep/20 dark:text-fw-purple-dark dark:border-fw-purple-deep/40 shadow-sm font-semibold",
  reviewer: "bg-fw-pink/10 text-fw-pink-deep border-fw-pink/20 dark:bg-fw-pink-deep/20 dark:text-fw-pink-dark dark:border-fw-pink-deep/40 shadow-sm font-semibold",
  auditor: "bg-fw-teal/10 text-fw-teal-deep border-fw-teal/20 dark:bg-fw-teal-deep/20 dark:text-fw-teal-dark dark:border-fw-teal-deep/40 shadow-sm font-semibold",
};

const ROLE_INDICATOR_CLASSES: Record<string, string> = {
  admin: "bg-fw-green dark:bg-fw-green-dark shadow-[0_0_8px_rgba(74,255,122,0.4)]",
  "super admin": "bg-fw-amber dark:bg-fw-amber-dark shadow-[0_0_8px_rgba(255,203,61,0.4)]",
  "finance manager": "bg-fw-amber dark:bg-fw-amber-dark shadow-[0_0_8px_rgba(255,203,61,0.4)]",
  approver: "bg-fw-purple dark:bg-fw-purple-dark shadow-[0_0_8px_rgba(179,136,255,0.4)]",
  reviewer: "bg-fw-pink dark:bg-fw-pink-dark shadow-[0_0_8px_rgba(255,92,184,0.4)]",
  auditor: "bg-fw-teal dark:bg-fw-teal-dark shadow-[0_0_8px_rgba(31,245,219,0.4)]",
};

const ROLE_TEXT_CLASSES: Record<string, string> = {
  admin: "text-fw-green-deep dark:text-fw-green-dark",
  "super admin": "text-fw-amber-deep dark:text-fw-amber-dark",
  "finance manager": "text-fw-amber-deep dark:text-fw-amber-dark",
  approver: "text-fw-purple-deep dark:text-fw-purple-dark",
  reviewer: "text-fw-pink-deep dark:text-fw-pink-dark",
  auditor: "text-fw-teal-deep dark:text-fw-teal-dark",
};

const LOGO_BG_CLASSES: Record<string, string> = {
  admin:            "bg-[#DCFCE7] dark:bg-[#14532D]/40 border-[#BBF7D0] dark:border-[#166534]/40",
  "super admin":    "bg-[#FEF3C7] dark:bg-[#451A03]/40 border-[#FDE68A] dark:border-[#92400E]/40",
  "finance manager": "bg-[#FFF7ED] dark:bg-[#431407]/40 border-[#FED7AA] dark:border-[#9A3412]/40",
  approver:         "bg-[#F3E8FF] dark:bg-[#3B0764]/40 border-[#DDD6FE] dark:border-[#6D28D9]/40",
  reviewer:         "bg-[#FDF2F8] dark:bg-[#3D0A28]/40 border-[#FBCFE8] dark:border-[#9D174D]/40",
  auditor:          "bg-[#E0F2FE] dark:bg-[#0C4A6E]/40 border-[#BAE6FD] dark:border-[#0369A1]/40",
};

const LOGO_ICON_CLASSES: Record<string, string> = {
  admin:            "text-[#16A34A]",
  "super admin":    "text-[#D97706]",
  "finance manager": "text-[#EA580C]",
  approver:         "text-[#7C3AED]",
  reviewer:         "text-[#DB2777]",
  auditor:          "text-[#0284C7]",
};

const LOGO_TEXT_CLASSES: Record<string, string> = {
  admin:            "text-[#15803D] dark:text-[#4ADE80]",
  "super admin":    "text-[#B45309] dark:text-[#FCD34D]",
  "finance manager": "text-[#C2410C] dark:text-[#FB923C]",
  approver:         "text-[#6D28D9] dark:text-[#C4B5FD]",
  reviewer:         "text-[#BE185D] dark:text-[#F9A8D4]",
  auditor:          "text-[#0369A1] dark:text-[#38BDF8]",
};


const ROLE_BADGE_CLASSES: Record<string, string> = {
  admin: "bg-fw-green/20 text-fw-green-deep dark:text-fw-green-dark",
  "super admin": "bg-fw-amber/20 text-fw-amber-deep dark:text-fw-amber-dark",
  "finance manager": "bg-fw-amber/20 text-fw-amber-deep dark:text-fw-amber-dark",
  approver: "bg-fw-purple/20 text-fw-purple-deep dark:text-fw-purple-dark",
  reviewer: "bg-fw-pink/20 text-fw-pink-deep dark:text-fw-pink-dark",
  auditor: "bg-fw-teal/20 text-fw-teal-deep dark:text-fw-teal-dark",
};

export default function Sidebar({ activeTab, setActiveTab, allowedTabs }: SidebarProps) {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { invoices } = useAppStore();

  useEffect(() => {
    const userObj = authService.getStoredUser();
    if (userObj) {
      setCurrentUser(userObj);
    }
  }, []);

  const myQueueCount = invoices.filter(
    (i) => i.workflow_status === "pending_review" || i.workflow_status === "validation_failed"
  ).length;

  const approvalQueueCount = invoices.filter(
    (i) => i.workflow_status === "pending_approval"
  ).length;

  const exceptionsCount = invoices.filter(
    (i) => i.validation_status === "FAILED" || (i.confidence_score !== undefined && i.confidence_score < 0.85)
  ).length;

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      id: "my-queue",
      label: "My Queue",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      badge: String(myQueueCount),
    },
    {
      id: "approval-queue",
      label: "Approval Queue",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      badge: String(approvalQueueCount),
    },
    {
      id: "invoices",
      label: "Invoices",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: "exceptions",
      label: "Exceptions",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      badge: String(exceptionsCount),
    },
    {
      id: "purchase-orders",
      label: "Purchase Orders",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      id: "users-roles",
      label: "Users & Roles",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },

    {
      id: "analytics",
      label: "Analytics",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: "audit-logs",
      label: "Audit Logs",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const visibleItems = navItems.filter((item) => allowedTabs.includes(item.id));
  const roleKey = currentUser?.role?.toLowerCase().trim() || "admin";
  const activeItemClass = ROLE_BG_CLASSES[roleKey] ?? ROLE_BG_CLASSES.admin;
  const indicatorClass = ROLE_INDICATOR_CLASSES[roleKey] ?? ROLE_INDICATOR_CLASSES.admin;
  const textAccentClass = ROLE_TEXT_CLASSES[roleKey] ?? ROLE_TEXT_CLASSES.admin;
  const badgeClass = ROLE_BADGE_CLASSES[roleKey] ?? ROLE_BADGE_CLASSES.admin;
  const logoBgClass = LOGO_BG_CLASSES[roleKey] ?? LOGO_BG_CLASSES.admin;
  const logoIconClass = LOGO_ICON_CLASSES[roleKey] ?? LOGO_ICON_CLASSES.admin;
  const logoTextClass = LOGO_TEXT_CLASSES[roleKey] ?? LOGO_TEXT_CLASSES.admin;

  return (
    <aside
      className={`bg-white dark:bg-zinc-950 text-slate-600 flex flex-col h-screen shrink-0 border-r border-slate-200/80 dark:border-zinc-800/85 shadow-[0_8px_30px_rgba(0,0,0,0.015)] transition-all duration-300 ease-in-out z-25 sticky top-0 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand Logo & Collapse Toggle */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/20">
        {!isCollapsed && (
          <div className="flex items-center space-x-2.5">
            <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg border shadow-sm ${logoBgClass}`}>
              <svg className={`w-4 h-4 ${logoIconClass}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 12h10L9 22l13-10H12l3-10z" />
              </svg>
            </div>
            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${logoTextClass}`}>
              AP AUTOMATION
            </span>
          </div>
        )}
        {isCollapsed && (
          <div className="mx-auto">
            <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg border ${logoBgClass}`}>
              <svg className={`w-4 h-4 ${logoIconClass}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 12h10L9 22l13-10H12l3-10z" />
              </svg>
            </div>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-100 dark:border-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors shrink-0"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        {!isCollapsed && (
          <div className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-3.5 px-3">
            Operations Center
          </div>
        )}
        
        {visibleItems.map((item) => {
          const isSelected = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group ${
                isSelected
                  ? `${activeItemClass} border`
                  : "text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800/40 hover:text-slate-800 dark:hover:text-zinc-100 border border-transparent"
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              {/* Selected left indicator line */}
              {isSelected && (
                <div className={`absolute left-0 top-1/4 bottom-1/4 w-0.75 rounded-r-md ${indicatorClass}`} />
              )}
              
              <div className="flex items-center space-x-3 min-w-0">
                <div className={`shrink-0 transition-colors duration-200 ${isSelected ? textAccentClass : "text-slate-400 group-hover:text-slate-655"}`}>
                  {item.icon}
                </div>
                {!isCollapsed && (
                  <span className={`truncate ${isSelected ? textAccentClass : "text-slate-600 dark:text-zinc-350 group-hover:text-slate-900 dark:group-hover:text-zinc-100"}`}>
                    {item.label}
                  </span>
                )}
              </div>
              
              {!isCollapsed && item.badge && (
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 tracking-wider ${
                    item.badge === "New"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : isSelected
                      ? badgeClass
                      : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapsible User Profile / Bottom Info */}
      <div 
        onClick={() => router.push("/settings")}
        className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0 cursor-pointer hover:bg-slate-100/60 transition-all duration-200"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-50 to-indigo-100 flex items-center justify-center font-bold text-blue-600 shadow-inner shrink-0 border border-blue-100">
            {currentUser ? currentUser.name.split(" ").map(n => n[0]).join("") : "JD"}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
                {currentUser ? currentUser.name : "Jane Doe"}
              </p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                {currentUser ? currentUser.email : "jane@enterprise.com"}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
