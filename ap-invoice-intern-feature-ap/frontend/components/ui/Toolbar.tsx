"use client";
import React from "react";
import SearchBar from "./SearchBar";
import IconButton from "./IconButton";

type ActionItem = {
  key:     string;
  label:   string;
  icon:    React.ReactNode;
  onClick: () => void;
  badge?:  number;
};

type Props = {
  search?:     string;
  onSearch?:   (v: string) => void;
  searchPlaceholder?: string;
  actions?:    ActionItem[];
  /** Additional content to render between search and actions */
  children?:   React.ReactNode;
  className?:  string;
};

/**
 * Toolbar — standard above-table row.
 * Left: SearchBar (pill). Right: circular IconBtns (Filter, Export, Download, Add, etc.)
 * Every icon button is a perfect circle, consistent size and spacing.
 */
export default function Toolbar({
  search      = "",
  onSearch,
  searchPlaceholder,
  actions     = [],
  children,
  className   = "",
}: Props) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Left: Search */}
      {onSearch && (
        <SearchBar
          value={search}
          onChange={onSearch}
          placeholder={searchPlaceholder}
        />
      )}

      {/* Middle: optional extra content */}
      {children}

      {/* Right: Action icon buttons */}
      {actions.length > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {actions.map((action) => (
            <IconButton
              key={action.key}
              icon={action.icon}
              label={action.label}
              size="md"
              variant="ghost"
              onClick={action.onClick}
              badge={action.badge}
            />
          ))}
        </div>
      )}
    </div>
  );
}
