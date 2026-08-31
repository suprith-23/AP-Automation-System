"use client";
import React from "react";

type Props = {
  title?:      string;
  /** Optional top-right action — rendered inside a circular button wrapper if it's a string (icon name), or rendered as-is if ReactNode */
  action?:     React.ReactNode;
  className?:  string;
  padding?:    boolean;
  children:    React.ReactNode;
};

/**
 * Card — canonical rounded-rectangle container.
 *
 * Rules from spec:
 * - Corner radius: 22px
 * - No borders
 * - No heavy shadows — minimal elevation only
 * - Cards are containers, not buttons
 * - Clicking empty space does nothing
 * - Separation from siblings comes from spacing and background colour
 */
export default function Card({ title, action, className = "", padding = true, children }: Props) {
  return (
    <div
      className={`fw-card fw-texture-grain ${padding ? "" : "!p-0"} ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">
              {title}
            </h3>
          )}
          {action && (
            <div className="shrink-0">{action}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
