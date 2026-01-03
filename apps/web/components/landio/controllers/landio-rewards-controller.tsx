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
  const { 
    pendingRewardsFormatted, 
    totalClaimedFormatted,
    canClaim, 
    claim, 
    isClaiming 
  } = useReferralClaim();

  // Neutralize hardcoded stats in the overview section
  useEffect(() => {
    // Stats overview cards - replace with real or placeholder values
    const statsCards = document.querySelectorAll<HTMLElement>(".rewards-stat-card");
    
    statsCards.forEach((card) => {
      const title = card.querySelector<HTMLElement>(".stat-label, .stat-title");
      const value = card.querySelector<HTMLElement>(".stat-value");
      
      if (!title || !value) return;
      const label = title.textContent?.toLowerCase() ?? "";
      
      if (label.includes("earned") || label.includes("total")) {
        // Total claimed from smart contract
        value.textContent = isConnected ? `${totalClaimedFormatted} BNB` : "—";
      } else if (label.includes("apy")) {
        // APY is not available from smart contract yet
        value.textContent = "—";
      } else if (label.includes("referral")) {
        // Referral count not tracked yet
        value.textContent = "—";
      } else if (label.includes("tier")) {
        // Tier system not implemented yet
        value.textContent = "—";
      }
    });

    // Staking section - show placeholder
    const stakingBalance = document.querySelector<HTMLElement>(".staking-balance-value");
    const stakingUsd = document.querySelector<HTMLElement>(".staking-balance-usd");
    if (stakingBalance) stakingBalance.textContent = isConnected ? "0 PILOT" : "—";
    if (stakingUsd) stakingUsd.textContent = "";

    // APY badge
    const apyBadge = document.querySelector<HTMLElement>(".apy-badge");
    if (apyBadge) apyBadge.textContent = "APY —";

    // Tier progress
    const tierProgress = document.querySelector<HTMLElement>(".tier-progress-label");
    const tierBar = document.querySelector<HTMLElement>(".tier-progress-fill");
    if (tierProgress) tierProgress.textContent = "Tier system coming soon";
    if (tierBar) tierBar.style.width = "0%";

    // Rewards breakdown - show real claimable, placeholder for others
    const breakdownItems = document.querySelectorAll<HTMLElement>(".breakdown-item");
    breakdownItems.forEach((item) => {
      const label = item.querySelector<HTMLElement>(".breakdown-label");
      const value = item.querySelector<HTMLElement>(".breakdown-value");
      if (!label || !value) return;
      
      const labelText = label.textContent?.toLowerCase() ?? "";
      if (labelText.includes("referral")) {
        value.textContent = isConnected ? `${pendingRewardsFormatted} BNB` : "—";
      } else {
        value.textContent = "—";
      }
    });

    // Referral stats
    const referralStats = document.querySelectorAll<HTMLElement>(".referral-stat-value");
    referralStats.forEach((stat) => {
      stat.textContent = "—";
    });

    // History section - clear and show placeholder
    const historyList = document.querySelector<HTMLElement>(".rewards-history-list");
    if (historyList) {
      historyList.innerHTML = `
        <div style="text-align: center; padding: 32px; color: var(--text-muted);">
          <p>Transaction history will appear here once you claim rewards.</p>
        </div>
      `;
    }
  }, [isConnected, totalClaimedFormatted, pendingRewardsFormatted]);

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
