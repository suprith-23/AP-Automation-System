const fs = require('fs');
let p = 'n:/PGM/AP-Automation-System/frontend/app/(protected)/dashboard/page.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/if\s*\(role\s*===\s*\(\"Finance Manager\" as any\)\)\s*\{\s*return\s*\(\s*<FinanceManagerDashboard[\s\S]*?\/>\s*\);\s*\}/, '');

fs.writeFileSync(p, c);
console.log('Fixed dashboard page');
