export type ProtocolRiskLevels = {
  security: 'LOW' | 'MEDIUM' | 'HIGH';
  compliance: 'LOW' | 'MEDIUM' | 'HIGH';
  financial: 'LOW' | 'MEDIUM' | 'HIGH';
  technology: 'LOW' | 'MEDIUM' | 'HIGH';
  operations: 'LOW' | 'MEDIUM' | 'HIGH';
  governance: 'LOW' | 'MEDIUM' | 'HIGH';
};

type ProtocolRiskRegistry = Record<string, ProtocolRiskLevels>;

const DEFAULT_LEVELS: ProtocolRiskLevels = {
  security: 'MEDIUM',
  compliance: 'MEDIUM',
  financial: 'MEDIUM',
  technology: 'MEDIUM',
  operations: 'MEDIUM',
  governance: 'MEDIUM',
};

// Established, audited protocols with long track records
const TIER1_LEVELS: ProtocolRiskLevels = {
  security: 'LOW',
  compliance: 'LOW',
  financial: 'LOW',
  technology: 'LOW',
  operations: 'LOW',
  governance: 'LOW',
};

// Mid-tier protocols, audited but less track record
const TIER2_LEVELS: ProtocolRiskLevels = {
  security: 'LOW',
  compliance: 'MEDIUM',
  financial: 'LOW',
  technology: 'MEDIUM',
  operations: 'MEDIUM',
  governance: 'MEDIUM',
};

// Newer or less established protocols
const TIER3_LEVELS: ProtocolRiskLevels = {
  security: 'MEDIUM',
  compliance: 'MEDIUM',
  financial: 'MEDIUM',
  technology: 'MEDIUM',
  operations: 'MEDIUM',
  governance: 'HIGH',
};

// Static, auditable registry. Can be expanded over time or sourced from external feeds.
const REGISTRY: ProtocolRiskRegistry = {
  // Tier 1: Established, battle-tested, multiple audits
  '0x': TIER1_LEVELS,
  '1inch': TIER1_LEVELS,
  'uniswap-v2': TIER1_LEVELS,
  'uniswap-v3': TIER1_LEVELS,
  pancakeswap: TIER1_LEVELS,
  paraswap: TIER1_LEVELS,
  
  // Tier 2: Solid protocols with good reputation, some audits
  kyberswap: TIER2_LEVELS,
  odos: TIER2_LEVELS,
  openocean: TIER2_LEVELS,
  'okx-dex': TIER2_LEVELS, // Centralized exchange DEX, different risk profile
  
  // Tier 3: Newer or BSC-specific protocols
  thena: TIER3_LEVELS,
  
  // Wallets - generally low risk as they don't custody funds in our integration
  metamask: { ...TIER1_LEVELS, governance: 'MEDIUM' },
  'binance-wallet': { ...TIER1_LEVELS, governance: 'MEDIUM', compliance: 'MEDIUM' },
  
  // Removed: squadswap, fstswap (were duplicates of PancakeSwap)
  
  // Unknown/future protocols
  liquidmesh: DEFAULT_LEVELS,
};

export function getProtocolRiskLevels(providerId: string): ProtocolRiskLevels {
  return REGISTRY[providerId] ?? DEFAULT_LEVELS;
}
