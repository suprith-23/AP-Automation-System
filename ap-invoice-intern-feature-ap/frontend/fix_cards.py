import re

filepath = r'n:\PGM\AP-Automation-System\frontend\app\globals.css'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace .fw-card
content = re.sub(
    r'\.fw-card \{[^}]+\}',
    r'.fw-card {\n    @apply rounded-[22px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 transition-all duration-200 bg-noise;\n  }',
    content
)

# Replace .fw-card-colored
content = re.sub(
    r'\.fw-card-colored \{[^}]+\}',
    r'.fw-card-colored {\n    @apply rounded-[22px] p-5 flex flex-col gap-4 border border-black/5 dark:border-white/5 shadow-sm bg-noise transition-all duration-200;\n  }',
    content
)

# Replace .premium-card
content = re.sub(
    r'\.premium-card \{[^}]+\}',
    r'.premium-card {\n    @apply rounded-[22px] bg-white border border-zinc-200 shadow-sm transition-all duration-250 bg-noise;\n  }',
    content
)

# Replace .dark .premium-card
content = re.sub(
    r'\.dark \.premium-card \{[^}]+\}',
    r'.dark .premium-card {\n    @apply bg-[#18181b] border-zinc-800;\n  }',
    content
)

# Replace .glass-card - No glassmorphism allowed
content = re.sub(
    r'\.glass-card \{[^}]+\}',
    r'.glass-card {\n    /* Glassmorphism removed per constraints */\n    @apply rounded-[22px] bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 shadow-md bg-noise;\n  }',
    content
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Card CSS")
