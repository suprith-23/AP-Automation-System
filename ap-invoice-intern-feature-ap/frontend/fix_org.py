import re

filepath = r'n:\PGM\AP-Automation-System\frontend\components\admin\OrganizationManagement.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add addStep state
content = content.replace(
    'const [isAddOpen, setIsAddOpen] = useState(false);',
    'const [isAddOpen, setIsAddOpen] = useState(false);\n  const [addStep, setAddStep] = useState(1);'
)

# Reset step in handleAddSubmit success
content = content.replace(
    'setIsAddOpen(false);',
    'setIsAddOpen(false);\n      setAddStep(1);'
)

# Handle X button closing
content = content.replace(
    'onClick={() => setIsAddOpen(false)}',
    'onClick={() => { setIsAddOpen(false); setAddStep(1); }}'
)

modal_body_old = '''            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <Input
                label="Organization Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Beverly"
              />
              <Input
                label="Org Unique Code (Short)"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. BEVERLY"
                className="font-mono uppercase"
              />
              <Input
                label="GST Number (GSTIN)"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="e.g. 29GGGGG1314R1Z0"
                className="font-mono uppercase"
              />
              <div className="flex flex-col gap-1 w-full text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-[#0F0F11] text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  placeholder="e.g. Bangalore, India"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Button variant="ghost" onClick={() => { setIsAddOpen(false); setAddStep(1); }} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={submitting}>
                  Create
                </Button>
              </div>
            </form>'''

modal_body_new = '''            <div className="px-6 pt-4 pb-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  <div className={`h-1.5 w-12 rounded-full transition-colors ${addStep >= 1 ? 'bg-fw-blue' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                  <div className={`h-1.5 w-12 rounded-full transition-colors ${addStep >= 2 ? 'bg-fw-blue' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                </div>
                <span className="text-xs font-bold text-zinc-400">Step {addStep} of 2</span>
              </div>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (addStep === 1) {
                if (!name || !code) return;
                setAddStep(2);
              } else {
                handleAddSubmit(e);
              }
            }} className="px-6 pb-6 space-y-4">
              {addStep === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <Input
                    label="Organization Name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Beverly"
                  />
                  <Input
                    label="Org Unique Code (Short)"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. BEVERLY"
                    className="font-mono uppercase"
                  />
                </div>
              )}
              {addStep === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <Input
                    label="GST Number (GSTIN)"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="e.g. 29GGGGG1314R1Z0"
                    className="font-mono uppercase"
                  />
                  <div className="flex flex-col gap-1 w-full text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Address</label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-[#0F0F11] text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                      placeholder="e.g. Bangalore, India"
                      rows={3}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800">
                {addStep === 1 ? (
                  <Button type="button" variant="ghost" onClick={() => { setIsAddOpen(false); setAddStep(1); }} disabled={submitting}>
                    Cancel
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => setAddStep(1)} disabled={submitting}>
                    Back
                  </Button>
                )}
                
                {addStep === 1 ? (
                  <Button type="button" variant="primary" onClick={() => {
                    if (name && code) setAddStep(2);
                  }}>
                    Next
                  </Button>
                ) : (
                  <Button type="submit" variant="primary" loading={submitting}>
                    Create
                  </Button>
                )}
              </div>
            </form>'''

content = content.replace(modal_body_old, modal_body_new)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated OrganizationManagement.tsx")
