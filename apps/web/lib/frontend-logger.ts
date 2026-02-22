/**
 * SwapPilot — Frontend Logger
 *
 * Captures every JS error, unhandled promise rejection, React boundary error,
 * and network/fetch failure. Stores a ring-buffer of the last 100 entries
 * accessible from the browser console as `window.__SP_ERRORS__`.
 *
 * Usage (console):
 *   window.__SP_ERRORS__          → full log array
 *   window.__SP_DUMP_ERRORS__()   → pretty-prints all entries
 *   window.__SP_CLEAR_ERRORS__()  → clears the buffer
 */

export type LogLevel = 'error' | 'warn' | 'info';

export interface LogEntry {
  id: number;
  ts: string;         // ISO timestamp
  level: LogLevel;
  category: string;   // e.g. 'js-error', 'promise', 'fetch', 'react', 'console'
  message: string;
  detail?: unknown;   // stack, response body, etc.
}

const MAX_ENTRIES = 100;
let _seq = 0;
const _log: LogEntry[] = [];

function push(level: LogLevel, category: string, message: string, detail?: unknown) {
  const entry: LogEntry = {
    id: ++_seq,
    ts: new Date().toISOString(),
    level,
    category,
    message,
    detail,
  };
  _log.push(entry);
  if (_log.length > MAX_ENTRIES) _log.shift();

  const style = level === 'error'
    ? 'color:#ff6b6b;font-weight:bold'
    : level === 'warn'
      ? 'color:#f0b90b;font-weight:bold'
      : 'color:#00e676';

  console.groupCollapsed(`%c[SP:${category}] ${message}`, style);
  console.log('timestamp:', entry.ts);
  if (detail !== undefined) console.log('detail:', detail);
  console.groupEnd();
}

// ─── Exposed on window ─────────────────────────────────────────────────────

declare global {
  interface Window {
    __SP_ERRORS__: LogEntry[];
    __SP_DUMP_ERRORS__: () => void;
    __SP_CLEAR_ERRORS__: () => void;
    __SP_LOG__: typeof push;
  }
}

/** Call once on app mount. Idempotent. */
export function initFrontendLogger() {
  if (typeof window === 'undefined') return;
  if ((window as { __SP_LOGGER_INIT__?: boolean }).__SP_LOGGER_INIT__) return;
  (window as { __SP_LOGGER_INIT__?: boolean }).__SP_LOGGER_INIT__ = true;

  // ── Expose helpers ──────────────────────────────────────────────────────
  window.__SP_ERRORS__ = _log;

  window.__SP_DUMP_ERRORS__ = () => {
    if (_log.length === 0) { console.log('[SP] No errors logged.'); return; }
    console.group(`[SP] Frontend error log — ${_log.length} entries`);
    _log.forEach((e) => {
      console.groupCollapsed(`#${e.id} [${e.level.toUpperCase()}] [${e.category}] ${e.ts.slice(11, 23)} — ${e.message}`);
      if (e.detail !== undefined) console.log(e.detail);
      console.groupEnd();
    });
    console.groupEnd();
  };

  window.__SP_CLEAR_ERRORS__ = () => { _log.length = 0; console.log('[SP] Error log cleared.'); };
  window.__SP_LOG__ = push;

  // ── 1. Uncaught JS errors ───────────────────────────────────────────────
  const prevOnerror = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    push('error', 'js-error', String(message), {
      source, lineno, colno,
      stack: error?.stack ?? null,
    });
    return typeof prevOnerror === 'function'
      ? prevOnerror(message, source, lineno, colno, error)
      : false;
  };

  // ── 2. Unhandled promise rejections ────────────────────────────────────
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    const message = reason instanceof Error
      ? reason.message
      : String(reason ?? 'Unhandled promise rejection');
    push('error', 'promise', message, {
      stack: reason instanceof Error ? reason.stack : null,
      reason,
    });
  });

  // ── 3. console.error override ───────────────────────────────────────────
  const _origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    _origError(...args);
    const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    push('error', 'console', message.slice(0, 300), args.length > 1 ? args : undefined);
  };

  // ── 4. console.warn override ────────────────────────────────────────────
  const _origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    _origWarn(...args);
    const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    push('warn', 'console', message.slice(0, 300), args.length > 1 ? args : undefined);
  };

  // ── 5. fetch interceptor ─────────────────────────────────────────────────
  const _origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    const t0 = performance.now();

    push('info', 'fetch', `${method} ${url}`);

    try {
      const response = await _origFetch(input, init);
      const ms = Math.round(performance.now() - t0);

      if (!response.ok) {
        let body: unknown;
        try { body = await response.clone().text(); } catch { body = null; }
        push('error', 'fetch', `${response.status} ${response.statusText} — ${method} ${url} (${ms}ms)`, { status: response.status, body });
      } else {
        push('info', 'fetch', `${response.status} OK — ${method} ${url} (${ms}ms)`);
      }

      return response;
    } catch (err: unknown) {
      const ms = Math.round(performance.now() - t0);
      const message = err instanceof Error ? err.message : String(err);
      push('error', 'fetch', `NETWORK ERROR — ${method} ${url} (${ms}ms): ${message}`, {
        stack: err instanceof Error ? err.stack : null,
      });
      throw err;
    }
  };

  // ── 6. React error boundary helper ──────────────────────────────────────
  // Components can call window.__SP_LOG__('error', 'react', msg, detail)
  // from their componentDidCatch / useEffect error handlers.

  push('info', 'init', 'SwapPilot frontend logger active');
  console.log(
    '%c[SP] Frontend logger active — use window.__SP_DUMP_ERRORS__() to inspect',
    'color:#00e676;font-weight:bold'
  );
}

/** Manually log a frontend error from any component. */
export function logFrontendError(category: string, message: string, detail?: unknown) {
  push('error', category, message, detail);
}

/** Manually log a frontend warning from any component. */
export function logFrontendWarn(category: string, message: string, detail?: unknown) {
  push('warn', category, message, detail);
}
