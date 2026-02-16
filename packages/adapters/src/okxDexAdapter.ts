import type { Adapter, AdapterQuote, BuiltTx, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';
import { safeFetch, withRetries } from '@swappilot/shared';
import { createHmac } from 'crypto';
import { safeJsonParse, OkxQuoteSchema, OkxSwapSchema } from './validation';

function placeholderSignals(reason: string): RiskSignals {
  return {
    sellability: { status: 'OK', confidence: 0.8, reasons: [reason] },
    revertRisk: { level: 'LOW', reasons: [reason] },
    mevExposure: { level: 'LOW', reasons: ['okx_private_routing'] },
    churn: { level: 'LOW', reasons: [reason] },
    preflight: { ok: true, pRevert: 0.1, confidence: 0.8, reasons: [reason] },
  };
}

function normalizeQuote(raw: { sellAmount: string; buyAmount: string }): {
  buyAmount: string;
  effectivePrice: string;
  estimatedGasUsd: string | null;
  feesUsd: string | null;
} {
  const buy = BigInt(raw.buyAmount);
  const sell = BigInt(raw.sellAmount);
  const scale = 10n ** 18n;
  const denom = sell === 0n ? 1n : sell;
  const value = (buy * scale) / denom;
  const intPart = value / scale;
  const fracPart = value % scale;
  const frac = fracPart.toString().padStart(18, '0').slice(0, 8);
  const effectivePrice = `${intPart.toString()}.${frac}`;
  return {
    buyAmount: raw.buyAmount,
    effectivePrice,
    estimatedGasUsd: null,
    feesUsd: null,
  };
}

export type OkxDexAdapterConfig = {
  apiKey: string | null;
  secretKey: string | null;
  passphrase: string | null;
  chainId: number;
  apiBaseUrl?: string;
  apiVersion?: string;
  timeoutMs?: number;
};

// OKX chain ID mapping
const OKX_CHAIN_IDS: Record<number, string> = {
  1: '1',      // Ethereum
  56: '56',    // BSC
  137: '137',  // Polygon
  42161: '42161', // Arbitrum
  10: '10',    // Optimism
  8453: '8453', // Base
  43114: '43114', // Avalanche
};

export class OkxDexAdapter implements Adapter {
  private readonly apiKey: string | null;
  private readonly secretKey: string | null;
  private readonly passphrase: string | null;
  private readonly chainId: number;
  private readonly apiBaseUrl: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;

  constructor(config: OkxDexAdapterConfig) {
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.passphrase = config.passphrase;
    this.chainId = config.chainId;
    this.apiBaseUrl = config.apiBaseUrl ?? 'https://www.okx.com';
    this.apiVersion = config.apiVersion ?? 'v6';
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  private quoteEnabled(): boolean {
    return Boolean(this.apiKey && this.secretKey && this.passphrase);
  }

  private buildTxEnabled(): boolean {
    return this.quoteEnabled();
  }

  getProviderMeta(): ProviderMeta {
    return {
      providerId: 'okx-dex',
      displayName: 'OKX DEX',
      category: 'aggregator',
      homepageUrl: 'https://www.okx.com/web3/dex',
      capabilities: {
        quote: this.quoteEnabled(),
        buildTx: this.buildTxEnabled(),
        deepLink: true,
      },
      integrationConfidence: this.quoteEnabled() ? 0.85 : 0.2,
      notes: this.quoteEnabled()
        ? 'OKX DEX API integration enabled (quote + buildTx)'
        : 'API credentials not configured, deep-link only',
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: 'okx-dex',
      sourceType: 'aggregator',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('okx_adapter'),
      deepLink: null,
      warnings: [],
      isStub: !this.quoteEnabled(),
    };

    if (!this.quoteEnabled()) {
      return {
        ...base,
        raw: {
          sellAmount: request.sellAmount,
          buyAmount: '0',
          estimatedGas: null,
          feeBps: null,
          route: [request.sellToken, request.buyToken],
        },
        normalized: {
          buyAmount: '0',
          effectivePrice: '0',
          estimatedGasUsd: null,
          feesUsd: null,
        },
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const chainIdStr = OKX_CHAIN_IDS[this.chainId] ?? String(this.chainId);
      
      // OKX DEX Aggregator API
      // Note: OKX uses 'chainIndex' instead of 'chainId' as the parameter name
      const path = `/api/${this.apiVersion}/dex/aggregator/quote`;
      const queryParams = new URLSearchParams({
        chainIndex: chainIdStr,
        fromTokenAddress: this.normalizeNativeToken(request.sellToken),
        toTokenAddress: this.normalizeNativeToken(request.buyToken),
        amount: request.sellAmount,
        slippage: String((request.slippageBps ?? 50) / 10000),
      });
      
      const url = `${this.apiBaseUrl}${path}?${queryParams.toString()}`;

      // OKX requires HMAC-SHA256 signature
      const timestamp = new Date().toISOString();
      const preHash = timestamp + 'GET' + path + '?' + queryParams.toString();
      const signature = createHmac('sha256', this.secretKey!)
        .update(preHash)
        .digest('base64');
      
      const res = await withRetries(
        () => safeFetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OK-ACCESS-KEY': this.apiKey!,
            'OK-ACCESS-SIGN': signature,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': this.passphrase!,
          },
          signal: controller.signal,
        }),
        { maxRetries: 2, signal: controller.signal }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OKX ${this.apiVersion} API error: ${res.status} - ${text.slice(0, 200)}`);
      }

      const json = await safeJsonParse(res, OkxQuoteSchema, 'OKX quote');

      if (json.code !== '0' || !json.data?.[0]) {
        throw new Error(`OKX ${this.apiVersion} API error: ${json.msg ?? 'No quote data'}`);
      }

      const quoteData = json.data[0];
      const buyAmount = quoteData.toTokenAmount ?? quoteData.routerResult?.toTokenAmount ?? '0';
      const raw = {
        sellAmount: request.sellAmount,
        buyAmount,
        estimatedGas: 200000,
        feeBps: 0,
        route: [request.sellToken, request.buyToken],
      };

      return {
        ...base,
        isStub: false,
        raw,
        normalized: {
          ...normalizeQuote(raw),
          estimatedGasUsd: quoteData.estimateGasFee ?? quoteData.routerResult?.estimateGasFee ?? '0.30',
        },
        signals: {
          ...placeholderSignals('okx_live_quote'),
          sellability: { status: 'OK', confidence: 0.9, reasons: ['okx_verified'] },
          mevExposure: { level: 'LOW', reasons: ['okx_private_mempool'] },
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ...base,
        isStub: true,
        warnings: [`OKX quote failed: ${message}`],
        raw: {
          sellAmount: request.sellAmount,
          buyAmount: '0',
          estimatedGas: null,
          feeBps: null,
          route: [request.sellToken, request.buyToken],
        },
        normalized: {
          buyAmount: '0',
          effectivePrice: '0',
          estimatedGasUsd: null,
          feesUsd: null,
        },
      };
    }
  }

  /**
   * Get the approval address (spender) for a specific token.
   * Calls OKX DEX Aggregator approve-transaction endpoint.
   */
  private async getApprovalAddress(tokenAddress: string): Promise<string | null> {
    if (!this.quoteEnabled()) return null;
    
    const chainIdStr = OKX_CHAIN_IDS[this.chainId] ?? String(this.chainId);
    const path = `/api/${this.apiVersion}/dex/aggregator/approve-transaction`;
    const queryParams = new URLSearchParams({
      chainIndex: chainIdStr,
      tokenContractAddress: this.normalizeNativeToken(tokenAddress),
      approveAmount: '0', // 0 = get info only, not approval data
    });

    const url = `${this.apiBaseUrl}${path}?${queryParams.toString()}`;
    const timestamp = new Date().toISOString();
    const preHash = timestamp + 'GET' + path + '?' + queryParams.toString();
    const signature = createHmac('sha256', this.secretKey!).update(preHash).digest('base64');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await withRetries(
        () => safeFetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OK-ACCESS-KEY': this.apiKey!,
            'OK-ACCESS-SIGN': signature,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': this.passphrase!,
          },
          signal: controller.signal,
        }),
        { maxRetries: 2, signal: controller.signal }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        return null;
      }

      const json = (await res.json()) as {
        code: string;
        data?: Array<{
          dexContractAddress?: string;
          approveAddress?: string;
        }>;
      };

      if (json.code === '0' && json.data?.[0]) {
        const item = json.data[0];
        return item.dexContractAddress ?? item.approveAddress ?? null;
      }

      return null;
    } catch (err) {
      void err;
      return null;
    }
  }

  /**
   * Build a ready-to-sign transaction for the swap.
   * Calls OKX DEX Aggregator swap endpoint which returns calldata.
   */
  async buildTx(request: QuoteRequest, quote: AdapterQuote): Promise<BuiltTx> {
    void quote;
    if (!this.buildTxEnabled()) {
      throw new Error('OKX API credentials not configured');
    }

    if (!request.account) {
      throw new Error('Account address required for building transaction');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const chainIdStr = OKX_CHAIN_IDS[this.chainId] ?? String(this.chainId);
    // OKX v6 uses slippagePercent (e.g., "0.5" = 0.5%), not decimal slippage
    // Convert from bps: 50 bps = 0.5%
    const slippagePercent = String((request.slippageBps ?? 50) / 100);

    // OKX DEX Aggregator API
    const path = `/api/${this.apiVersion}/dex/aggregator/swap`;
    const queryParams = new URLSearchParams({
      chainIndex: chainIdStr,
      fromTokenAddress: this.normalizeNativeToken(request.sellToken),
      toTokenAddress: this.normalizeNativeToken(request.buyToken),
      amount: request.sellAmount,
      slippagePercent,
      userWalletAddress: request.account,
    });

    const url = `${this.apiBaseUrl}${path}?${queryParams.toString()}`;
    const timestamp = new Date().toISOString();
    const preHashGet = timestamp + 'GET' + path + '?' + queryParams.toString();
    const signatureGet = createHmac('sha256', this.secretKey!).update(preHashGet).digest('base64');

    try {
      let res = await safeFetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OK-ACCESS-KEY': this.apiKey!,
          'OK-ACCESS-SIGN': signatureGet,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': this.passphrase!,
        },
        signal: controller.signal,
      });

      // Some OKX deployments may require POST; try a simple fallback.
      if (!res.ok && res.status === 405) {
        const body = JSON.stringify(Object.fromEntries(queryParams.entries()));
        const preHashPost = timestamp + 'POST' + path + body;
        const signaturePost = createHmac('sha256', this.secretKey!).update(preHashPost).digest('base64');
        res = await safeFetch(`https://www.okx.com${path}`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OK-ACCESS-KEY': this.apiKey!,
            'OK-ACCESS-SIGN': signaturePost,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': this.passphrase!,
          },
          body,
          signal: controller.signal,
        });
      }

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OKX ${this.apiVersion} swap API error: ${res.status} - ${text.slice(0, 200)}`);
      }

      const json = await safeJsonParse(res, OkxSwapSchema, 'OKX swap');

      if (json.code !== '0' || !json.data?.[0]) {
        throw new Error(`OKX ${this.apiVersion} swap API error: ${json.msg ?? 'No swap data'}`);
      }

      const item = json.data[0];
      const tx = item.tx ?? item.transaction;
      const to = tx?.to;
      const data = tx?.data;
      const value = tx?.value ?? '0';
      
      // OKX v6 API may return approval address in multiple locations
      // Common fields: routerResult.toTokenApproveContractAddress, 
      // routerResult.fromTokenApproveAddress, dexContractAddress, etc.
      const routerResult = (item as { routerResult?: {
        toTokenApproveContractAddress?: string;
        fromTokenApproveAddress?: string;
        dexContractAddress?: string;
      }}).routerResult;
      
      const approvalAddressRaw =
        // Top level fields
        (item as { approvalAddress?: string }).approvalAddress ??
        (item as { approveTo?: string }).approveTo ??
        (item as { tokenApproveAddress?: string }).tokenApproveAddress ??
        (item as { spender?: string }).spender ??
        (item as { dexContractAddress?: string }).dexContractAddress ??
        // routerResult fields (OKX v6 format)
        routerResult?.toTokenApproveContractAddress ??
        routerResult?.fromTokenApproveAddress ??
        routerResult?.dexContractAddress ??
        // tx object fields
        (tx as { approvalAddress?: string } | undefined)?.approvalAddress ??
        (tx as { approveTo?: string } | undefined)?.approveTo ??
        (tx as { tokenApproveAddress?: string } | undefined)?.tokenApproveAddress ??
        (tx as { spender?: string } | undefined)?.spender;
      const approvalAddress =
        typeof approvalAddressRaw === 'string' && approvalAddressRaw.startsWith('0x')
          ? approvalAddressRaw
          : undefined;

      if (!to || !data) {
        throw new Error('OKX swap API returned no tx calldata');
      }

      // If no approval address found in swap response, call the approve-transaction endpoint
      // to get the correct spender address for the sell token
      let finalApprovalAddress = approvalAddress;
      if (!finalApprovalAddress) {
        const sellTokenLower = request.sellToken.toLowerCase();
        const isNativeToken = 
          sellTokenLower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
          sellTokenLower === '0x0000000000000000000000000000000000000000';
        
        if (!isNativeToken) {
          const fetchedApprovalAddress = await this.getApprovalAddress(request.sellToken);
          if (fetchedApprovalAddress) {
            finalApprovalAddress = fetchedApprovalAddress;
          }
        }
      }

      const gasRaw = tx?.gas;
      const gasStr =
        typeof gasRaw === 'number'
          ? gasRaw > 0
            ? String(gasRaw)
            : null
          : typeof gasRaw === 'string'
            ? gasRaw !== '0' && gasRaw.trim() !== ''
              ? gasRaw
              : null
            : null;

      // Note: we intentionally omit gasPrice and gas unless present and non-zero
      // to let the wallet estimate properly when possible.
      return {
        to,
        data,
        value,
        ...(gasStr ? { gas: gasStr } : {}),
        ...(finalApprovalAddress ? { approvalAddress: finalApprovalAddress } : {}),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`OKX buildTx failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeNativeToken(token: string): string {
    const lower = token.toLowerCase();
    if (
      lower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      lower === '0x0000000000000000000000000000000000000000'
    ) {
      // OKX uses this format for native tokens
      return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }
    return token;
  }
}
