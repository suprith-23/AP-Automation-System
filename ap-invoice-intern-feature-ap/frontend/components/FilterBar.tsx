import { useState, useRef, useCallback } from "react";
import { useKeyboardShortcut } from "../hooks/useKeyboardShortcut";
import { usePersistentPreferences } from "../hooks/usePersistentPreferences";

export type FilterConfig = {
  search: string;
  validationStatus: "ALL" | "PASSED" | "FAILED";
  workflowStatus: "ALL" | "PENDING_REVIEW" | "PENDING_APPROVAL" | "APPROVED" | "VALIDATION_FAILED";
  minConfidence: string;
  dateStart?: string;
  dateEnd?: string;
};

export const defaultFilterConfig: FilterConfig = {
  search: "",
  validationStatus: "ALL",
  workflowStatus: "ALL",
  minConfidence: "0",
  dateStart: "",
  dateEnd: "",
};

type Props = {
  filters: FilterConfig;
  setFilters: (filters: FilterConfig) => void;
  hideWorkflowStatus?: boolean;
};

export default function FilterBar({ filters, setFilters, hideWorkflowStatus }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [savedFilters, setSavedFilters] = usePersistentPreferences<{ name: string; filter: FilterConfig }[]>("savedFilters", []);
  const [showSavedFilters, setShowSavedFilters] = useState(false);

  // Global shortcut to focus search
  const handleSearchShortcut = useCallback((e: KeyboardEvent) => {
    searchInputRef.current?.focus();
  }, []);

  useKeyboardShortcut({ key: "k", ctrlOrCmd: true }, handleSearchShortcut);

  const handleSearchChange = (val: string) => {
    setFilters({ ...filters, search: val });
  };

  const handleSelectChange = (key: keyof FilterConfig, val: string) => {
    setFilters({ ...filters, [key]: val });
  };

  const resetFilters = () => {
    setFilters(defaultFilterConfig);
  };

  const handleSaveCurrentFilter = () => {
    const name = prompt("Enter a name for this saved filter:");
    if (name) {
      setSavedFilters([...savedFilters, { name, filter: filters }]);
    }
  };

  const handleLoadFilter = (filter: FilterConfig) => {
    setFilters(filter);
    setShowSavedFilters(false);
  };

  return (
    <div className="premium-card p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="h-4.5 w-4.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by vendor, PO, or invoice #... (Ctrl+K)"
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="block w-full pl-11 pr-4 min-h-[44px] bg-fw-white-off dark:bg-fw-white-dark border-0 rounded-full text-xs text-zinc-800 dark:text-zinc-150 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-4 min-h-[44px] bg-fw-white-off dark:bg-fw-white-dark border-0 hover:brightness-95 text-zinc-700 dark:text-zinc-300 rounded-full text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-sm"
          >
            <svg className="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span>Advanced Filters</span>
          </button>

          {(filters.search || filters.validationStatus !== "ALL" || filters.workflowStatus !== "ALL" || filters.minConfidence !== "0") && (
            <button
              onClick={resetFilters}
              className="px-4 min-h-[44px] bg-rose-50 hover:bg-rose-100/60 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-0 rounded-full text-xs font-bold transition-all flex items-center justify-center"
            >
              Reset Filters
            </button>
          )}

          {/* Saved Filters Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSavedFilters(!showSavedFilters)}
              className="px-4 min-h-[44px] bg-fw-white-off dark:bg-fw-white-dark border-0 hover:brightness-95 text-zinc-700 dark:text-zinc-300 rounded-full text-xs font-bold transition-all flex items-center justify-center shadow-sm"
            >
              <span>Saved</span>
              <svg className="w-3.5 h-3.5 ml-2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showSavedFilters && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-20 py-2 animate-[fadeIn_150ms_ease-in-out]">
                <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-2 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Saved Filters</span>
                </div>
                {savedFilters.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-zinc-500 text-center">No saved filters.</div>
                ) : (
                  savedFilters.map((sf, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleLoadFilter(sf.filter)}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      {sf.name}
                    </button>
                  ))
                )}
                <div className="border-t border-zinc-100 dark:border-zinc-800 mt-2 pt-2 px-2">
                  <button
                    onClick={() => {
                      handleSaveCurrentFilter();
                      setShowSavedFilters(false);
                    }}
                    className="w-full text-center px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100/60 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-xl transition-colors"
                  >
                    + Save Current Filter
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-[fadeIn_150ms_ease-in-out]">
          {/* Validation Status */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Validation Status</label>
            <select
              value={filters.validationStatus}
              onChange={(e) => handleSelectChange("validationStatus", e.target.value)}
              className="block w-full bg-fw-white-off dark:bg-fw-white-dark border-0 rounded-xl text-zinc-700 dark:text-zinc-300 min-h-[44px] px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Validations</option>
              <option value="PASSED">Passed Only</option>
              <option value="FAILED">Failed Only</option>
            </select>
          </div>

          {/* Workflow Status */}
          {!hideWorkflowStatus && (
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Workflow Status</label>
              <select
                value={filters.workflowStatus}
                onChange={(e) => handleSelectChange("workflowStatus", e.target.value)}
                className="block w-full bg-fw-white-off dark:bg-fw-white-dark border-0 rounded-xl text-zinc-700 dark:text-zinc-300 min-h-[44px] px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All States</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved & posted</option>
                <option value="VALIDATION_FAILED">Validation Failed</option>
              </select>
            </div>
          )}

          {/* Min OCR Confidence */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Minimum OCR Match</label>
            <select
              value={filters.minConfidence}
              onChange={(e) => handleSelectChange("minConfidence", e.target.value)}
              className="block w-full bg-fw-white-off dark:bg-fw-white-dark border-0 rounded-xl text-zinc-700 dark:text-zinc-300 min-h-[44px] px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="0">All Match Scores</option>
              <option value="0.95">95% or Higher Match</option>
              <option value="0.85">85% or Higher Match</option>
              <option value="0.70">70% or Higher Match</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
