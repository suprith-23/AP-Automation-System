"use client";
import React from "react";
import { useConfirmStore } from "../../store/useConfirmStore";

export default function ConfirmDialog() {
  const { isOpen, title, message, confirmText, cancelText, roleAccent, onConfirm, onCancel } = useConfirmStore();

  if (!isOpen) return null;

  const accentColorClass = {
    green: "bg-fw-green text-fw-green-deep hover:bg-fw-green/90",
    purple: "bg-fw-purple text-white hover:bg-fw-purple/90",
    pink: "bg-fw-pink text-white hover:bg-fw-pink/90",
    teal: "bg-fw-teal text-fw-teal-deep hover:bg-fw-teal/90",
    red: "bg-fw-red text-white hover:bg-fw-red/90",
    blue: "bg-fw-blue text-white hover:bg-fw-blue/90",
  }[roleAccent || "blue"];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-backdrop"
        onClick={onCancel}
      />
      
      {/* Dialog Panel */}
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl animate-scale-in border border-zinc-150 dark:border-zinc-800">
        <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-sm text-zinc-550 dark:text-zinc-400 mb-6">
          {message}
        </p>
        
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-full text-xs font-bold transition-colors ${accentColorClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
