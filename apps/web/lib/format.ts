export function shortAddress(addr: string, head = 6, tail = 4): string {
  if (!addr) return '';
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function formatBigIntString(value: string): string {
  try {
    const v = BigInt(value);
    return v.toString();
  } catch {
    return value;
  }
}

export function computeMinOut(params: { buyAmount: string; slippageBps: number }): string {
  try {
    const buy = BigInt(params.buyAmount);
    const bps = BigInt(Math.max(0, Math.min(5000, params.slippageBps)));
    const minOut = (buy * (10_000n - bps)) / 10_000n;
    return minOut.toString();
  } catch {
    return '0';
  }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
