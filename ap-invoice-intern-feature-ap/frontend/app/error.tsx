"use client";
import React, { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Phase 10: Sentry Integration will log the error here
    console.error("Caught in Error Boundary:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 mb-6">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">Something went wrong!</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
          An unexpected error occurred in the application. We have been notified and are looking into it.
        </p>
        <button
          onClick={() => reset()}
          className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold py-3 rounded-xl shadow-sm hover:scale-[1.02] transition-transform"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
