let connectPending = false;
let resetTimer: ReturnType<typeof setTimeout> | null = null;

const DEFAULT_TIMEOUT_MS = 15_000;

function setPending(timeoutMs = DEFAULT_TIMEOUT_MS) {
  connectPending = true;
  if (resetTimer) {
    clearTimeout(resetTimer);
  }
  resetTimer = setTimeout(() => {
    connectPending = false;
    resetTimer = null;
  }, timeoutMs);
}

export function isWalletConnectPending(): boolean {
  return connectPending;
}

export function resetWalletConnectPending(): void {
  connectPending = false;
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
}

export function guardedOpenConnect(openConnectModal: () => void): void {
  if (connectPending) return;
  setPending();
  openConnectModal();
}

export function triggerRainbowKitConnect(): void {
  if (connectPending) return;
  setPending();
  const el = document.querySelector<HTMLElement>("[data-testid='rk-connect-button']");
  if (!el) {
    resetWalletConnectPending();
    return;
  }
  el.click();
}
