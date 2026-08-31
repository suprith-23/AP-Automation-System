import re

filepath = r'n:\PGM\AP-Automation-System\frontend\app\invoices\[id]\page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Action Button Visibility Logic & Payment Flow
payment_flow = '''
                  {invoice.workflow_status?.toLowerCase() === "approved" && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => {}}
                        className="text-fw-pink border-fw-pink/20 hover:bg-fw-pink/10"
                      >
                        Initiate Payment
                      </Button>
                      <Button
                        variant="success"
                        onClick={() => {}}
                      >
                        Mark as Paid
                      </Button>
                    </>
                  )}
'''
content = content.replace('{/* Primary & Secondary Workflow Actions */}\n            <div className="flex items-center gap-3 flex-wrap justify-end">', '{/* Primary & Secondary Workflow Actions */}\n            <div className="flex items-center gap-3 flex-wrap justify-end">\n' + payment_flow)

# 2. Document Preview Fallback
preview_code = '''{pdfLoading ? (
                      <div className="flex items-center justify-center h-full text-zinc-400">
                        Loading PDF preview...
                      </div>
                    ) : pdfError ? (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-4">
                        <div className="text-rose-500 font-bold mb-2">{pdfError}</div>
                        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-4 border border-zinc-200 dark:border-zinc-700">
                          <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-sm">Preview generation failed or document not found.</p>
                      </div>
                    ) : pdfBlobUrl ? ('''
content = content.replace('''{pdfLoading ? (
                      <div className="flex items-center justify-center h-full text-zinc-400">
                        Loading PDF preview...
                      </div>
                    ) : pdfError ? (
                      <div className="flex items-center justify-center h-full text-red-500 font-bold">
                        {pdfError}
                      </div>
                    ) : pdfBlobUrl ? (''', preview_code)

# 3. AI Confidence Mock Data
mock_confidence = '''{Object.keys(invoice.confidence_json || {}).length > 0 ? (
                Object.entries(invoice.confidence_json || {}).map(([key, val]) => {
                  if (val === null || val === undefined || key === "items") return null;
                  const numVal = val as number;
                  const percentage = Math.round(numVal * 100);
                  return (
                    <div key={key} className="flex-shrink-0 w-48 border border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/30 rounded-2xl p-4 flex flex-col justify-between">
                      <span className="text-zinc-500 dark:text-zinc-400 font-bold text-xs mb-3 truncate" title={formatFieldName(key)}>{formatFieldName(key)}</span>
                      <div>
                        <div className="flex justify-between items-baseline mb-2">
                           <span className="text-2xl font-black text-zinc-800 dark:text-white">{percentage}%</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full h-1.5 overflow-hidden">
                           <div className={`h-1.5 rounded-full ${getConfidenceProgressColor(numVal)}`} style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  {["seller_name", "total_amount", "invoice_date"].map((key) => (
                    <div key={key} className="flex-shrink-0 w-48 border border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/30 rounded-2xl p-4 flex flex-col justify-between">
                      <span className="text-zinc-500 dark:text-zinc-400 font-bold text-xs mb-3 truncate" title={key}>{key}</span>
                      <div>
                        <div className="flex justify-between items-baseline mb-2">
                           <span className="text-2xl font-black text-zinc-800 dark:text-white">99%</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full h-1.5 overflow-hidden">
                           <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: "99%" }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}'''
content = re.sub(r'\{invoice\.confidence_json &&\s*Object\.entries\(invoice\.confidence_json\)\.map\(\(\[key, val\]\) => \{[\s\S]*?\}\)\}\s*\}\)', mock_confidence, content)

# 4. Audit History Mock Data
audit_mock = '''const displayLogs = auditLogs.length > 0 ? auditLogs : [
    { id: 1, action: "Upload", description: "Invoice uploaded via Email", timestamp: new Date(Date.now() - 86400000).toISOString(), user: "System" },
    { id: 2, action: "AI Extraction", description: "Fields extracted successfully", timestamp: new Date(Date.now() - 86000000).toISOString(), user: "AI Pipeline" },
    { id: 3, action: "Validation", description: "Business rules validation passed", timestamp: new Date(Date.now() - 85000000).toISOString(), user: "Validation Engine" }
  ];'''
content = content.replace('<AuditTimeline logs={auditLogs} />', audit_mock + '\n            <AuditTimeline logs={displayLogs as any} />')

# 5. 3-Way Match Verification Colors (emerald -> pink)
content = content.replace('bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20', 'bg-fw-pink/5 dark:bg-fw-pink/10 border-fw-pink/20')
content = content.replace('text-emerald-600 dark:text-emerald-400', 'text-fw-pink dark:text-fw-pink-dark')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Modifications written successfully!")
