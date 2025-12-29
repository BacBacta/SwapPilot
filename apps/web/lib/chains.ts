import { bsc, mainnet, polygon, arbitrum, optimism, base, avalanche } from "wagmi/chains";
import type { Chain } from "wagmi/chains";

/* ========================================
   SUPPORTED CHAINS CONFIGURATION
   ======================================== */

export interface ChainConfig {
  chain: Chain;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  explorerName: string;
  nativeCurrency: string;
  enabled: boolean;
  popular: boolean;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    chain: bsc,
    name: "BNB Smart Chain",
    shortName: "BSC",
    icon: "bnb",
    color: "#F3BA2F",
    explorerName: "BscScan",
    nativeCurrency: "BNB",
    enabled: true,
    popular: true,
  },
  {
    chain: mainnet,
    name: "Ethereum",
    shortName: "ETH",
    icon: "eth",
    color: "#627EEA",
    explorerName: "Etherscan",
    nativeCurrency: "ETH",
    enabled: true,
    popular: true,
  },
  {
    chain: polygon,
    name: "Polygon",
    shortName: "MATIC",
    icon: "polygon",
    color: "#8247E5",
    explorerName: "Polygonscan",
    nativeCurrency: "MATIC",
    enabled: true,
    popular: true,
  },
  {
    chain: arbitrum,
    name: "Arbitrum One",
    shortName: "ARB",
    icon: "arbitrum",
    color: "#28A0F0",
    explorerName: "Arbiscan",
    nativeCurrency: "ETH",
    enabled: true,
    popular: true,
  },
  {
    chain: optimism,
    name: "Optimism",
    shortName: "OP",
    icon: "optimism",
    color: "#FF0420",
    explorerName: "Optimism Explorer",
    nativeCurrency: "ETH",
    enabled: true,
    popular: false,
  },
  {
    chain: base,
    name: "Base",
    shortName: "BASE",
    icon: "base",
    color: "#0052FF",
    explorerName: "Basescan",
    nativeCurrency: "ETH",
    enabled: true,
    popular: false,
  },
  {
    chain: avalanche,
    name: "Avalanche C-Chain",
    shortName: "AVAX",
    icon: "avalanche",
    color: "#E84142",
    explorerName: "Snowtrace",
    nativeCurrency: "AVAX",
    enabled: false, // Coming soon
    popular: false,
  },
];

/* ========================================
   HELPER FUNCTIONS
   ======================================== */

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS.find((c) => c.chain.id === chainId);
}

export function getEnabledChains(): ChainConfig[] {
  return SUPPORTED_CHAINS.filter((c) => c.enabled);
}

export function getPopularChains(): ChainConfig[] {
  return SUPPORTED_CHAINS.filter((c) => c.enabled && c.popular);
}

export function getChainById(chainId: number): Chain | undefined {
  return SUPPORTED_CHAINS.find((c) => c.chain.id === chainId)?.chain;
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  const config = getChainConfig(chainId);
  if (!config) return "";
  
  const baseUrl = config.chain.blockExplorers?.default.url;
  if (!baseUrl) return "";
  
  return `${baseUrl}/tx/${txHash}`;
}

export function getAddressExplorerUrl(chainId: number, address: string): string {
  const config = getChainConfig(chainId);
  if (!config) return "";
  
  const baseUrl = config.chain.blockExplorers?.default.url;
  if (!baseUrl) return "";
  
  return `${baseUrl}/address/${address}`;
}

/* ========================================
   CHAIN ICONS (for ChainImage component)
   ======================================== */
export const CHAIN_ICONS: Record<string, string> = {
  bnb: "https://cryptologos.cc/logos/bnb-bnb-logo.svg",
  eth: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
  polygon: "https://cryptologos.cc/logos/polygon-matic-logo.svg",
  arbitrum: "https://cryptologos.cc/logos/arbitrum-arb-logo.svg",
  optimism: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg",
  base: "https://avatars.githubusercontent.com/u/108554348",
  avalanche: "https://cryptologos.cc/logos/avalanche-avax-logo.svg",
};

/* ========================================
   DEFAULT CHAIN
   ======================================== */
export const DEFAULT_CHAIN_ID = bsc.id; // 56
