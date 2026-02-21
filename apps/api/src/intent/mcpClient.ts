/**
 * MCP BNB Chain client — optional.
 * Used only when MCP_BNB_SERVER_URL points to a running @bnb-chain/mcp server.
 * Falls back gracefully when the server is unreachable.
 */

export type TokenInfo = {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
};

export type MCPClient = {
  getTokenInfo(symbol: string, chainId: number): Promise<TokenInfo | null>;
  getTokenBalance(address: string, token: string, chainId: number): Promise<bigint | null>;
  close(): Promise<void>;
};

type MCPToolResult = {
  content?: Array<{ type: string; text?: string }>;
};

async function callMCPTool(
  serverUrl: string,
  toolName: string,
  params: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${serverUrl}/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool: toolName, params }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function createMCPClient(serverUrl: string, timeoutMs = 2000): MCPClient {
  return {
    async getTokenInfo(symbol, chainId) {
      const result = (await callMCPTool(
        serverUrl,
        'get_erc20_token_info',
        { symbol, chainId: String(chainId) },
        timeoutMs,
      )) as MCPToolResult | null;
      if (!result?.content?.[0]?.text) return null;
      try {
        return JSON.parse(result.content[0].text) as TokenInfo;
      } catch {
        return null;
      }
    },

    async getTokenBalance(address, token, chainId) {
      const result = (await callMCPTool(
        serverUrl,
        'get_erc20_balance',
        { address, token, chainId: String(chainId) },
        timeoutMs,
      )) as MCPToolResult | null;
      if (!result?.content?.[0]?.text) return null;
      try {
        return BigInt(result.content[0].text.trim());
      } catch {
        return null;
      }
    },

    async close() {
      // no persistent connection in this HTTP-based implementation
    },
  };
}
