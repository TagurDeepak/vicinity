'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, TextField } from '@vicinity/ui';
import { createInvite, type InviteDto } from '@/lib/workspaces';

interface InviteModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function InviteModal({ workspaceId, isOpen, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [invite, setInvite] = useState<InviteDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleGenerateInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const recipientEmail = email.trim() || `invite-${Date.now()}@vicinity.local`;
      const res = await createInvite(workspaceId, recipientEmail, role);
      setInvite(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invite');
    } finally {
      setLoading(false);
    }
  }

  const inviteUrl =
    invite && typeof window !== 'undefined'
      ? `${window.location.origin}/invite/${invite.token}`
      : '';

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="w-full max-w-md bg-surface-0 shadow-2xl">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <CardTitle id="invite-modal-title">Invite teammates</CardTitle>
            <p className="mt-1 text-xs text-ink-500">
              Share an invite link with colleagues so they can join you on the floor.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-surface-2 hover:text-ink-700"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </CardHeader>

        <CardBody className="space-y-4">
          <form onSubmit={handleGenerateInvite} className="space-y-3">
            <TextField
              name="email"
              type="email"
              label="Teammate's email (optional)"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div>
              <label
                htmlFor="invite-role-select"
                className="mb-1 block text-xs font-medium text-ink-700"
              >
                Role
              </label>
              <select
                id="invite-role-select"
                value={role}
                onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
                className="h-10 w-full rounded-xl border border-surface-3 bg-surface-0 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <option value="member">Member (can navigate, talk, chat)</option>
                <option value="admin">Admin (can manage zones and invites)</option>
              </select>
            </div>

            {error && <p className="text-xs text-danger-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Generating link…' : 'Generate invite link'}
            </Button>
          </form>

          {inviteUrl && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-brand-900">Shareable Invite Link</span>
                <span className="text-[10px] text-ink-400">Valid for 7 days</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="h-9 flex-1 truncate rounded-lg border border-surface-3 bg-surface-0 px-2.5 font-mono text-xs text-ink-700 select-all"
                  aria-label="Shareable invite URL"
                />
                <Button size="sm" variant={copied ? 'secondary' : 'primary'} onClick={handleCopy}>
                  {copied ? 'Copied! ✓' : 'Copy'}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
