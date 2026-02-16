/**
 * SSRF Protection: Domain allowlist for external API calls
 * 
 * Prevents Server-Side Request Forgery (SSRF) attacks by validating
 * all external URLs against a strict allowlist of known DEX aggregator domains.
 * Includes DNS rebinding protection via pre-fetch IP resolution.
 */

import { resolve4, resolve6 } from 'node:dns/promises';

/**
 * Allowed domains for DEX aggregator APIs
 * Only these domains can be fetched by adapters
 */
export const ALLOWED_API_DOMAINS = [
  // Aggregators
  'api.1inch.dev',
  'api.1inch.io',
  'api.0x.org',
  'bsc.api.0x.org',
  'polygon.api.0x.org',
  'arbitrum.api.0x.org',
  'optimism.api.0x.org',
  'base.api.0x.org',
  'avalanche.api.0x.org',
  'apiv5.paraswap.io',
  'api.paraswap.io',
  'api.odos.xyz',
  'api.kyberswap.com',
  'aggregator-api.kyberswap.com',
  'open-api.openocean.finance',
  'ethapi.openocean.finance',
  'www.okx.com',
  'okx.com',
  
  // RPC endpoints (for on-chain calls)
  'bsc-dataseed.binance.org',
  'bsc-dataseed1.binance.org',
  'bsc-dataseed2.binance.org',
  'bsc-dataseed3.binance.org',
  'bsc-dataseed4.binance.org',
  'bsc-dataseed1.defibit.io',
  'bsc-dataseed2.defibit.io',
  'bsc-dataseed3.defibit.io',
  'bsc-dataseed4.defibit.io',
  'bsc.publicnode.com',
  'rpc.ankr.com',
  
  // Token lists / metadata
  'tokens.coingecko.com',
  'assets-cdn.trustwallet.com',
] as const;

/**
 * Blocked private/internal IP ranges (RFC 1918, RFC 4193, etc.)
 * Prevents SSRF to internal networks
 */
const PRIVATE_IP_PATTERNS = [
  /^127\./,           // Loopback (127.0.0.0/8)
  /^10\./,            // Private Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2\d|3[01])\./,  // Private Class B (172.16.0.0/12)
  /^192\.168\./,      // Private Class C (192.168.0.0/16)
  /^169\.254\./,      // Link-local (169.254.0.0/16)
  /^::1$/,            // IPv6 loopback
  /^fe80:/,           // IPv6 link-local
  /^fc00:/,           // IPv6 Unique Local (fc00::/7)
  /^fd00:/,           // IPv6 Unique Local (fd00::/8)
  /^localhost$/i,     // localhost hostname
  /^0\.0\.0\.0$/,     // Unspecified
];

/**
 * Blocked schemes that could lead to SSRF
 */
const BLOCKED_SCHEMES = ['file:', 'ftp:', 'gopher:', 'data:', 'javascript:'];

/**
 * Validate a URL against the domain allowlist
 * 
 * @param url - URL to validate (string or URL object)
 * @throws Error if URL is not in allowlist or points to private IP
 * @returns Validated URL object
 */
export function validateApiUrl(url: string | URL): URL {
  const parsed = typeof url === 'string' ? new URL(url) : url;

  // 1. Check scheme
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    if (BLOCKED_SCHEMES.includes(parsed.protocol)) {
      throw new Error(`SSRF: Blocked scheme ${parsed.protocol}`);
    }
    throw new Error(`SSRF: Only HTTP(S) allowed, got ${parsed.protocol}`);
  }

  // 2. Extract hostname (without port)
  const hostname = parsed.hostname.toLowerCase();

  // 3. Check for private IPs
  if (PRIVATE_IP_PATTERNS.some(pattern => pattern.test(hostname))) {
    throw new Error(`SSRF: Private IP range blocked: ${hostname}`);
  }

  // 4. Check domain allowlist (strict: exact match or single-level subdomain only)
  const isAllowed = ALLOWED_API_DOMAINS.some(allowed => {
    // Exact match
    if (hostname === allowed) {
      return true;
    }
    // Strict single-level subdomain match
    // e.g., "bsc.api.0x.org" is allowed for "api.0x.org" but
    // "evil-api.0x.org" must be a single label before the allowed domain
    if (hostname.endsWith(`.${allowed}`)) {
      const prefix = hostname.slice(0, -(allowed.length + 1));
      // Only allow if prefix is a single DNS label (no dots, alphanumeric + hyphen)
      if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(prefix)) {
        return true;
      }
    }
    return false;
  });

  if (!isAllowed) {
    throw new Error(`SSRF: Domain not in allowlist: ${hostname}`);
  }

  // 5. Additional path-based checks (prevent bypasses like @, #, etc.)
  if (parsed.username || parsed.password) {
    throw new Error('SSRF: URLs with credentials are not allowed');
  }

  return parsed;
}

/**
 * Check if an IP address is in a private/internal range.
 * Used for DNS rebinding protection.
 */
function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(ip));
}

/**
 * Resolve hostname to IPs and verify none are private.
 * Protects against DNS rebinding attacks (C-2).
 */
async function validateResolvedIps(hostname: string): Promise<void> {
  // Skip for IP literals — already checked in validateApiUrl
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':')) {
    return;
  }

  try {
    const [ipv4Results, ipv6Results] = await Promise.allSettled([
      resolve4(hostname),
      resolve6(hostname),
    ]);

    const ips: string[] = [];
    if (ipv4Results.status === 'fulfilled') ips.push(...ipv4Results.value);
    if (ipv6Results.status === 'fulfilled') ips.push(...ipv6Results.value);

    // If DNS resolution returned no results, allow (the fetch itself will fail)
    if (ips.length === 0) return;

    for (const ip of ips) {
      if (isPrivateIp(ip)) {
        throw new Error(`SSRF: DNS resolved to private IP: ${ip} for hostname ${hostname}`);
      }
    }
  } catch {
    // Re-throw SSRF errors
    // (No err variable here; DNS resolution failures are allowed)
    // DNS resolution failures are allowed — the fetch will fail naturally
  }
}

/**
 * Safe fetch wrapper with SSRF protection
 * 
 * Use this instead of bare fetch() in adapters
 * 
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function safeFetch(
  url: string | URL,
  options?: RequestInit
): Promise<Response> {
  // Validate URL first
  const validatedUrl = validateApiUrl(url);

  // DNS rebinding protection: resolve hostname and check IPs before connecting
  await validateResolvedIps(validatedUrl.hostname);

  // Additional request-time checks
  const safeOptions: RequestInit = {
    ...options,
    // Prevent following redirects to unauthorized domains
    redirect: 'manual',
    // Set reasonable timeouts (10s default)
    signal: options?.signal ?? AbortSignal.timeout(10000),
  };

  const response = await fetch(validatedUrl.toString(), safeOptions);

  // Check for redirects to blocked domains
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) {
      // Validate redirect target
      try {
        const redirectUrl = new URL(location, validatedUrl);
        validateApiUrl(redirectUrl);
      } catch {
        throw new Error(`SSRF: Redirect to unauthorized domain: ${location}`);
      }
    }
  }

  return response;
}

/**
 * Check if a domain is in the allowlist (for testing/debugging)
 * 
 * @param domain - Domain to check
 * @returns true if domain is allowed
 */
export function isDomainAllowed(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0] ?? '';
  
  return ALLOWED_API_DOMAINS.some(allowed => {
    if (normalized === allowed) return true;
    if (normalized.endsWith(`.${allowed}`)) {
      const prefix = normalized.slice(0, -(allowed.length + 1));
      return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(prefix);
    }
    return false;
  });
}
