"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useReferralClaim } from "@/lib/hooks/use-referral-claim";

function clickRainbowKitConnect() {
  const el = document.querySelector<HTMLElement>("[data-testid='rk-connect-button']");
  el?.click();
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function LandioRewardsController() {
  const { address, isConnected } = useAccount();
  const { pendingRewardsFormatted, canClaim, claim, isClaiming } = useReferralClaim();

  useEffect(() => {
    // Claim card values
    const claimValue = document.querySelector<HTMLElement>(".claim-amount-value");
    const claimUsd = document.querySelector<HTMLElement>(".claim-amount-usd");
    const claimBtn = document.querySelector<HTMLButtonElement>(".claim-btn");

    if (claimValue) claimValue.textContent = `${pendingRewardsFormatted} BNB`;
    if (claimUsd) claimUsd.textContent = "";

    if (claimBtn) {
      claimBtn.disabled = isClaiming;
      claimBtn.textContent = !isConnected
        ? "Connect Wallet"
        : isClaiming
        ? "Claiming..."
        : canClaim
        ? "Claim Rewards"
        : "No Rewards";

      const onClick = (e: Event) => {
        e.preventDefault();
        if (!isConnected) {
          clickRainbowKitConnect();
          return;
        }
        if (!canClaim || isClaiming) return;
        claim();
      };

      claimBtn.removeAttribute("onclick");
      claimBtn.addEventListener("click", onClick);

      // Referral link box
      const referralInput = document.querySelector<HTMLInputElement>(".referral-link-input");
      const copyBtn = document.querySelector<HTMLButtonElement>(".copy-btn");

      const origin = window.location.origin;
      const link = address ? `${origin}/referrals?ref=${address}` : `${origin}/referrals`;
      if (referralInput) referralInput.value = address ? `${origin}/r/${shortAddress(address)}` : link;

      const onCopy = async (evt: Event) => {
        evt.preventDefault();
        const value = referralInput?.value ?? link;
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // ignore
        }
      };

      if (copyBtn) {
        copyBtn.removeAttribute("onclick");
        copyBtn.addEventListener("click", onCopy);
      }

      return () => {
        claimBtn.removeEventListener("click", onClick);
        if (copyBtn) copyBtn.removeEventListener("click", onCopy);
      };
    }

    return;
  }, [address, canClaim, claim, isClaiming, isConnected, pendingRewardsFormatted]);

  return null;
}
