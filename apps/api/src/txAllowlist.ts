export type TxAllowlistMode = 'off' | 'warn' | 'enforce';

export type TxAllowlistCheck = {
  ok: boolean;
  reason?: string;
  allowlistedTargets: string[];
  allowlistedSpenders: string[];
};

function normalizeAddress(a: string): string {
  return a.trim().toLowerCase();
}

function parseCsvAddresses(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeAddress)
    .filter((s) => /^0x[a-f0-9]{40}$/.test(s));
}

function providerIdToEnvKey(providerId: string): string {
  const p = providerId.trim().toUpperCase();
  if (p === '0X') return 'ZEROX';
  if (p === '1INCH') return 'ONEINCH';
  return p.replace(/[^A-Z0-9]+/g, '_');
}

export function getTxAllowlistMode(): TxAllowlistMode {
  const raw = (process.env.TX_ALLOWLIST_MODE ?? '').trim().toLowerCase();
  if (raw === 'off' || raw === 'warn' || raw === 'enforce') return raw;
  return 'warn';
}

const BSC_DEFAULTS = {
  chainId: 56,
  pancakeswapV2Router: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
  pancakeswapV3Router: '0x13f4ea83d0bd40e75c8222255bc855a974568dd4',
  thenaV2Router: '0xd4ae6eca985340dd434d38f470accce4dc78d109',
  paraswapTokenTransferProxy: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
} as const;

function getBuiltInAllowlist(params: {
  chainId: number;
  providerId: string;
}): { targets: string[]; spenders: string[] } {
  if (params.chainId !== BSC_DEFAULTS.chainId) {
    return { targets: [], spenders: [] };
  }

  switch (params.providerId) {
    case 'pancakeswap':
      return {
        targets: [BSC_DEFAULTS.pancakeswapV2Router, BSC_DEFAULTS.pancakeswapV3Router],
        spenders: [BSC_DEFAULTS.pancakeswapV2Router, BSC_DEFAULTS.pancakeswapV3Router],
      };
    case 'uniswap-v2':
      return {
        targets: [BSC_DEFAULTS.pancakeswapV2Router],
        spenders: [BSC_DEFAULTS.pancakeswapV2Router],
      };
    case 'uniswap-v3':
      return {
        targets: [BSC_DEFAULTS.pancakeswapV3Router],
        spenders: [BSC_DEFAULTS.pancakeswapV3Router],
      };
    case 'thena':
      return {
        targets: [BSC_DEFAULTS.thenaV2Router],
        spenders: [BSC_DEFAULTS.thenaV2Router],
      };
    case 'paraswap':
      // ParaSwap tx.to depends on Augustus contract; we only hard-allow the spender (TokenTransferProxy).
      return {
        targets: [],
        spenders: [BSC_DEFAULTS.paraswapTokenTransferProxy],
      };
    default:
      return { targets: [], spenders: [] };
  }
}

function getEnvAllowlist(params: { chainId: number; providerId: string }): { targets: string[]; spenders: string[] } {
  const chainKey = String(params.chainId);
  const providerKey = providerIdToEnvKey(params.providerId);

  // Examples:
  // - TX_ALLOWLIST_56_ONEINCH_TARGETS=0x...
  // - TX_ALLOWLIST_56_ONEINCH_SPENDERS=0x...
  const targets = parseCsvAddresses(process.env[`TX_ALLOWLIST_${chainKey}_${providerKey}_TARGETS`]);
  const spenders = parseCsvAddresses(process.env[`TX_ALLOWLIST_${chainKey}_${providerKey}_SPENDERS`]);
  return { targets, spenders };
}

export function checkBuildTxAllowlist(params: {
  chainId: number;
  providerId: string;
  to: string;
  spender: string;
}): TxAllowlistCheck {
  const providerId = params.providerId.trim();
  const to = normalizeAddress(params.to);
  const spender = normalizeAddress(params.spender);

  const builtIn = getBuiltInAllowlist({ chainId: params.chainId, providerId });
  const env = getEnvAllowlist({ chainId: params.chainId, providerId });

  const allowlistedTargets = Array.from(new Set([...builtIn.targets, ...env.targets]));
  const allowlistedSpenders = Array.from(new Set([...builtIn.spenders, ...env.spenders]));

  const targetOk = allowlistedTargets.length === 0 ? true : allowlistedTargets.includes(to);
  const spenderOk = allowlistedSpenders.length === 0 ? true : allowlistedSpenders.includes(spender);

  if (!targetOk) {
    return {
      ok: false,
      reason: `tx.to not allowlisted for provider '${providerId}' on chainId ${params.chainId}`,
      allowlistedTargets,
      allowlistedSpenders,
    };
  }

  if (!spenderOk) {
    return {
      ok: false,
      reason: `approval spender not allowlisted for provider '${providerId}' on chainId ${params.chainId}`,
      allowlistedTargets,
      allowlistedSpenders,
    };
  }

  return { ok: true, allowlistedTargets, allowlistedSpenders };
}
