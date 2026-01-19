"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { usePilotTier, getTierDisplay } from "@/lib/hooks/use-fees";
import { triggerRainbowKitConnect } from "@/lib/wallet/connect-guard";

function clickRainbowKitConnect() {
  triggerRainbowKitConnect();
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatPilotBalance(balance: string): string {
  try {
    const balanceBigInt = BigInt(balance);
    const formatted = Number(balanceBigInt) / 1e18;
    if (formatted >= 1000000) {
      return `${(formatted / 1000000).toFixed(2)}M`;
    } else if (formatted >= 1000) {
      return `${(formatted / 1000).toFixed(2)}K`;
    }
    return formatted.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return "0";
  }
}

export function LandioRewardsController() {
  const { address, isConnected } = useAccount();
  const { data: pilotTierInfo, isLoading: isPilotTierLoading } = usePilotTier();

  // Update stats overview cards
  useEffect(() => {
    const pilotBalanceEl = document.getElementById("pilotBalance");
    const feeDiscountEl = document.getElementById("feeDiscount");
    const referralCountEl = document.getElementById("referralCount");
    const currentTierEl = document.getElementById("currentTier");

    if (!isConnected) {
      if (pilotBalanceEl) pilotBalanceEl.textContent = "—";
      if (feeDiscountEl) feeDiscountEl.textContent = "0%";
      if (referralCountEl) referralCountEl.textContent = "0";
      if (currentTierEl) currentTierEl.textContent = "—";
      return;
    }

    if (isPilotTierLoading) {
      if (pilotBalanceEl) pilotBalanceEl.textContent = "...";
      if (currentTierEl) currentTierEl.textContent = "...";
      return;
    }

    if (pilotTierInfo) {
      const tierDisplay = getTierDisplay(pilotTierInfo.tier);
      if (pilotBalanceEl) pilotBalanceEl.textContent = formatPilotBalance(pilotTierInfo.balance);
      if (feeDiscountEl) feeDiscountEl.textContent = `${pilotTierInfo.discountPercent}%`;
      if (currentTierEl) currentTierEl.textContent = pilotTierInfo.tier === "none" ? "None" : tierDisplay.name;
    }
  }, [isConnected, isPilotTierLoading, pilotTierInfo]);

  // Update PILOT holdings card
  useEffect(() => {
    const tierBadge = document.getElementById("tierBadge");
    const pilotBalanceLarge = document.getElementById("pilotBalanceLarge");
    const pilotBalanceUsd = document.getElementById("pilotBalanceUsd");

    if (!isConnected) {
      if (tierBadge) tierBadge.textContent = "Connect Wallet";
      if (pilotBalanceLarge) pilotBalanceLarge.textContent = "— PILOT";
      if (pilotBalanceUsd) pilotBalanceUsd.textContent = "Connect wallet to view";
      return;
    }

    if (isPilotTierLoading) {
      if (tierBadge) tierBadge.textContent = "Loading...";
      if (pilotBalanceLarge) pilotBalanceLarge.textContent = "... PILOT";
      return;
    }

    if (pilotTierInfo) {
      const tierDisplay = getTierDisplay(pilotTierInfo.tier);
      if (tierBadge) {
        tierBadge.textContent = pilotTierInfo.tier === "none" 
          ? "No Tier" 
          : `${tierDisplay.emoji} ${tierDisplay.name} (-${pilotTierInfo.discountPercent}%)`;
      }
      if (pilotBalanceLarge) {
        pilotBalanceLarge.textContent = `${formatPilotBalance(pilotTierInfo.balance)} PILOT`;
      }
      if (pilotBalanceUsd) {
        pilotBalanceUsd.textContent = pilotTierInfo.tier === "none"
          ? "Hold 100+ PILOT for fee discounts"
          : `${tierDisplay.emoji} ${tierDisplay.name} Tier - ${pilotTierInfo.discountPercent}% fee discount`;
      }
    }
  }, [isConnected, isPilotTierLoading, pilotTierInfo]);

  // Update tier progress section
  useEffect(() => {
    const currentTierBadge = document.getElementById("currentTierBadge");
    const tierProgress = document.getElementById("tierProgress");
    const currentHolding = document.getElementById("currentHolding");
    const nextTierTarget = document.getElementById("nextTierTarget");

    // Tier cards
    const tierCardNone = document.getElementById("tierCardNone");
    const tierCardBronze = document.getElementById("tierCardBronze");
    const tierCardSilver = document.getElementById("tierCardSilver");
    const tierCardGold = document.getElementById("tierCardGold");

    // Reset all tier cards
    [tierCardNone, tierCardBronze, tierCardSilver, tierCardGold].forEach(card => {
      if (card) {
        card.classList.remove("active", "locked");
      }
    });

    if (!isConnected) {
      if (currentTierBadge) currentTierBadge.textContent = "Connect Wallet";
      if (tierProgress) tierProgress.style.width = "0%";
      if (currentHolding) currentHolding.textContent = "0 PILOT";
      if (nextTierTarget) nextTierTarget.textContent = "100 PILOT for Bronze";
      return;
    }

    if (isPilotTierLoading || !pilotTierInfo) {
      if (currentTierBadge) currentTierBadge.textContent = "Loading...";
      return;
    }

    const tierDisplay = getTierDisplay(pilotTierInfo.tier);
    const balanceFormatted = formatPilotBalance(pilotTierInfo.balance);

    if (currentTierBadge) {
      currentTierBadge.textContent = pilotTierInfo.tier === "none"
        ? "No Tier"
        : `${tierDisplay.emoji} ${tierDisplay.name} Tier`;
    }

    if (currentHolding) {
      currentHolding.textContent = `${balanceFormatted} PILOT`;
    }

    // Calculate progress and highlight active tier
    const balanceBigInt = BigInt(pilotTierInfo.balance);
    const bronze = 100n * 10n ** 18n;
    const silver = 1000n * 10n ** 18n;
    const gold = 10000n * 10n ** 18n;

    let progressPercent = 0;
    let nextTierText = "100 PILOT for Bronze";

    if (balanceBigInt >= gold) {
      progressPercent = 100;
      nextTierText = "Max tier reached!";
      if (tierCardGold) tierCardGold.classList.add("active");
    } else if (balanceBigInt >= silver) {
      progressPercent = 66 + (Number(balanceBigInt - silver) / Number(gold - silver)) * 34;
      const needed = Number(gold - balanceBigInt) / 1e18;
      nextTierText = `${needed.toLocaleString()} more for Gold`;
      if (tierCardSilver) tierCardSilver.classList.add("active");
      if (tierCardGold) tierCardGold.classList.add("locked");
    } else if (balanceBigInt >= bronze) {
      progressPercent = 33 + (Number(balanceBigInt - bronze) / Number(silver - bronze)) * 33;
      const needed = Number(silver - balanceBigInt) / 1e18;
      nextTierText = `${needed.toLocaleString()} more for Silver`;
      if (tierCardBronze) tierCardBronze.classList.add("active");
      if (tierCardSilver) tierCardSilver.classList.add("locked");
      if (tierCardGold) tierCardGold.classList.add("locked");
    } else {
      progressPercent = (Number(balanceBigInt) / Number(bronze)) * 33;
      const needed = Number(bronze - balanceBigInt) / 1e18;
      nextTierText = `${needed.toLocaleString()} more for Bronze`;
      if (tierCardNone) tierCardNone.classList.add("active");
      if (tierCardBronze) tierCardBronze.classList.add("locked");
      if (tierCardSilver) tierCardSilver.classList.add("locked");
      if (tierCardGold) tierCardGold.classList.add("locked");
    }

    if (tierProgress) tierProgress.style.width = `${Math.min(100, progressPercent)}%`;
    if (nextTierTarget) nextTierTarget.textContent = nextTierText;
  }, [isConnected, isPilotTierLoading, pilotTierInfo]);

  // Handle referral code/link
  useEffect(() => {
    const referralCodeInput = document.getElementById("referralCode") as HTMLInputElement | null;
    const referralLinkInput = document.getElementById("referralLink") as HTMLInputElement | null;
    const copyCodeBtn = document.getElementById("copyCodeBtn");
    const copyLinkBtn = document.getElementById("copyLinkBtn");

    const origin = typeof window !== "undefined" ? window.location.origin : "https://swappilot.io";

    if (!isConnected || !address) {
      if (referralCodeInput) referralCodeInput.value = "Connect wallet to generate";
      if (referralLinkInput) referralLinkInput.value = "Connect wallet to generate";
      return;
    }

    // Generate referral code from address
    const code = address.slice(2, 10).toUpperCase();
    const link = `${origin}/swap?ref=${code}`;

    if (referralCodeInput) referralCodeInput.value = code;
    if (referralLinkInput) referralLinkInput.value = link;

    const copyCode = async () => {
      try {
        await navigator.clipboard.writeText(code);
        if (copyCodeBtn) {
          const original = copyCodeBtn.textContent;
          copyCodeBtn.textContent = "✓ Copied!";
          setTimeout(() => { copyCodeBtn.textContent = original; }, 2000);
        }
      } catch { /* ignore */ }
    };

    const copyLink = async () => {
      try {
        await navigator.clipboard.writeText(link);
        if (copyLinkBtn) {
          const original = copyLinkBtn.textContent;
          copyLinkBtn.textContent = "✓ Copied!";
          setTimeout(() => { copyLinkBtn.textContent = original; }, 2000);
        }
      } catch { /* ignore */ }
    };

    copyCodeBtn?.addEventListener("click", copyCode);
    copyLinkBtn?.addEventListener("click", copyLink);

    return () => {
      copyCodeBtn?.removeEventListener("click", copyCode);
      copyLinkBtn?.removeEventListener("click", copyLink);
    };
  }, [isConnected, address]);

  // Connect wallet button in nav
  useEffect(() => {
    const navConnectBtn = document.querySelector<HTMLButtonElement>(".nav-right .btn-secondary");
    
    if (navConnectBtn) {
      if (isConnected && address) {
        navConnectBtn.textContent = shortAddress(address);
      } else {
        navConnectBtn.textContent = "Connect Wallet";
      }

      const onClick = (e: Event) => {
        e.preventDefault();
        clickRainbowKitConnect();
      };

      navConnectBtn.addEventListener("click", onClick);
      return () => navConnectBtn.removeEventListener("click", onClick);
    }
  }, [isConnected, address]);

  return null;
}
