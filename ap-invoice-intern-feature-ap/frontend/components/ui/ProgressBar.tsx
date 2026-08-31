"use client";

type Color = "green" | "blue" | "amber" | "red" | "purple" | "zinc";

type Props = {
  value:      number;   // 0–100
  color?:     Color;
  label?:     string;
  showValue?: boolean;
  className?: string;
};

const FILL_COLORS: Record<Color, string> = {
  green:  "bg-[#39E35D] dark:bg-[#4AFF7A]",
  blue:   "bg-[#2E8BFF] dark:bg-[#4FA3FF]",
  amber:  "bg-[#FFB800] dark:bg-[#FFCB3D]",
  red:    "bg-[#FF3B3B] dark:bg-[#FF5C5C]",
  purple: "bg-[#9B6BFF] dark:bg-[#B388FF]",
  zinc:   "bg-zinc-400 dark:bg-zinc-500",
};

function pickColor(value: number): Color {
  if (value > 90) return "green";
  if (value >= 70) return "amber";
  return "red";
}

/**
 * ProgressBar — stadium-shaped progress bar.
 * Used for confidence scores, step progress, SLA tracking.
 * Auto-picks colour based on value if no color prop given.
 */
export default function ProgressBar({
  value,
  color,
  label,
  showValue = true,
  className = "",
}: Props) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const fillColor    = FILL_COLORS[color ?? pickColor(clampedValue)];

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-0.5">
          {label && (
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {label}
            </span>
          )}
          {showValue && (
            <span className="text-[11px] font-black text-zinc-700 dark:text-zinc-300">
              {clampedValue.toFixed(0)}%
            </span>
          )}
        </div>
      )}

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`progress-fill ${fillColor}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
