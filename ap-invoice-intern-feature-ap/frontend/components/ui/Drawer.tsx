"use client";
import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import StatusPill from "./StatusPill";

type Props = {
  isOpen:      boolean;
  onClose:     () => void;
  title?:      string;
  subtitle?:   string;
  status?:     string;
  footer?:     React.ReactNode;
  children:    React.ReactNode;
  width?:      string; // e.g. "520px"
};

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/**
 * Drawer — right-side slide-over panel.
 *
 * - Slides in from the right (220ms)
 * - Backdrop dims current view
 * - Body scrolls independently; footer is sticky
 * - Escape key closes it
 * - Focus is trapped inside while open
 * - On mobile (<640px) becomes full-width
 * - Never navigates away; preserves scroll position of underlying page
 */
export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  status,
  footer,
  children,
  width = "520px",
}: Props) {
  const panelRef   = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Keyboard: Escape closes
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKey);
    // Prevent body scroll
    document.body.style.overflow = "hidden";
    // Move focus inside the drawer
    setTimeout(() => closeBtnRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKey]);

  // Focus trap: keep Tab inside the drawer
  const handleFocusTrap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Detail panel"}
        className="drawer-panel"
        style={{ width: `min(${width}, 100vw)` }}
        onKeyDown={handleFocusTrap}
      >
        {/* ── Header ── */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex-1 min-w-0">
            {title && (
              <h2 className="text-base font-black text-zinc-900 dark:text-white truncate">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate font-medium">
                {subtitle}
              </p>
            )}
            {status && (
              <div className="mt-2">
                <StatusPill status={status} />
              </div>
            )}
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close panel"
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0
                       bg-zinc-100 dark:bg-zinc-800
                       text-zinc-500 dark:text-zinc-400
                       hover:bg-zinc-200 dark:hover:bg-zinc-700
                       hover:text-zinc-800 dark:hover:text-white
                       transition-colors duration-150
                       focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {children}
        </div>

        {/* ── Footer ── */}
        {footer && (
          <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-[#111111]">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
