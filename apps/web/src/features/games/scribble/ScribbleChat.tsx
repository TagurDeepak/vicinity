'use client';

import { useState, useRef, useEffect } from 'react';
import type { ScribbleMessage, ScribbleRoomState } from '@vicinity/shared';

interface ScribbleChatProps {
  messages: ScribbleMessage[];
  roomState: ScribbleRoomState | null;
  currentUserId: string;
  onSendGuess: (text: string) => void;
}

export function ScribbleChat({
  messages,
  roomState,
  currentUserId,
  onSendGuess,
}: ScribbleChatProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isDrawer =
    roomState?.state === 'DRAWING' && roomState?.currentDrawerId === currentUserId;
  const localPlayer = roomState?.players.find((p) => p.userId === currentUserId);
  const hasGuessed = localPlayer?.hasGuessed ?? false;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendGuess(trimmed);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">💬</span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Game Chat & Guesses
          </span>
        </div>
        {hasGuessed && roomState?.state === 'DRAWING' && (
          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            ✓ Word Guessed!
          </span>
        )}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-500 italic p-4">
            <span>Type your guesses here!</span>
            <span className="text-[11px] mt-1 text-slate-600">
              Exact matches earn points automatically!
            </span>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.type === 'correct') {
              return (
                <div
                  key={msg.id}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 font-bold text-emerald-300 shadow-sm"
                >
                  🎉 {msg.text}
                </div>
              );
            }
            if (msg.type === 'close') {
              return (
                <div
                  key={msg.id}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 font-semibold text-amber-300 shadow-sm"
                >
                  💡 {msg.text}
                </div>
              );
            }
            if (msg.type === 'system') {
              return (
                <div
                  key={msg.id}
                  className="px-1 py-0.5 text-[11px] text-slate-400 italic"
                >
                  ℹ️ {msg.text}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className="rounded-md bg-slate-950/40 px-2.5 py-1.5 text-slate-200 break-words"
              >
                <strong className="text-sky-300 font-bold mr-1.5">
                  {msg.senderName || 'Player'}:
                </strong>
                <span>{msg.text}</span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input box */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-slate-800 bg-slate-950 p-2.5"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isDrawer}
          placeholder={
            isDrawer
              ? 'You are drawing! No guessing.'
              : hasGuessed
              ? 'Chat with other guessers...'
              : 'Type your guess here...'
          }
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isDrawer}
          className="flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-2 text-xs font-black text-white hover:from-rose-400 hover:to-rose-500 disabled:opacity-40 transition active:scale-95 shadow-md shadow-rose-500/20"
        >
          Send
        </button>
      </form>
    </div>
  );
}
