import React, { useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "../finewise/TopNav";
import NotificationPanel from "../NotificationPanel";
import authService from "../../services/auth.service";

type AppLayoutProps = {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  allowedTabs: string[];
  role: "Admin" | "Reviewer" | "Approver" | "Finance Manager" | "Auditor" | "Super Admin";
  setRole: (role: "Admin" | "Reviewer" | "Approver" | "Finance Manager" | "Auditor" | "Super Admin") => void;
  onRefresh: () => void;
  loading: boolean;
};

/**
 * Legacy layout component — the primary route layout is now ProtectedLayout.
 * Middleware handles auth guarding server-side; no client-side redirect needed here.
 */
export default function AppLayout({
  children,
  activeTab,
  setActiveTab,
  allowedTabs,
  role,
  setRole,
  onRefresh,
  loading,
}: AppLayoutProps) {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAFC] dark:bg-[#050506] font-sans text-zinc-900 dark:text-zinc-100">
      <TopNav
        role={role}
        setRole={setRole}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        allowedTabs={allowedTabs}
        onRefresh={onRefresh}
        loading={loading}
        onNotificationClick={() => setIsNotificationOpen(true)}
      />

      <main className="max-w-[1440px] mx-auto px-6 py-8 space-y-8">
        {children}
      </main>

      <NotificationPanel isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} />
    </div>
  );
}
