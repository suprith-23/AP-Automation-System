import json
log_path = r'C:\Users\NITHIN\.gemini\antigravity\brain\f69b479b-ad42-41b1-9237-b77c1b605eb7\.system_generated\logs\transcript_full.jsonl'
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        if '"step_index":124' in line:
            print(line[:500])
            print('...')
            print(line[-500:])
