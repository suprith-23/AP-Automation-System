import re
import json

log_path = r'C:\Users\NITHIN\.gemini\antigravity\brain\f69b479b-ad42-41b1-9237-b77c1b605eb7\.system_generated\logs\transcript_full.jsonl'
with open(log_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Find the last occurrence of write_to_file for register/page.tsx
pattern = r'"name":"write_to_file","arguments":\{.*?"CodeContent":"(.*?)","Description"'
matches = list(re.finditer(pattern, text, re.DOTALL))
if matches:
    last_match = matches[-1]
    code = last_match.group(1)
    code_str = '"' + code + '"'
    try:
        real_code = json.loads(code_str)
        with open(r'n:\PGM\AP-Automation-System\frontend\app\register\page.tsx', 'w', encoding='utf-8') as out:
            out.write(real_code)
        print('Restored successfully!')
    except Exception as e:
        print('Error unescaping:', e)
else:
    print('No regex match found.')
