"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const ReferralsPanel = dynamic(
  () => import("@/components/referrals/referrals-panel").then((mod) => mod.ReferralsPanel),
  { 
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-sp-border bg-sp-surface p-8 text-center">
        <div className="animate-pulse text-sp-muted">Chargement...</div>
      </div>
    ),
  }
);

export default function ReferralsPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-h1 font-bold text-sp-text">Referrals</h1>
      <p className="mt-1 text-caption text-sp-muted">
        Invitez vos amis et gagnez des récompenses sur leurs swaps
      </p>
      <div className="mt-6">
        <Suspense fallback={<div className="text-sp-muted">Chargement...</div>}>
          <ReferralsPanel />
        </Suspense>
      </div>
    </div>
  );
}
