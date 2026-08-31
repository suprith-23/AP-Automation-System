"use client";
import React from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "warning";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  tooltip?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-[var(--role-accent,var(--fw-green))] text-[var(--role-accent-foreground,#ffffff)] hover:opacity-90 active:scale-[0.97] dark:bg-[var(--role-accent,var(--fw-green))] dark:text-[var(--role-accent-foreground,#000000)]",
  secondary: "bg-zinc-100 text-fw-black hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  outline: "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
  ghost: "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
  danger: "bg-fw-red text-white hover:bg-fw-red/90 dark:bg-fw-red dark:hover:bg-fw-red/90",
  success: "bg-fw-green text-fw-green-deep hover:bg-fw-green/90 dark:bg-fw-green dark:text-fw-green-deep",
  warning: "bg-fw-amber text-fw-amber-deep hover:bg-fw-amber/90 dark:bg-fw-amber dark:text-fw-amber-deep",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "text-xs px-3 h-8",
  md: "text-sm px-4 h-10",
  lg: "text-base px-6 h-12",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon,
      iconRight,
      loading = false,
      disabled = false,
      className = "",
      children,
      tooltip,
      type = "button",
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-label={ariaLabel || (typeof children === "string" ? children : undefined)}
        aria-busy={loading}
        title={tooltip}
        className={`
          inline-flex items-center justify-center gap-2
          font-semibold rounded-full whitespace-nowrap select-none
          transition-all duration-200 outline-none
          active:scale-[0.97]
          disabled:opacity-40 disabled:pointer-events-none
          focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400
          fw-texture-grain
          ${VARIANT_CLASSES[variant]}
          ${SIZE_CLASSES[size]}
          ${className}
        `.trim()}
        {...props}
      >
        {loading ? (
          <svg
            className="w-4 h-4 animate-spin text-current"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            aria-hidden
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          icon && <span className="shrink-0" aria-hidden>{icon}</span>
        )}
        {children}
        {iconRight && !loading && (
          <span className="shrink-0" aria-hidden>{iconRight}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
