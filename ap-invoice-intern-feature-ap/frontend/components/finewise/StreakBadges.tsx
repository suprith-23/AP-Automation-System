"use client";

type Badge = {
  icon: string;
  label: string;
  count: number;
  maxCount: number;
  caption: string;
  unlocked: boolean;
};

type StreakBadgesProps = {
  badges: Badge[];
};

export default function StreakBadges({ badges }: StreakBadgesProps) {
  return (
    <div className="bg-[#18181B] rounded-[24px] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-white font-black text-base">Reliability Streaks</span>
        <span className="text-zinc-500 text-xs font-medium">Milestones</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {badges.map((badge, i) => (
          <div
            key={i}
            className={`flex flex-col items-center gap-3 p-4 rounded-2xl transition-all duration-200 ${
              badge.unlocked ? "bg-zinc-800/60" : "bg-zinc-900/40 opacity-50"
            }`}
          >
            {/* Circle badge with count overlay */}
            <div className="relative">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
                  badge.unlocked
                    ? "bg-[#7ED957]"
                    : "bg-zinc-700"
                }`}
              >
                {badge.icon}
              </div>
              <div
                className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                  badge.unlocked ? "bg-white text-green-800" : "bg-zinc-600 text-zinc-400"
                }`}
              >
                {badge.count}
              </div>
            </div>

            {/* Label */}
            <span className={`text-xs font-bold text-center leading-tight ${badge.unlocked ? "text-white" : "text-zinc-600"}`}>
              {badge.label}
            </span>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${badge.unlocked ? "bg-[#7ED957]" : "bg-zinc-600"}`}
                style={{ width: `${Math.min((badge.count / badge.maxCount) * 100, 100)}%` }}
              />
            </div>

            {/* Caption */}
            <span className={`text-[9px] font-medium text-center ${badge.unlocked ? "text-zinc-400" : "text-zinc-600"}`}>
              {badge.caption}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
