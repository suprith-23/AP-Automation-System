"use client";
import StatusPill from "../ui/StatusPill";

export type SystemCardProps = {
  name: string;
  connectorType: string;
  secondaryLine: string; // e.g. maskedKey, "142 invoices routed"
  environment: "production" | "staging" | "development";
  lastUsed: string;
  status: "active" | "expired" | "revoked" | "healthy" | "degraded" | "online" | "offline";
  iconLetter?: string;
  index?: number;
  onClick?: () => void;
};

const GRADIENT_MAP = {
  production:  "from-[#1e1b4b] via-[#312e81] to-[#4338ca] border-indigo-500/20",
  staging:     "from-[#1c1917] via-[#292524] to-[#44403c] border-stone-500/20",
  development: "from-[#0c4a6e] via-[#075985] to-[#0369a1] border-sky-500/20",
};

const GRADIENT_ROTATION = [
  "from-[#2563EB] to-[#1D4ED8] border-blue-500/30 shadow-blue-500/20", // Neon Indigo Blue
  "from-[#7C3AED] to-[#6D28D9] border-purple-500/30 shadow-purple-500/20", // Neon Purple
  "from-[#059669] to-[#047857] border-emerald-500/30 shadow-emerald-500/20", // Neon Green/Teal
  "from-[#DC2626] to-[#B91C1C] border-rose-500/30 shadow-rose-500/20", // Neon Crimson
  "from-[#D97706] to-[#B45309] border-amber-500/30 shadow-amber-500/20", // Neon Amber/Orange
  "from-[#0891B2] to-[#0369A1] border-cyan-500/30 shadow-cyan-500/20", // Neon Cyan/Sky
];

export default function SystemCard({
  name,
  connectorType,
  secondaryLine,
  environment,
  lastUsed,
  status,
  iconLetter,
  index,
  onClick,
}: SystemCardProps) {
  const grad = index !== undefined 
    ? GRADIENT_ROTATION[index % GRADIENT_ROTATION.length] 
    : GRADIENT_MAP[environment] || GRADIENT_MAP.production;
  const initial = iconLetter || name.substring(0, 2).toUpperCase();

  return (
    <div
      onClick={onClick}
      className={`bg-gradient-to-br ${grad} border rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden shadow-md transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]' : ''}`}
      style={{ minHeight: 150 }}
    >
      {/* Decorative circles / soft glow */}
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />

      {/* Top row: icon + status */}
      <div className="flex items-center justify-between z-10">
        <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white font-black text-sm select-none">
          {initial}
        </div>
        <StatusPill status={status} />
      </div>

      {/* Connector name */}
      <div className="z-10">
        <div className="text-white font-black text-base leading-tight truncate">{name}</div>
        <div className="text-white/50 text-[10px] font-semibold uppercase tracking-wider mt-0.5">{connectorType}</div>
      </div>

      {/* Masked key / Metric line */}
      <div className="font-mono text-white/85 text-xs tracking-wider z-10 truncate mt-1">
        {secondaryLine}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto z-10">
        <StatusPill status={environment} />
        <span className="text-white/40 text-[10px] font-medium">Last used {lastUsed}</span>
      </div>
    </div>
  );
}
