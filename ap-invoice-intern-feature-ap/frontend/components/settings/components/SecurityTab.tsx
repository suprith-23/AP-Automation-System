"use client";
import React, { useState, useEffect } from "react";
import authService from "../../../services/auth.service";
import apiClient from "../../../services/api-client";

export default function SecurityTab() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const stored = authService.getStoredUser();
    if (stored) {
      setUser(stored);
    }
  }, []);

  const passwordCriteria = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[@$!%*?&]/.test(newPassword),
  };

  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (!isPasswordValid) {
      setError("New password does not meet the complexity requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword
      });
      setSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const roleKey = user.role?.toLowerCase().trim() || "";
  const ROLE_GRADIENT_MAP: Record<string, string> = {
    admin: "from-fw-green to-fw-green-deep shadow-fw-green/20",
    "super admin": "from-fw-amber to-fw-amber-deep shadow-fw-amber/20",
    "finance manager": "from-fw-amber to-fw-amber-deep shadow-fw-amber/20",
    approver: "from-fw-purple to-fw-purple-deep shadow-fw-purple/20",
    reviewer: "from-fw-pink to-fw-pink-deep shadow-fw-pink/20",
    auditor: "from-fw-teal to-fw-teal-deep shadow-fw-teal/20",
  };
  const gradientClass = ROLE_GRADIENT_MAP[roleKey] || "from-zinc-400 to-zinc-600 shadow-zinc-500/20";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-zinc-950 dark:text-white">
      {/* User Details Card */}
      <div className="md:col-span-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6 flex flex-col items-center text-center">
        <div className={`w-24 h-24 rounded-full bg-gradient-to-tr ${gradientClass} flex items-center justify-center text-white font-extrabold text-3xl shadow-lg`}>
          {user.name.split(" ").map((n: string) => n[0]).join("")}
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">{user.name}</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider mt-1">{user.role} · {user.designation}</p>
        </div>

        <div className="w-full border-t border-slate-100 dark:border-zinc-800 pt-6 space-y-3.5 text-left text-xs">
          <div>
            <p className="text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-[9px]">Email Address</p>
            <p className="font-semibold text-slate-700 dark:text-zinc-200 mt-0.5">{user.email}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-[9px]">Created Date</p>
            <p className="font-semibold text-slate-700 dark:text-zinc-200 mt-0.5">{new Date(user.created_at).toLocaleDateString()}</p>
          </div>
          {user.last_login && (
            <div>
              <p className="text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-[9px]">Last Login</p>
              <p className="font-semibold text-slate-750 dark:text-zinc-200 mt-0.5">{new Date(user.last_login).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Form */}
      <div className="md:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
        <h3 className="text-lg font-black text-slate-850 dark:text-zinc-100">Security & Password Management</h3>
        
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold">
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold">
            <span>Password changed successfully!</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
              Old Password
            </label>
            <div className="relative">
              <input
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 bg-transparent"
                required
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650 transition-colors"
              >
                {showOldPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 bg-transparent"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650 transition-colors"
              >
                {showNewPassword ? "🙈" : "👁"}
              </button>
            </div>

            {newPassword.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 space-y-1.5 mt-2 animate-fade-in text-[9px] font-bold">
                <p className="text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1 pl-0.5">Password Complexity Requirements</p>
                <div className="grid grid-cols-1 gap-1 text-[9px] uppercase tracking-wider font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.length ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-slate-300"}`} />
                    <span className={passwordCriteria.length ? "text-emerald-600 dark:text-emerald-400" : "text-slate-450 dark:text-zinc-400"}>At least 8 characters ({newPassword.length}/8)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.uppercase ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-slate-300"}`} />
                    <span className={passwordCriteria.uppercase ? "text-emerald-600 dark:text-emerald-400" : "text-slate-450 dark:text-zinc-400"}>One uppercase letter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.lowercase ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-slate-300"}`} />
                    <span className={passwordCriteria.lowercase ? "text-emerald-600 dark:text-emerald-400" : "text-slate-450 dark:text-zinc-400"}>One lowercase letter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.number ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-slate-300"}`} />
                    <span className={passwordCriteria.number ? "text-emerald-600 dark:text-emerald-400" : "text-slate-450 dark:text-zinc-400"}>One number</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.special ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-slate-300"}`} />
                    <span className={passwordCriteria.special ? "text-emerald-600 dark:text-emerald-400" : "text-slate-450 dark:text-zinc-400"}>One special char (@$!%*?&)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5 pl-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 bg-transparent"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650 transition-colors"
              >
                {showConfirmPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-blue-500/10 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
