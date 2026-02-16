import { describe, expect, it } from 'vitest';
import { escapeHtml, sanitizeHtml } from '../sanitize';

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello" & \'world\'')).toBe(
      '&quot;hello&quot; &amp; &#39;world&#39;',
    );
  });

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('sanitizeHtml', () => {
  it('removes script tags with content', () => {
    expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
  });

  it('removes self-closing script tags', () => {
    expect(sanitizeHtml('<script src="evil.js"/>')).toBe('');
  });

  it('removes on* event handlers', () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe(
      '<img src="x">',
    );
  });

  it('removes javascript: URIs', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    expect(sanitizeHtml(input)).not.toContain('javascript:');
  });

  it('removes data: URIs in src', () => {
    const input = '<img src="data:text/html,<script>alert(1)</script>">';
    expect(sanitizeHtml(input)).not.toContain('data:');
  });

  it('preserves safe HTML', () => {
    const safe = '<p class="text">Hello <strong>World</strong></p>';
    expect(sanitizeHtml(safe)).toBe(safe);
  });
});
