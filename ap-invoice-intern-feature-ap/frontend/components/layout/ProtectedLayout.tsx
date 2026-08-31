"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import AppTopNav from "../finewise/AppTopNav";
import NotificationPanel from "../NotificationPanel";
import authService from "../../services/auth.service";
import { useAppStore } from "../../store/useAppStore";

import { LazyMotion, domAnimation, m } from "framer-motion";

const roleAccentMap: Record<string, { accent: string; foreground: string; bgDeep: string }> = {
  Admin:            { accent: "var(--fw-green)",  foreground: "#123B22",  bgDeep: "#E6FCE9" }, // Solid light green tint matching Admin (#39E35D)
  Reviewer:         { accent: "var(--fw-pink)",   foreground: "#ffffff",  bgDeep: "#FFEBF6" }, // Solid light pink tint matching Reviewer (#FF3EA5)
  Approver:         { accent: "var(--fw-purple)", foreground: "#ffffff",  bgDeep: "#F5F0FF" }, // Solid light purple tint matching Approver (#9B6BFF)
  "Super Admin":    { accent: "var(--fw-amber)",  foreground: "#451A03",  bgDeep: "#FFF8E6" }, // Solid light amber tint matching Super Admin (#FFB800)
  Auditor:          { accent: "var(--fw-sky)",    foreground: "#ffffff",  bgDeep: "#E7F6FD" }, // Solid light sky blue tint matching Auditor (#0ea5e9)
  "Finance Manager":{ accent: "var(--fw-orange)", foreground: "#ffffff",  bgDeep: "#FFF1E6" }, // Solid light orange tint matching Finance Manager (#f97316)
};

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const { role, setRole, fetchAllData } = useAppStore();
  const didInitialFetch = useRef(false);
  const [shouldAnimate, setShouldAnimate] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setShouldAnimate(!mediaQuery.matches);
      const handler = (e: MediaQueryListEvent) => setShouldAnimate(!e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  /**
   * WHY: All auth/storage reads are inside useEffect so they run only on the
   * client, AFTER hydration. Lazy useState(() => localStorage...) causes a
   * hydration mismatch (server sees no window → false, client sees true) which
   * makes React throw away the server HTML and re-render repeatedly — that's
   * the continuous blinking.
   *
   * WHY we don't gate rendering on auth state:
   * The middleware already verified the JWT cookie server-side before this
   * component even mounts. There is no unauthenticated state to render.
   * We just need to sync role + start the background data fetch.
   */
  useEffect(() => {
    let active = true;

    // 1. Sync role from cached user immediately (synchronous, no flash)
    const cachedUser = authService.getStoredUser();
    if (cachedUser?.role) {
      setRole(cachedUser.role as any);
    }

    // 2. Kick off initial data load once
    if (!didInitialFetch.current) {
      didInitialFetch.current = true;
      fetchAllData(true);
    }

    // 3. Background session validation — never blocks render
    const validateSession = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (active && user?.role) {
          setRole(user.role as any);
        }
      } catch (err: any) {
        // Only hard-redirect on explicit 401 (token truly expired/invalid).
        // Network errors should not kick the user out.
        if (active && err?.response?.status === 401) {
          authService.logout().then(() => {
            router.replace("/login");
          }).catch(() => {
            router.replace("/login");
          });
        }
      }
    };

    validateSession();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch data on route or role transitions
  useEffect(() => {
    fetchAllData(true);
  }, [role, pathname]);

  // Background poll every 30s — invisible to the user
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchAllData(false);
      }
    }, 30000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable style props — only recompute when role changes
  const styleProps = useMemo(() => {
    const rc = roleAccentMap[role] || roleAccentMap["Admin"];
    return {
      "--role-accent":            rc.accent,
      "--role-accent-foreground": rc.foreground,
      "--role-accent-bg-deep":    rc.bgDeep,
    } as React.CSSProperties;
  }, [role]);

  /**
   * Always render the layout — no conditional auth gate.
   * - Middleware guarantees the request is authenticated before reaching here.
   * - Page-level loading skeletons (loading.tsx + store.loading) handle
   *   the "data not yet loaded" state independently.
   * - Removing the conditional prevents any SSR/hydration mismatch flash.
   */
  return (
    <div
      className="min-h-screen bg-[#FAFAFC] dark:bg-[#050506] font-sans text-zinc-900 dark:text-zinc-100"
      style={styleProps}
    >
      <AppTopNav
        onNotificationClick={() => setIsNotificationOpen(true)}
        onRefresh={fetchAllData}
      />

      <main className="max-w-[1440px] mx-auto px-6 py-8 space-y-8">
        <LazyMotion features={domAnimation}>
          <m.div
            key={pathname}
            initial={shouldAnimate ? { opacity: 0, y: 8 } : undefined}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
            exit={shouldAnimate ? { opacity: 0, y: -8 } : undefined}
            transition={shouldAnimate ? { duration: 0.15, ease: "easeOut" } : { duration: 0 }}
          >
            {children}
          </m.div>
        </LazyMotion>
      </main>

      <NotificationPanel
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </div>
  );
}
