"use client";
import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", id, ...props }, ref) => {
    const inputId = id || React.useId();
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            input-rounded
            disabled:opacity-50
            ${error ? "!border-red-500 focus:!border-red-500" : ""}
            ${className}
          `.trim()}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-500 font-medium">{error}</p>
        )}
        {!error && helperText && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
