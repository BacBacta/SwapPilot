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

function parsePilotBalance(balance: string): number {
  try {
    return Number(BigInt(balance)) / 1e18;
  } catch {
    return 0;
  }
}

type TierKey = "none" | "bronze" | "silver" | "gold";

const STAKING_BASE_APY: Record<TierKey, number> = {
  none: 12,
  bronze: 14,
  silver: 16,
  gold: 20,
};

function getStakingStorageKey(address?: string): string | null {
  if (!address) return null;
  return `sp:staking:${address.toLowerCase()}`;
}

function formatStakeAmount(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} PILOT`;
}

function formatReward(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} PILOT`;
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

  // PILOT staking simulation + methodology
  useEffect(() => {
    const amountInput = document.getElementById("stakingAmountInput") as HTMLInputElement | null;
    const lockSelect = document.getElementById("stakingLockSelect") as HTMLSelectElement | null;
    const maxBtn = document.getElementById("stakingMaxBtn") as HTMLButtonElement | null;
    const stakeBtn = document.getElementById("stakePilotBtn") as HTMLButtonElement | null;
    const unstakeBtn = document.getElementById("unstakePilotBtn") as HTMLButtonElement | null;

    const stakedAmountValue = document.getElementById("stakedAmountValue");
    const effectiveApyValue = document.getElementById("effectiveApyValue");
    const dailyRewardValue = document.getElementById("dailyRewardValue");
    const periodRewardValue = document.getElementById("periodRewardValue");
    const statusText = document.getElementById("stakingStatusText");
    const apyBadge = document.getElementById("stakingApyBadge");

    if (
      !amountInput ||
      !lockSelect ||
      !maxBtn ||
      !stakeBtn ||
      !unstakeBtn ||
      !stakedAmountValue ||
      !effectiveApyValue ||
      !dailyRewardValue ||
      !periodRewardValue ||
      !statusText ||
      !apyBadge
    ) {
      return;
    }

    const walletBalance = pilotTierInfo ? parsePilotBalance(pilotTierInfo.balance) : 0;
    const currentTier = (pilotTierInfo?.tier ?? "none") as TierKey;
    const baseApy = STAKING_BASE_APY[currentTier] ?? STAKING_BASE_APY.none;

    const storageKey = getStakingStorageKey(address);
    let stakedAmount = 0;
    if (storageKey) {
      try {
        stakedAmount = Number(window.localStorage.getItem(storageKey) || "0") || 0;
      } catch {
        stakedAmount = 0;
      }
    }

    const compute = () => {
      const lockDays = Number(lockSelect.value || "30");
      const lockBonus = lockDays >= 180 ? 4 : lockDays >= 90 ? 2 : 0;
      const effectiveApy = baseApy + lockBonus;
      const apr = Math.log(1 + effectiveApy / 100);
      const dailyRate = apr / 365;
      const dailyReward = stakedAmount * dailyRate;
      const periodReward = stakedAmount * (Math.pow(1 + dailyRate, lockDays) - 1);

      stakedAmountValue.textContent = formatStakeAmount(stakedAmount);
      effectiveApyValue.textContent = `${effectiveApy.toFixed(1)}%`;
      apyBadge.textContent = `${effectiveApy.toFixed(1)}% APY`;
      dailyRewardValue.textContent = formatReward(dailyReward);
      periodRewardValue.textContent = formatReward(periodReward);

      const inputAmount = Number(amountInput.value || "0");
      const canStake = isConnected && inputAmount > 0 && inputAmount <= walletBalance;
      stakeBtn.disabled = !canStake;
      unstakeBtn.disabled = !isConnected || stakedAmount <= 0;

      if (!isConnected) {
        statusText.textContent = "Connect wallet to start staking simulation.";
      } else if (inputAmount > walletBalance) {
        statusText.textContent = `Insufficient PILOT balance. Max available: ${walletBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`;
      } else if (stakedAmount > 0) {
        statusText.textContent = `Staking active: ${formatStakeAmount(stakedAmount)} · Lock: ${lockDays} days · Tier base APY: ${baseApy.toFixed(1)}%`;
      } else {
        statusText.textContent = `Ready to stake. Tier base APY: ${baseApy.toFixed(1)}% (${currentTier.toUpperCase()}).`;
      }
    };

    if (!isConnected) {
      amountInput.value = "";
      amountInput.disabled = true;
      lockSelect.disabled = true;
      maxBtn.disabled = true;
      stakeBtn.disabled = true;
      unstakeBtn.disabled = true;
      stakedAmount = 0;
    } else {
      amountInput.disabled = false;
      lockSelect.disabled = false;
      maxBtn.disabled = false;
    }

    const onInput = () => compute();
    const onLockChange = () => compute();
    const onMax = () => {
      amountInput.value = walletBalance > 0 ? walletBalance.toFixed(2) : "0";
      compute();
    };
    const onStake = () => {
      const value = Number(amountInput.value || "0");
      if (!Number.isFinite(value) || value <= 0 || value > walletBalance) return;
      stakedAmount = value;
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, value.toString());
        } catch {
          // no-op
        }
      }
      amountInput.value = "";
      compute();
    };
    const onUnstake = () => {
      stakedAmount = 0;
      if (storageKey) {
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          // no-op
        }
      }
      compute();
    };

    amountInput.addEventListener("input", onInput);
    lockSelect.addEventListener("change", onLockChange);
    maxBtn.addEventListener("click", onMax);
    stakeBtn.addEventListener("click", onStake);
    unstakeBtn.addEventListener("click", onUnstake);

    compute();

    return () => {
      amountInput.removeEventListener("input", onInput);
      lockSelect.removeEventListener("change", onLockChange);
      maxBtn.removeEventListener("click", onMax);
      stakeBtn.removeEventListener("click", onStake);
      unstakeBtn.removeEventListener("click", onUnstake);
    };
  }, [isConnected, address, pilotTierInfo]);

  return null;
}
