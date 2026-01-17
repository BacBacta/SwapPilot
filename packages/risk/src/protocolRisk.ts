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
  security: 'LOW',
  compliance: 'LOW',
  financial: 'LOW',
  technology: 'LOW',
  operations: 'LOW',
  governance: 'LOW',
};

// Static, auditable registry. Can be expanded over time or sourced from external feeds.
const REGISTRY: ProtocolRiskRegistry = {
  '0x': DEFAULT_LEVELS,
  '1inch': DEFAULT_LEVELS,
  odos: DEFAULT_LEVELS,
  openocean: DEFAULT_LEVELS,
  kyberswap: DEFAULT_LEVELS,
  paraswap: DEFAULT_LEVELS,
  'okx-dex': DEFAULT_LEVELS,
  pancakeswap: DEFAULT_LEVELS,
  'uniswap-v2': DEFAULT_LEVELS,
  'uniswap-v3': DEFAULT_LEVELS,
  squadswap: DEFAULT_LEVELS,
  thena: DEFAULT_LEVELS,
  fstswap: DEFAULT_LEVELS,
  metamask: DEFAULT_LEVELS,
  'binance-wallet': DEFAULT_LEVELS,
  liquidmesh: DEFAULT_LEVELS,
};

export function getProtocolRiskLevels(providerId: string): ProtocolRiskLevels {
  return REGISTRY[providerId] ?? DEFAULT_LEVELS;
}
