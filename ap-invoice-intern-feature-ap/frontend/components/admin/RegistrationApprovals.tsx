"use client";

import React, { useState, useEffect } from "react";
import apiClient from "../../services/api-client";
import { toast } from "sonner";

interface PendingUser {
  id: number;
  name: string;
  email: string;
  role: string;
  designation: string;
  employee_id: string;
  department: string;
  phone: string;
  status: string;
  created_at: string;
}

type RegistrationApprovalsProps = {
  onRefreshNeeded?: () => void;
};

export default function RegistrationApprovals({ onRefreshNeeded }: RegistrationApprovalsProps) {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal actions
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [modalType, setModalType] = useState<"approve" | "reject" | "info" | null>(null);
  const [textInput, setTextInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPendingUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<PendingUser[]>("/users/pending");
      setPendingUsers(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to load pending users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !modalType) return;
    setSubmitting(true);

    try {
      if (modalType === "approve") {
        await apiClient.post(`/users/${selectedUser.id}/approve`);
      } else if (modalType === "reject") {
        await apiClient.post(`/users/${selectedUser.id}/reject`, null, {
          params: { reason: textInput }
        });
      } else if (modalType === "info") {
        await apiClient.post(`/users/${selectedUser.id}/request-info`, null, {
          params: { notes: textInput }
        });
      }
      setModalType(null);
      setSelectedUser(null);
      setTextInput("");
      fetchPendingUsers();
      toast.success(`Successfully performed action: ${modalType}`);
      if (onRefreshNeeded) onRefreshNeeded();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || `Failed to perform action: ${modalType}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-zinc-500 text-xs font-semibold py-4">Checking pending user registries...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-wider">Pending Registrations</h2>
        <button
          onClick={fetchPendingUsers}
          className="text-xs text-zinc-400 font-bold hover:text-zinc-200"
        >
          Refresh List
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl">
          {error}
        </div>
      )}

      {pendingUsers.length === 0 ? (
        <div className="p-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl text-center">
          <p className="text-zinc-450 dark:text-zinc-500 text-xs font-semibold">No pending registrations awaiting approval.</p>
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="text-white text-[10px] font-black uppercase tracking-wider border-none">
                  <th className="rounded-l-full py-3.5 px-4 bg-[#EC4899] text-white">Name & Email</th>
                  <th className="py-3.5 px-4 bg-[#EC4899] text-white">Employee ID</th>
                  <th className="py-3.5 px-4 bg-[#EC4899] text-white">Department</th>
                  <th className="py-3.5 px-4 bg-[#EC4899] text-white">Role Requested</th>
                  <th className="py-3.5 px-4 bg-[#EC4899] text-white">Phone</th>
                  <th className="rounded-r-full py-3.5 px-4 bg-[#EC4899] text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {pendingUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="py-4 pl-5">
                      <div className="font-bold text-zinc-800 dark:text-zinc-100">{user.name}</div>
                      <div className="text-zinc-500 dark:text-zinc-400 font-medium text-[10px]">{user.email}</div>
                    </td>
                    <td className="py-4 font-mono font-bold text-zinc-650 dark:text-zinc-350">{user.employee_id || "—"}</td>
                    <td className="py-4 font-semibold text-zinc-700 dark:text-zinc-300">{user.department || "—"}</td>
                    <td className="py-4">
                      <span className="px-2 py-0.5 rounded bg-[#FFB800] dark:bg-[#3D2E05] text-[#3D2E05] dark:text-[#FFCB3D] text-[9px] font-black uppercase">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4 text-zinc-500 dark:text-zinc-400">{user.phone || "—"}</td>
                    <td className="py-4 pr-5 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setModalType("approve");
                        }}
                        className="px-2.5 py-1 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 text-[10px] font-bold rounded-lg transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setModalType("info");
                          setTextInput("");
                        }}
                        className="px-2.5 py-1 bg-amber-600/10 text-amber-500 hover:bg-amber-600/20 text-[10px] font-bold rounded-lg transition-colors"
                      >
                        Info
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setModalType("reject");
                          setTextInput("");
                        }}
                        className="px-2.5 py-1 bg-rose-600/10 text-rose-500 hover:bg-rose-600/20 text-[10px] font-bold rounded-lg transition-colors"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Dialog / Modal */}
      {modalType && selectedUser && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-black text-zinc-900 dark:text-white capitalize">
              {modalType === "approve" ? "Confirm Approval" : modalType === "reject" ? "Reject Registration" : "Request Information"}
            </h3>
            
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">
              Action regarding: <span className="text-zinc-800 dark:text-white font-bold">{selectedUser.name} ({selectedUser.email})</span>
            </p>

            <form onSubmit={handleActionSubmit} className="space-y-4">
              {modalType !== "approve" && (
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">
                    {modalType === "reject" ? "Reason for Rejection" : "Message to User"}
                  </label>
                  <textarea
                    required
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={modalType === "reject" ? "e.g. Invalid organization matching or employee credentials" : "e.g. Please clarify your department name."}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white text-xs font-semibold focus:outline-none"
                    rows={4}
                  />
                </div>
              )}

              {modalType === "approve" && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Approving this user will mark their status as Active and allow them to log in to the AP Automation System.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setModalType(null);
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-350 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-2 text-white rounded-xl ${
                    modalType === "approve" ? "bg-emerald-600 hover:bg-emerald-500" :
                    modalType === "reject" ? "bg-rose-600 hover:bg-rose-500" :
                    "bg-amber-600 hover:bg-amber-500"
                  }`}
                >
                  {submitting ? "Processing..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
