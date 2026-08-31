"use client";
import React from "react";
import InvoiceUpload from "../../../components/InvoiceUpload";
import { useAppStore } from "../../../store/useAppStore";
import { toast } from "sonner";

export default function DocumentIntakePage() {
  const { fetchAllData } = useAppStore();

  const handleIntakeUploadSuccess = () => {
    fetchAllData();
    toast.success("Document uploaded successfully. OCR & AI Extraction triggered.");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Document Intake</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium font-normal">
          Upload invoices (PDF, Images, JSON) directly into the automated ingestion pipeline
        </p>
      </div>
      <InvoiceUpload onUploadSuccess={handleIntakeUploadSuccess} />
    </div>
  );
}
