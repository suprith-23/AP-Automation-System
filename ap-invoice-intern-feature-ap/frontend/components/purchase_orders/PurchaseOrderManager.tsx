import React, { useState } from "react";
import { PurchaseOrder } from "../../types/purchase_order";
import { Invoice } from "../../types/invoice";
import { formatIndianCurrency } from "../../utils/format";
import StatusPill from "../ui/StatusPill";
import { Role } from "../../store/useAppStore";

type PurchaseOrderManagerProps = {
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  role: Role;
  onCreatePo: (payload: { po_number: string; vendor_name: string; vendor_gstin: string; po_amount: number; po_date: string; status: string }) => Promise<void>;
  onUpdatePo: (id: number, payload: { po_number: string; vendor_name: string; vendor_gstin: string; po_amount: number; po_date: string; status: string }) => Promise<void>;
  onDeletePo: (id: number) => Promise<void>;
  onImportPo: () => void;
  onExportPo: () => void;
};

export default function PurchaseOrderManager({
  purchaseOrders,
  invoices,
  role,
  onCreatePo,
  onUpdatePo,
  onDeletePo,
  onImportPo,
  onExportPo,
}: PurchaseOrderManagerProps) {
  const [poSearch, setPoSearch] = useState("");
  const [isAddPoOpen, setIsAddPoOpen] = useState(false);
  const [isEditPoOpen, setIsEditPoOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);

  // Form fields
  const [poNumber, setPoNumber] = useState("");
  const [poVendor, setPoVendor] = useState("");
  const [poGstin, setPoGstin] = useState("");
  const [poAmount, setPoAmount] = useState(0);
  const [poDate, setPoDate] = useState("");
  const [poStatusVal, setPoStatusVal] = useState("open");

  const filteredPurchaseOrders = purchaseOrders.filter(
    (po) =>
      po.po_number.toLowerCase().includes(poSearch.toLowerCase()) ||
      po.vendor_name.toLowerCase().includes(poSearch.toLowerCase())
  );

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poNumber || !poVendor || !poAmount || !poDate) return;
    try {
      await onCreatePo({
        po_number: poNumber,
        vendor_name: poVendor,
        vendor_gstin: poGstin,
        po_amount: poAmount,
        po_date: poDate,
        status: poStatusVal,
      });
      setIsAddPoOpen(false);
      setPoNumber("");
      setPoVendor("");
      setPoGstin("");
      setPoAmount(0);
      setPoDate("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo) return;
    try {
      await onUpdatePo(selectedPo.id, {
        po_number: poNumber,
        vendor_name: poVendor,
        vendor_gstin: poGstin,
        po_amount: poAmount,
        po_date: poDate,
        status: poStatusVal,
      });
      setIsEditPoOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Track and match PO allocations against vendor invoices
          </p>
        </div>
        {role === "Admin" && (
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setIsAddPoOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
            >
              Create PO
            </button>
            <button
              onClick={onImportPo}
              className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              Import PO
            </button>
            <button
              onClick={onExportPo}
              className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              Export PO
            </button>
          </div>
        )}
      </div>

      <div className="relative w-full max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={poSearch}
          onChange={(e) => setPoSearch(e.target.value)}
          placeholder="Search POs by number, vendor..."
          className="block w-full pl-10 pr-4 py-2.5 bg-[#F7F7F7] dark:bg-[#1A1A1A] border-0 rounded-full text-xs text-zinc-800 dark:text-zinc-150 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FF3EA5] dark:bg-[#FF5CB8] text-white text-[10px] font-black uppercase tracking-widest border-none">
                <th className="py-3 px-5 rounded-l-full">PO Number</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4 text-right">PO Amount</th>
                <th className="py-3 px-4 text-right">Remaining Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                {role === "Admin" && (
                  <th className="py-3 px-5 rounded-r-full text-right">Actions</th>
                )}
                {role !== "Admin" && (
                  <th className="py-3 px-5 rounded-r-full"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800 text-xs">
              {filteredPurchaseOrders.map((po) => {
                const matchedInvs = invoices.filter((i) => i.po_number === po.po_number);
                const matchedAmount = matchedInvs.reduce((sum, item) => sum + (item.total_amount || 0), 0);
                const remainingAmount = Math.max(0, po.po_amount - matchedAmount);

                return (
                  <tr key={po.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="py-4 pl-5 pr-4 font-mono font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                      {po.po_number}
                    </td>
                    <td className="py-4 px-4 font-semibold text-zinc-800 dark:text-zinc-100">
                      <div>
                        <div className="font-bold text-zinc-800 dark:text-zinc-100">{po.vendor_name}</div>
                        {po.vendor_gstin && <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">{po.vendor_gstin}</div>}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-zinc-800 dark:text-zinc-100">₹{formatIndianCurrency(po.po_amount)}</td>
                    <td className="py-4 px-4 text-right font-bold text-zinc-800 dark:text-zinc-100">₹{formatIndianCurrency(remainingAmount)}</td>
                    <td className="py-4 px-4 text-center">
                      <StatusPill status={po.status} />
                    </td>
                    <td className="py-4 text-right pr-5 space-x-3">
                      {role === "Admin" && (
                        <>
                          <button onClick={() => {
                            setSelectedPo(po);
                            setPoNumber(po.po_number);
                            setPoVendor(po.vendor_name);
                            setPoGstin(po.vendor_gstin || "");
                            setPoAmount(po.po_amount);
                            setPoDate(po.po_date || "");
                            setPoStatusVal(po.status || "open");
                            setIsEditPoOpen(true);
                          }} className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Edit</button>
                          <button onClick={() => onDeletePo(po.id)} className="text-rose-600 font-bold hover:underline">Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add PO Modal */}
      {isAddPoOpen && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 text-xs font-bold shadow-2xl">
            <h3 className="text-lg font-black text-zinc-900 dark:text-white">Create Purchase Order</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-zinc-400 dark:text-zinc-500 mb-1">PO Number</label>
                <input type="text" required value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-zinc-400 dark:text-zinc-500 mb-1">Vendor Name</label>
                <input type="text" required value={poVendor} onChange={(e) => setPoVendor(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-zinc-400 dark:text-zinc-500 mb-1">Vendor GSTIN</label>
                <input type="text" value={poGstin} onChange={(e) => setPoGstin(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 dark:text-zinc-500 mb-1">PO Amount (₹)</label>
                  <input type="number" required value={poAmount || ""} onChange={(e) => setPoAmount(parseFloat(e.target.value) || 0)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-zinc-400 dark:text-zinc-500 mb-1">PO Date</label>
                  <input type="date" required value={poDate} onChange={(e) => setPoDate(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button type="button" onClick={() => setIsAddPoOpen(false)} className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-colors">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit PO Modal */}
      {isEditPoOpen && selectedPo && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 text-xs font-bold shadow-2xl">
            <h3 className="text-lg font-black text-zinc-900 dark:text-white">Edit Purchase Order</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-zinc-400 dark:text-zinc-500 mb-1">PO Number</label>
                <input type="text" required value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-zinc-400 dark:text-zinc-500 mb-1">Vendor Name</label>
                <input type="text" required value={poVendor} onChange={(e) => setPoVendor(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-zinc-400 dark:text-zinc-500 mb-1">Vendor GSTIN</label>
                <input type="text" value={poGstin} onChange={(e) => setPoGstin(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-zinc-400 dark:text-zinc-500 mb-1">PO Amount (₹)</label>
                  <input type="number" required value={poAmount || ""} onChange={(e) => setPoAmount(parseFloat(e.target.value) || 0)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-zinc-400 dark:text-zinc-500 mb-1">PO Date</label>
                  <input type="date" required value={poDate} onChange={(e) => setPoDate(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-zinc-400 dark:text-zinc-500 mb-1">Status</label>
                  <select value={poStatusVal} onChange={(e) => setPoStatusVal(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button type="button" onClick={() => setIsEditPoOpen(false)} className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-colors">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
