import re

filepath = r'n:\PGM\AP-Automation-System\frontend\app\(protected)\payment-queue\page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the bg-*/10 with solid colors and white text
# { label: "Awaiting Schedule", value: stats.awaitingSchedulingCount, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" }
# Becomes solid colors using fw-* tokens
content = content.replace(
    'color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20"',
    'color: "text-white dark:text-white", bg: "bg-fw-amber dark:bg-fw-amber-dark border-transparent shadow-sm"'
)
content = content.replace(
    'color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20"',
    'color: "text-white dark:text-white", bg: "bg-fw-blue dark:bg-fw-blue-dark border-transparent shadow-sm"'
)
content = content.replace(
    'color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20"',
    'color: "text-white dark:text-white", bg: "bg-fw-green dark:bg-fw-green-dark border-transparent shadow-sm"'
)
content = content.replace(
    'color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20"',
    'color: "text-white dark:text-white", bg: "bg-fw-pink dark:bg-fw-pink-dark border-transparent shadow-sm"'
)
content = content.replace(
    'color: "text-red-500", bg: "bg-red-500/10 border-red-500/20"',
    'color: "text-white dark:text-white", bg: "bg-fw-red dark:bg-fw-red-dark border-transparent shadow-sm"'
)
content = content.replace(
    'color: "text-zinc-600 dark:text-zinc-300", bg: "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"',
    'color: "text-white dark:text-white", bg: "bg-fw-grey-muted dark:bg-fw-grey-mutedDark border-transparent shadow-sm"'
)
# Ensure the capsule labels use white text since the background is solid
content = re.sub(r'<div className="text-\[10px\] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">', r'<div className="text-[10px] font-black uppercase tracking-widest text-white/90 mb-2">', content)
# Also the value should be white instead of `stat.color` since we overrode it anyway, but the span itself:
content = re.sub(r'<span className={`font-black text-2xl \${stat.color}`}>\s*\{stat.value\}\s*</span>', r'<span className={`font-black text-2xl text-white dark:text-white`}>{stat.value}</span>', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated payment queue capsules")
