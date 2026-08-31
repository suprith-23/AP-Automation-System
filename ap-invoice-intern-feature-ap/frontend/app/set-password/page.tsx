"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import apiClient from "../../services/api-client";

const setPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address."),
  otpCode: z.string().min(6, "OTP code must be 6 digits").max(6, "OTP code must be 6 digits"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[@$!%*?&]/, "Password must contain at least one special character (@$!%*?&)"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;

const STAGES = [
  { id: 1, label: "Account Details", pct: 20 },
  { id: 2, label: "Email OTP", pct: 40 },
  { id: 3, label: "Work Info", pct: 60 },
  { id: 4, label: "Admin Review", pct: 80 },
  { id: 5, label: "Verified & Ready", pct: 100 },
];

export default function SetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      email: "",
      otpCode: "",
      password: "",
      confirmPassword: "",
    }
  });

  const password = watch("password") || "";

  const passwordCriteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[@$!%*?&]/.test(password),
  };

  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  const onSubmit = async (data: SetPasswordFormValues) => {
    setError(null);
    setLoading(true);
    try {
      await apiClient.post("/auth/set-password-otp", {
        email: data.email,
        otp_code: data.otpCode,
        password: data.password,
        confirm_password: data.confirmPassword
      });
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Verification failed. Check your OTP and try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (hasErr?: boolean) =>
    `w-full px-4 py-2.5 rounded-xl bg-zinc-900/40 border ${hasErr ? "border-rose-500" : "border-zinc-800"} text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] transition-all duration-200`;

  return (
    <div className="min-h-screen bg-[#050506] grid grid-cols-1 md:grid-cols-2 relative overflow-hidden">

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes float-gentle {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(-1deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.05); }
        }
        @keyframes scan-sweep {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 100%; opacity: 0.8; }
          100% { top: 0%; opacity: 0.8; }
        }
        .anim-float { animation: float-gentle 6s infinite ease-in-out; }
        .anim-glow-circle { animation: pulse-glow 8s infinite ease-in-out; }
        .anim-scan {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #10b981, transparent);
          box-shadow: 0 0 12px #10b981, 0 0 4px #10b981;
          animation: scan-sweep 4s infinite linear;
        }
      `}} />

      {/* LEFT COLUMN */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-[#050506] to-[#0f1115] border-r border-zinc-900/60 relative overflow-hidden select-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#9B6BFF]/5 blur-[120px] pointer-events-none anim-glow-circle" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none anim-glow-circle" />

        <div className="flex items-center space-x-3 z-10">
          <div className="w-9 h-9 rounded-full bg-[#10b981] flex items-center justify-center text-zinc-950 font-black text-sm">AP</div>
          <span className="text-sm font-black uppercase tracking-[0.25em] text-white">AUTOFLOW</span>
        </div>

        <div className="my-auto max-w-lg z-10 space-y-10">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">Configure Password.</h1>
            <p className="text-sm text-zinc-400 leading-relaxed font-medium">
              Your registration registry has been approved by your Org Admin. Set your secure password using the OTP code sent to your email to activate login access.
            </p>
          </div>

          <div className="relative w-full max-w-[360px] aspect-[4/3] rounded-[24px] bg-[#0c0c0e]/80 border border-zinc-800/80 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col justify-between anim-float">
            <div className="anim-scan" />
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3.5">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider">Registry Active</span>
              </div>
              <span className="text-[9px] px-2.5 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] font-bold border border-emerald-500/20">Approved</span>
            </div>
            <div className="flex flex-col gap-3 my-4 text-[10px] font-bold text-zinc-300">
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span className="text-zinc-500">Security Gate</span>
                <span className="text-emerald-400">OTP verified</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[9px] font-black text-zinc-500 uppercase tracking-widest pt-3 border-t border-zinc-800/80">
              <span>AP Credentials</span>
              <span>100% Encrypted</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="flex flex-col justify-center items-center p-8 bg-[#0c0c0e] relative overflow-y-auto">
        <div className="w-full max-w-[380px] space-y-6 z-10 py-6">

          <div className="space-y-1.5">
            <h2 className="text-3xl font-black text-white tracking-tight uppercase">Set Password</h2>
            <p className="text-xs text-zinc-500 font-medium">
              Input the set-password OTP sent to your registered email to configure your credentials.
            </p>
          </div>

          {/* Milestone Step Progress Bar (100% complete) */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase tracking-wider px-1">
              <span>Progress</span>
              <span className="text-[#10b981]">100%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 w-full" />
            </div>
            <div className="flex justify-between text-[9px] font-bold text-zinc-650">
              {STAGES.map((s) => (
                <span key={s.id} className="text-zinc-400 font-black">
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">{error}</div>
          )}
          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              Password configured successfully! Redirecting to login...
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Email Address</label>
              <input type="email" {...register("email")} className={inputCls(!!errors.email)} />
              {errors.email && <p className="text-[10px] text-rose-500 pl-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">OTP Verification Code</label>
              <input type="text" {...register("otpCode")} placeholder="Enter 6-digit code" className={inputCls(!!errors.otpCode)} />
              {errors.otpCode && <p className="text-[10px] text-rose-500 pl-1">{errors.otpCode.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} {...register("password")} className={inputCls(!!errors.password) + " pr-10"} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500">
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>
              {errors.password && <p className="text-[10px] text-rose-500 pl-1">{errors.password.message}</p>}
              {password.length > 0 && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-900 space-y-1.5 mt-2 text-[9px] font-bold">
                  <p className="text-zinc-500 uppercase tracking-widest mb-1 pl-0.5">Password Requirements</p>
                  {[
                    ["length", `At least 8 characters (${password.length}/8)`, passwordCriteria.length],
                    ["uppercase", "One uppercase letter", passwordCriteria.uppercase],
                    ["lowercase", "One lowercase letter", passwordCriteria.lowercase],
                    ["number", "One number", passwordCriteria.number],
                    ["special", "One special char (@$!%*?&)", passwordCriteria.special],
                  ].map(([k, label, ok]) => (
                    <div key={String(k)} className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-[#10b981] shadow-[0_0_8px_#10b981]" : "bg-zinc-700"}`} />
                      <span className={ok ? "text-emerald-400" : "text-zinc-650"}>{String(label)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Confirm Password</label>
              <div className="relative">
                <input type={showConfirmPassword ? "text" : "password"} {...register("confirmPassword")} className={inputCls(!!errors.confirmPassword) + " pr-10"} />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500">
                  {showConfirmPassword ? "👁️" : "🙈"}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-[10px] text-rose-500 pl-1">{errors.confirmPassword.message}</p>}
            </div>

            <button type="submit" disabled={loading || !isPasswordValid} className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all duration-200 mt-2">
              {loading ? "Verifying..." : "Configure Credentials →"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
