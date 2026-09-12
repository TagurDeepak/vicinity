'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@vicinity/ui';
import { clearMessages, getMessages, type ChatMessageDto } from '@/lib/workspaces';
import { getSocket } from '@/lib/ws';
import { useAuthStore } from '@/stores/auth';
import { usePresenceStore } from '@/stores/presence';

export function ChatPanel({
  channelId,
  channelName = 'Workspace',
  dmTargetName,
  onSend,
  onCloseDm,
  onStartDm,
}: {
  channelId: string;
  channelName?: string;
  dmTargetName?: string | null;
  onSend: (channelId: string, body: string) => void;
  onCloseDm?: () => void;
  onStartDm?: (userId: string, displayName: string) => void;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const meId = useAuthStore((s) => s.user?.id);
  const users = usePresenceStore((s) => s.users);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [draft, setDraft] = useState('');
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'dms'>(dmTargetName ? 'chat' : 'chat');
  const listRef = useRef<HTMLDivElement>(null);

  const history = useQuery({
    queryKey: ['messages', channelId],
    queryFn: () => getMessages(channelId),
    enabled: Boolean(channelId),
  });

  useEffect(() => {
    if (history.data) setMessages(history.data);
  }, [history.data]);

  // Subscribe to live messages and clear events for this channel.
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

    const onCleared = (p: { channelId: string }) => {
      if (p.channelId !== channelId) return;
      setMessages([]);
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:cleared', onCleared);

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:cleared', onCleared);
    };
  }, [token, channelId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function handleClearChat() {
    if (!channelId) return;
    setClearing(true);
    try {
      await clearMessages(channelId);
      setMessages([]);
      setConfirmClear(false);
    } catch {
      // Degrade gracefully
    } finally {
      setClearing(false);
    }
  }

  function nameFor(userId: string): string {
    if (userId === meId) return 'You';
    return users[userId]?.displayName ?? 'Someone';
  }

  const otherUsers = Object.values(users).filter((u) => u.userId !== meId);

  return (
    <div className="flex h-full flex-col">
      {/* Header Tabs */}
      <div className="mb-3 flex items-center justify-between border-b border-surface-3 pb-2.5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setActiveTab('chat');
              if (dmTargetName && onCloseDm) onCloseDm();
            }}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              activeTab === 'chat' && !dmTargetName
                ? 'bg-brand-50 text-brand-700'
                : 'text-ink-500 hover:bg-surface-2'
            }`}
          >
            # {channelName}
          </button>
          {dmTargetName && (
            <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              @{dmTargetName}
            </span>
          )}
          <button
            onClick={() => setActiveTab('dms')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              activeTab === 'dms'
                ? 'bg-brand-50 text-brand-700'
                : 'text-ink-500 hover:bg-surface-2'
            }`}
          >
            Direct Messages
          </button>
        </div>

        {/* Clear Chat Button */}
        {activeTab === 'chat' && (
          <div className="relative">
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-ink-400 transition hover:bg-danger-50 hover:text-danger-600"
                title="Clear all messages in this chat"
              >
                Clear
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleClearChat}
                  disabled={clearing}
                  className="rounded bg-danger-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-danger-700 disabled:opacity-50"
                >
                  {clearing ? '…' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded px-1.5 py-0.5 text-[11px] text-ink-400 hover:bg-surface-2"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {activeTab === 'dms' ? (
        <div className="flex-1 overflow-y-auto pr-1">
          <p className="mb-2 text-xs font-medium text-ink-400">
            Start a 1:1 conversation with a teammate:
          </p>
          {otherUsers.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-400">
              No other teammates on the floor right now. Share the invite link to bring them in!
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {otherUsers.map((u) => (
                <button
                  key={u.userId}
                  onClick={() => {
                    onStartDm?.(u.userId, u.displayName);
                    setActiveTab('chat');
                  }}
                  className="flex items-center justify-between rounded-xl border border-surface-2 bg-surface-0 px-3 py-2 text-left transition hover:border-brand-300 hover:bg-brand-50/50"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 font-semibold text-brand-700 text-xs">
                        {u.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-ink-900">{u.displayName}</span>
                      <p className="text-[11px] text-ink-400">Click to start direct message</p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-surface-1 px-2 py-1 text-xs text-ink-500">💬 DM</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="text-sm text-ink-400">
                {dmTargetName
                  ? `No messages with @${dmTargetName} yet.`
                  : 'No messages yet. Say hello 👋'}
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
        </>
      )}
    </div>
  );
}
