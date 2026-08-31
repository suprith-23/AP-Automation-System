"use client";

type StatChip = {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  color: "green" | "pink" | "purple" | "blue" | "teal" | "amber" | "red" | "black" | "grey";
};

type CapsuleStatRowProps = {
  chips: StatChip[];
};

/**
 * COLOR_MAP — dual-mode canonical palette.
 * Light fills use the bright brand hex; dark fills use the bright dark-mode variant
 * (deep fills for cards are handled by ColoredListCard; chips stay bright for readability).
 */
const COLOR_MAP: Record<StatChip["color"], { bg: string; text: string; sub: string; icon: string }> = {
  green:  { bg: "bg-[#22C55E] dark:bg-[#16A34A]",         text: "text-[#0A0A0A] dark:text-white",          sub: "text-[#166534] dark:text-green-100",      icon: "text-[#0A0A0A] dark:text-white" },
  pink:   { bg: "bg-[#EC4899] dark:bg-[#DB2777]",          text: "text-white",                              sub: "text-pink-100",                            icon: "text-white"                     },
  purple: { bg: "bg-[#8B5CF6] dark:bg-[#7C3AED]",          text: "text-white",                              sub: "text-purple-100",                          icon: "text-white"                     },
  blue:   { bg: "bg-[#3B82F6] dark:bg-[#2563EB]",          text: "text-white",                              sub: "text-blue-100",                            icon: "text-white"                     },
  teal:   { bg: "bg-[#14B8A6] dark:bg-[#0D9488]",          text: "text-[#0A0A0A] dark:text-white",          sub: "text-teal-900 dark:text-teal-100",         icon: "text-[#0A0A0A] dark:text-white" },
  amber:  { bg: "bg-[#F59E0B] dark:bg-[#D97706]",          text: "text-[#0A0A0A] dark:text-white",          sub: "text-amber-900 dark:text-amber-100",       icon: "text-[#0A0A0A] dark:text-white" },
  red:    { bg: "bg-[#EF4444] dark:bg-[#DC2626]",           text: "text-white",                              sub: "text-red-100",                             icon: "text-white"                     },
  black:  { bg: "bg-[#0A0A0A] dark:bg-[#1A1A1A]",          text: "text-white",                              sub: "text-zinc-400",                            icon: "text-zinc-300"                  },
  grey:   { bg: "bg-[#E4E4E7] dark:bg-[#3F3F46]",          text: "text-[#0A0A0A] dark:text-white",          sub: "text-[#6B7280] dark:text-[#D4D4D8]",       icon: "text-[#6B7280] dark:text-[#D4D4D8]" },
};

export default function CapsuleStatRow({ chips }: CapsuleStatRowProps) {
  return (
    <div className="flex flex-wrap gap-4 w-full">
      {chips.map((chip, i) => {
        const c = COLOR_MAP[chip.color];
        return (
          <div
            key={i}
            className={`${c.bg} flex-1 min-w-[200px] flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-250 hover:scale-[1.02] active:scale-[0.99] cursor-default select-none shadow-sm fw-texture-grain`}
          >
            {chip.icon && (
              <div className="shrink-0 w-10 h-10 rounded-full bg-white/20 dark:bg-black/20 flex items-center justify-center shadow-sm">
                <div className={c.icon}>{chip.icon}</div>
              </div>
            )}
            <div>
              <div className={`text-2xl font-black leading-none tracking-tight ${c.text}`}>
                {chip.value}
              </div>
              <div className={`text-[10px] font-semibold uppercase tracking-widest mt-0.5 ${c.sub}`}>
                {chip.label}
              </div>
              {chip.sub && (
                <div className={`text-[10px] font-medium mt-0.5 ${c.sub} opacity-80`}>
                  {chip.sub}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
