import os
import re

count = 0
for root, dirs, files in os.walk(r'n:\PGM\AP-Automation-System\frontend'):
    if 'node_modules' in root or '.git' in root or '.next' in root:
        continue
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find <th> tags with py-4 or py-3 and replace with py-2
            new_content = re.sub(r'(<th\b[^>]*className="[^"]*?)\bpy-4\b', r'\1py-2.5', content)
            new_content = re.sub(r'(<th\b[^>]*className="[^"]*?)\bpy-3\b', r'\1py-2.5', new_content)

            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Fixed {file}")
                count += 1

print(f"Fixed table padding in {count} files")
