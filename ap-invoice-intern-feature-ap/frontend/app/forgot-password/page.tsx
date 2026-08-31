"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import apiClient from "../../services/api-client";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Please fill in your email.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post("/auth/forgot-password", { email });
      setSuccess(true);
      if (response.data.reset_token) {
        setResetToken(response.data.reset_token);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Could not request password reset. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050506] grid grid-cols-1 md:grid-cols-2 relative overflow-hidden">
      
      {/* Injecting CSS Keyframe Animations Localized to Forgot Password Screen */}
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
              Ingest. Match.<br />Authorize.
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed font-medium">
              Enterprise accounts payable engine driving end-to-end extraction and validation. Seamlessly sync invoices from your inbox, execute 3-way matching rules, and resolve variances.
            </p>
          </div>

          {/* Premium UI Mockup Graphic with Scanner Sweep */}
          <div className="relative w-full max-w-[360px] aspect-[4/3] rounded-[24px] bg-[#0c0c0e]/80 border border-zinc-800/80 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col justify-between anim-float">
            
            {/* The Scanning Sweep Bar */}
            <div className="anim-scan" />

            {/* Mock Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3.5">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider">AP Match Core</span>
              </div>
              <span className="text-[9px] px-2.5 py-0.5 rounded-full bg-[#39E35D] dark:bg-[#123B22] text-[#123B22] dark:text-[#4AFF7A] font-bold border-none">Synced</span>
            </div>

            {/* Mock Invoices */}
            <div className="flex flex-col gap-3 my-4">
              <div className="h-8 w-full rounded-xl bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between px-3 text-[10px] font-bold text-zinc-300 hover:bg-zinc-800 transition-colors duration-150">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  INV-2026-0042
                </span>
                <span className="text-emerald-400 font-black text-[9px] bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">3-Way Matched</span>
              </div>
              
              <div className="h-8 w-full rounded-xl bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between px-3 text-[10px] font-bold text-zinc-300 hover:bg-zinc-800 transition-colors duration-150">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9B6BFF]" />
                  INV-2026-0043
                </span>
                <span className="font-black text-[9px] bg-[#9B6BFF] text-[#241B3D] dark:bg-[#241B3D] dark:text-[#B388FF] px-2 py-0.5 rounded uppercase tracking-wider">Review Triggered</span>
              </div>
            </div>

            {/* Mock Footer info */}
            <div className="flex items-center justify-between text-[9px] font-black text-zinc-500 uppercase tracking-widest pt-3 border-t border-zinc-800/80">
              <span>99.2% OCR Accuracy</span>
              <span>1.2s Sync Speed</span>
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: RESET FORM */}
      <div className="flex flex-col justify-center items-center p-8 bg-[#0c0c0e] relative">
        {/* Glow backdrop on mobile */}
        <div className="md:hidden absolute top-[-10%] right-[-10%] w-[80%] h-[80%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[380px] space-y-8 z-10 animate-fade-in stagger-1">
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
              Reset Password
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              Enter your email to obtain a validation token.
            </p>
          </div>

          {/* Status Alerts */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex flex-col gap-2">
                <span>Password reset requested! Check your console or see the debug token below to complete the reset.</span>
              </div>
              
              {resetToken && (
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
                  <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest pl-1">Debug Reset Token:</p>
                  <code className="block text-xs text-emerald-400 select-all font-mono break-all bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">{resetToken}</code>
                  
                  <button
                    onClick={() => router.push(`/reset-password?token=${resetToken}`)}
                    className="w-full mt-2 py-3 bg-[#10b981] hover:bg-emerald-450 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all duration-200"
                  >
                    Proceed to Reset Page
                  </button>
                </div>
              )}

              <button
                onClick={() => router.push("/login")}
                className="w-full py-3.5 bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 font-black text-xs uppercase tracking-widest rounded-xl transition-all duration-200"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field with Icon */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">
                  Your Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-550">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800 text-white placeholder-zinc-650 text-sm focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] transition-all duration-200"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#10b981] hover:bg-emerald-450 disabled:opacity-50 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all duration-200 flex justify-center items-center gap-1.5"
              >
                {loading ? (
                  <svg className="animate-spin h-4 w-4 text-zinc-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <>
                    <span>GET RESET LINK</span>
                    <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>

              {/* Back to Login link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="text-xs font-bold text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
