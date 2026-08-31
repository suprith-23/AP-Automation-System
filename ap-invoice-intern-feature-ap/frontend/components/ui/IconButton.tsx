"use client";
import React from "react";

export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonVariant = "dark" | "ghost" | "outline";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string; // Required for screen reader compatibility (aria-label)
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  badge?: number;
}

const SIZE_CLASSES: Record<IconButtonSize, { btn: string; icon: string }> = {
  sm: { btn: "w-7 h-7", icon: "w-3.5 h-3.5" },
  md: { btn: "w-9 h-9", icon: "w-4 h-4" },
  lg: { btn: "w-11 h-11", icon: "w-5 h-5" },
};

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  dark: "bg-[#0A0A0A] text-white dark:bg-white dark:text-[#0A0A0A] hover:opacity-80",
  ghost: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700",
  outline: "border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800",
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      size = "md",
      variant = "ghost",
      disabled = false,
      type = "button",
      className = "",
      badge,
      ...props
    },
    ref
  ) => {
    const sc = SIZE_CLASSES[size];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={`
          relative inline-flex items-center justify-center
          rounded-full shrink-0
          transition-all duration-200 outline-none
          hover:scale-[1.06] active:scale-[0.96]
          disabled:opacity-40 disabled:pointer-events-none
          focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400
          ${sc.btn}
          ${VARIANT_CLASSES[variant]}
          ${className}
        `.trim()}
        {...props}
      >
        <span className={sc.icon} aria-hidden="true">{icon}</span>

        {badge !== undefined && badge > 0 && (
          <span
            aria-label={`${badge} notifications`}
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1
                       flex items-center justify-center
                       rounded-full bg-[#EF4444]
                       text-[9px] font-black text-white
                       ring-2 ring-white dark:ring-[#0A0A0A]"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
export default IconButton;
