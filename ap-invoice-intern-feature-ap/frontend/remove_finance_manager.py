import sys

f = 'n:/PGM/AP-Automation-System/frontend/app/(protected)/dashboard/page.tsx'
with open(f, 'r', encoding='utf-8') as file:
    content = file.read()

content = content.replace('import FinanceManagerDashboard from "../../../components/finewise/FinanceManagerDashboard";\n', '')
content = content.replace('{role === "Finance Manager" && <FinanceManagerDashboard />}', '')
content = content.replace('{role === ("Finance Manager" as any) && <FinanceManagerDashboard />}', '')

with open(f, 'w', encoding='utf-8') as file:
    file.write(content)
