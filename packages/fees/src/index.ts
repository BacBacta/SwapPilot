/**
 * @swappilot/fees
 * 
 * Platform fee calculation and PILOT token integration
 */

export { FEE_CONFIG, FEE_ADDRESSES } from './config.js';
export type { FeeConfig, FeeAddresses } from './config.js';

export {
  calculateFees,
  calculateOutputFee,
  getPilotTier,
  formatFeeDisplay,
  formatPilotBalance,
} from './calculator.js';
export type {
  FeeCalculationInput,
  FeeCalculationResult,
} from './calculator.js';

export {
  getPilotBalance,
  getPilotBalanceCached,
  clearBalanceCache,
} from './pilot-balance.js';
export type { PilotBalanceReaderConfig } from './pilot-balance.js';
