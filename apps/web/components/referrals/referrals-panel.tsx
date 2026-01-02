"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/cn";
import { useReferralClaim } from "@/lib/hooks/use-referral-claim";

/* ========================================
   TYPES
   ======================================== */
interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalEarnings: string;
  pendingRewards: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
}

interface ReferralUser {
  address: string;
  joinedAt: Date;
  totalVolume: string;
  yourEarnings: string;
  status: "active" | "inactive";
}

/* ========================================
   CONSTANTS
   ======================================== */
const REFERRAL_TIERS = {
  bronze: { minReferrals: 0, commission: 5, color: "from-amber-600 to-amber-700" },
  silver: { minReferrals: 5, commission: 7.5, color: "from-gray-400 to-gray-500" },
  gold: { minReferrals: 20, commission: 10, color: "from-yellow-400 to-yellow-500" },
  platinum: { minReferrals: 50, commission: 15, color: "from-purple-400 to-purple-500" },
};

/* ========================================
   MOCK DATA (will be replaced with real API)
   ======================================== */
const MOCK_STATS: ReferralStats = {
  totalReferrals: 12,
  activeReferrals: 8,
  totalEarnings: "0.0542",
  pendingRewards: "0.0123",
  tier: "silver",
};

const MOCK_REFERRALS: ReferralUser[] = [
  {
    address: "0x1234...5678",
    joinedAt: new Date("2025-12-15"),
    totalVolume: "$2,450",
    yourEarnings: "0.0082 BNB",
    status: "active",
  },
  {
    address: "0xabcd...ef01",
    joinedAt: new Date("2025-12-20"),
    totalVolume: "$1,200",
    yourEarnings: "0.0041 BNB",
    status: "active",
  },
  {
    address: "0x9876...5432",
    joinedAt: new Date("2025-12-25"),
    totalVolume: "$580",
    yourEarnings: "0.0019 BNB",
    status: "active",
  },
];

/* ========================================
   COMPONENTS
   ======================================== */
