import re

filepath = r'n:\PGM\AP-Automation-System\frontend\components\layout\Sidebar.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Role colors mapping logic
role_colors_snippet = '''
  const roleColors: Record<string, string> = {
    admin: "bg-fw-green/10 text-fw-green-deep dark:bg-fw-green/20 dark:text-fw-green-dark border-fw-green/50 shadow-[0_0_8px_rgba(57,227,93,0.4)] font-semibold",
    "super admin": "bg-fw-amber/10 text-fw-amber-deep dark:bg-fw-amber/20 dark:text-fw-amber-dark border-fw-amber/50 shadow-[0_0_8px_rgba(255,184,0,0.4)] font-semibold",
    approver: "bg-fw-purple/10 text-fw-purple-deep dark:bg-fw-purple/20 dark:text-fw-purple-dark border-fw-purple/50 shadow-[0_0_8px_rgba(155,107,255,0.4)] font-semibold",
    reviewer: "bg-fw-pink/10 text-fw-pink-deep dark:bg-fw-pink/20 dark:text-fw-pink-dark border-fw-pink/50 shadow-[0_0_8px_rgba(255,62,165,0.4)] font-semibold",
    auditor: "bg-fw-blue/10 text-fw-blue-deep dark:bg-fw-blue/20 dark:text-fw-blue-dark border-fw-blue/50 shadow-[0_0_8px_rgba(46,139,255,0.4)] font-semibold",
  };
  const roleIndicatorColors: Record<string, string> = {
    admin: "bg-fw-green shadow-[0_0_8px_rgba(57,227,93,0.4)]",
    "super admin": "bg-fw-amber shadow-[0_0_8px_rgba(255,184,0,0.4)]",
    approver: "bg-fw-purple shadow-[0_0_8px_rgba(155,107,255,0.4)]",
    reviewer: "bg-fw-pink shadow-[0_0_8px_rgba(255,62,165,0.4)]",
    auditor: "bg-fw-blue shadow-[0_0_8px_rgba(46,139,255,0.4)]",
  };

  const getActiveClasses = () => {
    if (!currentUser?.role) return "bg-blue-50/70 text-blue-600 border border-blue-100/50 shadow-sm font-semibold";
    const key = currentUser.role.toLowerCase().trim();
    return roleColors[key] || "bg-blue-50/70 text-blue-600 border border-blue-100/50 shadow-sm font-semibold";
  };
  
  const getIndicatorClasses = () => {
    if (!currentUser?.role) return "bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]";
    const key = currentUser.role.toLowerCase().trim();
    return roleIndicatorColors[key] || "bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]";
  };
'''

content = content.replace('const visibleItems = navItems.filter((item) => allowedTabs.includes(item.id));', 'const visibleItems = navItems.filter((item) => allowedTabs.includes(item.id));\n' + role_colors_snippet)

content = content.replace(
    'isSelected\n              ? "bg-blue-50/70 text-blue-600 border border-blue-100/50 shadow-sm font-semibold"\n              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent"',
    'isSelected ? getActiveClasses() : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent"'
)
content = content.replace(
    'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]',
    '${getIndicatorClasses()}'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Sidebar.tsx")
