import React, { useState, useEffect } from "react";
import { UserResponse } from "../../services/user.service";
import RegistrationApprovals from "./RegistrationApprovals";
import Input from "../ui/Input";
import Button from "../ui/Button";
import RoleBadge from "../ui/RoleBadge";
import StatusPill from "../ui/StatusPill";
import { apiClient } from "../../services/api-client";

type UserManagementProps = {
  users: UserResponse[];
  onCreateUser: (payload: { name: string; email: string; role: string; designation: string; password?: string }) => Promise<void>;
  onUpdateUser: (id: string | number, payload: { name: string; email: string; role: string; designation: string; status: string; password?: string }) => Promise<void>;
  onDeleteUser: (id: string | number) => Promise<void>;
};

export default function UserManagement({ users, onCreateUser, onUpdateUser, onDeleteUser }: UserManagementProps) {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null);
  
  const [userStats, setUserStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [workModalData, setWorkModalData] = useState<{
    userName: string;
    role: string;
    type: "pending" | "finished";
    items: any[];
  } | null>(null);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await apiClient.get("/users/stats");
      setUserStats(res.data || []);
    } catch (err) {
      console.error("Failed to load user stats", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [users]);

  const handleOpenWorkDetail = (user: UserResponse, type: "pending" | "finished") => {
    const stats = userStats.find(s => s.user_id === String(user.id));
    if (stats) {
      setWorkModalData({
        userName: user.name,
        role: user.role,
        type,
        items: type === "pending" ? stats.pending_works : stats.finished_works
      });
    } else {
      setWorkModalData({
        userName: user.name,
        role: user.role,
        type,
        items: []
      });
    }
  };

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleVal, setRoleVal] = useState("Reviewer");
  const [designation, setDesignation] = useState("");
  const [status, setStatus] = useState("Active");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !designation) {
      setFormError("Required fields are missing.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await onCreateUser({
        name: `${firstName} ${lastName}`,
        email,
        role: roleVal,
        designation,
        password,
      } as any);
      setIsAddUserOpen(false);
      // Reset form
      setFirstName("");
      setLastName("");
      setEmail("");
      setDesignation("");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (password && password !== confirmPassword) {
      setFormError("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await onUpdateUser(selectedUser.id, {
        name: `${firstName} ${lastName}`,
        email,
        role: roleVal,
        designation,
        status,
        password: password || undefined,
      } as any);
      setIsEditUserOpen(false);
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Failed to update user.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <RegistrationApprovals />
      <div className="border-t border-zinc-200 dark:border-zinc-800 my-6" />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Users & Roles</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Configure user accounts, designations, and routing rules
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setIsAddUserOpen(true);
          }}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
        >
          Create User
        </button>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-white text-[10px] font-black uppercase tracking-wider border-none">
                <th className="rounded-l-full py-3.5 px-4 bg-[#EC4899] text-white">Name</th>
                <th className="py-3.5 px-4 bg-[#EC4899] text-white">Email</th>
                <th className="py-3.5 px-4 bg-[#EC4899] text-white">Role</th>
                <th className="py-3.5 px-4 bg-[#EC4899] text-white">Finished Work</th>
                <th className="py-3.5 px-4 bg-[#EC4899] text-white">Pending Work</th>
                <th className="py-3.5 px-4 bg-[#EC4899] text-white">Status</th>
                <th className="py-3.5 px-4 bg-[#EC4899] text-white">Designation</th>
                <th className="rounded-r-full py-3.5 px-4 bg-[#EC4899] text-white text-right pr-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800 text-xs">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                  <td className="py-4 pl-5 font-bold text-zinc-800 dark:text-zinc-100">{user.name}</td>
                  <td className="py-4 text-zinc-500 dark:text-zinc-400 font-medium">{user.email}</td>
                  <td className="py-4">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="py-4">
                    {user.role === "Reviewer" || user.role === "Approver" ? (
                      <button
                        onClick={() => handleOpenWorkDetail(user, "finished")}
                        className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg font-black text-xs transition-colors"
                      >
                        {(userStats.find(s => s.user_id === String(user.id))?.finished_count) ?? 0} Items
                      </button>
                    ) : (
                      <span className="text-zinc-400 font-semibold">-</span>
                    )}
                  </td>
                  <td className="py-4">
                    {user.role === "Reviewer" || user.role === "Approver" ? (
                      <button
                        onClick={() => handleOpenWorkDetail(user, "pending")}
                        className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg font-black text-xs transition-colors"
                      >
                        {(userStats.find(s => s.user_id === String(user.id))?.pending_count) ?? 0} Items
                      </button>
                    ) : (
                      <span className="text-zinc-400 font-semibold">-</span>
                    )}
                  </td>
                  <td className="py-4">
                    <StatusPill status={user.status} />
                  </td>
                  <td className="py-4 text-zinc-450 dark:text-zinc-500 font-bold italic tracking-wide">{user.designation}</td>
                  <td className="py-4 pr-5 text-right space-x-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setFirstName(user.name.split(" ")[0] || "");
                        setLastName(user.name.split(" ").slice(1).join(" ") || "");
                        setEmail(user.email);
                        setDesignation(user.designation);
                        setRoleVal(user.role);
                        setStatus(user.status || "Active");
                        setPassword("");
                        setConfirmPassword("");
                        setFormError(null);
                        setIsEditUserOpen(true);
                      }}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteUser(user.id)}
                      className="text-rose-600 font-bold hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-[#000000]/60 backdrop-blur-[2px] z-[999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[22px] p-7 max-w-md w-full shadow-2xl animate-scale-in relative mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-black text-zinc-900 dark:text-white">Create New Account</h3>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                aria-label="Close"
                className="w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
                           bg-zinc-100 dark:bg-zinc-800
                           text-zinc-500 hover:text-zinc-800 dark:hover:text-white
                           hover:bg-zinc-200 dark:hover:bg-zinc-700
                           transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {formError && <div className="p-3 bg-rose-100 text-rose-800 text-xs font-bold rounded-xl mb-4">{formError}</div>}
            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <Input
                  label="Last Name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Role Type</label>
                  <select
                    value={roleVal}
                    onChange={(e) => setRoleVal(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-[#0F0F11] text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  >
                    <option value="Reviewer">Reviewer</option>
                    <option value="Approver">Approver</option>
                    <option value="Finance Manager">Finance Manager</option>
                    <option value="Auditor">Auditor</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <Input
                  label="Designation"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Button type="button" variant="ghost" size="md" onClick={() => setIsAddUserOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" loading={submitting}>
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditUserOpen && selectedUser && (
        <div className="fixed inset-0 bg-[#000000]/60 backdrop-blur-[2px] z-[999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[22px] p-7 max-w-md w-full shadow-2xl animate-scale-in relative mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-black text-zinc-900 dark:text-white">Edit User Profile</h3>
              <button
                type="button"
                onClick={() => setIsEditUserOpen(false)}
                aria-label="Close"
                className="w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
                           bg-zinc-100 dark:bg-zinc-800
                           text-zinc-500 hover:text-zinc-800 dark:hover:text-white
                           hover:bg-zinc-200 dark:hover:bg-zinc-700
                           transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {formError && <div className="p-3 bg-rose-100 text-rose-800 text-xs font-bold rounded-xl mb-4">{formError}</div>}
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <Input
                  label="Last Name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Role Type</label>
                  <select
                    value={roleVal}
                    onChange={(e) => setRoleVal(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-[#0F0F11] text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  >
                    <option value="Reviewer">Reviewer</option>
                    <option value="Approver">Approver</option>
                    <option value="Finance Manager">Finance Manager</option>
                    <option value="Auditor">Auditor</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <Input
                  label="Designation"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-[#0F0F11] text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="New Password (Optional)"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Button type="button" variant="ghost" size="md" onClick={() => setIsEditUserOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" loading={submitting}>
                  Update
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Work Detail Modal */}
      {workModalData && (
        <div className="fixed inset-0 bg-[#000000]/60 backdrop-blur-[2px] z-[999] flex items-center justify-center p-4 font-sans">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[22px] p-7 max-w-2xl w-full shadow-2xl animate-scale-in relative mx-4 space-y-5 text-zinc-900 dark:text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black uppercase tracking-wider">
                  {workModalData.userName} ({workModalData.role})
                </h3>
                <p className="text-[10px] text-zinc-400 font-black uppercase tracking-wider mt-1">
                  {workModalData.type} Workload Detail
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWorkModalData(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950 font-black text-zinc-450 uppercase tracking-widest text-[9px] border-b border-zinc-200 dark:border-zinc-800">
                    <th className="py-2.5 px-4">Invoice #</th>
                    <th className="py-2.5 px-4">Vendor</th>
                    <th className="py-2.5 px-4">Amount</th>
                    <th className="py-2.5 px-4 text-right pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 font-bold">
                  {workModalData.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-400 uppercase tracking-wider text-[9px] font-black">
                        No work records found in this queue.
                      </td>
                    </tr>
                  ) : (
                    workModalData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="py-3 px-4 font-extrabold text-zinc-850 dark:text-zinc-100">{item.invoice_number}</td>
                        <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 font-medium">{item.vendor}</td>
                        <td className="py-3 px-4 font-extrabold">INR {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-right pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            workModalData.type === "finished" 
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
