"use client";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (newConn: {
    name: string;
    connectorType: string;
    maskedKey: string;
    environment: "production" | "staging" | "development";
    status: "active" | "expired";
    desc: string;
    lastUsed: string;
  }) => void;
};

export default function CreateConnectorModal({ isOpen, onClose, onCreate }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [connectorType, setConnectorType] = useState("Odoo");
  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState<"production" | "staging" | "development">("production");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  if (!isOpen || !mounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!apiKey.trim()) {
      toast.error("API credentials/key is required");
      return;
    }

    // Generate masked key
    const prefix = connectorType.toLowerCase().substring(0, 2) + "_";
    const masked = prefix + "•••• •••• •••• " + apiKey.substring(apiKey.length - 4);

    onCreate({
      name: name.trim(),
      connectorType,
      maskedKey: masked,
      environment,
      status: "active",
      desc: desc.trim() || `Syncs accounts payable records with ${name}.`,
      lastUsed: "Just now",
    });

    // Reset form
    setName("");
    setApiKey("");
    setDesc("");
    onClose();
    toast.success(`ERP connection gateway ${name} created successfully!`);
  };

  const selectClass = "w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer font-medium";
  const inputClass = "w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs outline-none focus:ring-1 focus:ring-zinc-400 font-medium";

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
        className="relative z-10 w-full max-w-md rounded-[22px] bg-white dark:bg-[#121214] p-6 shadow-xl border border-zinc-200/65 dark:border-zinc-800 animate-scale-in text-zinc-900 dark:text-zinc-100 flex flex-col gap-4 font-sans"
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-base font-black text-zinc-800 dark:text-white">
              Add ERP Connection
            </h2>
            <p className="text-[10px] text-zinc-450 dark:text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
              Configure active database / API gateway credentials
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 pl-0.5">Connection Name</label>
            <input 
              type="text" 
              placeholder="e.g. Oracle NetSuite Staging" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 pl-0.5">Connector Type</label>
              <select 
                value={connectorType} 
                onChange={(e) => setConnectorType(e.target.value)}
                className={selectClass}
              >
                <option value="Odoo">Odoo</option>
                <option value="SAP">SAP S/4HANA</option>
                <option value="Oracle">Oracle NetSuite</option>
                <option value="QuickBooks">QuickBooks</option>
                <option value="Salesforce">Salesforce</option>
                <option value="Custom">Custom Gateway</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 pl-0.5">Environment</label>
              <select 
                value={environment} 
                onChange={(e) => setEnvironment(e.target.value as any)}
                className={selectClass}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 pl-0.5">API Credentials (Key/Token)</label>
            <input 
              type="password" 
              placeholder="sk_live_..." 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 pl-0.5">Description (Optional)</label>
            <textarea 
              placeholder="Integration channel parameters..." 
              value={desc} 
              onChange={(e) => setDesc(e.target.value)}
              className={`${inputClass} h-16 resize-none`}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-850">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#FF3EA5] hover:bg-[#d82d85] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              Save Connection
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
