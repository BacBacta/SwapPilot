"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

/* ========================================
   TOKEN ICONS - URLs for common tokens
   ======================================== */
export const TOKEN_ICONS: Record<string, string> = {
  // Use API proxy to avoid loading third-party images directly in the browser.
  // Prefer same-origin rewrite (/api/v1/...) when NEXT_PUBLIC_API_URL is configured.
  BNB: "/api/v1/token-image/0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  WBNB: "/api/v1/token-image/0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  ETH: "/api/v1/token-image/0x2170ed0880ac9a755fd29b2688956bd959f933f8",
  USDT: "/api/v1/token-image/0x55d398326f99059ff775485246999027b3197955",
  USDC: "/api/v1/token-image/0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
  BUSD: "/api/v1/token-image/0xe9e7cea3dedca5984780bafc599bd69add087d56",
  CAKE: "/api/v1/token-image/0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
  BTCB: "/api/v1/token-image/0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c",
  DAI: "/api/v1/token-image/0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3",
  XRP: "/api/v1/token-image/0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe",
  ADA: "/api/v1/token-image/0x3ee2200efb3400fabb9aacf31297cbdd1d435d47",
  DOGE: "/api/v1/token-image/0xba2ae424d960c26247dd6c32edc70b295c744c43",
  MATIC: "/api/v1/token-image/0xcc42724c6683b7e57334c4e856f4c9965ed682bd",
  SOL: "/api/v1/token-image/0x570a5d26f7765ecb712c0924e4de545b89fd43df",
  DOT: "/api/v1/token-image/0x7083609fce4d1d8dc0c979aab8c869ea2c873402",
  LINK: "/api/v1/token-image/0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd",
  UNI: "/api/v1/token-image/0xbf5140a22578168fd562dccf235e5d43a02ce9b1",
  AVAX: "/api/v1/token-image/0x1ce0c2827e2ef14d5c4f29a091d735a204794041",
};

/* ========================================
   TOKEN IMAGE COMPONENT
   ======================================== */
interface TokenImageProps {
  symbol: string;
  src?: string | undefined;
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

  // Avoid Next.js optimizer for some third-party hosts that may block server-side fetches
  // (causing noisy logs like: "upstream image response failed ... 403").
  const unoptimized =
    imageUrl.includes("assets.coingecko.com") ||
    imageUrl.includes("walletconnect") ||
    imageUrl.includes("trustwallet") ||
    imageUrl.includes("swappilot-api.fly.dev") ||
    imageUrl.startsWith("/api/v1/token-image/");

  return (
    <Image
      src={imageUrl}
      alt={symbol}
      width={pixelSize}
      height={pixelSize}
      className={cn("rounded-full", className)}
      onError={() => setHasError(true)}
      unoptimized={unoptimized}
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
