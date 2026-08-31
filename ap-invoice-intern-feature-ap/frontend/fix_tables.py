import os
import re

files_to_fix = [
    r"n:\PGM\AP-Automation-System\frontend\app\(protected)\audit-logs\page.tsx",
    r"n:\PGM\AP-Automation-System\frontend\app\(protected)\payment-queue\page.tsx",
    r"n:\PGM\AP-Automation-System\frontend\app\(protected)\queue-management\page.tsx",
    r"n:\PGM\AP-Automation-System\frontend\app\invoices\[id]\page.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\InvoiceUpload.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\PurchaseOrderTable.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\admin\OrganizationManagement.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\admin\RegistrationApprovals.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\admin\UserManagement.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\analytics\AnalyticsModule.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\enterprise\EnterpriseModule.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\finewise\AdminDashboard.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\finewise\SuperAdminDashboard.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\purchase_orders\PurchaseOrderManager.tsx",
    r"n:\PGM\AP-Automation-System\frontend\components\reviewer\ValidationWorkbench.tsx"
]

for filepath in files_to_fix:
    try:
        if not os.path.exists(filepath):
            continue
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # We look for <thead*> followed by <tr*> and replace with <thead className="bg-fw-pink text-white bg-noise"><tr>
        # But we must preserve the <tr> content if it's separated, or just replace both.
        # It's safer to just replace <thead*> and <tr*> with specific classes.
        
        # Replace <thead className="..."> or <thead> with just <thead>
        content = re.sub(r'<thead[^>]*>', r'<thead>', content)
        
        # Now replace <thead>\n *<tr...> with <thead>\n<tr className="bg-fw-pink text-white bg-noise">
        content = re.sub(r'<thead>\s*<tr[^>]*>', r'<thead>\n                <tr className="bg-fw-pink text-white bg-noise">', content)

        # Also strip text-zinc-500 or text-zinc-900 from <th> elements inside thead so they inherit white
        # We can just let CSS specificity do it, but to be sure:
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {os.path.basename(filepath)}")
    except Exception as e:
        print(f"Failed on {filepath}: {e}")

print("Fixed table headers")
