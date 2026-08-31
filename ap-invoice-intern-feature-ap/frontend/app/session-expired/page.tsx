"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function SessionExpiredPage() {
  const router = useRouter();

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
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-rose-500/5 blur-[120px] pointer-events-none anim-glow-circle" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none anim-glow-circle" />

      <div className="w-full max-w-md bg-[#0c0c0e]/85 backdrop-blur-xl border border-zinc-900 rounded-3xl p-8 shadow-2xl relative z-10 text-center space-y-8 anim-float">
        
        {/* Top Logo / Lock Icon */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-450 shadow-lg shadow-rose-500/5 mb-2">
            <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-[#10b981] flex items-center justify-center text-zinc-950 font-black text-xs">
              AP
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white">
              AUTOFLOW
            </span>
          </div>
        </div>

        {/* Messaging */}
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            Session Expired
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed font-medium max-w-sm mx-auto">
            Your authorization session has expired or become invalid. To protect sensitive financial data pipelines, sessions are automatically terminated. Please re-authenticate.
          </p>
        </div>

        {/* Redirect Button */}
        <button
          onClick={() => router.push("/login")}
          className="w-full py-3.5 bg-[#10b981] hover:bg-emerald-450 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all duration-200"
        >
          LOG BACK IN
        </button>

        {/* Subtitle / Note */}
        <div className="text-[9px] font-black text-zinc-650 uppercase tracking-widest border-t border-zinc-900/80 pt-4">
          <span>Enterprise MFA · RBAC Auditing</span>
        </div>
      </div>
    </div>
  );
}
