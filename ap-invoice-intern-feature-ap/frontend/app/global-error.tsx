"use client";
import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">Critical System Error</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
              A fatal error occurred. Please refresh the page or contact support if the issue persists.
            </p>
            <button
              onClick={() => reset()}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold py-3 rounded-xl shadow-sm hover:scale-[1.02] transition-transform"
            >
              Reload System
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