function StatCard({ 
  label, 
  value, 
  subValue,
  icon,
  highlight = false,
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-all",
      highlight 
        ? "border-sp-accent/40 bg-sp-accent/10 shadow-glow" 
        : "border-sp-border bg-sp-surface2 hover:border-sp-borderHover"
    )}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-micro text-sp-muted uppercase tracking-wider">{label}</div>
          <div className={cn(
            "mt-1 text-h2 font-bold",
            highlight ? "text-sp-accent" : "text-sp-text"
          )}>
            {value}
          </div>
          {subValue && (
            <div className="mt-0.5 text-caption text-sp-muted">{subValue}</div>
          )}
        </div>
        {icon && (
          <div className={cn(
            "rounded-xl p-2",
            highlight ? "bg-sp-accent/20 text-sp-accent" : "bg-sp-surface3 text-sp-muted"
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: ReferralStats["tier"] }) {
  const tierInfo = REFERRAL_TIERS[tier];
  return (
    <div className={cn(
      "inline-flex items-center gap-2 rounded-full bg-gradient-to-r px-4 py-2 text-white shadow-lg",
      tierInfo.color
    )}>
      <TierIcon tier={tier} className="h-5 w-5" />
      <span className="font-bold capitalize">{tier}</span>
      <span className="text-white/80">•</span>
      <span className="text-sm">{tierInfo.commission}% commission</span>
    </div>
  );
}

function TierIcon({ tier, className }: { tier: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
}

function ReferralLinkBox({ referralCode }: { referralCode: string }) {
  const [copied, setCopied] = useState(false);
  const referralLink = `https://swappilot.xyz?ref=${referralCode}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = referralLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [referralLink]);

  return (
    <div className="rounded-2xl border border-sp-border bg-sp-surface p-6">
      <h3 className="text-body font-semibold text-sp-text">Votre lien de parrainage</h3>
      <p className="mt-1 text-caption text-sp-muted">
        Partagez ce lien et gagnez 5% des frais de chaque swap effectué par vos filleuls
      </p>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 rounded-xl border border-sp-border bg-sp-surface2 px-4 py-3 font-mono text-sm text-sp-text truncate">
          {referralLink}
        </div>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-3 font-semibold transition-all",
            copied
              ? "bg-sp-ok text-white"
              : "bg-sp-accent text-black hover:bg-sp-accent/90"
          )}
        >
          {copied ? (
            <>
              <CheckIcon className="h-5 w-5" />
              Copié!
            </>
          ) : (
            <>
              <CopyIcon className="h-5 w-5" />
              Copier
            </>
          )}
        </button>
      </div>

      {/* Share buttons */}
      <div className="mt-4 flex gap-2">
        <ShareButton
          platform="twitter"
          link={referralLink}
          message="Swap smarter with @SwapPilot! Get the best rates across all DEXes 🚀"
        />
        <ShareButton
          platform="telegram"
          link={referralLink}
          message="Check out SwapPilot - the smartest DEX aggregator!"
        />
        <ShareButton
          platform="discord"
          link={referralLink}
        />
      </div>
    </div>
  );
}

function ShareButton({ 
  platform, 
  link, 
  message = "" 
}: { 
  platform: "twitter" | "telegram" | "discord"; 
  link: string;
  message?: string;
}) {
  const handleShare = () => {
    const encodedLink = encodeURIComponent(link);
    const encodedMessage = encodeURIComponent(message);

    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedLink}`,
      telegram: `https://t.me/share/url?url=${encodedLink}&text=${encodedMessage}`,
      discord: link, // Discord doesn't have a share URL, just copy
    };

    if (platform === "discord") {
      navigator.clipboard.writeText(`${message} ${link}`);
    } else {
      window.open(urls[platform], "_blank", "width=600,height=400");
    }
  };

  const icons = {
    twitter: <TwitterIcon className="h-5 w-5" />,
    telegram: <TelegramIcon className="h-5 w-5" />,
    discord: <DiscordIcon className="h-5 w-5" />,
  };

  const labels = {
    twitter: "Twitter",
    telegram: "Telegram",
    discord: "Discord",
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 rounded-xl border border-sp-border bg-sp-surface2 px-4 py-2 text-sm font-medium text-sp-text transition-all hover:border-sp-borderHover hover:bg-sp-surface3"
    >
      {icons[platform]}
      {labels[platform]}
    </button>
  );
}

function TierProgress({ stats }: { stats: ReferralStats }) {
  const currentTier = REFERRAL_TIERS[stats.tier];
  const tiers = Object.entries(REFERRAL_TIERS);
  const currentIndex = tiers.findIndex(([key]) => key === stats.tier);
  const nextTier = tiers[currentIndex + 1];

  const progress = nextTier
    ? ((stats.totalReferrals - currentTier.minReferrals) / 
       (nextTier[1].minReferrals - currentTier.minReferrals)) * 100
    : 100;

  return (
    <div className="rounded-2xl border border-sp-border bg-sp-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-body font-semibold text-sp-text">Progression du tier</h3>
        <TierBadge tier={stats.tier} />
      </div>

      {nextTier && (
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-sp-muted">
              {stats.totalReferrals} / {nextTier[1].minReferrals} referrals
            </span>
            <span className="font-medium text-sp-accent">
              Prochain: {nextTier[0].charAt(0).toUpperCase() + nextTier[0].slice(1)} ({nextTier[1].commission}%)
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-sp-surface3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sp-accent to-sp-accent/70 transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="mt-2 text-caption text-sp-muted">
            Plus que {nextTier[1].minReferrals - stats.totalReferrals} referrals pour débloquer {nextTier[1].commission}% de commission!
          </div>
        </div>
      )}

      {!nextTier && (
        <div className="mt-6 rounded-xl bg-sp-accent/10 p-4 text-center">
          <div className="text-2xl">🏆</div>
          <div className="mt-2 font-semibold text-sp-accent">Niveau maximum atteint!</div>
          <div className="text-caption text-sp-muted">Vous gagnez {currentTier.commission}% sur tous les swaps de vos filleuls</div>
        </div>
      )}
    </div>
  );
}

function ReferralsList({ referrals }: { referrals: ReferralUser[] }) {
  if (referrals.length === 0) {
    return (
      <div className="rounded-2xl border border-sp-border bg-sp-surface p-8 text-center">
        <div className="text-4xl">👥</div>
        <h3 className="mt-4 text-body font-semibold text-sp-text">Aucun filleul pour le moment</h3>
        <p className="mt-2 text-caption text-sp-muted">
          Partagez votre lien de parrainage pour commencer à gagner des récompenses!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sp-border bg-sp-surface overflow-hidden">
      <div className="border-b border-sp-border px-6 py-4">
        <h3 className="text-body font-semibold text-sp-text">Vos filleuls</h3>
      </div>
      <div className="divide-y divide-sp-border">
        {referrals.map((referral, index) => (
          <div key={index} className="flex items-center justify-between px-6 py-4 hover:bg-sp-surface2 transition-colors">
            <div className="flex items-center gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-sp-surface3 text-sp-muted font-mono text-sm">
                {referral.address.slice(2, 4).toUpperCase()}
              </div>
              <div>
                <div className="font-mono text-sm text-sp-text">{referral.address}</div>
                <div className="text-caption text-sp-muted">
                  Rejoint le {referral.joinedAt.toLocaleDateString("fr-FR")}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-body font-semibold text-sp-text">{referral.yourEarnings}</div>
              <div className="text-caption text-sp-muted">Volume: {referral.totalVolume}</div>
            </div>
            <div className={cn(
              "rounded-full px-3 py-1 text-micro font-medium",
              referral.status === "active" 
                ? "bg-sp-ok/10 text-sp-ok" 
                : "bg-sp-muted/10 text-sp-muted"
            )}>
              {referral.status === "active" ? "Actif" : "Inactif"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClaimRewardsCard() {
  const {
    pendingRewardsFormatted,
    totalClaimedFormatted,
    isClaiming,
    isClaimSuccess,
    canClaim,
    claim,
    claimHash,
    error,
    resetClaimState,
  } = useReferralClaim();

  const pendingFloat = parseFloat(pendingRewardsFormatted);
  const hasPending = pendingFloat > 0;

  // Show success message briefly then reset
  useEffect(() => {
    if (isClaimSuccess) {
      const timer = setTimeout(() => {
        resetClaimState();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isClaimSuccess, resetClaimState]);

  return (
    <div className="rounded-2xl border border-sp-accent/30 bg-gradient-to-br from-sp-accent/10 to-sp-accent/5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-body font-semibold text-sp-text">Récompenses à réclamer</h3>
          <div className="mt-2 text-h1 font-bold text-sp-accent">
            {parseFloat(pendingRewardsFormatted).toFixed(4)} BNB
          </div>
          <div className="mt-1 text-caption text-sp-muted">
            ≈ ${(pendingFloat * 700).toFixed(2)} USD
          </div>
          {parseFloat(totalClaimedFormatted) > 0 && (
            <div className="mt-2 text-caption text-sp-ok">
              Total réclamé: {parseFloat(totalClaimedFormatted).toFixed(4)} BNB
            </div>
          )}
        </div>
        <button
          onClick={claim}
          disabled={!canClaim || isClaiming}
          className={cn(
            "flex items-center gap-2 rounded-xl px-6 py-3 font-semibold transition-all",
            canClaim && !isClaiming
              ? "bg-sp-accent text-black hover:bg-sp-accent/90"
              : "bg-sp-surface3 text-sp-muted cursor-not-allowed"
          )}
        >
          {isClaiming ? (
            <>
              <SpinnerIcon className="h-5 w-5 animate-spin" />
              Claiming...
            </>
          ) : isClaimSuccess ? (
            <>
              <CheckIcon className="h-5 w-5" />
              Claimed!
            </>
          ) : (
            <>
              <GiftIcon className="h-5 w-5" />
              Claim
            </>
          )}
        </button>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="mt-4 rounded-xl bg-sp-error/10 border border-sp-error/30 p-3 text-caption text-sp-error">
          {error.message.includes("Amount below minimum") 
            ? "Montant inférieur au minimum requis (0.001 BNB)"
            : error.message.includes("user rejected")
            ? "Transaction annulée"
            : `Erreur: ${error.message}`
          }
        </div>
      )}
      
      {/* Success message with tx hash */}
      {isClaimSuccess && claimHash && (
        <div className="mt-4 rounded-xl bg-sp-ok/10 border border-sp-ok/30 p-3">
          <div className="text-caption text-sp-ok font-medium">Récompenses réclamées avec succès!</div>
          <a
            href={`https://bscscan.com/tx/${claimHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-micro text-sp-accent hover:underline"
          >
            Voir la transaction ↗
          </a>
        </div>
      )}
    </div>
  );
}

/* ========================================
   MAIN PANEL
   ======================================== */
export function ReferralsPanel() {
  return (
    <div className="rounded-2xl border border-sp-border bg-sp-surface p-12 text-center">
      <div className="text-6xl mb-6">🎁</div>
      <h2 className="text-h1 font-bold text-sp-text">Programme de Parrainage</h2>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-sp-accent/10 px-4 py-2 text-sp-accent font-semibold">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sp-accent opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-sp-accent"></span>
        </span>
        Coming Soon
      </div>
      <p className="mt-6 text-body text-sp-muted max-w-lg mx-auto">
        Bientôt, vous pourrez parrainer vos amis et gagner 5% des frais de chaque swap effectué par vos filleuls.
        Restez à l&apos;écoute !
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto">
        <div className="rounded-xl border border-sp-border bg-sp-surface2 p-4">
          <div className="text-h2 font-bold text-sp-accent">5%</div>
          <div className="text-caption text-sp-muted">Commission</div>
        </div>
        <div className="rounded-xl border border-sp-border bg-sp-surface2 p-4">
          <div className="text-h2 font-bold text-sp-text">∞</div>
          <div className="text-caption text-sp-muted">Filleuls illimités</div>
        </div>
        <div className="rounded-xl border border-sp-border bg-sp-surface2 p-4">
          <div className="text-h2 font-bold text-sp-text">BNB</div>
          <div className="text-caption text-sp-muted">Paiements en BNB</div>
        </div>
      </div>
    </div>
  );
}

function ReferralsPanelContent() {
  const { address, isConnected } = useAccount();

  // Generate referral code from wallet address
  const referralCode = useMemo(() => {
    if (!address) return "CONNECT_WALLET";
    return address.slice(2, 10).toUpperCase();
  }, [address]);

  // Mock data for now - will be replaced with real API calls
  const stats = MOCK_STATS;
  const referrals = MOCK_REFERRALS;

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-sp-border bg-sp-surface p-12 text-center">
        <div className="text-5xl">🔗</div>
        <h2 className="mt-4 text-h2 font-bold text-sp-text">Connectez votre wallet</h2>
        <p className="mt-2 text-body text-sp-muted max-w-md mx-auto">
          Connectez votre wallet pour accéder à votre programme de parrainage et commencer à gagner des récompenses
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Referrals"
          value={stats.totalReferrals.toString()}
          subValue={`${stats.activeReferrals} actifs`}
          icon={<UsersIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Total Gagné"
          value={`${stats.totalEarnings} BNB`}
          subValue={`≈ $${(parseFloat(stats.totalEarnings) * 700).toFixed(2)}`}
          icon={<CoinIcon className="h-5 w-5" />}
          highlight
        />
        <StatCard
          label="Commission"
          value={`${REFERRAL_TIERS[stats.tier].commission}%`}
          subValue={`Tier ${stats.tier}`}
          icon={<PercentIcon className="h-5 w-5" />}
        />
        <StatCard
          label="En attente"
          value={`${stats.pendingRewards} BNB`}
          subValue="À réclamer"
          icon={<ClockIcon className="h-5 w-5" />}
        />
      </div>

      {/* Claim Rewards */}
      <ClaimRewardsCard />

      {/* Referral Link */}
      <ReferralLinkBox referralCode={referralCode} />

      {/* Tier Progress */}
      <TierProgress stats={stats} />

      {/* Referrals List */}
      <ReferralsList referrals={referrals} />

      {/* How it works */}
      <div className="rounded-2xl border border-sp-border bg-sp-surface p-6">
        <h3 className="text-body font-semibold text-sp-text">Comment ça marche?</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-sp-surface2 p-4">
            <div className="text-2xl">1️⃣</div>
            <h4 className="mt-2 font-semibold text-sp-text">Partagez votre lien</h4>
            <p className="mt-1 text-caption text-sp-muted">
              Copiez et partagez votre lien unique avec vos amis et votre communauté
            </p>
          </div>
          <div className="rounded-xl bg-sp-surface2 p-4">
            <div className="text-2xl">2️⃣</div>
            <h4 className="mt-2 font-semibold text-sp-text">Ils font des swaps</h4>
            <p className="mt-1 text-caption text-sp-muted">
              Chaque fois qu&apos;un filleul effectue un swap, vous gagnez une commission
            </p>
          </div>
          <div className="rounded-xl bg-sp-surface2 p-4">
            <div className="text-2xl">3️⃣</div>
            <h4 className="mt-2 font-semibold text-sp-text">Réclamez vos gains</h4>
            <p className="mt-1 text-caption text-sp-muted">
              Réclamez vos récompenses en BNB directement sur votre wallet
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================
   ICONS
   ======================================== */
function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PercentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function GiftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}
