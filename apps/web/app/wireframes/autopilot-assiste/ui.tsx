'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ElevatedCard, GlassCard } from '@/components/ui/surfaces';

type DemoStep = 'intent' | 'proposal' | 'approve' | 'swap' | 'receipt';

function shortAddr(addr: string): string {
  if (!addr.startsWith('0x') || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function Pill({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'info' }) {
  const classes =
    tone === 'ok'
      ? 'border border-white/10 bg-white/5 text-sp-text'
      : tone === 'warn'
        ? 'border border-white/10 bg-white/5 text-sp-text'
        : 'border border-white/10 bg-white/5 text-sp-text';

  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${classes}`}>{label}</span>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-b-0">
      <div className="text-xs text-sp-muted">{k}</div>
      <div className="text-xs text-sp-text">{v}</div>
    </div>
  );
}

export function AutopilotAssisteDemo() {
  const [step, setStep] = useState<DemoStep>('intent');
  const [showRaw, setShowRaw] = useState(false);

  const mock = useMemo(() => {
    const now = Date.now();
    const expiresAt = new Date(now + 90_000).toISOString();
    return {
      requestId: `demo-${now}`,
      chainId: 56,
      providerId: 'pancakeswap',
      wallet: '0xBEEF00000000000000000000000000000000BEEF',
      sellToken: { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' },
      buyToken: { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955' },
      sellAmount: '0.2500',
      sellAmountWei: '250000000000000000',
      slippageBps: 100,
      expectedBuyAmount: '152.23',
      minBuyAmount: '150.70',
      approvalSpender: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      tx: {
        to: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        value: '0',
        gas: '280000',
        dataHash: '0x9a6d…c3f1 (keccak256(data))',
      },
      envelope: {
        domain: {
          name: 'SwapPilot Autopilot',
          version: '1',
          chainId: 56,
        },
        message: {
          requestId: `demo-${now}`,
          wallet: '0xBEEF00000000000000000000000000000000BEEF',
          providerId: 'pancakeswap',
          sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
          buyToken: '0x55d398326f99059fF775485246999027B3197955',
          sellAmountWei: '250000000000000000',
          slippageBps: 100,
          approvalSpender: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
          to: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
          value: '0',
          dataHash: '0x9a6d...c3f1',
          issuedAt: new Date(now).toISOString(),
          expiresAt,
        },
        signature: '0xSIG… (EIP-712)',
        verified: true,
        signer: 'SwapPilot API key (rotation-ready)',
      },
      signals: [
        { label: 'Allowlist target/spender OK', tone: 'ok' as const },
        { label: 'Approve exact (no infinite)', tone: 'ok' as const },
        { label: 'Simulation: OK (best-effort)', tone: 'info' as const },
        { label: 'Deadline: 90s', tone: 'info' as const },
      ],
    };
  }, []);

  const nextLabel =
    step === 'intent'
      ? 'Générer la proposition Autopilot'
      : step === 'proposal'
        ? 'Continuer (approval exact)'
        : step === 'approve'
          ? 'Continuer (swap)'
          : step === 'swap'
            ? 'Voir le receipt'
            : 'Recommencer';

  function goNext() {
    setShowRaw(false);
    setStep((s) => {
      if (s === 'intent') return 'proposal';
      if (s === 'proposal') return 'approve';
      if (s === 'approve') return 'swap';
      if (s === 'swap') return 'receipt';
      return 'intent';
    });
  }

  return (
    <div className="grid gap-6">
      <GlassCard className="p-5" glow>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-sp-text">Étape</div>
              <Pill
                label={
                  step === 'intent'
                    ? '1/5 — Intention'
                    : step === 'proposal'
                      ? '2/5 — Proposition (signée)'
                      : step === 'approve'
                        ? '3/5 — Approval exact'
                        : step === 'swap'
                          ? '4/5 — Swap'
                          : '5/5 — Receipt'
                }
                tone="info"
              />
              {step !== 'intent' && (
                <Pill label={mock.envelope.verified ? 'Verified' : 'Unverified'} tone={mock.envelope.verified ? 'ok' : 'warn'} />
              )}
            </div>
            <div className="mt-2 text-xs text-sp-muted">
              Cible: {mock.sellToken.symbol} → {mock.buyToken.symbol} · {mock.sellAmount} {mock.sellToken.symbol} · slippage {mock.slippageBps / 100}%
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowRaw((v) => !v)} disabled={step === 'intent'}>
              {showRaw ? 'Masquer JSON' : 'Voir JSON signé'}
            </Button>
            <Button onClick={goNext}>{nextLabel}</Button>
          </div>
        </div>
      </GlassCard>

      {step === 'intent' && (
        <ElevatedCard className="p-5">
          <div className="text-sm font-medium text-sp-text">1) Intention utilisateur</div>
          <div className="mt-2 text-sm text-sp-muted">
            L’utilisateur choisit ses tokens, son montant et son slippage max. Rien n’est signé ici.
          </div>
          <div className="mt-4 grid gap-2">
            <Row k="Wallet" v={shortAddr(mock.wallet)} />
            <Row k="Sell" v={`${mock.sellAmount} ${mock.sellToken.symbol} (${shortAddr(mock.sellToken.address)})`} />
            <Row k="Buy" v={`${mock.buyToken.symbol} (${shortAddr(mock.buyToken.address)})`} />
            <Row k="Slippage max" v={`${mock.slippageBps / 100}%`} />
          </div>
        </ElevatedCard>
      )}

      {step !== 'intent' && (
        <ElevatedCard className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-sp-text">2) Proposition Autopilot (bundle prêt à signer)</div>
            <div className="flex flex-wrap gap-2">
              {mock.signals.map((s) => (
                <Pill key={s.label} label={s.label} tone={s.tone} />
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <Row k="Provider" v={mock.providerId} />
            <Row k="Expected buy" v={`${mock.expectedBuyAmount} ${mock.buyToken.symbol}`} />
            <Row k="Min buy (slippage)" v={`${mock.minBuyAmount} ${mock.buyToken.symbol}`} />
            <Row k="Approval spender" v={`${shortAddr(mock.approvalSpender)} (router)`} />
            <Row k="Tx to" v={shortAddr(mock.tx.to)} />
            <Row k="Tx value" v={mock.tx.value} />
            <Row k="Tx gas (est.)" v={mock.tx.gas} />
            <Row k="Tx data" v={mock.tx.dataHash} />
            <Row k="Expires" v={mock.envelope.message.expiresAt} />
          </div>

          {showRaw && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-sp-muted">EIP-712 envelope (mock)</div>
              <pre className="mt-2 max-h-72 overflow-auto text-xs text-sp-text">
                {JSON.stringify(mock.envelope, null, 2)}
              </pre>
            </div>
          )}
        </ElevatedCard>
      )}

      {step === 'approve' && (
        <ElevatedCard className="p-5">
          <div className="text-sm font-medium text-sp-text">3) Approval exact</div>
          <div className="mt-2 text-sm text-sp-muted">
            L’utilisateur signe un approve exact du montant nécessaire (pas d’approval infinie).
          </div>
          <div className="mt-4 grid gap-2">
            <Row k="Token" v={`${mock.sellToken.symbol} (${shortAddr(mock.sellToken.address)})`} />
            <Row k="Spender" v={shortAddr(mock.approvalSpender)} />
            <Row k="Amount" v={`${mock.sellAmountWei} (wei)`} />
          </div>
        </ElevatedCard>
      )}

      {step === 'swap' && (
        <ElevatedCard className="p-5">
          <div className="text-sm font-medium text-sp-text">4) Swap</div>
          <div className="mt-2 text-sm text-sp-muted">
            L’utilisateur signe ensuite le swap. Avant d’envoyer, l’app peut faire une simulation (estimation gas / revert).
          </div>
          <div className="mt-4 grid gap-2">
            <Row k="Tx to" v={shortAddr(mock.tx.to)} />
            <Row k="Min buy" v={`${mock.minBuyAmount} ${mock.buyToken.symbol}`} />
            <Row k="Deadline" v={mock.envelope.message.expiresAt} />
          </div>
        </ElevatedCard>
      )}

      {step === 'receipt' && (
        <ElevatedCard className="p-5">
          <div className="text-sm font-medium text-sp-text">5) Receipt (post-trade)</div>
          <div className="mt-2 text-sm text-sp-muted">
            Après confirmation, l’app peut envoyer un receipt (signé par le wallet) pour des métriques fiables et une
            réputation future.
          </div>
          <div className="mt-4 grid gap-2">
            <Row k="Tx hash" v="0xTX… (mock)" />
            <Row k="Status" v="success" />
            <Row k="Provider" v={mock.providerId} />
            <Row k="Wallet" v={shortAddr(mock.wallet)} />
          </div>
        </ElevatedCard>
      )}
    </div>
  );
}
