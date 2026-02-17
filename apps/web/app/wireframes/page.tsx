import Link from 'next/link';
import Image from 'next/image';

import { Button } from '../../components/ui/button';

type Wireframe = {
  id: 'A' | 'B' | 'C';
  title: string;
  subtitle: string;
  desktopPath: string;
  mobilePath: string;
};

const WIREFRAMES: Wireframe[] = [
  {
    id: 'A',
    title: 'Design A',
    subtitle: 'Two‑Pane Compare',
    desktopPath: '/wireframes/swappilot-wireframe-A-desktop.svg',
    mobilePath: '/wireframes/swappilot-wireframe-A-mobile.svg',
  },
  {
    id: 'B',
    title: 'Design B',
    subtitle: 'Trading Terminal Light',
    desktopPath: '/wireframes/swappilot-wireframe-B-desktop.svg',
    mobilePath: '/wireframes/swappilot-wireframe-B-mobile.svg',
  },
  {
    id: 'C',
    title: 'Design C',
    subtitle: 'Explainability‑First',
    desktopPath: '/wireframes/swappilot-wireframe-C-desktop.svg',
    mobilePath: '/wireframes/swappilot-wireframe-C-mobile.svg',
  },
];

export const metadata = {
  title: 'SwapPilot — Wireframes',
};

export default function WireframesPage() {
  return (
    <main className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Wireframes</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Visualisation des designs A/B/C (desktop + mobile) au format SVG.
          </p>
          <p className="mt-2 text-sm">
            <Link className="underline" href="/wireframes/a-models">
              Voir 10 modèles UI (Wireframe A)
            </Link>
          </p>
          <p className="mt-2 text-sm">
            <Link className="underline" href="/wireframes/autopilot-assiste">
              Démo UI — Autopilot assisté (bundle signé)
            </Link>
          </p>
        </div>
        <Link href="/">
          <Button variant="outline">Retour</Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-6">
        {WIREFRAMES.map((wf) => (
          <section key={wf.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">
                {wf.title}{' '}
                <span className="text-muted-foreground">— {wf.subtitle}</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                Ouvrir les SVG:{' '}
                <a
                  className="underline"
                  href={wf.desktopPath}
                  target="_blank"
                  rel="noreferrer"
                >
                  desktop
                </a>{' '}
                ·{' '}
                <a
                  className="underline"
                  href={wf.mobilePath}
                  target="_blank"
                  rel="noreferrer"
                >
                  mobile
                </a>
              </p>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border bg-background p-3">
                <div className="text-xs text-muted-foreground">Desktop</div>
                <div className="mt-2 overflow-hidden rounded-md border bg-white">
                  <Image
                    src={wf.desktopPath}
                    alt={`${wf.title} desktop wireframe`}
                    width={1440}
                    height={900}
                    className="h-auto w-full"
                    priority={wf.id === 'A'}
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-background p-3">
                <div className="text-xs text-muted-foreground">Mobile</div>
                <div className="mt-2 flex justify-center overflow-hidden rounded-md border bg-white p-2">
                  <Image
                    src={wf.mobilePath}
                    alt={`${wf.title} mobile wireframe`}
                    width={260}
                    height={562}
                    className="h-auto w-[260px] max-w-full"
                  />
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
