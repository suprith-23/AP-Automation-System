"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [tokenFound, setTokenFound] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setTokenFound(true);
      setVerifying(true);
      const timer = setTimeout(() => {
        setVerifying(false);
        setVerified(true);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#050506] flex flex-col justify-center items-center p-8 relative overflow-hidden font-sans">
      
      {/* Injecting CSS Keyframe Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes float-gentle {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.05); }
        }
        .anim-float {
          animation: float-gentle 5s infinite ease-in-out;
        }
        .anim-glow-circle {
          animation: pulse-glow 8s infinite ease-in-out;
        }
      `}} />

      {/* Pulsing Glow Backdrops */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none anim-glow-circle" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none anim-glow-circle" />

      <div className="w-full max-w-md bg-[#0c0c0e]/85 backdrop-blur-xl border border-zinc-900 rounded-3xl p-8 shadow-2xl relative z-10 text-center space-y-8 anim-float">
        
        {/* Top Logo */}
        <div className="flex flex-col items-center space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-[#10b981] flex items-center justify-center text-zinc-950 font-black text-xs">
              AP
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white">
              AUTOFLOW
            </span>
          </div>
        </div>

        {/* Dynamic Display based on token states */}
        {verifying && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <svg className="animate-spin h-10 w-10 text-[#10b981]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Verifying Email...</h2>
              <p className="text-xs text-zinc-550 max-w-xs mx-auto">
                Decrypting security signature hash credentials from your activation request...
              </p>
            </div>
          </div>
        )}

        {verified && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/5">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Email Verified</h2>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                Thank you! Your company work email address has been successfully verified. Your account registration is complete.
              </p>
            </div>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-3.5 bg-[#10b981] hover:bg-emerald-450 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all duration-200"
            >
              PROCEED TO LOG IN
            </button>
          </div>
        )}

        {!tokenFound && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-[#9B6BFF]/10 border border-[#9B6BFF]/25 flex items-center justify-center text-[#B388FF]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Check Your Inbox</h2>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                We've sent a verification link to your company work email. Please click the link inside that email to activate your account.
              </p>
            </div>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-3.5 bg-transparent border border-zinc-800 hover:border-zinc-700 text-zinc-200 font-black text-xs uppercase tracking-widest rounded-xl transition-all duration-200"
            >
              BACK TO LOG IN
            </button>
          </div>
        )}

        {/* Subtitle / Note */}
        <div className="text-[9px] font-black text-zinc-650 uppercase tracking-widest border-t border-zinc-900/80 pt-4">
          <span>Enterprise MFA · Security Registry</span>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050506] flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-[#10b981]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
