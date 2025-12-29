import Link from 'next/link';

import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

type Model = {
  id:
    | '01'
    | '02'
    | '03'
    | '04'
    | '05'
    | '06'
    | '07'
    | '08'
    | '09'
    | '10';
  name: string;
  tagline: string;
  density: 'spacious' | 'balanced' | 'dense';
  frameClass: string;
  headerClass: string;
  panelClass: string;
  cardClass: string;
  rowClass: string;
};

const MODELS: Model[] = [
  {
    id: '01',
    name: 'SaaS Minimal (Clean)',
    tagline: 'Très sobre, beaucoup d’air, hiérarchie typographique nette.',
    density: 'spacious',
    frameClass: 'rounded-2xl border bg-background',
    headerClass: 'border-b bg-background',
    panelClass: 'bg-background',
    cardClass: 'rounded-xl border bg-background',
    rowClass: 'rounded-lg border bg-background',
  },
  {
    id: '02',
    name: 'Fintech Premium (Glass‑lite)',
    tagline: 'Surfaces “glass” légères, focus sur BEQ vs Raw.',
    density: 'balanced',
    frameClass: 'rounded-2xl border bg-muted/30',
    headerClass: 'border-b bg-muted/30',
    panelClass: 'bg-muted/20',
    cardClass: 'rounded-xl border bg-background/80',
    rowClass: 'rounded-lg border bg-background/70',
  },
  {
    id: '03',
    name: 'Data‑Dense Terminal (Light)',
    tagline: 'Table compacte, alignement strict, lisible et dense.',
    density: 'dense',
    frameClass: 'rounded-xl border bg-background',
    headerClass: 'border-b bg-background',
    panelClass: 'bg-background',
    cardClass: 'rounded-lg border bg-background',
    rowClass: 'rounded-md border bg-background',
  },
  {
    id: '04',
    name: 'Editorial Compare',
    tagline: 'Plus narratif, micro‑copy, receipt plus “lisible”.',
    density: 'spacious',
    frameClass: 'rounded-2xl border bg-background',
    headerClass: 'border-b bg-background',
    panelClass: 'bg-background',
    cardClass: 'rounded-xl border bg-muted/30',
    rowClass: 'rounded-lg border bg-background',
  },
  {
    id: '05',
    name: 'Split‑Screen Executive',
    tagline: 'Panneaux très structurés, “cockpit” net.',
    density: 'balanced',
    frameClass: 'rounded-2xl border bg-background',
    headerClass: 'border-b bg-background',
    panelClass: 'bg-muted/20',
    cardClass: 'rounded-xl border bg-background',
    rowClass: 'rounded-lg border bg-background',
  },
  {
    id: '06',
    name: 'Card Marketplace',
    tagline: 'Quotes en cards “produit”, BEQ mis en avant.',
    density: 'balanced',
    frameClass: 'rounded-2xl border bg-background',
    headerClass: 'border-b bg-background',
    panelClass: 'bg-background',
    cardClass: 'rounded-xl border bg-background',
    rowClass: 'rounded-xl border bg-muted/20',
  },
  {
    id: '07',
    name: 'Monochrome Pro',
    tagline: 'Monochrome, contrastes subtils, ultra pro.',
    density: 'balanced',
    frameClass: 'rounded-xl border bg-background',
    headerClass: 'border-b bg-background',
    panelClass: 'bg-background',
    cardClass: 'rounded-xl border bg-background',
    rowClass: 'rounded-lg border bg-background',
  },
  {
    id: '08',
    name: 'Soft Rounded',
    tagline: 'Rayons plus généreux, sensation moderne “friendly”.',
    density: 'spacious',
    frameClass: 'rounded-3xl border bg-muted/20',
    headerClass: 'border-b bg-muted/20',
    panelClass: 'bg-muted/10',
    cardClass: 'rounded-2xl border bg-background',
    rowClass: 'rounded-2xl border bg-background',
  },
  {
    id: '09',
    name: 'Metrics‑First Scoreboard',
    tagline: 'BEQ vs Raw façon “scoreboard” comparatif.',
    density: 'balanced',
    frameClass: 'rounded-2xl border bg-background',
    headerClass: 'border-b bg-background',
    panelClass: 'bg-background',
    cardClass: 'rounded-xl border bg-muted/20',
    rowClass: 'rounded-lg border bg-background',
  },
  {
    id: '10',
    name: 'Enterprise Panel System',
    tagline: 'Look “admin/enterprise”, panneaux + toolbars.',
    density: 'dense',
    frameClass: 'rounded-xl border bg-background',
    headerClass: 'border-b bg-muted/20',
    panelClass: 'bg-muted/10',
    cardClass: 'rounded-lg border bg-background',
    rowClass: 'rounded-md border bg-background',
  },
];

export const metadata = {
  title: 'SwapPilot — Modèles UI (Wireframe A)',
};

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
      {label}
    </span>
  );
}

