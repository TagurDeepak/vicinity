'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';

/**
 * Client-side auth guard. Waits for the persisted store to finish hydrating
 * before deciding, so a page refresh or direct navigation doesn't flash/redirect
 * to /login while localStorage is still loading.
 */
export function useRequireAuth() {
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [hydrated, setHydrated] = useState(
    () => typeof window !== 'undefined' && useAuthStore.persist.hasHydrated(),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHydrated(useAuthStore.persist.hasHydrated());
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [hydrated, token, router]);

  return { ready, user, token };
}
