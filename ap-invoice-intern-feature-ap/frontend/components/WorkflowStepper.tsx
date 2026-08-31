import React from "react";
import { Invoice } from "../types/invoice";

type Props = {
  invoice: Invoice;
};

type StepState = "complete" | "current" | "upcoming" | "error";

interface Step {
  label: string;
  state: StepState;
}

export default function WorkflowStepper({ invoice }: Props) {
  const vStatus = (invoice.validation_status || "").toUpperCase();
  const wfStatus = (invoice.workflow_status || invoice.status || "").toLowerCase();

  // Determine step states based on invoice status
  const steps: Step[] = [
    { label: "Uploaded", state: "complete" },
    { label: "Validation", state: "upcoming" },
    { label: "Review", state: "upcoming" },
    { label: "Approval", state: "upcoming" },
    { label: "Processed", state: "upcoming" },
  ];

  // 1. Validation Logic
  if (vStatus === "FAILED" || wfStatus === "validation_failed") {
    steps[1].state = "error";
  } else if (vStatus === "PASSED" || ["pending_review", "pending_approval", "approved", "rejected"].includes(wfStatus)) {
    steps[1].state = "complete";
  } else {
    steps[1].state = "current";
  }

  // 2. Review Logic
  if (steps[1].state === "complete") {
    if (wfStatus === "pending_review") {
      steps[2].state = "current";
    } else if (["pending_approval", "approved"].includes(wfStatus)) {
      steps[2].state = "complete";
    } else if (wfStatus === "rejected") {
      // Could be rejected at review
      steps[2].state = "error";
    }
  }

  // 3. Approval Logic
  if (steps[2].state === "complete") {
    if (wfStatus === "pending_approval") {
      steps[3].state = "current";
    } else if (wfStatus === "approved") {
      steps[3].state = "complete";
    } else if (wfStatus === "rejected") {
      // Rejected at approval
      steps[3].state = "error";
    }
  }

  // 4. Processed Logic
  if (wfStatus === "approved") {
    steps[4].state = "complete";
  } else if (wfStatus === "rejected") {
    steps[4].state = "error";
  }

  return (
    <div className="w-full px-4 sm:px-8 pb-6 pt-2">
      <div className="flex items-center justify-between relative">
        {/* Background Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-200 dark:bg-zinc-800 z-0"></div>
        
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          
          let circleColor = "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-550";
          let labelColor = "text-zinc-400 dark:text-zinc-500";
          let icon = null;

          if (step.state === "complete") {
            circleColor = "bg-emerald-500 border-emerald-500 text-white shadow-sm hover:scale-[1.08] transition-transform duration-300";
            labelColor = "text-emerald-700 font-bold";
            icon = (
              <svg className="w-4 h-4 animate-logo-pop" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            );
          } else if (step.state === "current") {
            circleColor = "bg-indigo-600 border-indigo-600 text-white shadow-md ring-4 ring-indigo-100 dark:ring-indigo-900/50 animate-pulse hover:scale-[1.08] transition-transform duration-300";
            labelColor = "text-indigo-700 font-bold";
            icon = <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping"></div>;
          } else if (step.state === "error") {
            circleColor = "bg-rose-500 border-rose-500 text-white shadow-sm hover:scale-[1.08] transition-transform duration-300";
            labelColor = "text-rose-600 font-bold";
            icon = (
              <svg className="w-4 h-4 animate-shake" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            );
          }

          return (
            <div key={step.label} className="relative z-10 flex flex-col items-center group">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 hover:scale-[1.1] ${circleColor}`}
              >
                {icon}
              </div>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                <span className={`text-[11px] uppercase tracking-wider transition-colors duration-300 ${labelColor}`}>
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
