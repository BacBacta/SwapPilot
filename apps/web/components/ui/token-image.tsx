"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

/* ========================================
   TOKEN ICONS - URLs for common tokens
   ======================================== */
export const TOKEN_ICONS: Record<string, string> = {
  BNB: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  USDT: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  BUSD: "https://assets.coingecko.com/coins/images/9576/small/BUSD.png",
  CAKE: "https://assets.coingecko.com/coins/images/12632/small/pancakeswap-cake-logo.png",
  WBNB: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  BTCB: "https://assets.coingecko.com/coins/images/14108/small/Binance-bitcoin.png",
  DAI: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
  XRP: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
  ADA: "https://assets.coingecko.com/coins/images/975/small/cardano.png",
  DOGE: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png",
  MATIC: "https://assets.coingecko.com/coins/images/4713/small/polygon.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  DOT: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png",
  LINK: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  UNI: "https://assets.coingecko.com/coins/images/12504/small/uni.jpg",
  AVAX: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
};

/* ========================================
   TOKEN IMAGE COMPONENT
   ======================================== */
interface TokenImageProps {
  symbol: string;
  src?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  fallbackClassName?: string;
}

const sizeMap = {
  xs: 20,
  sm: 24,
  md: 28,
  lg: 32,
  xl: 40,
};

export function TokenImage({
  symbol,
  src,
  size = "md",
  className,
  fallbackClassName,
}: TokenImageProps) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = src ?? TOKEN_ICONS[symbol];
  const pixelSize = sizeMap[size];

  // Fallback to initials
  if (hasError || !imageUrl) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-full bg-sp-accent text-micro font-bold text-black",
          fallbackClassName
        )}
        style={{ width: pixelSize, height: pixelSize }}
      >
        {symbol.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={symbol}
      width={pixelSize}
      height={pixelSize}
      className={cn("rounded-full", className)}
      onError={() => setHasError(true)}
      unoptimized={imageUrl.includes("walletconnect")} // Skip optimization for dynamic URLs
    />
  );
}

/* ========================================
   CHAIN IMAGE COMPONENT
   ======================================== */
interface ChainImageProps {
  name: string;
  iconUrl?: string | undefined;
  iconBackground?: string | undefined;
  size?: number | undefined;
  className?: string | undefined;
}

export function ChainImage({
  name,
  iconUrl,
  iconBackground,
  size = 20,
  className,
}: ChainImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !iconUrl) {
    return (
      <div
        className={cn("grid place-items-center rounded-full bg-sp-surface3 text-[8px] font-bold text-sp-muted", className)}
        style={{ width: size, height: size, background: iconBackground }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-hidden rounded-full", className)}
      style={{ width: size, height: size, background: iconBackground }}
    >
      <Image
        src={iconUrl}
        alt={name}
        width={size}
        height={size}
        className="h-full w-full"
        onError={() => setHasError(true)}
        unoptimized // Chain icons often come from dynamic sources
      />
    </div>
  );
}
