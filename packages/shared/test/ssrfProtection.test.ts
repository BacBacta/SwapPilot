import { describe, expect, it } from 'vitest';
import { validateApiUrl, isDomainAllowed } from '../src/ssrfProtection';

describe('validateApiUrl', () => {
  it('allows known API domains', () => {
    const url = validateApiUrl('https://api.1inch.dev/swap/v1/quote');
    expect(url.hostname).toBe('api.1inch.dev');
  });

  it('allows single-level subdomains of allowed domains', () => {
    const url = validateApiUrl('https://bsc.api.0x.org/swap/v1/quote');
    expect(url.hostname).toBe('bsc.api.0x.org');
  });

  it('blocks multi-level subdomain attacks', () => {
    expect(() => validateApiUrl('https://evil.sub.api.1inch.dev/x')).toThrow('SSRF');
  });

  it('blocks unknown domains', () => {
    expect(() => validateApiUrl('https://evil.com/api')).toThrow('SSRF: Domain not in allowlist');
  });

  it('blocks private IP addresses', () => {
    expect(() => validateApiUrl('http://127.0.0.1:8080/data')).toThrow('SSRF: Private IP');
    expect(() => validateApiUrl('http://10.0.0.1/internal')).toThrow('SSRF: Private IP');
    expect(() => validateApiUrl('http://192.168.1.1/admin')).toThrow('SSRF: Private IP');
    expect(() => validateApiUrl('http://169.254.169.254/metadata')).toThrow('SSRF: Private IP');
  });

  it('blocks file:// scheme', () => {
    expect(() => validateApiUrl('file:///etc/passwd')).toThrow('SSRF: Blocked scheme');
  });

  it('blocks URLs with credentials', () => {
    expect(() => validateApiUrl('https://user:pass@api.1inch.dev/x')).toThrow('SSRF: URLs with credentials');
  });

  it('blocks javascript: scheme', () => {
    expect(() => validateApiUrl('javascript:alert(1)')).toThrow();
  });
});

describe('isDomainAllowed', () => {
  it('returns true for exact match', () => {
    expect(isDomainAllowed('api.1inch.dev')).toBe(true);
  });

  it('returns true for allowed subdomain', () => {
    expect(isDomainAllowed('bsc.api.0x.org')).toBe(true);
  });

  it('strips protocol prefix', () => {
    expect(isDomainAllowed('https://api.1inch.dev')).toBe(true);
  });

  it('returns false for unknown domain', () => {
    expect(isDomainAllowed('evil.com')).toBe(false);
  });

  it('returns false for attack subdomains', () => {
    expect(isDomainAllowed('evil.sub.api.1inch.dev')).toBe(false);
  });
});
