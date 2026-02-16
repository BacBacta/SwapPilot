/**
 * HTML sanitization utilities for Landio controllers
 * 
 * Defence-in-depth: escapes dynamic text values before insertion into innerHTML.
 * This prevents XSS even if upstream API data contains malicious HTML.
 */

/**
 * Escape a string for safe insertion into innerHTML as text content.
 * Converts HTML special characters to their entity equivalents.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize an HTML string by removing dangerous patterns.
 * Use when the HTML structure is needed but dynamic values may be untrusted.
 */
export function sanitizeHtml(html: string): string {
  return html
    // Remove <script>...</script> blocks
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
    // Remove standalone <script> tags
    .replace(/<script[^>]*\/?>/gi, '')
    // Remove on* event handlers
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript: URIs
    .replace(/(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""')
    // Remove data: URIs in src
    .replace(/src\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, 'src=""');
}
