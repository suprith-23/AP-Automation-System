"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import authService from "../../services/auth.service";
import Checkbox from "../../components/ui/Checkbox";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [requiredRole, setRequiredRole] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    }
  });

  const rememberMe = watch("rememberMe");

  useEffect(() => {
    // If the URL has a redirect parameter, it means the middleware bounced the user
    // because their session/cookies expired. In this case, clear the stale local storage state.
    const redirectParam = searchParams.get("redirect");
    if (redirectParam) {
      authService.clearLocalAuth();
    } else if (authService.isAuthenticated()) {
      router.push("/");
      return;
    }

    if (typeof window !== "undefined") {
      const rememberedEmail = localStorage.getItem("remembered_email");
      if (rememberedEmail) {
        setValue("email", rememberedEmail);
        setValue("rememberMe", true);
      }
    }
    
    const roleParam = searchParams.get("required_role");
    if (roleParam) {
      setRequiredRole(roleParam);
      const mappings: Record<string, string> = {
        Admin: "suprith@beverly.com",
        Reviewer: "ranjitha@beverly.com",
        Approver: "pooja@beverly.com"
      };
      if (mappings[roleParam]) {
        setValue("email", mappings[roleParam]);
        setValue("password", "Password123!");
      }
    }
  }, [searchParams, router, setValue]);

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    setLoading(true);
    try {
      await authService.login({ email: data.email, password: data.password }, data.rememberMe || false);
      if (data.rememberMe) {
        localStorage.setItem("remembered_email", data.email);
      } else {
        localStorage.removeItem("remembered_email");
      }
      router.push("/");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Invalid email or password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050506] grid grid-cols-1 md:grid-cols-2 relative overflow-hidden">
      
      {/* Injecting CSS Keyframe Animations Localized to Ingest Screen */}
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
        .stagger-3 { animation-delay: 0.3s; }
      `}} />

      {/* LEFT COLUMN: BRANDING & ILLUSTRATION */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-[#050506] to-[#0f1115] border-r border-zinc-900/60 relative overflow-hidden select-none">
        
        {/* Pulsing Gradient Lights */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none anim-glow-circle" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none anim-glow-circle stagger-2" />

        {/* Top Logo */}
        <div className="flex items-center space-x-3 z-10 animate-fade-in">
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

      {/* RIGHT COLUMN: LOGIN FORM */}
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
              Welcome Back
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              Log in to your account.
            </p>
          </div>

          {/* Required Role Context Alert */}
          {requiredRole && (
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                Please authenticate as <strong className="text-blue-300">{requiredRole}</strong>. Credentials pre-filled below.
              </div>
            </div>
          )}



          {/* Status Alerts */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-rose-400">{error}</span>
            </div>
          )}



          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Field with Icon */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-550">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                  </svg>
                </div>
                <input
                  type="email"
                  {...register("email")}
                  placeholder="name@company.com"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-900/40 border ${errors.email ? 'border-rose-500' : 'border-zinc-800'} text-white placeholder-zinc-650 text-sm focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] transition-all duration-200`}
                />
              </div>
              {errors.email && <p className="text-xs text-rose-500 pl-1">{errors.email.message}</p>}
            </div>

            {/* Password Field with Icon and Toggle */}
            <div className="space-y-2">
              <div className="flex justify-between items-center pl-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-555">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  placeholder="••••••••••••"
                  className={`w-full pl-10 pr-10 py-3 rounded-xl bg-zinc-900/40 border ${errors.password ? 'border-rose-500' : 'border-zinc-800'} text-white placeholder-zinc-650 text-sm focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] transition-all duration-200`}
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
              {errors.password && <p className="text-xs text-rose-500 pl-1">{errors.password.message}</p>}
              <div className="flex justify-between items-center pt-2 select-none">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe || false}
                    onChange={(e) => setValue("rememberMe", e.target.checked)}
                    className="text-[#10b981] focus:ring-[#10b981] accent-[#10b981] w-4 h-4 bg-zinc-900 border-zinc-800 rounded cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="text-[10px] font-black text-zinc-500 hover:text-zinc-400 uppercase tracking-widest cursor-pointer transition-colors">
                    Remember Me
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/forgot-password")}
                  className="text-[10px] font-black text-zinc-500 hover:text-zinc-400 transition-colors uppercase tracking-wider"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {/* Submit Sign In Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-3.5 bg-[#10b981] hover:bg-emerald-450 disabled:opacity-50 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all duration-200 flex justify-center items-center gap-1.5 mt-2"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-zinc-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <span>SIGN IN</span>
                  <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-3 items-center">
            <div className="flex-grow border-t border-zinc-800"></div>
            <span className="flex-shrink mx-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">New to Autoflow?</span>
            <div className="flex-grow border-t border-zinc-800"></div>
          </div>

          {/* Register Button */}
          <button
            onClick={() => router.push("/register")}
            className="w-full py-3.5 bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 font-black text-xs uppercase tracking-widest rounded-xl transition-all duration-200 flex justify-center items-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0 text-zinc-450" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span>SIGN UP</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050506] flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-[#10b981]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    }>
      <LoginFormContent />
    </Suspense>
  );
}
