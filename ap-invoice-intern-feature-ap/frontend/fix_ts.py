import sys

f1 = 'n:/PGM/AP-Automation-System/frontend/app/(protected)/dashboard/page.tsx'
with open(f1, 'r', encoding='utf-8') as f:
    c1 = f.read()
c1 = c1.replace('role === "Finance Manager"', 'role === ("Finance Manager" as any)')
with open(f1, 'w', encoding='utf-8') as f:
    f.write(c1)

f2 = 'n:/PGM/AP-Automation-System/frontend/components/finewise/HeroChartCard.tsx'
with open(f2, 'r', encoding='utf-8') as f:
    c2 = f.read()
c2 = c2.replace('role === "Finance Manager"', 'role === ("Finance Manager" as any)')
with open(f2, 'w', encoding='utf-8') as f:
    f.write(c2)

f3 = 'n:/PGM/AP-Automation-System/frontend/app/invoices/[id]/page.tsx'
with open(f3, 'r', encoding='utf-8') as f:
    c3 = f.read()
c3 = c3.replace('response.headers["content-disposition"]', '(response.headers["content-disposition"] as string)')
with open(f3, 'w', encoding='utf-8') as f:
    f.write(c3)
