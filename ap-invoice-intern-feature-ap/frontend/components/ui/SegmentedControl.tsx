"use client";

type Option = {
  key:   string;
  label: string;
};

type Props = {
  options:   Option[];
  value:     string;
  onChange:  (key: string) => void;
  className?: string;
};

/**
 * SegmentedControl — outer rounded container with a floating inner pill for the active state.
 * Used for chart tab toggles, view-mode selectors, and filter controls.
 * Never flat tabs. Never square edges.
 */
export default function SegmentedControl({ options, value, onChange, className = "" }: Props) {
  return (
    <div
      className={`segmented-control ${className}`}
      role="tablist"
      aria-label="Segmented control"
    >
      {options.map((opt) => {
        const isActive = opt.key === value;
        return (
          <button
            key={opt.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.key)}
            className={`segmented-control-item${isActive ? " active" : ""}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
