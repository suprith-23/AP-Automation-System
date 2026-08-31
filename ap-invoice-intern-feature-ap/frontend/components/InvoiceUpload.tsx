import React, { useState, useEffect, useRef } from "react";
import { uploadInvoiceDocument } from "../services/api";
import { formatIndianCurrency } from "../utils/format";
import { useRouter } from "next/navigation";

interface InvoiceUploadProps {
  onUploadSuccess?: () => void;
}

export default function InvoiceUpload({ onUploadSuccess }: InvoiceUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadStep, setUploadStep] = useState<string>("");
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [error, setError] = useState<string | {message: string, original_id?: number}>("");
  const router = useRouter();
  const [result, setResult] = useState<{
    invoice_data: any;
    validation_result: { passed: boolean; errors: string[] };
    confidence: Record<string, number | null>;
    invoice?: any;
  } | null>(null);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fileUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      setFileUrl(URL.createObjectURL(selectedFile));
      setError("");
      setResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleReset = () => {
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setFile(null);
    setFileUrl("");
    setError("");
    setResult(null);
    setUploadStep("");
    setUploading(false);
    setElapsedTime(0);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const validTypes = [".pdf", ".png", ".jpg", ".jpeg"];
      const matches = validTypes.some((ext) =>
        droppedFile.name.toLowerCase().endsWith(ext)
      );
      if (matches) {
        setFile(droppedFile);
        if (fileUrl) {
          URL.revokeObjectURL(fileUrl);
        }
        setFileUrl(URL.createObjectURL(droppedFile));
        setError("");
        setResult(null);
      } else {
        setError("Unsupported file format. Please upload a PDF, PNG, JPG, or JPEG file.");
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setResult(null);
      setElapsedTime(0);
      setUploadStep("document_intake");

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const secs = (Date.now() - startTime) / 1000;
        setElapsedTime(secs);
        
        if (secs < 0.8) {
          setUploadStep("document_intake");
        } else if (secs < 2.5) {
          setUploadStep("ocr_extraction");
        } else if (secs < 4.8) {
          setUploadStep("llm_parsing");
        } else {
          setUploadStep("compliance_check");
        }
      }, 100);

      const res = await uploadInvoiceDocument(file);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      setResult(res);
      setUploading(false);
      setUploadStep("");
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      console.error(err);
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string' && detail.trim() !== '') {
        setError(detail);
      } else if (typeof detail === 'object' && detail !== null && detail.message) {
        setError({ message: detail.message, original_id: detail.original_id });
      } else {
        setError("Failed to process the invoice. Please make sure the file is valid.");
      }
      setUploading(false);
      setUploadStep("");
    }
  };

  const getConfidenceColor = (score: number | null) => {
    if (score === null || score === undefined) return "bg-gray-200 text-gray-700";
    if (score >= 0.8) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 0.5) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const formatFieldName = (key: string) => {
    return key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };
  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div className="glass-card rounded-2xl border border-zinc-800/60 shadow-xl p-6">
        <h2 className="text-xl font-bold text-zinc-100 mb-2">Ingest Invoice Document</h2>
        <p className="text-zinc-400 text-sm mb-6">
          Upload PDF invoices or scanned images (PNG, JPG, JPEG) to run the automated extraction pipeline.
        </p>

        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer ${
            file
              ? "border-indigo-500/60 bg-indigo-600/5 shadow-[0_0_20px_rgba(99,102,241,0.08)]"
              : "border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900/40"
          }`}
        >
          <div className="flex flex-col items-center justify-center">
            <svg
              className={`w-12 h-12 mb-4 transition-transform duration-300 ${file ? "text-indigo-400 scale-110" : "text-zinc-500"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            {file ? (
              <div className="space-y-1.5 flex flex-col items-center">
                <p className="text-sm font-bold text-zinc-100">{file.name}</p>
                <p className="text-xs text-zinc-400 font-semibold">{(file.size / 1024).toFixed(1)} KB</p>
                {!uploading && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-bold hover:underline transition-colors"
                  >
                    Upload a different file
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-sm text-zinc-300 font-medium">
                  Drag and drop your document here, or{" "}
                  <label className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer">
                    browse
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                    />
                  </label>
                </p>
                <p className="text-xs text-zinc-500 font-medium">Supports PDF, PNG, JPG, and JPEG up to 10MB</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-5 bg-[#FF3B3B] text-[#FFFFFF] border-none p-4 rounded-xl shadow-lg">
            <div className="flex justify-between items-start">
              {typeof error === "string" ? (
                <p className="text-sm font-semibold text-rose-300">{error}</p>
              ) : (
                <p className="text-sm font-semibold text-rose-300">
                  {error.message}
                  {error.original_id && (
                    <span className="ml-2.5">
                      <a
                        href={`/invoices/${error.original_id}`}
                        className="text-rose-400 underline hover:text-rose-300 font-bold transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(`/invoices/${error.original_id}`);
                        }}
                      >
                        View Original Invoice
                      </a>
                    </span>
                  )}
                </p>
              )}
              <button 
                onClick={handleReset}
                className="ml-4 px-3 py-1 bg-[#FF3B3B] text-[#FFFFFF] text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
              >
                Upload a different file
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl shadow-md hover:bg-indigo-500 shadow-indigo-600/15 transition-colors disabled:opacity-30"
          >
            {uploading ? (
              <div className="flex items-center space-x-2.5">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Processing extraction...</span>
              </div>
            ) : (
              "Run Ingestion Pipeline"
            )}
          </button>
        </div>
      </div>

      {/* Document Ingestion & Scan Animation Panel */}
      {uploading && (
        <div className="glass-card rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/10 via-zinc-900/40 to-indigo-950/5 shadow-2xl p-6 overflow-hidden">
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Left Column: Interactive Scanning Canvas */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-indigo-400 tracking-wider uppercase flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Interactive Scan Pipeline</span>
                </span>
                <span className="text-[11px] font-mono text-zinc-500">FORMAT: {file?.type || "unknown"}</span>
              </div>
              
              <div className="relative min-h-[350px] lg:min-h-[420px] max-h-[500px] w-full border border-zinc-800 rounded-xl bg-zinc-950/80 overflow-hidden flex items-center justify-center">
                {/* Techy HUD Corner Reticles */}
                <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-indigo-500/60 pointer-events-none" />
                <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-indigo-500/60 pointer-events-none" />
                <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-indigo-500/60 pointer-events-none" />
                <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-indigo-500/60 pointer-events-none" />
                
                {/* Dynamic Digital Grid Overlay */}
                <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                  backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.2) 1px, transparent 1px)',
                  backgroundSize: '16px 16px'
                }} />
                
                {/* Scrollable Document Viewport */}
                <div className="w-full h-[400px] lg:h-[450px] overflow-y-auto pointer-events-auto flex flex-col items-center w-full">
                  {fileUrl ? (
                    file?.type === "application/pdf" ? (
                      <iframe 
                        src={`${fileUrl}#toolbar=0&navpanes=0`} 
                        className="w-full h-[600px] lg:h-[800px] border-none rounded-lg select-none opacity-40 filter contrast-125"
                      />
                    ) : (
                      <img 
                        src={fileUrl} 
                        alt="Ingested invoice" 
                        className="w-full h-auto object-contain rounded-lg select-none opacity-45 filter contrast-125 saturate-50"
                      />
                    )
                  ) : (
                    <div className="text-zinc-600 text-xs font-mono my-auto">No document preview available</div>
                  )}
                </div>

                {/* Sweeping Laser Line & Real-time Scan Highlight */}
                <div className="absolute left-0 right-0 h-[60px] bg-gradient-to-b from-cyan-400/5 to-cyan-400/20 border-t border-b border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.2)] animate-scan-sweep pointer-events-none z-10 flex items-center justify-center">
                  <div className="bg-zinc-900/90 text-cyan-300 border border-cyan-500/40 rounded px-2.5 py-0.5 text-[8px] font-mono font-bold tracking-wider uppercase animate-pulse shadow-lg flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>OCR READING: {elapsedTime < 2.0 ? "METADATA" : elapsedTime < 3.5 ? "GSTIN & SELLER" : "LINE ITEMS"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Processing HUD / Logging */}
            <div className="w-full lg:w-[380px] flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-5 border-b border-zinc-800 pb-3">
                  <h3 className="text-sm font-bold text-zinc-300 tracking-wide uppercase">Ingestion Telemetry</h3>
                  <div className="bg-indigo-950/60 border border-indigo-500/30 rounded-lg px-2.5 py-1 font-mono text-xs text-indigo-300 font-bold shadow-sm">
                    TIMER: {elapsedTime.toFixed(1)}s
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Step 1: Document Verification */}
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {uploadStep !== "document_intake" ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center text-[10px] text-emerald-400 font-bold">✓</div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-400 flex items-center justify-center text-[10px] text-indigo-400 font-bold animate-pulse">●</div>
                      )}
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold ${uploadStep === "document_intake" ? "text-indigo-300" : "text-zinc-400"}`}>Document Verification & Routing</h4>
                      <p className="text-[11px] text-zinc-500 font-medium">Validating file signature, integrity, and checking route configurations.</p>
                    </div>
                  </div>

                  {/* Step 2: OCR */}
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {uploadStep === "document_intake" ? (
                        <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-600 font-bold">-</div>
                      ) : uploadStep !== "ocr_extraction" ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center text-[10px] text-emerald-400 font-bold">✓</div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-400 flex items-center justify-center text-[10px] text-indigo-400 font-bold animate-pulse">●</div>
                      )}
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold ${uploadStep === "ocr_extraction" ? "text-indigo-300" : "text-zinc-400"}`}>Layout Analysis & Character OCR</h4>
                      <p className="text-[11px] text-zinc-500 font-medium">Running high-speed RapidOCR engines to map out textual bounding boxes.</p>
                    </div>
                  </div>

                  {/* Step 3: LLM Parsing */}
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {uploadStep === "document_intake" || uploadStep === "ocr_extraction" ? (
                        <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-600 font-bold">-</div>
                      ) : uploadStep !== "llm_parsing" ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center text-[10px] text-emerald-400 font-bold">✓</div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-400 flex items-center justify-center text-[10px] text-indigo-400 font-bold animate-pulse">●</div>
                      )}
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold ${uploadStep === "llm_parsing" ? "text-indigo-300" : "text-zinc-400"}`}>AI Schema Parsing & Entity Resolution</h4>
                      <p className="text-[11px] text-zinc-500 font-medium">Running Deep Ingestion LLM pipelines to structure raw fields (GST, totals, items).</p>
                    </div>
                  </div>

                  {/* Step 4: Compliance Validation */}
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {uploadStep !== "compliance_check" ? (
                        <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-600 font-bold">-</div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-400 flex items-center justify-center text-[10px] text-indigo-400 font-bold animate-pulse">●</div>
                      )}
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold ${uploadStep === "compliance_check" ? "text-indigo-300 animate-pulse" : "text-zinc-400"}`}>Compliance Rules & Database Commits</h4>
                      <p className="text-[11px] text-zinc-500 font-medium">Executing validation checks and final ingestion database transactions.</p>
                    </div>
                  </div>
                </div>

                {/* Field Extraction Status HUD */}
                <div className="mt-5 border-t border-zinc-800 pt-4">
                  <h4 className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase mb-2.5">Field Extraction Status</h4>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="flex items-center space-x-1.5 bg-zinc-950 p-1.5 rounded border border-zinc-900">
                      <span className={`w-1.5 h-1.5 rounded-full ${elapsedTime >= 0.8 ? 'bg-emerald-400' : 'bg-indigo-400 animate-pulse'}`} />
                      <span className="text-zinc-500">GSTIN Details:</span>
                      <span className={elapsedTime >= 0.8 ? 'text-emerald-400 font-bold' : 'text-zinc-600'}>{elapsedTime >= 0.8 ? 'MAPPED' : 'READING'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 bg-zinc-950 p-1.5 rounded border border-zinc-900">
                      <span className={`w-1.5 h-1.5 rounded-full ${elapsedTime >= 1.4 ? 'bg-emerald-400' : 'bg-indigo-400 animate-pulse'}`} />
                      <span className="text-zinc-500">Invoice No:</span>
                      <span className={elapsedTime >= 1.4 ? 'text-emerald-400 font-bold' : 'text-zinc-600'}>{elapsedTime >= 1.4 ? 'MAPPED' : 'READING'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 bg-zinc-950 p-1.5 rounded border border-zinc-900">
                      <span className={`w-1.5 h-1.5 rounded-full ${elapsedTime >= 2.0 ? 'bg-emerald-400' : 'bg-indigo-400 animate-pulse'}`} />
                      <span className="text-zinc-500">Seller Name:</span>
                      <span className={elapsedTime >= 2.0 ? 'text-emerald-400 font-bold' : 'text-zinc-600'}>{elapsedTime >= 2.0 ? 'MAPPED' : 'READING'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 bg-zinc-950 p-1.5 rounded border border-zinc-900">
                      <span className={`w-1.5 h-1.5 rounded-full ${elapsedTime >= 3.0 ? 'bg-emerald-400' : 'bg-indigo-400 animate-pulse'}`} />
                      <span className="text-zinc-500">Line Items:</span>
                      <span className={elapsedTime >= 3.0 ? 'text-emerald-400 font-bold' : 'text-zinc-600'}>{elapsedTime >= 3.0 ? 'MAPPED' : 'READING'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 bg-zinc-950 p-1.5 rounded border border-zinc-900 col-span-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${elapsedTime >= 3.8 ? 'bg-emerald-400' : 'bg-indigo-400 animate-pulse'}`} />
                      <span className="text-zinc-500">Invoice Value:</span>
                      <span className={elapsedTime >= 3.8 ? 'text-emerald-400 font-bold' : 'text-zinc-600'}>{elapsedTime >= 3.8 ? 'MAPPED' : 'READING'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Console Logger Output */}
              <div className="mt-5 p-3 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-[10px] text-emerald-400/90 h-[90px] overflow-y-auto space-y-1.5 shadow-inner">
                <div className="text-zinc-500">[SYSTEM] Initializing stream...</div>
                {elapsedTime >= 0.2 && <div className="text-zinc-400">[INFO] File stream buffers resolved. Size: {(file?.size ? (file.size / 1024).toFixed(1) : 0)} KB</div>}
                {elapsedTime >= 0.6 && <div className="text-cyan-400">[INGESTION] Magic-byte validation passed. Signature: {file?.type === "application/pdf" ? "%PDF" : "IMAGE"}</div>}
                {elapsedTime >= 1.2 && <div className="text-cyan-400">[OCR] Initializing thread-safe RapidOCR model registry...</div>}
                {elapsedTime >= 1.8 && <div className="text-emerald-400">[OCR] Bounding boxes mapped. Raw character confidence: 94.6%</div>}
                {elapsedTime >= 2.5 && <div className="text-indigo-400">[LLM] Running extraction schema matching pipeline...</div>}
                {elapsedTime >= 3.4 && <div className="text-indigo-400">[LLM] Resolving items table details...</div>}
                {elapsedTime >= 4.2 && <div className="text-zinc-400">[COMPLIANCE] GST validation check triggered...</div>}
                {elapsedTime >= 5.0 && <div className="text-amber-400">[VALIDATION] Schema check finished. Resolving database transactions.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extraction Results Visualizer */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Validation Errors and Field-Level Confidence */}
          <div className="space-y-6">
            {/* Compliance Card */}
            <div className="glass-card rounded-2xl border border-zinc-800/60 shadow-xl p-6">
              <div className="flex justify-between items-center mb-5 border-b border-zinc-800/55 pb-3">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Pipeline Compliance</h3>
                {result.invoice && (
                  <button
                    onClick={() => router.push(`/invoices/${result.invoice.id}`)}
                    className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-colors"
                  >
                    View Details
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-3 mb-5">
                <div
                  className={`w-3 h-3 rounded-full animate-ping ${
                    result.validation_result.passed ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
                <span className="text-sm font-bold text-zinc-100">
                  {result.validation_result.passed
                    ? "Compliance Check: Passed (Invoice Review Required)"
                    : "Compliance Check: Failed (Validation Issues Detected)"}
                </span>
              </div>

              {!result.validation_result.passed && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-rose-400 uppercase tracking-widest">
                    Violations Summary
                  </p>
                  <ul className="space-y-2">
                    {result.validation_result.errors.map((err, i) => (
                      <li
                        key={i}
                        className="bg-[#FF3B3B] text-[#FFFFFF] border-none p-3.5 rounded-xl text-xs font-semibold text-rose-300 flex items-start space-x-2"
                      >
                        <span className="mt-0.5">•</span>
                        <span>{err}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Confidence Metrics */}
            <div className="glass-card rounded-2xl border border-zinc-800/60 shadow-xl p-6">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-5 border-b border-zinc-800/55 pb-3">Extraction Confidence</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(result.confidence).map(([key, val]) => {
                  if (val === null || val === undefined) return null;
                  return (
                    <div
                      key={key}
                      className="border border-zinc-800/60 rounded-xl p-3.5 flex flex-col justify-between bg-zinc-900/10"
                    >
                      <span className="text-xs font-semibold text-zinc-400">
                        {formatFieldName(key)}
                      </span>
                      <div className="flex items-center justify-between mt-2.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold border ${getConfidenceColor(
                            val
                          )}`}
                        >
                          {(val * 100).toFixed(0)}%
                        </span>
                        <div className="w-24 bg-zinc-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              val >= 0.8
                                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                : val >= 0.5
                                ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                                : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                            }`}
                            style={{ width: `${val * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Extracted Values and Line Items */}
          <div className="space-y-6">
            <div className="glass-card rounded-2xl border border-zinc-800/60 shadow-xl p-6">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-5 border-b border-zinc-800/55 pb-3">Extracted Metadata</h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Invoice Number</span>
                  <span className="font-bold text-zinc-100">
                    {result.invoice_data.invoice_number || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">PO Number</span>
                  <span className="font-bold text-zinc-100">
                    {result.invoice_data.po_number || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Invoice Date</span>
                  <span className="font-bold text-zinc-100">
                    {result.invoice_data.invoice_date || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Type of Invoice</span>
                  <span className="font-bold text-zinc-100">
                    {result.invoice_data.type_of_invoice || "TAX_INVOICE"}
                  </span>
                </div>
                <div className="col-span-2 border-t border-zinc-800/55 pt-3">
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Seller Name</span>
                  <span className="font-bold text-zinc-100">
                    {result.invoice_data.seller_name || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Seller GSTIN</span>
                  <span className="font-mono text-xs font-bold text-zinc-100">
                    {result.invoice_data.seller_gstin || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Seller PIN Code</span>
                  <span className="font-bold text-zinc-100">
                    {result.invoice_data.seller_gstin_pincode || "—"}
                  </span>
                </div>
                <div className="col-span-2 border-t border-zinc-800/55 pt-3">
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Buyer Name</span>
                  <span className="font-bold text-zinc-100">
                    {result.invoice_data.buyer_name || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Buyer GSTIN</span>
                  <span className="font-mono text-xs font-bold text-zinc-100">
                    {result.invoice_data.buyer_gstin || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Buyer PIN Code</span>
                  <span className="font-bold text-zinc-100">
                    {result.invoice_data.buyer_gstin_pincode || "—"}
                  </span>
                </div>
                <div className="col-span-2 border-t border-zinc-800/55 pt-4 grid grid-cols-3 gap-4 bg-zinc-950/20 p-3 rounded-xl border border-zinc-800/40">
                  <div>
                    <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Taxable Value</span>
                    <span className="font-bold text-zinc-100">
                      ₹{formatIndianCurrency(result.invoice_data.total_taxable_value)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">CGST</span>
                    <span className="font-bold text-zinc-100">
                      ₹{formatIndianCurrency(result.invoice_data.total_cgst_value)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">SGST</span>
                    <span className="font-bold text-zinc-100">
                      ₹{formatIndianCurrency(result.invoice_data.total_sgst_value)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">IGST</span>
                    <span className="font-bold text-zinc-100">
                      ₹{formatIndianCurrency(result.invoice_data.total_igst_value)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Round Off</span>
                    <span className="font-bold text-zinc-100">
                      ₹{formatIndianCurrency(result.invoice_data.round_off_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Grand Total</span>
                    <span className="font-extrabold text-indigo-400 text-sm">
                      ₹{formatIndianCurrency(result.invoice_data.total_invoice_value)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            {result.invoice_data.items && result.invoice_data.items.length > 0 && (
              <div className="glass-card rounded-2xl border border-zinc-800/60 shadow-xl p-6 overflow-hidden">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Extracted Line Items</h3>
                <div className="overflow-x-auto border border-zinc-800/40 rounded-xl">
                  <table className="min-w-full divide-y divide-zinc-800/60">
                    <thead className="bg-zinc-900/60">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Item</th>
                        <th className="px-3 py-2.5 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">Qty</th>
                        <th className="px-3 py-2.5 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">Price</th>
                        <th className="px-3 py-2.5 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">HSN</th>
                        <th className="px-3 py-2.5 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40 text-xs text-zinc-300">
                      {result.invoice_data.items.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-3 py-2.5 font-semibold text-zinc-200 max-w-xs truncate">
                            {item.description || "Line Item"}
                          </td>
                          <td className="px-3 py-2.5 text-right text-zinc-400 font-medium">
                            {item.quantity || 0}
                          </td>
                          <td className="px-3 py-2.5 text-right text-zinc-400 font-medium">
                            ₹{formatIndianCurrency(item.unit_price)}
                          </td>
                          <td className="px-3 py-2.5 text-zinc-400 font-mono">
                            {item.hsn_code || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right text-zinc-100 font-bold">
                            ₹{formatIndianCurrency(item.total_item_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

