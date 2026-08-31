import re

filepath = r'n:\PGM\AP-Automation-System\frontend\components\settings\components\SecurityTab.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

color_mapping = '''
  const getRoleColor = (roleStr: string) => {
    if (!roleStr) return "from-blue-500 to-indigo-600 shadow-blue-500/20";
    const key = roleStr.toLowerCase().trim();
    if (key === "admin") return "from-fw-green to-fw-green-deep shadow-fw-green/20";
    if (key === "super admin") return "from-fw-amber to-fw-amber-deep shadow-fw-amber/20";
    if (key === "approver") return "from-fw-purple to-fw-purple-deep shadow-fw-purple/20";
    if (key === "reviewer") return "from-fw-pink to-fw-pink-deep shadow-fw-pink/20";
    if (key === "auditor") return "from-fw-blue to-fw-blue-deep shadow-fw-blue/20";
    return "from-blue-500 to-indigo-600 shadow-blue-500/20";
  };
'''

content = content.replace('  if (!user) return null;', color_mapping + '\n  if (!user) return null;')

content = content.replace(
    'className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-3xl shadow-lg shadow-blue-500/20"',
    'className={`w-24 h-24 rounded-full bg-gradient-to-tr flex items-center justify-center text-white font-extrabold text-3xl shadow-lg ${getRoleColor(user?.role)}`}'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated SecurityTab.tsx")
