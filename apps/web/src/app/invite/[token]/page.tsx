'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle } from '@vicinity/ui';
import { acceptInvite } from '@/lib/workspaces';
import { useAuthStore } from '@/stores/auth';

export default function InviteAcceptPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-accept if already authenticated
  useEffect(() => {
    if (!accessToken || !token) return;

    let isMounted = true;
    setLoading(true);

    acceptInvite(token)
      .then((workspace) => {
        if (isMounted) {
          router.replace(`/w/${workspace.id}`);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to accept invitation');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, token, router]);

  if (!accessToken) {
    const returnUrl = encodeURIComponent(`/invite/${token}`);
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <Card className="w-full max-w-md bg-surface-0 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 font-bold text-white text-xl">
              V
            </div>
            <CardTitle>You've been invited!</CardTitle>
            <p className="mt-2 text-sm text-ink-500">
              A teammate invited you to collaborate on their Vicinity workspace floor.
            </p>
          </CardHeader>
          <CardBody className="space-y-4 pt-2">
            <p className="text-center text-xs text-ink-400">
              Sign in or create an account to accept this invite and step into the office.
            </p>
            <div className="flex flex-col gap-2.5">
              <Link href={`/login?redirect=${returnUrl}`}>
                <Button className="w-full" size="lg">
                  Sign in to accept
                </Button>
              </Link>
              <Link href={`/signup?redirect=${returnUrl}`}>
                <Button variant="secondary" className="w-full" size="lg">
                  Create new account
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <Card className="w-full max-w-md bg-surface-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 font-bold text-white text-xl">
            V
          </div>
          <CardTitle>Joining workspace…</CardTitle>
          <p className="mt-2 text-sm text-ink-500">
            Welcome, {user?.displayName ?? 'teammate'}. Connecting you to the floor.
          </p>
        </CardHeader>
        <CardBody className="space-y-4 text-center">
          {loading && <p className="text-sm text-ink-400 animate-pulse">Accepting invitation…</p>}
          {error && (
            <div className="space-y-3">
              <p className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">{error}</p>
              <div className="flex flex-col gap-2.5">
                <Link href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}>
                  <Button className="w-full">Sign in to workspace</Button>
                </Link>
                <Button variant="secondary" onClick={() => router.push('/lobby')}>
                  Return to lobby
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
