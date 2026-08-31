/**
 * AuthPrimaryButton — gold-standard CTA for login/register auth pages.
 *
 * Matches login page's solid emerald style exactly:
 * - bg-[#10b981] solid fill (NOT a gradient)
 * - py-3.5, rounded-xl, font-black, text-xs, uppercase tracking-widest
 * - shadow-lg, disabled:opacity-50
 * - Trailing arrow SVG icon by default (hidden when loading)
 * - Spinner SVG when loading (not text fallback)
 *
 * Usage:
 *   <AuthPrimaryButton loading={loading} disabled={!selectedOrg}>
 *     VERIFY WORK EMAIL
 *   </AuthPrimaryButton>
 *
 *   // Custom icon override (e.g. checkmark on submit step):
 *   <AuthPrimaryButton iconRight={<CheckIcon />}>SUBMIT</AuthPrimaryButton>
 *
 *   // No trailing arrow (e.g. back button variant):
 *   <AuthPrimaryButton showArrow={false} type="button" onClick={...}>BACK</AuthPrimaryButton>
 */

import React from "react";

const ArrowIcon = () => (
  <svg
    className="w-4 h-4 shrink-0"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin h-4 w-4 text-zinc-950" fill="none" viewBox="0 0 24 24" aria-hidden>
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

interface AuthPrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  showArrow?: boolean;
  iconRight?: React.ReactNode;
}

export function AuthPrimaryButton({
  loading = false,
  showArrow = true,
  iconRight,
  disabled,
  children,
  className = "",
  type = "submit",
  ...rest
}: AuthPrimaryButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`
        w-full py-3.5
        bg-[#10b981] hover:bg-emerald-450
        disabled:opacity-50
        text-zinc-950 font-black text-xs uppercase tracking-widest
        rounded-xl shadow-lg
        transition-all duration-200
        flex justify-center items-center gap-1.5
        mt-2
        ${className}
      `.trim()}
      {...rest}
    >
      {loading ? (
        <SpinnerIcon />
      ) : (
        <>
          <span>{children}</span>
          {iconRight ?? (showArrow ? <ArrowIcon /> : null)}
        </>
      )}
    </button>
  );
}

/**
 * AuthOutlineButton — secondary/ghost style for auth pages.
 * Matches login's "SIGN UP" button: transparent, border-zinc-800, zinc-200 text.
 */
export function AuthOutlineButton({
  children,
  className = "",
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`
        w-full py-3.5
        bg-transparent hover:bg-zinc-900
        border border-zinc-800 hover:border-zinc-700
        text-zinc-200 font-black text-xs uppercase tracking-widest
        rounded-xl transition-all duration-200
        flex justify-center items-center gap-2
        ${className}
      `.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
