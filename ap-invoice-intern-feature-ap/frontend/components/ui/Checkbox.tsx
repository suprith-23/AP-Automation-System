"use client";
import React from "react";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const checkboxId = id || React.useId();
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className={`
              w-4 h-4 rounded text-blue-600 border-zinc-300 dark:border-zinc-700
              focus:ring-blue-500 focus:ring-2 focus:ring-offset-0
              bg-white dark:bg-[#0F0F11] transition duration-150
              ${className}
            `.trim()}
            {...props}
          />
          {label && (
            <label
              htmlFor={checkboxId}
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300 select-none cursor-pointer"
            >
              {label}
            </label>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-500 font-medium">{error}</p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";
export default Checkbox;
