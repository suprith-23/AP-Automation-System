import json
log_path = r'C:\Users\NITHIN\.gemini\antigravity\brain\f69b479b-ad42-41b1-9237-b77c1b605eb7\.system_generated\logs\transcript_full.jsonl'
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        if '"step_index":124' in line:
            data = json.loads(line)
            for tc in data.get('tool_calls', []):
                args = tc.get('arguments', {})
                if isinstance(args, str):
                    args = json.loads(args)
                if 'TargetFile' in args and 'register' in args['TargetFile']:
                    code = args['CodeContent']
                    with open(r'n:\PGM\AP-Automation-System\frontend\app\register\page.tsx', 'w', encoding='utf-8') as out:
                        out.write(code)
                    print('SUCCESSFULLY RESTORED!')
