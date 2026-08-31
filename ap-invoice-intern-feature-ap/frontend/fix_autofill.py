import re

filepath = r'n:\PGM\AP-Automation-System\frontend\app\globals.css'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

autofill_css = '''
/* ── Fix Chrome Autofill Invisible Text ── */
input:-webkit-autofill,
input:-webkit-autofill:hover, 
input:-webkit-autofill:focus, 
input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 30px transparent inset !important;
  transition: background-color 5000s ease-in-out 0s;
  -webkit-text-fill-color: inherit !important;
}
'''

content = content.replace('  /* Global focus-visible ring for keyboard users */', autofill_css + '\n  /* Global focus-visible ring for keyboard users */')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated globals.css with autofill fix")
