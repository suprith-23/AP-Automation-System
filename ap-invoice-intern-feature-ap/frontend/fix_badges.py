import os
import re

def make_translucent(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # In RoleBadge.tsx
    if 'RoleBadge' in filepath:
        content = content.replace('bg-fw-green text-white', 'bg-fw-green/20 text-fw-green border border-fw-green/30')
        content = content.replace('bg-fw-amber text-white', 'bg-fw-amber/20 text-fw-amber border border-fw-amber/30')
        content = content.replace('bg-fw-purple text-white', 'bg-fw-purple/20 text-fw-purple border border-fw-purple/30')
        content = content.replace('bg-fw-pink text-white', 'bg-fw-pink/20 text-fw-pink border border-fw-pink/30')
        content = content.replace('bg-fw-blue text-white', 'bg-fw-blue/20 text-fw-blue border border-fw-blue/30')
        content = content.replace('bg-zinc-500 text-white', 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30')

    # In StatusPill.tsx
    if 'StatusPill' in filepath:
        content = content.replace('bg-[#10b981] text-white', 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30')
        content = content.replace('bg-rose-500 text-white', 'bg-rose-500/20 text-rose-500 border border-rose-500/30')
        content = content.replace('bg-amber-500 text-white', 'bg-amber-500/20 text-amber-500 border border-amber-500/30')
        content = content.replace('bg-purple-500 text-white', 'bg-purple-500/20 text-purple-400 border border-purple-500/30')
        content = content.replace('bg-blue-500 text-white', 'bg-blue-500/20 text-blue-400 border border-blue-500/30')
        content = content.replace('bg-emerald-500 text-white', 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30')
        content = content.replace('bg-zinc-500 text-white', 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30')
        content = content.replace('bg-cyan-500 text-white', 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

make_translucent(r'n:\PGM\AP-Automation-System\frontend\components\ui\RoleBadge.tsx')
make_translucent(r'n:\PGM\AP-Automation-System\frontend\components\ui\StatusPill.tsx')
print("Fixed Badges")
