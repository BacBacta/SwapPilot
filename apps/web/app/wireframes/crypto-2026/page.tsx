import Link from 'next/link'

import { Button } from '../../../components/ui/button'

export const metadata = {
  title: 'SwapPilot — Crypto 2026 Preview',
}

export default function CryptoPreviewPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] p-6 text-[var(--text-primary)]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Crypto 2026 Preview</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Interactive motion preview for home-inspired crypto UI directions.
            </p>
          </div>
          <Link href="/wireframes">
            <Button variant="outline">Back</Button>
          </Link>
        </div>

        <section className="card">
          <div className="mb-4 flex flex-wrap gap-3">
            <Link href="/wireframes/crypto-2026?variant=glass" className="btn btn-primary">
              Premium Glass
            </Link>
            <Link href="/wireframes/crypto-2026?variant=terminal" className="btn btn-secondary">
              Terminal Velocity
            </Link>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            This route is active and available for preview navigation.
          </p>
        </section>
      </div>
    </main>
  )
}
