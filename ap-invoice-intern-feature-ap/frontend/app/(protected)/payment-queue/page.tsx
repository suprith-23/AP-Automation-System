"use client";

import React from "react";
import dynamic from "next/dynamic";

const PaymentQueueModule = dynamic(
  () => import("../../../components/payments/PaymentQueueModule"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-10 h-10 border-4 border-zinc-200 border-t-zinc-950 rounded-full animate-spin"></div>
        <p className="text-xs text-zinc-400">Loading AP Payment Queue Console...</p>
      </div>
    ),
  }
);

export default function PaymentQueuePage() {
  return <PaymentQueueModule />;
}
