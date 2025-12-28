'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import type { QuoteMode, QuoteResponse } from '@swappilot/shared';

import { Button } from '../../components/ui/button';
import { postQuotes, type ApiError } from '../../lib/api';
import { formatBigIntString } from '../../lib/format';

type ProviderOption = { id: string; label: string };

const PROVIDERS: ProviderOption[] = [
  { id: 'binance-wallet', label: 'Binance Wallet' },
  { id: 'okx-dex', label: 'OKX DEX' },
  { id: '1inch', label: '1inch' },
  { id: 'liquidmesh', label: 'LiquidMesh' },
  { id: 'kyberswap', label: 'KyberSwap' },
  { id: 'metamask', label: 'MetaMask' },
  { id: 'pancakeswap', label: 'PancakeSwap' },
];

const TOKEN_PRESETS = [
  { label: 'BNB (natif placeholder)', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
  { label: 'WBNB (placeholder)', address: '0x0000000000000000000000000000000000000001' },
  { label: 'Token B (placeholder)', address: '0x0000000000000000000000000000000000000002' },
] as const;

function errorToMessage(err: ApiError): string {
  switch (err.kind) {
    case 'timeout':
      return "Délai dépassé. L'API n'a pas répondu à temps.";
    case 'http':
      return `Erreur API (${err.status ?? 'HTTP'}): ${err.message}`;
    case 'network':
      return `Erreur réseau: ${err.message}`;
    case 'invalid_response':
      return "Réponse API inattendue (schéma invalide).";
    default:
      return 'Erreur inconnue.';
  }
}

function ModePill({ mode, active, onClick }: { mode: QuoteMode; active: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      aria-pressed={active}
    >
      {mode}
    </Button>
  );
}

function DrawerShell(params: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!params.open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/20" onClick={params.onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-border bg-background">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="text-sm font-semibold">{params.title}</div>
          <Button variant="ghost" size="sm" onClick={params.onClose}>
            Fermer
          </Button>
        </div>
        <div className="p-4">{params.children}</div>
      </div>
    </div>
  );
}

