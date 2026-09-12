import Link from 'next/link';
import { Button } from '@vicinity/ui';

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 text-lg font-semibold text-ink-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            V
          </span>
          Vicinity
        </span>
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button>Get started</Button>
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-20 text-center">
        <p className="mb-4 inline-flex rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
          Spatial collaboration for distributed teams
        </p>
        <h1 className="text-balance text-5xl font-bold tracking-tight text-ink-900">
          Your team’s space, wherever you are
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink-500">
          Walk up to a colleague to start talking. Drop into a focus room to get heads-down.
          Vicinity brings the spontaneity of an office to remote work — no scheduling required.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link href="/signup">
            <Button size="lg">Create your workspace</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="secondary">
              I already have an account
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-24 grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
        {[
          { title: 'Proximity audio', body: 'Conversations start when you move close — just like real life.' },
          { title: 'Focus & meeting zones', body: 'Private rooms keep the right people in the right conversation.' },
          { title: 'Presence at a glance', body: 'See who’s available, busy, or heads-down across the floor.' },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-surface-3 bg-surface-0 p-6">
            <h3 className="font-semibold text-ink-900">{f.title}</h3>
            <p className="mt-2 text-sm text-ink-500">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
