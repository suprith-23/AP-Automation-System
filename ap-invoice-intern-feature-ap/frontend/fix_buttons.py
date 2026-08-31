import re

filepath = r'n:\PGM\AP-Automation-System\frontend\app\globals.css'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

btn_css = '''  /* ─────────────────────────────────────────────────────────────
   * BUTTON SYSTEM — Every variant uses stadium (pill) geometry
   * ──────────────────────────────────────────────────────────── */
  .btn-base {
    @apply inline-flex items-center justify-center gap-2 font-bold
           rounded-full whitespace-nowrap select-none
           transition-all duration-200 outline-none shadow-sm bg-noise
           disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none disabled:transform-none
           hover:shadow-md hover:-translate-y-[1px]
           focus-visible:ring-2 focus-visible:ring-offset-2
           active:scale-[0.98] active:translate-y-0 active:shadow-sm;
    min-height: 44px; /* WCAG touch target */
    padding: 0 1.25rem;
  }

  .btn-sm {
    @apply text-xs;
    min-height: 34px;
    padding: 0 0.875rem;
    font-size: 0.75rem;
  }

  .btn-md {
    @apply text-sm;
    min-height: 40px;
    padding: 0 1.125rem;
  }

  .btn-lg {
    @apply text-base;
    min-height: 48px;
    padding: 0 1.5rem;
  }

  /* Primary — solid fill */
  .btn-primary {
    @apply btn-base bg-[#0A0A0A] text-white hover:bg-zinc-800;
  }
  .dark .btn-primary {
    @apply bg-white text-[#0A0A0A] hover:bg-zinc-200;
  }
'''

content = content.replace('  /* Secondary — transparent + border */\n  .btn-secondary {', btn_css + '\n  /* Secondary — transparent + border */\n  .btn-secondary {')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Button CSS")
