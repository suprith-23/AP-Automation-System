import os
import glob

def fix_file(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove the style block
    start_idx = content.find('{/* Injecting CSS Keyframe Animations Localized to Ingest Screen */}')
    if start_idx != -1:
        end_idx = content.find('`}} />', start_idx)
        if end_idx != -1:
            content = content[:start_idx] + content[end_idx + 6:]

    content = content.replace('anim-glow-circle stagger-2', 'animate-pulse-glow [animation-delay:200ms]')
    content = content.replace('anim-glow-circle', 'animate-pulse-glow')
    content = content.replace('anim-float', 'animate-float-gentle')
    content = content.replace('className=\"anim-scan\"', 'className=\"absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#10b981] to-transparent shadow-[0_0_12px_#10b981,0_0_4px_#10b981] animate-scan-sweep\"')
    content = content.replace('stagger-1', '[animation-delay:100ms]')
    content = content.replace('stagger-2', '[animation-delay:200ms]')
    content = content.replace('stagger-3', '[animation-delay:300ms]')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file('app/login/page.tsx')
fix_file('app/register/page.tsx')
