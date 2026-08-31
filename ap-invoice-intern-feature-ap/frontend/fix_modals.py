import os
import re

files_to_fix = [
    r"n:\PGM\AP-Automation-System\frontend\app\(protected)\audit-logs\page.tsx",
    r"n:\PGM\AP-Automation-System\frontend\app\(protected)\payment-queue\page.tsx",
    r"n:\PGM\AP-Automation-System\frontend\app\(protected)\queue-management\page.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\InvoiceEditModal.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\admin\SuperAdminObservability.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\admin\UserManagement.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\finewise\SystemCard.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\reviewer\ValidationWorkbench.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\settings\SettingsPanel.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\settings\components\TDSTab.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\ui\ConfirmDialog.tsx",
]

for filepath in files_to_fix:
    try:
        if not os.path.exists(filepath):
            continue
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Remove backdrop-blur-* classes
        content = re.sub(r'backdrop-blur-[a-z0-9]+', '', content)
        content = re.sub(r'backdrop-blur', '', content)
        
        # Replace translucent backgrounds with solid black scrim
        content = re.sub(r'bg-black/40', 'bg-[#000000]/60', content)
        content = re.sub(r'bg-black/50', 'bg-[#000000]/60', content)
        content = re.sub(r'bg-zinc-900/40', 'bg-[#000000]/60', content)
        content = re.sub(r'bg-zinc-900/50', 'bg-[#000000]/60', content)
        content = re.sub(r'bg-zinc-900/60', 'bg-[#000000]/60', content)

        # Cleanup double spaces from class removals
        content = re.sub(r'\s{2,}', ' ', content)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Removed blur from {os.path.basename(filepath)}")
    except Exception as e:
        print(f"Failed on {filepath}: {e}")

print("Fixed modals")
