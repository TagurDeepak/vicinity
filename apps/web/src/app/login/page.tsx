'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, TextField } from '@vicinity/ui';
import { login } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/lobby';
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(email, password);
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
          <CardTitle>Welcome back</CardTitle>
          <p className="mt-1 text-sm text-ink-500">Sign in to your Vicinity workspace.</p>
        </CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-danger-600">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-ink-500">
            No account?{' '}
            <Link
              href={redirect !== '/lobby' ? `/signup?redirect=${encodeURIComponent(redirect)}` : '/signup'}
              className="font-medium text-brand-600 hover:underline"
            >
              Create one
            </Link>
          </p>
        </CardBody>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
