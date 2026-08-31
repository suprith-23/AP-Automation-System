"use client";
import React from "react";

type InputType = "text" | "email" | "number" | "tel" | "url" | "password" | "date";

type Props = {
  label?:       string;
  type?:        InputType;
  placeholder?: string;
  value:        string;
  onChange:     (v: string) => void;
  error?:       string;
  required?:    boolean;
  disabled?:    boolean;
  id?:          string;
  className?:   string;
  /** "pill" = full pill shape | "rounded" = large rounded rect */
  shape?:       "pill" | "rounded";
};

/**
 * PillInput — pill-shaped or large-rounded-rect form input.
 * Never sharp rectangles.
 */
export default function PillInput({
  label,
  type       = "text",
  placeholder,
  value,
  onChange,
  error,
  required   = false,
  disabled   = false,
  id,
  className  = "",
  shape      = "pill",
}: Props) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}{required && <span className="text-[#EF4444] ml-0.5" aria-hidden>*</span>}
        </label>
      )}

      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`
          ${shape === "pill" ? "input-pill" : "input-rounded"}
          ${error ? "!border-[#EF4444] dark:!border-[#F87171]" : ""}
          ${disabled ? "opacity-40 cursor-not-allowed" : ""}
        `.trim()}
      />

      {error && (
        <p
          id={`${inputId}-error`}
          className="text-[11px] font-semibold text-[#EF4444] dark:text-[#F87171] px-1"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
