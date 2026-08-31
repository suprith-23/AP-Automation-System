import re

filepath = r'n:\PGM\AP-Automation-System\frontend\components\ui\StatusPill.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'bg-fw-([a-z]+) dark:bg-fw-\1-deep', r'bg-fw-\1/20 dark:bg-fw-\1/20', content)
content = re.sub(r'bg-purple-100 dark:bg-purple-950/40', r'bg-purple-500/20 dark:bg-purple-500/20', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("StatusPill updated")
