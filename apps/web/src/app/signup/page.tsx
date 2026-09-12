'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, TextField } from '@vicinity/ui';
import { signup } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/lobby';
  const setSession = useAuthStore((s) => s.setSession);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signup(email, password, displayName);
      setSession(res);
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <p className="mt-1 text-sm text-ink-500">Start collaborating in minutes.</p>
        </CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <TextField
              name="displayName"
              label="Display name"
              autoComplete="name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <TextField
              name="email"
              type="email"
              label="Email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              name="password"
              type="password"
              label="Password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
                <p>{error}</p>
                {error.toLowerCase().includes('already exists') && (
                  <Link
                    href={`/login?redirect=${encodeURIComponent(redirect)}&email=${encodeURIComponent(email)}`}
                    className="mt-2 block font-semibold text-brand-700 underline hover:text-brand-900"
                  >
                    Click here to sign in with this email →
                  </Link>
                )}
              </div>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-ink-500">
            Already have an account?{' '}
            <Link
              href={redirect !== '/lobby' ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'}
              className="font-medium text-brand-600 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardBody>
      </Card>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
