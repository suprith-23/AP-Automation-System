"use client";
import React from "react";

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, helperText, className = "", id, ...props }, ref) => {
    const selectId = id || React.useId();
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full px-3 py-2 text-sm rounded-lg border
            bg-white dark:bg-[#0F0F11]
            text-zinc-900 dark:text-zinc-100
            border-zinc-300 dark:border-zinc-700
            transition-all duration-200 outline-none
            focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
            disabled:opacity-50 disabled:bg-zinc-50 dark:disabled:bg-zinc-900/50
            ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}
            ${className}
          `.trim()}
          {...props}
        >
          {options.map((option) => (
            <option 
              key={option.value} 
              value={option.value} 
              disabled={option.value === ""} 
              className="bg-white dark:bg-[#0F0F11] text-zinc-900 dark:text-zinc-100"
            >
              {option.label}
            </option>
          ))}
        </select>
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

Select.displayName = "Select";
export default Select;
