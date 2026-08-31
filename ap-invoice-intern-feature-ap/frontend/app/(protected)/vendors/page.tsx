"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import vendorService, { Vendor } from "../../../services/vendor.service";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const data = await vendorService.getVendors();
      setVendors(data);
    } catch (err: any) {
      toast.error("Failed to load vendors: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Vendor Name is required.");
      return;
    }

    try {
      setSubmitting(true);
      await vendorService.createVendor({
        name: name.trim(),
        bank_name: bankName.trim() || undefined,
        bank_account_number: accountNumber.trim() || undefined,
        ifsc_code: ifscCode.trim() || undefined,
      });
      toast.success("Vendor created successfully.");
      setIsModalOpen(false);
      // Reset form
      setName("");
      setBankName("");
      setAccountNumber("");
      setIfscCode("");
      // Refresh list
      fetchVendors();
    } catch (err: any) {
      toast.error("Failed to create vendor: " + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.bank_name && v.bank_name.toLowerCase().includes(search.toLowerCase())) ||
    (v.bank_account_number && v.bank_account_number.includes(search))
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Vendors Directory</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            Manage vendor bank accounts, routing details, and payment profiles
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="sm:self-end">
          ＋ Add New Vendor
        </Button>
      </div>

      {/* Search and List */}
      <Card className="p-6">
        <div className="mb-6">
          <label htmlFor="vendor-search" className="sr-only">Search vendors</label>
          <input
            id="vendor-search"
            type="text"
            placeholder="Search vendors by name, bank, or account number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-450 dark:text-white"
          />
        </div>

        {loading ? (
          <div className="py-20 text-center text-zinc-400 dark:text-zinc-500 text-xs font-normal">
            Loading vendors...
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="py-20 text-center text-zinc-400 dark:text-zinc-500 text-xs font-normal">
            No vendors found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-150 dark:border-zinc-800/80">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-150 dark:border-zinc-800/80 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  <th className="px-6 py-4">Vendor ID</th>
                  <th className="px-6 py-4">Vendor Name</th>
                  <th className="px-6 py-4">Bank Name</th>
                  <th className="px-6 py-4">Account Number</th>
                  <th className="px-6 py-4">IFSC Code</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80 text-xs text-zinc-700 dark:text-zinc-300">
                {filteredVendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-all duration-150"
                  >
                    <td className="px-6 py-4 font-bold text-zinc-400">VND-{vendor.id}</td>
                    <td className="px-6 py-4 font-extrabold text-zinc-900 dark:text-white">{vendor.name}</td>
                    <td className="px-6 py-4 font-semibold">{vendor.bank_name || "—"}</td>
                    <td className="px-6 py-4 font-mono font-bold">
                      {vendor.bank_account_number ? `•••• •••• ${vendor.bank_account_number.slice(-4)}` : "—"}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-blue-500 dark:text-blue-400">
                      {vendor.ifsc_code || "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">
                        Mapped
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Vendor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 font-sans" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="absolute inset-0 bg-[#000000]/60 transition-opacity duration-300" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 overflow-hidden transform scale-100 shadow-2xl text-zinc-900 dark:text-zinc-100 animate-fade-in">
            <h3 id="modal-title" className="text-lg font-black uppercase tracking-wider mb-4">Add New Vendor</h3>
            
            <form onSubmit={handleCreateVendor} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5" htmlFor="vendor-name">
                  Vendor Name *
                </label>
                <input
                  id="vendor-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-450 dark:text-white"
                  placeholder="e.g. Acme Corp"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5" htmlFor="bank-name">
                  Bank Name
                </label>
                <input
                  id="bank-name"
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-450 dark:text-white"
                  placeholder="e.g. HDFC Bank"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5" htmlFor="account-number">
                  Bank Account Number
                </label>
                <input
                  id="account-number"
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-450 dark:text-white"
                  placeholder="e.g. 501001234567"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5" htmlFor="ifsc-code">
                  IFSC Code
                </label>
                <input
                  id="ifsc-code"
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-450 dark:text-white"
                  placeholder="e.g. HDFC0000001"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting ? "Creating..." : "Save Vendor"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
