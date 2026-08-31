"use client";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import StatusPill from "./StatusPill";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export type ConnectorInfo = {
  name: string;
  connectorType: string;
  secondaryLine: string;
  environment: "production" | "staging" | "development";
  lastUsed: string;
  status: "active" | "expired" | "revoked" | "healthy" | "degraded" | "online" | "offline";
  iconLetter?: string;
};

type Props = {
  connector: ConnectorInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus?: (name: string, newStatus: string) => void;
  onDelete?: (name: string) => void;
};

export default function ConnectorDetailsModal({ connector, isOpen, onClose, onUpdateStatus, onDelete }: Props) {
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (connector) {
      setCurrentStatus(connector.status);
    }
  }, [connector]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !connector || !mounted) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    toast.info(`Initiating credentials check for ${connector.name}...`);
    
    // Simulate API request delay
    await new Promise((r) => setTimeout(r, 1200));
    
    setTesting(false);
    const latency = Math.floor(Math.random() * 45) + 15;
    toast.success(`Connection Active! Latency: ${latency}ms (API Key Authorized)`);
  };

  const handleToggleStatus = () => {
    const nextStatus = currentStatus === "active" || currentStatus === "healthy" || currentStatus === "online" 
      ? "expired" 
      : "active";
    
    setCurrentStatus(nextStatus);
    if (onUpdateStatus) {
      onUpdateStatus(connector.name, nextStatus);
    }
    toast.success(`Connector ${connector.name} status updated to ${nextStatus.toUpperCase()}`);
  };

  const handleConfigure = () => {
    onClose();
    // Redirect to the enterprise module where ERPs are set up
    router.push("/enterprise");
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(connector.secondaryLine);
    toast.success("Credentials key copied to clipboard");
  };

  const initial = connector.iconLetter || connector.name.substring(0, 2).toUpperCase();

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div 
        ref={modalRef}
        className="relative z-10 w-full max-w-md rounded-[22px] bg-white dark:bg-[#121214] p-6 shadow-xl border border-zinc-200/65 dark:border-zinc-800 animate-scale-in text-zinc-900 dark:text-zinc-100 flex flex-col gap-5 font-sans"
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-850 flex items-center justify-center font-black text-sm select-none border border-zinc-200/40 dark:border-zinc-750">
              {initial}
            </div>
            <div>
              <h2 className="text-base font-black text-zinc-800 dark:text-white truncate max-w-[200px]">
                {connector.name}
              </h2>
              <p className="text-[10px] text-zinc-450 dark:text-zinc-400 font-bold uppercase tracking-wider">
                {connector.connectorType}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
          <div>
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Environment</span>
            <StatusPill status={connector.environment} />
          </div>
          <div>
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Connector Status</span>
            <StatusPill status={currentStatus as any} />
          </div>
          <div>
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Last Synced / Used</span>
            <span className="text-zinc-700 dark:text-zinc-350">{connector.lastUsed}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Connector ID</span>
            <span className="font-mono text-zinc-500">{connector.name.toLowerCase().replace(/\s+/g, "_")}</span>
          </div>
        </div>

        {/* Credentials / Key Box */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Authorized API Key / Endpoint</label>
          <div className="flex gap-2 items-center bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-150 dark:border-zinc-800/80 font-mono text-xs">
            <input 
              type={showKey ? "text" : "password"} 
              readOnly 
              value={connector.secondaryLine} 
              className="flex-1 bg-transparent border-0 outline-none text-zinc-800 dark:text-zinc-200 select-all"
            />
            <button 
              onClick={() => setShowKey(!showKey)} 
              className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 text-xs transition-colors px-1"
              title={showKey ? "Hide Credentials" : "Show Credentials"}
            >
              {showKey ? "🙈" : "👁"}
            </button>
            <button 
              onClick={handleCopyKey}
              className="text-zinc-450 hover:text-zinc-650 dark:hover:text-zinc-200 text-xs transition-colors px-1"
              title="Copy to Clipboard"
            >
              📋
            </button>
          </div>
        </div>

        {/* Description / Actions info */}
        <div className="bg-zinc-50 dark:bg-zinc-900/30 p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-500 leading-relaxed">
          {connector.status === "active" ? "🔒 Integrates accounts payable registers, bills, and purchase order records. Syncing runs asynchronously via background Celery brokers." : "⚠️ Integration connection is expired or inactive. Synced invoices will buffer until connectivity is restored."}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center gap-2 border-t border-zinc-100 dark:border-zinc-850 pt-4">
          <div className="flex gap-2">
            <button
              onClick={handleToggleStatus}
              className="px-3.5 py-2 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-350 text-xs font-bold rounded-xl transition-all"
            >
              {currentStatus === "active" || currentStatus === "healthy" || currentStatus === "online" ? "Deactivate" : "Activate"}
            </button>
            {onDelete && (
              <button
                onClick={() => {
                  onDelete(connector.name);
                  onClose();
                }}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200/40 dark:border-red-900/30 text-xs font-bold rounded-xl transition-colors"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test Link"}
            </button>
            <button
              onClick={handleConfigure}
              className="px-3.5 py-2 bg-[#FF3EA5] hover:bg-[#d82d85] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              Configure
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
