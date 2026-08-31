const fs = require('fs');
let p = 'n:/PGM/AP-Automation-System/frontend/components/finewise/FinanceManagerDashboard.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/role="Finance Manager"/g, 'role={"Finance Manager" as any}');

fs.writeFileSync(p, c);
console.log('Fixed FinanceManagerDashboard');
