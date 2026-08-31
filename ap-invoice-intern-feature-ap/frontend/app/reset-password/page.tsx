"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import apiClient from "../../services/api-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = searchParams.get("token");
    if (t) {
      setToken(t);
    }
  }, [searchParams]);

  const passwordCriteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[@$!%*?&]/.test(password),
  };

  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not meet the complexity requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await apiClient.post("/auth/reset-password", {
        token,
        password,
        confirm_password: confirmPassword
      });
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Invalid/expired token or password constraints failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050506] grid grid-cols-1 md:grid-cols-2 relative overflow-hidden">
      
      {/* Injecting CSS Keyframe Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan-sweep {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 100%; opacity: 0.8; }
          100% { top: 0%; opacity: 0.8; }
        }
        @keyframes float-gentle {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.05); }
        }
        .anim-scan {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #10b981, transparent);
          box-shadow: 0 0 12px #10b981, 0 0 4px #10b981;
          animation: scan-sweep 6s infinite linear;
        }
        .anim-float {
          animation: float-gentle 5s infinite ease-in-out;
        }
        .anim-glow-circle {
          animation: pulse-glow 8s infinite ease-in-out;
        }
        .stagger-1 { animation-delay: 0.1s; }
        .stagger-2 { animation-delay: 0.2s; }
      `}} />

      {/* LEFT COLUMN: BRANDING & ILLUSTRATION */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-[#050506] to-[#0f1115] border-r border-zinc-900/60 relative overflow-hidden select-none">
        
        {/* Pulsing Gradient Lights */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none anim-glow-circle" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none anim-glow-circle stagger-2" />

        {/* Top Logo */}
        <div className="flex items-center space-x-3 z-10">
          <div className="w-9 h-9 rounded-full bg-[#10b981] flex items-center justify-center text-zinc-950 font-black text-sm shadow-[0_0_15px_rgba(16,185,129,0.25)]">
            AP
          </div>
          <span className="text-sm font-black uppercase tracking-[0.25em] text-white">
            AUTOFLOW
          </span>
        </div>

        {/* Central Content */}
        <div className="my-auto max-w-lg z-10 space-y-10">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
              Reset Password.
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed font-medium">
              Create your new account access credentials. Make sure to define a strong password containing uppercase, lowercase, numbers, and special characters.
            </p>
          </div>

          {/* Premium UI Mockup Graphic */}
          <div className="relative w-full max-w-[360px] aspect-[4/3] rounded-[24px] bg-[#0c0c0e]/80 border border-zinc-800/80 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col justify-between anim-float">
            
            {/* The Scanning Sweep Bar */}
            <div className="anim-scan" />

            {/* Mock Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3.5">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider">Security Core</span>
              </div>
              <span className="text-[9px] px-2.5 py-0.5 rounded-full bg-[#39E35D] dark:bg-[#123B22] text-[#123B22] dark:text-[#4AFF7A] font-bold border-none">Active</span>
            </div>

            {/* Mock Content */}
            <div className="flex flex-col gap-3 my-4">
              <div className="h-8 w-full rounded-xl bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between px-3 text-[10px] font-bold text-zinc-300">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  Hashing Protocol
                </span>
                <span className="text-emerald-400 font-black text-[9px] bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">Bcrypt Active</span>
              </div>
              
              <div className="h-8 w-full rounded-xl bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between px-3 text-[10px] font-bold text-zinc-300">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  Token Status
                </span>
                <span className="font-black text-[9px] bg-[#9B6BFF] text-[#241B3D] dark:bg-[#241B3D] dark:text-[#B388FF] px-2 py-0.5 rounded uppercase tracking-wider">One-time Use</span>
              </div>
            </div>

            {/* Mock Footer info */}
            <div className="flex items-center justify-between text-[9px] font-black text-zinc-500 uppercase tracking-widest pt-3 border-t border-zinc-800/80">
              <span>Cryptographic Salts</span>
              <span>100% Secure</span>
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: RESET FORM */}
      <div className="flex flex-col justify-center items-center p-8 bg-[#0c0c0e] relative overflow-y-auto">
        {/* Glow backdrop on mobile */}
        <div className="md:hidden absolute top-[-10%] right-[-10%] w-[80%] h-[80%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[380px] space-y-6 z-10 py-6 animate-fade-in stagger-1">
          {/* Logo showing only on mobile */}
          <div className="flex md:hidden items-center justify-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-zinc-950 font-black text-sm shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              AP
            </div>
            <span className="text-base font-black uppercase tracking-[0.25em] text-white">
              AUTOFLOW
            </span>
          </div>

          {/* Form Header */}
          <div className="text-center md:text-left space-y-1.5">
            <h2 className="text-3xl font-black text-white tracking-tight uppercase">
              New Password
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              Define your new account access credentials.
            </p>
          </div>

          {/* Status Alerts */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-rose-400">{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Password reset success! Redirecting to login...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Token Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">
                Reset Token
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token from forgot password page"
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800 text-white placeholder-zinc-650 text-sm focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] transition-all duration-200"
                required
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800 text-white placeholder-zinc-650 text-sm focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-350 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {password.length > 0 && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-900 space-y-1.5 mt-2 animate-fade-in text-[9px] font-bold">
                  <p className="text-zinc-500 uppercase tracking-widest mb-1 pl-0.5">Password Complexity Requirements</p>
                  <div className="grid grid-cols-1 gap-1 text-[9px] uppercase tracking-wider font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.length ? "bg-[#10b981] shadow-[0_0_8px_#10b981]" : "bg-zinc-700"}`} />
                      <span className={passwordCriteria.length ? "text-emerald-450" : "text-zinc-550"}>At least 8 characters ({password.length}/8)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.uppercase ? "bg-[#10b981] shadow-[0_0_8px_#10b981]" : "bg-zinc-700"}`} />
                      <span className={passwordCriteria.uppercase ? "text-emerald-450" : "text-zinc-550"}>One uppercase letter</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.lowercase ? "bg-[#10b981] shadow-[0_0_8px_#10b981]" : "bg-zinc-700"}`} />
                      <span className={passwordCriteria.lowercase ? "text-emerald-450" : "text-zinc-550"}>One lowercase letter</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.number ? "bg-[#10b981] shadow-[0_0_8px_#10b981]" : "bg-zinc-700"}`} />
                      <span className={passwordCriteria.number ? "text-emerald-450" : "text-zinc-550"}>One number</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.special ? "bg-[#10b981] shadow-[0_0_8px_#10b981]" : "bg-zinc-700"}`} />
                      <span className={passwordCriteria.special ? "text-emerald-450" : "text-zinc-550"}>One special char (@$!%*?&)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800 text-white placeholder-zinc-650 text-sm focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-350 transition-colors"
                >
                  {showConfirmPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Save Password Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all duration-200 flex justify-center items-center gap-2 mt-4"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-zinc-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : "Save Password"}
            </button>
          </form>

          {/* Footer info */}
          <div className="text-center text-xs font-semibold text-zinc-500 pt-2">
            Remember your credentials?{" "}
            <button
              onClick={() => router.push("/login")}
              className="text-[#10b981] hover:text-emerald-400 font-bold transition-colors"
            >
              Log in here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050506] flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-[#10b981]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
