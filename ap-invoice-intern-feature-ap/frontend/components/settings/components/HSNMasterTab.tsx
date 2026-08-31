"use client";
import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import apiClient from "../../../services/api-client";

type HSNMasterTabProps = {
  canEdit: boolean;
};

export default function HSNMasterTab({ canEdit }: HSNMasterTabProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchHsnCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const skip = page * limit;
      const res = await apiClient.get(`/hsn?skip=${skip}&limit=${limit}`);
      setRecords(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load HSN master records");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchHsnCodes();
  }, [fetchHsnCodes]);

  const handleSeedData = async () => {
    if (!canEdit) return;
    setLoading(true);
    try {
      const res = await apiClient.post("/hsn/seed");
      toast.success(`Success: ${res.data.summary || "Database seeded successfully"}`);
      setPage(0);
      fetchHsnCodes();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to seed HSN codes database");
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter((r: any) => {
    const q = searchQuery.toLowerCase();
    return (
      r.hsn_code?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in text-zinc-950 dark:text-white">
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              HSN / SAC Master Database lookup
            </h3>
            <p className="text-[10px] text-zinc-500 font-normal mt-0.5">
              Browse master tariff codes, descriptions, and standard IGST/CGST/SGST rates.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={handleSeedData}
              className="px-3.5 py-1.5 bg-[#39E35D] hover:bg-[#2fc44e] text-zinc-950 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
            >
              Seed Standard HSN Data
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search by HSN code or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#39E35D]/50 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        {loading && <div className="text-xs text-zinc-400 py-4 text-center">Loading HSN codes…</div>}
        {error && <div className="text-xs text-red-500 py-4 text-center">{error}</div>}

        {!loading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    {["HSN/SAC Code", "Description", "GST Rate (%)", "IGST (%)", "CGST (%)", "SGST (%)"].map((h) => (
                      <th
                        key={h}
                        className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400 font-normal">
                        No HSN master records found.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rule) => (
                      <tr
                        key={rule.id}
                        className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors"
                      >
                        <td className="py-2.5 px-2 font-black text-zinc-800 dark:text-zinc-100">{rule.hsn_code}</td>
                        <td className="py-2.5 px-2 text-zinc-600 dark:text-zinc-400 max-w-[300px] truncate font-normal">
                          {rule.description || "—"}
                        </td>
                        <td className="py-2.5 px-2 font-bold text-zinc-800 dark:text-zinc-100">{rule.gst_rate}%</td>
                        <td className="py-2.5 px-2 font-normal text-zinc-500">{rule.igst_rate}%</td>
                        <td className="py-2.5 px-2 font-normal text-zinc-500">{rule.cgst_rate}%</td>
                        <td className="py-2.5 px-2 font-normal text-zinc-500">{rule.sgst_rate}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 text-[10px] font-bold text-zinc-400">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
              >
                Previous Page
              </button>
              <span>Page {page + 1}</span>
              <button
                disabled={records.length < limit}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
              >
                Next Page
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
