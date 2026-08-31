"use client";
import React, { useRef } from "react";

type Props = {
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  className?:   string;
  id?:          string;
};

const SearchIcon = () => (
  <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ClearIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/**
 * SearchBar — canonical pill-shaped search bar.
 * Consistent h-10 height across every location in the app.
 * Icon left, clear button right, pill geometry, never square.
 */
export default function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
  className   = "",
  id,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`search-pill flex-1 ${className}`}
      onClick={() => inputRef.current?.focus()}
      role="search"
    >
      <SearchIcon />
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(""); inputRef.current?.focus(); }}
          aria-label="Clear search"
          className="w-5 h-5 rounded-full flex items-center justify-center
                     text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200
                     hover:bg-zinc-200 dark:hover:bg-zinc-700
                     transition-colors shrink-0"
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
}
