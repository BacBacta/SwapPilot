"use client";

import { ReferralsPanel } from "@/components/referrals/referrals-panel";

export default function ReferralsPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-h1 font-bold text-sp-text">Referrals</h1>
      <p className="mt-1 text-caption text-sp-muted">
        Invitez vos amis et gagnez des récompenses sur leurs swaps
      </p>
      <div className="mt-6">
        <ReferralsPanel />
      </div>
    </div>
  );
}
