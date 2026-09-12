'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar, Button, Card, CardBody, CardTitle, TextField } from '@vicinity/ui';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { createWorkspace, listWorkspaces } from '@/lib/workspaces';
import { useAuthStore } from '@/stores/auth';

export default function LobbyPage() {
  const { ready, user } = useRequireAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const clear = useAuthStore((s) => s.clear);
  const [name, setName] = useState('');

  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: listWorkspaces,
    enabled: ready,
  });

  const create = useMutation({
    mutationFn: () => createWorkspace(name.trim()),
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setName('');
      router.push(`/w/${ws.id}`);
    },
  });

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={user?.displayName ?? '?'} src={user?.avatarUrl} size={44} />
          <div>
            <h1 className="text-xl font-semibold text-ink-900">
              Hi, {user?.displayName ?? 'there'}
            </h1>
            <p className="text-sm text-ink-500">Pick a workspace to enter the floor.</p>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            clear();
            router.replace('/login');
          }}
        >
          Sign out
        </Button>
      </header>

      <Card className="mb-8">
        <CardBody>
          <CardTitle className="mb-3">Create a workspace</CardTitle>
          <form
            className="flex items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate();
            }}
          >
            <TextField
              name="workspaceName"
              label="Workspace name"
              placeholder="Acme HQ"
              className="flex-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </form>
        </CardBody>
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
        Your workspaces
      </h2>
      {workspaces.isLoading ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : workspaces.data && workspaces.data.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {workspaces.data.map((ws) => (
            <li key={ws.id}>
              <button
                onClick={() => router.push(`/w/${ws.id}`)}
                className="flex w-full items-center justify-between rounded-2xl border border-surface-3 bg-surface-0 p-5 text-left transition-colors hover:border-brand-300 hover:bg-surface-1"
              >
                <span>
                  <span className="block font-medium text-ink-900">{ws.name}</span>
                  <span className="text-xs text-ink-400">Role: {ws.role}</span>
                </span>
                <span aria-hidden className="text-ink-400">→</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-500">No workspaces yet — create your first one above.</p>
      )}
    </main>
  );
}
