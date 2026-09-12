'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@vicinity/ui';
import { getMessages, type ChatMessageDto } from '@/lib/workspaces';
import { getSocket } from '@/lib/ws';
import { useAuthStore } from '@/stores/auth';
import { usePresenceStore } from '@/stores/presence';

export function ChatPanel({
  channelId,
  channelName = 'Workspace',
  dmTargetName,
  onSend,
  onCloseDm,
}: {
  channelId: string;
  channelName?: string;
  dmTargetName?: string | null;
  onSend: (channelId: string, body: string) => void;
  onCloseDm?: () => void;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const meId = useAuthStore((s) => s.user?.id);
  const users = usePresenceStore((s) => s.users);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const history = useQuery({
    queryKey: ['messages', channelId],
    queryFn: () => getMessages(channelId),
    enabled: Boolean(channelId),
  });

  useEffect(() => {
    if (history.data) setMessages(history.data);
  }, [history.data]);

  // Subscribe to live messages for this channel.
  useEffect(() => {
    if (!token || !channelId) return;
    const socket = getSocket(token);
    socket.emit('chat:subscribe', { channelId });
    const onMessage = (p: { channelId: string; message: ChatMessageDto }) => {
      if (p.channelId !== channelId) return;
      setMessages((prev) =>
        prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message],
      );
    };
    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, [token, channelId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function nameFor(userId: string): string {
    if (userId === meId) return 'You';
    return users[userId]?.displayName ?? 'Someone';
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between border-b border-surface-3 pb-2.5">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {dmTargetName ? 'Direct Message' : 'Channel'}
          </span>
          <h2 className="text-sm font-semibold text-ink-900">
            {dmTargetName ? `@${dmTargetName}` : `# ${channelName}`}
          </h2>
        </div>
        {dmTargetName && onCloseDm && (
          <button
            onClick={onCloseDm}
            className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-ink-600 transition hover:bg-surface-3"
            title="Switch back to Workspace chat"
          >
            ← Workspace
          </button>
        )}
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-ink-400">
            {dmTargetName ? `No messages with @${dmTargetName} yet.` : 'No messages yet. Say hello 👋'}
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-medium text-ink-900">{nameFor(m.senderId)}</span>{' '}
            <span className="text-ink-400 text-xs">
              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <p className="text-ink-700">{m.body}</p>
          </div>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const body = draft.trim();
          if (!body) return;
          onSend(channelId, body);
          setDraft('');
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={dmTargetName ? `Message @${dmTargetName}…` : `Message the workspace…`}
          aria-label="Message"
          className="h-10 flex-1 rounded-xl border border-surface-3 bg-surface-0 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        />
        <Button type="submit" size="sm" disabled={!draft.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
