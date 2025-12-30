import { RpcClient, type HexString } from '@swappilot/preflight';

const ERC20_DECIMALS_SELECTOR = '0x313ce567' as const;
const ERC20_SYMBOL_SELECTOR = '0x95d89b41' as const;
const ERC20_NAME_SELECTOR = '0x06fdde03' as const;

const NATIVE_SENTINEL = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const;

function strip0x(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = strip0x(hex);
  if (clean.length % 2 !== 0) throw new Error('invalid_hex_length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToAscii(bytes: Uint8Array): string {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return new TextDecoder().decode(bytes.slice(0, end));
}

function decodeUint256(hex: string): bigint {
  const clean = strip0x(hex);
  if (clean.length < 64) throw new Error('invalid_uint256');
  const last32 = clean.slice(clean.length - 64);
  return BigInt('0x' + last32);
}

function readWord(hexNo0x: string, wordIndex: number): string {
  const start = wordIndex * 64;
  const end = start + 64;
  if (hexNo0x.length < end) throw new Error('abi_out_of_bounds');
  return hexNo0x.slice(start, end);
}

function decodeAbiStringOrBytes32(hex: string): string {
  const clean = strip0x(hex);
  if (clean.length === 64) {
    // bytes32
    return bytesToAscii(hexToBytes('0x' + clean));
  }

  // string (ABI): head[0]=offset, then at offset: length, data
  const offset = Number(decodeUint256('0x' + readWord(clean, 0)));
  const offsetWords = offset / 32;
  const length = Number(decodeUint256('0x' + readWord(clean, offsetWords)));

  const dataStart = (offsetWords + 1) * 64;
  const dataHex = clean.slice(dataStart, dataStart + length * 2);
  return bytesToAscii(hexToBytes('0x' + dataHex));
}

async function callWithFallback(params: {
  rpcUrls: string[];
  timeoutMs: number;
  to: string;
  data: HexString;
}): Promise<HexString> {
  let lastError: Error | null = null;

  for (const rpcUrl of params.rpcUrls) {
    try {
      const client = new RpcClient(rpcUrl, params.timeoutMs);
      return await client.call({ to: params.to, data: params.data } as unknown);
    } catch (e) {
      lastError = e as Error;
    }
  }

  throw lastError ?? new Error('rpc_call_failed');
}

export type TokenMetadata = {
  address: string;
  symbol: string | null;
  name: string | null;
  decimals: number;
  isNative: boolean;
};

export async function resolveErc20Metadata(params: {
  address: string;
  rpcUrls: string[];
  timeoutMs: number;
}): Promise<TokenMetadata> {
  const address = params.address;

  if (address.toLowerCase() === NATIVE_SENTINEL.toLowerCase()) {
    return {
      address: NATIVE_SENTINEL,
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18,
      isNative: true,
    };
  }

  const [decimalsHex, symbolHex, nameHex] = await Promise.all([
    callWithFallback({ rpcUrls: params.rpcUrls, timeoutMs: params.timeoutMs, to: address, data: ERC20_DECIMALS_SELECTOR }),
    callWithFallback({ rpcUrls: params.rpcUrls, timeoutMs: params.timeoutMs, to: address, data: ERC20_SYMBOL_SELECTOR }).catch(() => '0x' as HexString),
    callWithFallback({ rpcUrls: params.rpcUrls, timeoutMs: params.timeoutMs, to: address, data: ERC20_NAME_SELECTOR }).catch(() => '0x' as HexString),
  ]);

  const decimalsBig = decodeUint256(decimalsHex);
  const decimals = Number(decimalsBig);

  const symbol = symbolHex === '0x' ? null : decodeAbiStringOrBytes32(symbolHex).trim() || null;
  const name = nameHex === '0x' ? null : decodeAbiStringOrBytes32(nameHex).trim() || null;

  return {
    address,
    symbol,
    name,
    decimals: Number.isFinite(decimals) ? decimals : 18,
    isNative: false,
  };
}
