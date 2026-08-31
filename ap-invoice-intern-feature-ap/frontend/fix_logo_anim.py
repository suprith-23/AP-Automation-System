import re

filepath = r'n:\PGM\AP-Automation-System\frontend\components\layout\Sidebar.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add usePathname to imports
if 'usePathname' not in content:
    content = content.replace('import { useRouter } from "next/navigation";', 'import { useRouter, usePathname } from "next/navigation";')
elif 'usePathname' not in content and 'next/navigation' in content:
    content = content.replace('useRouter', 'useRouter, usePathname')

# Add animation state
state_code = '''  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 800);
    return () => clearTimeout(timer);
  }, [pathname]);
'''

content = content.replace('  const router = useRouter();', state_code)

# Add animate-pulse or spin to logo
logo_svg_old = '''<svg className="w-4.5 h-4.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 12h10L9 22l13-10H12l3-10z" />
                </svg>'''
logo_svg_new = '''<svg className={`w-4.5 h-4.5 text-blue-600 transition-all duration-700 ${isNavigating ? 'scale-110 rotate-180 text-fw-blue' : 'scale-100 rotate-0'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 12h10L9 22l13-10H12l3-10z" />
                </svg>'''
content = content.replace(logo_svg_old, logo_svg_new)

# Note: The logo is repeated twice in Sidebar.tsx (one for expanded, one for collapsed)
# We can replace both occurrences
logo_svg_collapsed_old = '''<svg className="w-4.5 h-4.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 12h10L9 22l13-10H12l3-10z" />
            </svg>'''
logo_svg_collapsed_new = '''<svg className={`w-4.5 h-4.5 text-blue-600 transition-all duration-700 ${isNavigating ? 'scale-110 rotate-180 text-fw-blue' : 'scale-100 rotate-0'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 12h10L9 22l13-10H12l3-10z" />
            </svg>'''
content = content.replace(logo_svg_collapsed_old, logo_svg_collapsed_new)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Sidebar.tsx for Logo Animation")
