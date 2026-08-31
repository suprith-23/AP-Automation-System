"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import authService from "../../services/auth.service";
import apiClient from "../../services/api-client";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address."),
  role: z.string().min(1),
  designation: z.string().optional(),
  employeeId: z.string().min(1, "Employee ID is required"),
  department: z.string().optional(),
  phone: z.string().optional(),
  organizationName: z.string().min(1, "Organization name is required"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const STAGES = [
  { id: 1, label: "Account Details", pct: 20 },
  { id: 2, label: "Email OTP", pct: 40 },
  { id: 3, label: "Work Info", pct: 60 },
  { id: 4, label: "Admin Review", pct: 80 },
  { id: 5, label: "Verified & Ready", pct: 100 },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Flow Stage State: 1 (Account), 2 (OTP Verification), 3 (Work Info), 4 (Submitted / Pending Approval)
  const [stage, setStage] = useState(1);
  const [stageDir, setStageDir] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState(["", "", "", "", "", ""]);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Organization Validation state
  const [orgCheckState, setOrgCheckState] = useState<"idle" | "verifying" | "valid" | "invalid">("idle");
  const [verifiedOrgId, setVerifiedOrgId] = useState<string | null>(null);

  const { register, handleSubmit, watch, trigger, formState: { errors }, setValue, getValues } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "", email: "", role: "Reviewer",
      designation: "", employeeId: "", department: "", phone: "", organizationName: ""
    }
  });

  const emailValue = watch("email") || "";
  const orgNameValue = watch("organizationName") || "";

  useEffect(() => {
    if (authService.isAuthenticated()) {
      router.push("/");
    }
  }, [router]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Animated stage transitions
  const goToStage = (next: number, dir: "forward" | "back") => {
    setAnimating(true);
    setStageDir(dir);
    setTimeout(() => {
      setStage(next);
      setAnimating(false);
    }, 220);
  };

  const handleStage1Next = async () => {
    const valid = await trigger(["name", "email"]);
    if (valid) {
      goToStage(2, "forward");
      if (!otpSent) handleSendOtp();
    }
  };

  const handleSendOtp = async () => {
    setOtpLoading(true);
    setOtpError(null);
    try {
      await apiClient.post("/auth/otp/send", { email: emailValue, action: "REGISTRATION" });
      setOtpSent(true);
      setCooldown(60);
    } catch (err: any) {
      setOtpSent(true);
      setOtpError(err.response?.data?.detail || "OTP delivery failed. Please request a new code.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpInput = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otpValue];
    next[idx] = val;
    setOtpValue(next);
    if (val && idx < 5) {
      const el = document.getElementById(`otp-${idx + 1}`);
      if (el) (el as HTMLInputElement).focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpValue[idx] && idx > 0) {
      const el = document.getElementById(`otp-${idx - 1}`);
      if (el) (el as HTMLInputElement).focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otpValue.join("");
    if (code.length < 6) {
      setOtpError("Please enter all 6 digits.");
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    try {
      await apiClient.post("/auth/otp/verify", { email: emailValue, action: "REGISTRATION", otp_code: code });
      setOtpVerified(true);
      setTimeout(() => {
        goToStage(3, "forward");
      }, 800);
    } catch (err: any) {
      setOtpError(err.response?.data?.detail || "Invalid verification code.");
    } finally {
      setOtpLoading(false);
    }
  };

  // Triggered on blur or change of organization field
  const handleVerifyOrganizationName = async () => {
    const val = getValues("organizationName");
    if (!val || val.trim() === "") {
      setOrgCheckState("idle");
      setVerifiedOrgId(null);
      return;
    }
    setOrgCheckState("verifying");
    try {
      const res = await apiClient.get(`/auth/check-organization?name=${encodeURIComponent(val)}`);
      setOrgCheckState("valid");
      setVerifiedOrgId(res.data.id);
    } catch {
      setOrgCheckState("invalid");
      setVerifiedOrgId(null);
    }
  };

  const onSubmit = async (data: RegisterFormValues) => {
    if (orgCheckState !== "valid" || !verifiedOrgId) {
      setError("Please input a recognized and active organization.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiClient.post("/auth/register-pending", {
        name: data.name,
        email: data.email,
        role: data.role,
        designation: data.designation || "Staff",
        employee_id: data.employeeId,
        department: data.department || "",
        phone: data.phone || "",
        organization_id: verifiedOrgId
      });
      setSuccess(true);
      goToStage(4, "forward");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Pending registration failed. Check details and resubmit.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (hasErr?: boolean) =>
    `w-full px-4 py-2.5 rounded-xl bg-zinc-900/40 border ${hasErr ? "border-rose-500" : "border-zinc-800"} text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] transition-all duration-200`;

  const slideClass = animating
    ? stageDir === "forward" ? "opacity-0 translate-x-6" : "opacity-0 -translate-x-6"
    : "opacity-100 translate-x-0";

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
        .stagger-1 { animation-delay: 0.1s; }
        .stagger-2 { animation-delay: 0.2s; }
      `}} />

      {/* LEFT COLUMN: BRANDING */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-[#050506] to-[#0f1115] border-r border-zinc-900/60 relative overflow-hidden select-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#9B6BFF]/5 blur-[120px] pointer-events-none anim-glow-circle" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none anim-glow-circle stagger-2" />

        <div className="flex items-center space-x-3 z-10">
          <div className="w-9 h-9 rounded-full bg-[#10b981] flex items-center justify-center text-zinc-950 font-black text-sm shadow-[0_0_15px_rgba(16,185,129,0.25)]">AP</div>
          <span className="text-sm font-black uppercase tracking-[0.25em] text-white">AUTOFLOW</span>
        </div>

        <div className="my-auto max-w-lg z-10 space-y-10">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">Access Verification.</h1>
            <p className="text-sm text-zinc-400 leading-relaxed font-medium">
              Join the AP Automation platform. Securely register below, verify your identity with dynamic OTP, and await administrator verification approval to set your account password.
            </p>
          </div>

          {/* Premium UI Mockup Graphic with Scanner Sweep */}
          <div className="relative w-full max-w-[360px] aspect-[4/3] rounded-[24px] bg-[#0c0c0e]/80 border border-zinc-800/80 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col justify-between anim-float">
            
            {/* The Scanning Sweep Bar */}
            <div className="anim-scan" />

            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3.5">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider">AP Registry Scan</span>
              </div>
              <span className="text-[9px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-[#10b981] font-bold border border-emerald-500/20">Extracting...</span>
            </div>

            {/* Scanning graphic layout details */}
            <div className="flex flex-col gap-3 my-4 text-[10px] font-bold text-zinc-300">
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span className="text-zinc-500">Validation Mode</span>
                <span className="text-emerald-400">OCR Domain Extraction</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span className="text-zinc-500">Security Rule</span>
                <span>OTP + Org Match</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span className="text-zinc-500">Encryption status</span>
                <span>SHA-256 Hashes</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[9px] font-black text-zinc-500 uppercase tracking-widest pt-3 border-t border-zinc-800/80">
              <span>RBAC Policy</span>
              <span>Pending Review</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: REGISTER FORM */}
      <div className="flex flex-col justify-center items-center p-8 bg-[#0c0c0e] relative overflow-y-auto">
        <div className="md:hidden absolute top-[-10%] right-[-10%] w-[80%] h-[80%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[400px] space-y-6 z-10 py-6">

          {/* Mobile logo */}
          <div className="flex md:hidden items-center justify-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-zinc-950 font-black text-sm">AP</div>
            <span className="text-base font-black uppercase tracking-[0.25em] text-white">AUTOFLOW</span>
          </div>

          {/* Header */}
          <div className="space-y-1.5">
            <h2 className="text-3xl font-black text-white tracking-tight uppercase">Register Account</h2>
            <p className="text-xs text-zinc-500 font-medium">
              Create your new automation profile. All registrations require administrator approval.
            </p>
          </div>

          {/* Milestone Step Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase tracking-wider px-1">
              <span>Progress</span>
              <span className="text-[#10b981]">{STAGES.find(s => s.id === stage)?.pct || 20}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 ease-out"
                style={{ width: `${STAGES.find(s => s.id === stage)?.pct || 20}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-bold text-zinc-600">
              {STAGES.map((s) => (
                <span key={s.id} className={stage >= s.id ? "text-zinc-400 font-black" : ""}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs font-semibold">{error}</div>
          )}
          {success && stage === 4 && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold space-y-2 text-center">
              <div className="text-2xl">⏳</div>
              <p className="font-bold text-sm">Registration Successfully Submitted!</p>
              <p className="text-zinc-400 font-medium leading-relaxed">
                Your profile is now pending review by your Organization Admin. Once approved, you will receive an OTP via email to verify and configure your password.
              </p>
            </div>
          )}

          {/* Animated Stage Panels */}
          <div
            className={`transition-all duration-200 ease-out ${slideClass}`}
            style={{ willChange: "transform, opacity" }}
          >
            <form onSubmit={handleSubmit(onSubmit)}>

              {/* ── STAGE 1: Account Details ── */}
              {stage === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Full Name</label>
                    <input type="text" {...register("name")} className={inputCls(!!errors.name)} />
                    {errors.name && <p className="text-[10px] text-rose-500 pl-1">{errors.name.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Work Email</label>
                    <input type="email" {...register("email")} className={inputCls(!!errors.email)} />
                    {errors.email && <p className="text-[10px] text-rose-500 pl-1">{errors.email.message}</p>}
                  </div>

                  <button type="button" onClick={handleStage1Next} className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all duration-200 mt-2">
                    Next — Verify Email →
                  </button>
                </div>
              )}

              {/* ── STAGE 2: OTP Verification ── */}
              {stage === 2 && (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 rounded-full bg-zinc-800 border-2 border-[#10b981] flex items-center justify-center text-2xl mx-auto">✉️</div>
                    <p className="text-sm font-bold text-zinc-300">Verify your email</p>
                    <p className="text-xs text-zinc-500 font-medium font-mono">
                      Sent confirmation code to <span className="text-[#10b981] font-bold">{emailValue}</span>
                    </p>
                  </div>

                  {!otpVerified ? (
                    <>
                      <div className="flex gap-2 justify-center">
                        {otpValue.map((digit, idx) => (
                          <input
                            key={idx}
                            id={`otp-${idx}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpInput(idx, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                            className="w-11 h-12 text-center text-lg font-black text-white bg-zinc-900 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981] transition-all"
                          />
                        ))}
                      </div>

                      {otpError && <p className="text-[10px] text-rose-400 text-center font-bold">{otpError}</p>}

                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={otpLoading}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all"
                      >
                        {otpLoading ? "Verifying..." : "Verify Code"}
                      </button>

                      <div className="text-center">
                        {cooldown > 0 ? (
                          <span className="text-[10px] text-zinc-650 font-bold">Resend OTP in {cooldown}s</span>
                        ) : (
                          <button type="button" onClick={handleSendOtp} disabled={otpLoading} className="text-xs text-zinc-500 hover:text-zinc-300 font-bold transition-colors">
                            Resend verification code
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-1">
                      <div className="text-xl">✅</div>
                      <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Email verified</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button type="button" onClick={() => goToStage(1, "back")} className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-black text-xs uppercase tracking-widest rounded-xl border border-zinc-800 transition-all">← Back</button>
                  </div>
                </div>
              )}

              {/* ── STAGE 3: Work Info & Organization Validation ── */}
              {stage === 3 && (
                <div className="space-y-4">
                  
                  {/* Organization field with dynamic SVG checkmark / SVG X validation */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Organization</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        {...register("organizationName")} 
                        onBlur={handleVerifyOrganizationName}
                        onChange={() => setOrgCheckState("idle")}
                        className={inputCls(!!errors.organizationName || orgCheckState === "invalid") + " pr-10"} 
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        {orgCheckState === "verifying" && (
                          <svg className="animate-spin h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        )}
                        {orgCheckState === "valid" && (
                          <svg className="h-5 w-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {orgCheckState === "invalid" && (
                          <svg className="h-5 w-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                    {orgCheckState === "invalid" && <p className="text-[10px] text-rose-500 pl-1 font-bold">Organization not recognized.</p>}
                    {errors.organizationName && <p className="text-[10px] text-rose-500 pl-1">{errors.organizationName.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Employee ID</label>
                      <input type="text" {...register("employeeId")} className={inputCls(!!errors.employeeId)} />
                      {errors.employeeId && <p className="text-[10px] text-rose-500 pl-1">{errors.employeeId.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Phone</label>
                      <input type="text" {...register("phone")} className={inputCls()} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Department</label>
                      <input type="text" {...register("department")} className={inputCls()} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Designation</label>
                      <input type="text" {...register("designation")} className={inputCls()} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Requested Role</label>
                    <select {...register("role")} className={inputCls(!!errors.role) + " bg-zinc-900"}>
                      <option value="Reviewer" className="bg-[#0c0c0e] text-white">Reviewer</option>
                      <option value="Approver" className="bg-[#0c0c0e] text-white">Approver</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => goToStage(2, "back")} className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-black text-xs uppercase tracking-widest rounded-xl border border-zinc-800 transition-all">← Back</button>
                    <button 
                      type="submit" 
                      disabled={loading || orgCheckState !== "valid"}
                      className="flex-[2] py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all"
                    >
                      {loading ? "Submitting..." : "Submit Registry →"}
                    </button>
                  </div>
                </div>
              )}

            </form>
          </div>

          <div className="text-center text-xs font-semibold text-zinc-500 pt-2">
            Already have an account?{" "}
            <button onClick={() => router.push("/login")} className="text-[#10b981] hover:text-emerald-400 font-bold transition-colors">
              Log in here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
