const fs = require('fs');
let p = 'n:/PGM/AP-Automation-System/frontend/app/invoices/[id]/page.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/const blob = new Blob\(\[response\.data\], \{ type: blobType \}\);/, 'const blob = new Blob([response.data], { type: blobType as string });');

fs.writeFileSync(p, c);
console.log('Fixed invoice page');
