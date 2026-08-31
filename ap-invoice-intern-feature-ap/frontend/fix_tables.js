const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) {
            if (f !== 'node_modules' && f !== '.next') walk(dirPath, callback);
        } else if (f.endsWith('.tsx')) {
            callback(dirPath);
        }
    });
}

const targetClass = 'border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-black uppercase tracking-wider text-[10px]';

walk('n:/PGM/AP-Automation-System/frontend/', (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Replace tr backgrounds
    let newContent = content.replace(/className="bg-\[var\(--role-accent\)\].*?"/g, 'className="' + targetClass + '"');
    newContent = newContent.replace(/className="bg-\[#EC4899\].*?"/g, 'className="' + targetClass + '"');
    newContent = newContent.replace(/className="bg-fw-pink.*?"/g, 'className="' + targetClass + '"');

    // Remove rounded corners on th
    newContent = newContent.replace(/rounded-l-full\s*/g, '');
    newContent = newContent.replace(/rounded-r-full\s*/g, '');
    newContent = newContent.replace(/rounded-l-2xl\s*/g, '');
    newContent = newContent.replace(/rounded-r-2xl\s*/g, '');

    // Ensure all th have standard padding if they have py-
    newContent = newContent.replace(/<th className="py-3(\.5)?\s*(.*?)"/g, '<th className="py-3 px-4 "');

    // Also remove the extra text-[10px] tracking-widest... from the first task if it got in there
    newContent = newContent.replace(/text-\[10px\] tracking-widest uppercase opacity-90 font-black\s*/g, '');

    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent);
        console.log('Updated', filePath);
    }
});
