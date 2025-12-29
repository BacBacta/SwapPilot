export type ProviderId = "SwapPilot" | "1inch" | "OKX" | "PancakeSwap" | "KyberSwap" | "MetaMask" | "Binance" | "Paraswap";

export type QuoteRow = {
  provider: ProviderId;
  outUsd: number;
  deltaPct?: number;
  confidence: number; // 0..100
  flags: ("BEQ" | "RAW" | "MEV" | "SELL_OK" | "SELL_UNCERTAIN")[];
};

export const bestExecutable: QuoteRow[] = [
  { provider: "SwapPilot", outUsd: 13975, deltaPct: 0.0, confidence: 92, flags: ["BEQ","SELL_OK"] },
  { provider: "OKX", outUsd: 13228, deltaPct: -5.3, confidence: 90, flags: ["BEQ","SELL_OK"] },
  { provider: "1inch", outUsd: 12805, deltaPct: -8.4, confidence: 88, flags: ["BEQ","SELL_UNCERTAIN"] },
  { provider: "KyberSwap", outUsd: 11805, deltaPct: -15.5, confidence: 80, flags: ["BEQ","MEV"] },
  { provider: "PancakeSwap", outUsd: 11680, deltaPct: -16.4, confidence: 90, flags: ["BEQ","SELL_OK"] },
];

export const bestRaw: QuoteRow[] = [
  { provider: "SwapPilot", outUsd: 14875, deltaPct: 0.0, confidence: 84, flags: ["RAW","SELL_UNCERTAIN"] },
  { provider: "Paraswap", outUsd: 13228, deltaPct: -11.1, confidence: 82, flags: ["RAW","SELL_UNCERTAIN"] },
  { provider: "OKX", outUsd: 12805, deltaPct: -13.9, confidence: 80, flags: ["RAW","MEV"] },
  { provider: "1inch", outUsd: 11605, deltaPct: -22.0, confidence: 78, flags: ["RAW","MEV"] },
  { provider: "PancakeSwap", outUsd: 11500, deltaPct: -22.7, confidence: 86, flags: ["RAW","SELL_OK"] },
];

export const statusProviders = [
  { name: "PancakeSwap", ok: true, latencyMs: 280, errPct: 0.6 },
  { name: "Paraswap", ok: true, latencyMs: 410, errPct: 0.8 },
  { name: "1inch", ok: true, latencyMs: 520, errPct: 1.8 },
  { name: "KyberSwap", ok: false, latencyMs: 740, errPct: 3.2 },
  { name: "OKX", ok: true, latencyMs: 460, errPct: 1.1 },
];