function DensityClasses(density: Model['density']) {
  if (density === 'dense') {
    return {
      pad: 'p-3',
      gap: 'gap-3',
      hHeader: 'h-12',
      hInput: 'h-9',
      hRow: 'h-12',
      textTitle: 'text-base',
      textMeta: 'text-xs',
    };
  }
  if (density === 'spacious') {
    return {
      pad: 'p-6',
      gap: 'gap-5',
      hHeader: 'h-16',
      hInput: 'h-11',
      hRow: 'h-16',
      textTitle: 'text-lg',
      textMeta: 'text-sm',
    };
  }
  return {
    pad: 'p-4',
    gap: 'gap-4',
    hHeader: 'h-14',
    hInput: 'h-10',
    hRow: 'h-14',
    textTitle: 'text-lg',
    textMeta: 'text-sm',
  };
}

function ModelPreview({ model }: { model: Model }) {
  const d = DensityClasses(model.density);

  return (
    <div className={cn('overflow-hidden', model.frameClass)}>
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4',
          d.hHeader,
          model.headerClass,
        )}
      >
        <div className="flex items-baseline gap-2">
          <div className={cn('font-semibold', d.textTitle)}>SwapPilot</div>
          <div className={cn('text-muted-foreground', d.textMeta)}>
            A — Two‑Pane Compare
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip label="BNB" />
          <Chip label="SAFE" />
          <Button size="sm" variant="outline">
            Connect
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className={cn('grid lg:grid-cols-[360px,1fr]', d.gap, d.pad)}>
        {/* Left panel */}
        <div className={cn('rounded-xl border', model.panelClass, d.pad)}>
          <div className={cn('font-semibold', d.textTitle)}>Paramètres</div>
          <div className={cn('mt-1 text-muted-foreground', d.textMeta)}>
            Token In / Token Out • Montant • Slippage
          </div>

          <div className={cn('mt-4 grid', d.gap)}>
            <div className={cn('rounded-lg border bg-background', d.hInput)} />
            <div className={cn('rounded-lg border bg-background', d.hInput)} />
            <div className="grid grid-cols-2 gap-3">
              <div className={cn('rounded-lg border bg-background', d.hInput)} />
              <div className={cn('rounded-lg border bg-background', d.hInput)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Chip label="Conf: High" />
                <Chip label="Risk: OK" />
              </div>
              <Button size="sm">Quotes</Button>
            </div>

            <div className={cn('mt-2', model.cardClass, d.pad)}>
              <div className={cn('font-medium', d.textTitle)}>Receipt (aperçu)</div>
              <div className={cn('mt-1 text-muted-foreground', d.textMeta)}>
                Why BEQ chose X: fees, taxes, liquidity…
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip label="OK" />
                <Chip label="UNCERTAIN" />
                <Chip label="FAIL" />
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className={cn('grid', d.gap)}>
          {/* Two cards */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className={cn(model.cardClass, d.pad)}>
              <div className="flex items-center justify-between">
                <div className={cn('font-semibold', d.textTitle)}>BEQ</div>
                <Chip label="Recommended" />
              </div>
              <div className={cn('mt-2 text-muted-foreground', d.textMeta)}>
                Provider X • Out • Fees • Risk
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm">Deep‑link</Button>
                <Button size="sm" variant="outline">
                  Receipt
                </Button>
              </div>
            </div>
            <div className={cn(model.cardClass, d.pad)}>
              <div className="flex items-center justify-between">
                <div className={cn('font-semibold', d.textTitle)}>Raw</div>
                <Chip label="Best output" />
              </div>
              <div className={cn('mt-2 text-muted-foreground', d.textMeta)}>
                Provider Y • Out • Fees • Risk
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline">
                  Deep‑link
                </Button>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className={cn('flex items-center justify-between', model.cardClass, d.pad)}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip label="All quotes" />
              <Chip label="Providers" />
              <Chip label="DEX direct" />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline">
                Export
              </Button>
              <Button size="sm" variant="outline">
                Refresh
              </Button>
            </div>
          </div>

          {/* Quote rows */}
          <div className={cn('grid', d.gap)}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                className={cn(
                  'flex items-center justify-between',
                  model.rowClass,
                  d.pad,
                  d.hRow,
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-8 w-8 rounded-md border bg-muted" />
                  <div className="min-w-0">
                    <div className={cn('font-medium', d.textMeta)}>
                      Provider {String.fromCharCode(65 + idx)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Chip label="Out" />
                      <Chip label="Fees" />
                      <Chip label="Risk" />
                      <Chip label="Conf" />
                    </div>
                  </div>
                </div>
                <Button size="sm" variant={idx === 0 ? 'default' : 'outline'}>
                  Open
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WireframeAModelsPage() {
  return (
    <main className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Wireframe A — 10 modèles UI</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Chaque modèle garde la même structure que le wireframe A (panneau
            paramètres à gauche, comparaison BEQ vs Raw à droite, liste de quotes
            + receipt). Seuls les styles (densité, arrondis, surfaces) changent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/wireframes">
            <Button variant="outline">SVG wireframes</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Accueil</Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-10">
        {MODELS.map((model) => (
          <section key={model.id} className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-semibold">
                  {model.id}. {model.name}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {model.tagline}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Densité: {model.density}
              </div>
            </div>

            <div className="rounded-2xl bg-muted/30 p-3">
              <ModelPreview model={model} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
