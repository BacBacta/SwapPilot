import Link from 'next/link'

type TokenTab = 'claim' | 'airdrop'

const tabConfig: Record<TokenTab, { title: string; subtitle: string }> = {
  claim: {
    title: 'Claim token',
    subtitle: 'Claim your unlocked PILOT allocation directly from your connected wallet.',
  },
  airdrop: {
    title: 'Airdrop',
    subtitle: 'Track eligibility, campaign rounds, and airdrop distribution status.',
  },
}

export default async function TokenPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const activeTab: TokenTab = params.tab === 'airdrop' ? 'airdrop' : 'claim'
  const current = tabConfig[activeTab]

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <section className="mx-auto max-w-5xl px-5 pb-20 pt-32">
        <div className="mb-6">
          <span className="badge">Token Center</span>
          <h1 className="mt-4 text-3xl font-bold">Manage PILOT Distribution</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Dedicated token workspace with two flows: claiming unlocked tokens and following airdrop rounds.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)] p-3">
          <Link
            href="/token?tab=claim"
            className={`btn pointer-events-none select-none ${
              activeTab === 'claim' ? 'btn-primary' : 'btn-secondary'
            }`}
            aria-current={activeTab === 'claim' ? 'page' : undefined}
            aria-disabled="true"
          >
            <span className="blur-[1.5px]">Claim token</span>
          </Link>
          <Link
            href="/token?tab=airdrop"
            className={`btn pointer-events-none select-none ${
              activeTab === 'airdrop' ? 'btn-primary' : 'btn-secondary'
            }`}
            aria-current={activeTab === 'airdrop' ? 'page' : undefined}
            aria-disabled="true"
          >
            <span className="blur-[1.5px]">Airdrop</span>
          </Link>
          <span className="ml-auto inline-flex items-center rounded-full border border-[var(--border-light)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs text-[var(--text-secondary)]">
            Coming soon
          </span>
        </div>

        <article className="card slide-up relative overflow-hidden">
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(5,5,5,0.45)] backdrop-blur-[1px]">
            <div className="rounded-xl border border-[var(--border-light)] bg-[rgba(13,13,13,0.9)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]">
              Token features are being finalized
            </div>
          </div>
          <div className="pointer-events-none select-none blur-[2px] opacity-80">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">{current.title}</h2>
              <p className="mt-2 text-[var(--text-secondary)]">{current.subtitle}</p>
            </div>
            <span className="badge">{activeTab === 'claim' ? 'Live' : 'Campaign'}</span>
          </div>

          {activeTab === 'claim' ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="card-inner">
                <p className="text-sm text-[var(--text-muted)]">Wallet</p>
                <p className="mt-2 text-lg font-semibold">Not connected</p>
              </div>
              <div className="card-inner">
                <p className="text-sm text-[var(--text-muted)]">Claimable PILOT</p>
                <p className="mt-2 text-lg font-semibold">0.00</p>
              </div>
              <div className="card-inner">
                <p className="text-sm text-[var(--text-muted)]">Next unlock</p>
                <p className="mt-2 text-lg font-semibold">--</p>
              </div>
              <div className="md:col-span-3 mt-1">
                <button className="btn btn-primary" disabled>
                  Connect wallet to claim
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="card-inner">
                <p className="text-sm text-[var(--text-muted)]">Eligibility</p>
                <p className="mt-2 text-lg font-semibold">Checking required</p>
              </div>
              <div className="card-inner">
                <p className="text-sm text-[var(--text-muted)]">Current round</p>
                <p className="mt-2 text-lg font-semibold">Round #1</p>
              </div>
              <div className="card-inner">
                <p className="text-sm text-[var(--text-muted)]">Status</p>
                <p className="mt-2 text-lg font-semibold">Upcoming</p>
              </div>
              <div className="md:col-span-3 mt-1">
                <button className="btn btn-secondary" disabled>
                  Airdrop checker coming soon
                </button>
              </div>
            </div>
          )}
          </div>
        </article>
      </section>
    </main>
  )
}
