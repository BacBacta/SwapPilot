'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import type {
  DecisionReceipt,
  QuoteMode,
  QuoteResponse,
  RankedQuote,
} from '@swappilot/shared';

import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { getReceipt, postQuotes, type ApiError } from '../../lib/api';
import {
  computeMinOut,
  downloadJson,
  formatBigIntString,
  shortAddress,
} from '../../lib/format';

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

function CapabilityBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs',
        enabled
          ? 'border-border bg-secondary text-secondary-foreground'
          : 'border-border bg-background text-muted-foreground',
      )}
    >
      {label}
    </span>
  );
}

function RiskChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xs font-medium">{value}</div>
    </div>
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

function ProviderCard(params: {
  quote: RankedQuote;
  slippageBps: number;
  isBeqWinner: boolean;
  isRawWinner: boolean;
}) {
  const q = params.quote;
  const minOut = computeMinOut({ buyAmount: q.raw.buyAmount, slippageBps: params.slippageBps });
  const deepLinkOnly = q.capabilities.quote === false;
  const outIsZero = q.raw.buyAmount === '0';

  const confidence = q.signals.preflight?.confidence ?? q.signals.sellability.confidence;
  const pRevert = q.signals.preflight?.pRevert;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">{q.providerId}</div>
            {params.isBeqWinner ? (
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">BEQ</span>
            ) : null}
            {params.isRawWinner ? (
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                Best Raw
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Source: {q.sourceType}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CapabilityBadge label="quote" enabled={q.capabilities.quote} />
          <CapabilityBadge label="buildTx" enabled={q.capabilities.buildTx} />
          <CapabilityBadge label="deepLink" enabled={q.capabilities.deepLink} />
        </div>
      </div>

      {deepLinkOnly ? (
        <div className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          Deep-link only: aucun quote direct disponible. Le classement reflète une estimation / stub.
        </div>
      ) : null}

      {outIsZero ? (
        <div className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          Quote indisponible (sortie à 0). Tu peux quand même tenter le deep-link.
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-md border border-border bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">Sortie (out)</div>
          <div className="mt-1 font-mono text-sm">{formatBigIntString(q.raw.buyAmount)}</div>
          <div className="mt-2 text-xs text-muted-foreground">Min out (slippage)</div>
          <div className="mt-1 font-mono text-sm">{formatBigIntString(minOut)}</div>
        </div>
        <div className="rounded-md border border-border bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">Gas estimate</div>
          <div className="mt-1 text-sm">{q.raw.estimatedGas ?? '—'}</div>
          <div className="mt-2 text-xs text-muted-foreground">Gas (USD)</div>
          <div className="mt-1 text-sm">{q.normalized.estimatedGasUsd ?? '—'}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        <RiskChip label="Sellability" value={`${q.signals.sellability.status} (conf ${confidence.toFixed(2)})`} />
        <RiskChip
          label="Revert risk"
          value={`${q.signals.revertRisk.level}${pRevert != null ? ` (pRevert ${pRevert.toFixed(2)})` : ''}`}
        />
        <RiskChip label="MEV" value={q.signals.mevExposure.level} />
        <RiskChip label="Churn" value={q.signals.churn.level} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!q.deepLink) return;
            window.open(q.deepLink, '_blank', 'noopener,noreferrer');
          }}
          disabled={!q.deepLink}
        >
          Open in Provider
        </Button>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Aucun résultat n’est garanti. Affiche la confiance/risque, pas une certitude.
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

  const [activeTab, setActiveTab] = useState<'beq' | 'raw'>('beq');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QuoteResponse | null>(null);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<DecisionReceipt | null>(null);

  const enabledProviderIds = useMemo(() => Array.from(enabledProviders.values()), [enabledProviders]);
  const allEnabled = enabledProviderIds.length === PROVIDERS.length;

  const quotesToShow = useMemo(() => {
    if (!response) return [];
    return activeTab === 'beq' ? response.rankedQuotes : response.bestRawQuotes;
  }, [response, activeTab]);

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
      setReceipt(null);
      setReceiptError(null);
    } catch (e) {
      setResponse(null);
      setReceipt(null);
      setReceiptError(null);
      setError(errorToMessage(e as ApiError));
    } finally {
      setLoading(false);
    }
  }

  async function openReceiptDrawer() {
    const id = response?.receiptId;
    if (!id) return;

    setReceiptOpen(true);
    setReceiptLoading(true);
    setReceiptError(null);

    try {
      const r = await getReceipt({ id, timeoutMs: 12_000 });
      setReceipt(r);
    } catch (e) {
      setReceipt(null);
      setReceiptError(errorToMessage(e as ApiError));
    } finally {
      setReceiptLoading(false);
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Results</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Affiche le classement BEQ ou le meilleur output brut. Pas de garantie: utilise les signaux et la confiance.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeTab === 'beq' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('beq')}
            >
              BEQ ranking
            </Button>
            <Button
              variant={activeTab === 'raw' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('raw')}
            >
              Best Raw Output
            </Button>
          </div>
        </div>

        {response ? (
          <div className="mt-4 rounded-lg border border-border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Receipt</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{response.receiptId}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={openReceiptDrawer}>
                  Ouvrir receipt
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!response) return;
                    void navigator.clipboard.writeText(response.receiptId);
                  }}
                >
                  Copier ID
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">BEQ recommended</div>
                <div className="mt-1 text-sm">{response.beqRecommendedProviderId ?? '—'}</div>
              </div>
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">Best executable</div>
                <div className="mt-1 text-sm">{response.bestExecutableQuoteProviderId ?? '—'}</div>
              </div>
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">Best raw</div>
                <div className="mt-1 text-sm">{response.bestRawOutputProviderId ?? '—'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            Aucun résultat pour le moment. Lance une requête.
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4">
          {quotesToShow.map((q) => (
            <ProviderCard
              key={`${activeTab}:${q.providerId}`}
              quote={q}
              slippageBps={slippageBps}
              isBeqWinner={q.providerId === response?.beqRecommendedProviderId}
              isRawWinner={q.providerId === response?.bestRawOutputProviderId}
            />
          ))}
        </div>
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

      <DrawerShell open={receiptOpen} title="Receipt" onClose={() => setReceiptOpen(false)}>
        {!response ? (
          <div className="text-sm text-muted-foreground">Aucun receipt disponible.</div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-xs text-muted-foreground">{response.receiptId}</div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!receipt) return;
                    downloadJson(`${response.receiptId}.json`, receipt);
                  }}
                  disabled={!receipt}
                >
                  Export JSON
                </Button>
              </div>
            </div>

            {receiptLoading ? (
              <div className="mt-4 text-sm text-muted-foreground">Chargement…</div>
            ) : receiptError ? (
              <div className="mt-4 rounded-md border border-border bg-muted px-4 py-3 text-sm">
                <div className="font-medium">Erreur</div>
                <div className="mt-1 text-muted-foreground">{receiptError}</div>
              </div>
            ) : receipt ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-md border border-border bg-background p-3">
                  <div className="text-sm font-semibold">Decision</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground">BEQ recommended</div>
                      <div className="text-sm">{receipt.beqRecommendedProviderId ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Best raw</div>
                      <div className="text-sm">{receipt.bestRawOutputProviderId ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Mode</div>
                      <div className="text-sm">{receipt.ranking.mode}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Warnings</div>
                      <div className="text-sm">{receipt.warnings.length ? receipt.warnings.join(', ') : '—'}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-border bg-background p-3">
                  <div className="text-sm font-semibold">Request</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {shortAddress(receipt.request.sellToken)} → {shortAddress(receipt.request.buyToken)} | amount{' '}
                    <span className="font-mono">{formatBigIntString(receipt.request.sellAmount)}</span>
                  </div>
                </div>

                <div className="rounded-md border border-border bg-background p-3">
                  <div className="text-sm font-semibold">Raw JSON</div>
                  <pre className="mt-2 max-h-[50vh] overflow-auto rounded-md border border-border bg-background p-3 text-xs">
                    {JSON.stringify(receipt, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-muted-foreground">Aucune donnée.</div>
            )}
          </div>
        )}
      </DrawerShell>
    </main>
  );
}
