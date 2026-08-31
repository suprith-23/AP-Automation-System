import sys

file_path = 'n:/PGM/AP-Automation-System/frontend/components/admin/SuperAdminObservability.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    ('// Support / Impersonation Mode State', '/* Support / Impersonation Mode State */'),
    ('// Search State', '/* Search State */'),
    ('// Org Provisioning Modal ────────────────────────────────────────', '/* Org Provisioning Modal */'),
    ('// Org Provisioning', '/* Org Provisioning */'),
    ('// ── Icons (inline SVG, no extra dep) ──────────────────────────────────────', '/* Icons */'),
    ('// ── Impersonation Active Banner ───────────────────────────────────', '/* Impersonation Active Banner */'),
    ('// ── Top bar ───────────────────────────────────────────────────────', '/* Top bar */'),
    ('// ── Stat Cards — match DashboardStats.tsx fw-card pattern ───────', '/* Stat Cards */'),
    ('// ── Cross-Tenant Global Search ────────────────────────────────────', '/* Cross-Tenant Global Search */'),
    ('// ── Tenant Registry + Detail Panel ───────────────────────────────', '/* Tenant Registry + Detail Panel */'),
    ('// ── Support Mode Modal ────────────────────────────────────────────', '/* Support Mode Modal */'),
    ('// No data available', '/* No data available */'),
    ('// Primary action — matches existing "primary" button variant', '/* Primary action */'),
    ('// Warning action — uses canonical warning button, not a bespoke amber', '/* Warning action */')
]

for old, new in replacements:
    content = content.replace(old, new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
