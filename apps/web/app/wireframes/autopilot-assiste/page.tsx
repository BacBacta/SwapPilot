import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { AppShellDark, ElevatedCard } from '@/components/ui/surfaces';

import { AutopilotAssisteDemo } from './ui';

export const metadata = {
  title: 'SwapPilot — Démo Autopilot assisté',
};

export default function AutopilotAssistePage() {
  return (
    <AppShellDark>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Démo — Autopilot assisté</h1>
          <p className="mt-2 text-sm text-sp-muted">
            Maquette interactive (mock) : l’autopilot prépare un bundle prêt à signer + une preuve « réponse signée ».
          </p>
        </div>
        <Link href="/wireframes">
          <Button variant="outline">Retour</Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-6">
        <ElevatedCard className="p-5">
          <div className="text-sm text-sp-muted">
            Cette page ne fait aucun appel API et n’utilise pas le wallet : c’est uniquement une visualisation du rendu
            et des étapes UX.
          </div>
        </ElevatedCard>

        <AutopilotAssisteDemo />
      </div>
    </AppShellDark>
  );
}