export function SwapClient() {
  const [sellToken, setSellToken] = useState('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');
  const [buyToken, setBuyToken] = useState('0x0000000000000000000000000000000000000002');
  const [sellAmount, setSellAmount] = useState('1000000000000000000');

  const [mode, setMode] = useState<QuoteMode>('NORMAL');
  const [slippageBps, setSlippageBps] = useState(100);
  const [account, setAccount] = useState('');

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [enabledProviders, setEnabledProviders] = useState<Set<string>>(
    () => new Set(PROVIDERS.map((p) => p.id)),
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QuoteResponse | null>(null);

  const enabledProviderIds = useMemo(() => Array.from(enabledProviders.values()), [enabledProviders]);
  const allEnabled = enabledProviderIds.length === PROVIDERS.length;

  async function onRequestQuotes() {
    setLoading(true);
    setError(null);

    try {
      const req = {
        chainId: 56,
        sellToken,
        buyToken,
        sellAmount,
        slippageBps,
        mode,
        ...(account.trim() ? { account: account.trim() } : {}),
        ...(!allEnabled ? { providers: enabledProviderIds } : {}),
      };

      const res = await postQuotes({ request: req, timeoutMs: 12_000 });
      setResponse(res);
    } catch (e) {
      setResponse(null);
      setError(errorToMessage(e as ApiError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Swap (Option 1)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Demande des quotes à l’API, compare BEQ vs Best Raw Output, puis ouvre un deep-link.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
          <Button onClick={onRequestQuotes} disabled={loading}>
            {loading ? 'Request…' : 'Request quotes'}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-border bg-muted px-4 py-3 text-sm">
          <div className="font-medium">Erreur</div>
          <div className="mt-1 text-muted-foreground">{error}</div>
        </div>
      ) : null}

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="text-sm font-semibold">From</div>
          <div className="mt-2 flex flex-col gap-2">
            <input
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={sellToken}
              onChange={(e) => setSellToken(e.currentTarget.value)}
              placeholder="0x…"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              {TOKEN_PRESETS.map((t) => (
                <Button key={t.label} variant="outline" size="sm" onClick={() => setSellToken(t.address)}>
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="text-sm font-semibold">To</div>
          <div className="mt-2 flex flex-col gap-2">
            <input
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={buyToken}
              onChange={(e) => setBuyToken(e.currentTarget.value)}
              placeholder="0x…"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              {TOKEN_PRESETS.map((t) => (
                <Button key={t.label} variant="outline" size="sm" onClick={() => setBuyToken(t.address)}>
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="text-sm font-semibold">Sell amount (base units)</div>
          <input
            className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm"
            value={sellAmount}
            onChange={(e) => setSellAmount(e.currentTarget.value)}
            placeholder="1000000000000000000"
            spellCheck={false}
            inputMode="numeric"
          />
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="text-sm font-semibold">Mode</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <ModePill mode="SAFE" active={mode === 'SAFE'} onClick={() => setMode('SAFE')} />
            <ModePill mode="NORMAL" active={mode === 'NORMAL'} onClick={() => setMode('NORMAL')} />
            <ModePill mode="DEGEN" active={mode === 'DEGEN'} onClick={() => setMode('DEGEN')} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            SAFE exclut les quotes jugées non-exécutables / à risque élevé. DEGEN privilégie le brut.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Providers</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Active/désactive des providers. Cette sélection est envoyée dans `enabledProviders` (champ `providers`).
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEnabledProviders(new Set(PROVIDERS.map((p) => p.id)))}
            >
              Tout activer
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEnabledProviders(new Set())}>
              Tout désactiver
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {PROVIDERS.map((p) => {
            const enabled = enabledProviders.has(p.id);
            return (
              <label
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="font-mono text-xs text-muted-foreground">{p.id}</div>
                </div>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => {
                    setEnabledProviders((prev) => {
                      const next = new Set(prev);
                      if (e.currentTarget.checked) next.add(p.id);
                      else next.delete(p.id);
                      return next;
                    });
                  }}
                />
              </label>
            );
          })}
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Remarque: si tu désactives tout, la requête renverra une liste vide.
        </div>
      </section>

      <section className="mt-6">
        <div className="text-sm font-semibold">Results</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Commit 1: intégration API + layout. Les vues BEQ/Raw et actions deep-link arrivent ensuite.
        </div>

        {response ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-sm font-semibold">Receipt</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{response.receiptId}</div>
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-sm font-semibold">Quotes ({response.rankedQuotes.length})</div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {response.rankedQuotes.map((q) => (
                  <div key={q.providerId} className="rounded-md border border-border bg-background px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{q.providerId}</div>
                      <div className="text-xs text-muted-foreground">{q.sourceType}</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">buyAmount</div>
                    <div className="mt-1 font-mono text-sm">{formatBigIntString(q.raw.buyAmount)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            Aucun résultat pour le moment. Lance une requête.
          </div>
        )}
      </section>

      <DrawerShell open={settingsOpen} title="Settings" onClose={() => setSettingsOpen(false)}>
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold">Slippage (bps)</div>
            <input
              className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm"
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.currentTarget.value))}
              inputMode="numeric"
            />
            <div className="mt-1 text-xs text-muted-foreground">0–5000. Utilisé pour calculer “min out”.</div>
          </div>

          <div>
            <div className="text-sm font-semibold">Account (optionnel)</div>
            <input
              className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm"
              value={account}
              onChange={(e) => setAccount(e.currentTarget.value)}
              placeholder="0x…"
              spellCheck={false}
            />
            <div className="mt-1 text-xs text-muted-foreground">
              Utilisé uniquement pour construire certains deep-links. Aucun secret / clé côté front.
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            L’UI affiche une confiance et des signaux de risque. Elle ne doit jamais promettre un résultat.
          </div>
        </div>
      </DrawerShell>
    </main>
  );
}
