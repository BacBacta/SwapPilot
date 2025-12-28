import Link from 'next/link';

import { Button } from '../components/ui/button';

export default function HomePage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">SwapPilot</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Meta-aggregation hub (Option 1): compare, normalize, explain, deep-link.
      </p>
      <div className="mt-4">
        <Link href="/swap">
          <Button>Go to /swap</Button>
        </Link>
      </div>
    </main>
  );
}
