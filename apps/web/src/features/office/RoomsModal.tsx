'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, TextField } from '@vicinity/ui';
import type { Zone } from '@vicinity/shared';
import { applyPresetZones, createZone, deleteZone } from '@/lib/workspaces';

interface RoomsModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  zones: Zone[];
  onZonesUpdated: () => void;
}

export function RoomsModal({
  workspaceId,
  isOpen,
  onClose,
  zones,
  onZonesUpdated,
}: RoomsModalProps) {
  const [tab, setTab] = useState<'preset' | 'create' | 'manage'>('preset');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New room form state
  const [name, setName] = useState('');
  const [type, setType] = useState<'meeting' | 'focus' | 'lounge' | 'private' | 'open'>('meeting');
  const [audioIsolated, setAudioIsolated] = useState(true);
  const [sizePreset, setSizePreset] = useState<'small' | 'medium' | 'large'>('medium');

  if (!isOpen) return null;

  async function handleApplyPreset(preset: 'standard' | 'campus-garden') {
    setError(null);
    setLoading(true);
    try {
      await applyPresetZones(workspaceId, preset);
      onZonesUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply layout preset');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setLoading(true);

    const dims =
      sizePreset === 'small'
        ? { w: 220, h: 200 }
        : sizePreset === 'large'
          ? { w: 500, h: 400 }
          : { w: 400, h: 320 };

    // Find non-overlapping position or place along empty area
    const x = 100 + (zones.length % 3) * 450;
    const y = 100 + Math.floor(zones.length / 3) * 360;

    try {
      await createZone(workspaceId, {
        name: name.trim(),
        type,
        geometry: { x: Math.min(x, 1100), y: Math.min(y, 600), ...dims },
        audioIsolated,
      });
      setName('');
      onZonesUpdated();
      setTab('manage');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteRoom(zoneId: string) {
    setError(null);
    setLoading(true);
    try {
      await deleteZone(workspaceId, zoneId);
      onZonesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove room');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rooms-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="w-full max-w-lg bg-surface-0 shadow-2xl">
        <CardHeader className="flex items-center justify-between pb-3 border-b border-surface-2">
          <div>
            <CardTitle id="rooms-modal-title">Office Rooms & Floor Plan</CardTitle>
            <p className="mt-0.5 text-xs text-ink-500">
              Configure rooms, focus pods, meeting spaces, and audio isolation.
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

        {/* Tab Navigation */}
        <div className="flex border-b border-surface-2 px-4 pt-2">
          <button
            onClick={() => setTab('preset')}
            className={`pb-2 px-3 text-xs font-medium border-b-2 transition ${
              tab === 'preset'
                ? 'border-brand-600 text-brand-700 font-semibold'
                : 'border-transparent text-ink-500 hover:text-ink-900'
            }`}
          >
            ⭐ Office Layouts
          </button>
          <button
            onClick={() => setTab('create')}
            className={`pb-2 px-3 text-xs font-medium border-b-2 transition ${
              tab === 'create'
                ? 'border-brand-600 text-brand-700 font-semibold'
                : 'border-transparent text-ink-500 hover:text-ink-900'
            }`}
          >
            + Add Room
          </button>
          <button
            onClick={() => setTab('manage')}
            className={`pb-2 px-3 text-xs font-medium border-b-2 transition ${
              tab === 'manage'
                ? 'border-brand-600 text-brand-700 font-semibold'
                : 'border-transparent text-ink-500 hover:text-ink-900'
            }`}
          >
            Current Rooms ({zones.length})
          </button>
        </div>

        <CardBody className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-xs text-danger-600 bg-danger-50 p-2.5 rounded-xl">{error}</p>}

          {/* TAB 1: PRESETS */}
          {tab === 'preset' && (
            <div className="space-y-4">
              {/* CHOICE 1: GARDEN CAMPUS & GRAND PLAZA */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-950 flex items-center gap-1.5">
                      <span>🌿</span> Garden Campus & Grand Plaza (13 Zones)
                    </h3>
                    <p className="mt-1 text-xs text-emerald-900/80">
                      Kumospace-style outdoor park campus featuring a central 4-fountain plaza, plush sofas, garden picnic lawns, and 4 room quadrants:
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-600/15 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                    New Layout
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-ink-700 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span>⛲</span>
                    <span>Grand Fountain Plaza (4 pools)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>🌸</span>
                    <span>Cherry Blossoms & Pines</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>💻</span>
                    <span>4 Coworking Desk Pods</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>📊</span>
                    <span>4 Meeting Suites (Isolated)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>🎧</span>
                    <span>4 Focus Pods (Lockable)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>🦩</span>
                    <span>Picnic Lawns, Floats & Puppy</span>
                  </div>
                </div>

                <Button
                  onClick={() => handleApplyPreset('campus-garden')}
                  disabled={loading}
                  className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                  size="md"
                >
                  {loading ? 'Applying Layout…' : '🌿 Apply Garden Campus Layout to Floor'}
                </Button>
              </div>

              {/* CHOICE 2: STANDARD MODERN OFFICE */}
              <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-brand-900 flex items-center gap-1.5">
                      <span>🏢</span> Standard Modern Office (8 Rooms)
                    </h3>
                    <p className="mt-1 text-xs text-brand-800/80">
                      Comprehensive indoor corporate floor with executive boardroom, conference rooms, focus pods, and cafe:
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-600/10 px-2.5 py-1 text-[11px] font-bold text-brand-700">
                    Classic
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-ink-700 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span>☕</span>
                    <span>Commons Lounge</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>🎧</span>
                    <span>Focus Pod 1 & 2 (Isolated)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>📊</span>
                    <span>Meeting Alpha (Isolated)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>📊</span>
                    <span>Meeting Beta (Isolated)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>🏢</span>
                    <span>Boardroom (Isolated)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>🔒</span>
                    <span>Private Office (Lockable)</span>
                  </div>
                </div>

                <Button
                  onClick={() => handleApplyPreset('standard')}
                  disabled={loading}
                  className="w-full mt-2"
                  size="md"
                >
                  {loading ? 'Applying Layout…' : '🏢 Apply Modern Office Layout to Floor'}
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: CREATE CUSTOM ROOM */}
          {tab === 'create' && (
            <form onSubmit={handleCreateRoom} className="space-y-3">
              <TextField
                name="roomName"
                label="Room Name"
                placeholder="e.g. Design Studio, War Room"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700">Room Type</label>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as 'meeting' | 'focus' | 'lounge' | 'private' | 'open')
                  }
                  className="h-10 w-full rounded-xl border border-surface-3 bg-surface-0 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <option value="meeting">📊 Meeting Room (Table + Chairs, Walls & Door)</option>
                  <option value="focus">🎧 Focus Pod (Desks + Computers, Lockable Door)</option>
                  <option value="private">🔒 Private Office (Executive Desk, Lockable Door)</option>
                  <option value="lounge">☕ Lounge (Couches + Coffee Table, Open Entry)</option>
                  <option value="open">🌿 Open Area (Terrace & Plants)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700">Size Preset</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['small', 'medium', 'large'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSizePreset(s)}
                      className={`h-9 rounded-xl border text-xs font-medium capitalize transition ${
                        sizePreset === s
                          ? 'border-brand-600 bg-brand-50 text-brand-900 font-semibold'
                          : 'border-surface-3 bg-surface-0 text-ink-700 hover:bg-surface-1'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="audio-isolated-chk"
                  checked={audioIsolated}
                  onChange={(e) => setAudioIsolated(e.target.checked)}
                  className="h-4 w-4 rounded border-surface-3 text-brand-600 focus:ring-brand-400"
                />
                <label htmlFor="audio-isolated-chk" className="text-xs text-ink-700 cursor-pointer">
                  <strong>Audio Isolated:</strong> People outside cannot hear inside, and vice versa.
                </label>
              </div>

              <Button type="submit" disabled={loading || !name.trim()} className="w-full mt-2">
                {loading ? 'Adding Room…' : 'Add Room to Floor'}
              </Button>
            </form>
          )}

          {/* TAB 3: MANAGE ROOMS */}
          {tab === 'manage' && (
            <div className="space-y-2">
              {zones.map((z) => (
                <div
                  key={z.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-surface-2 bg-surface-1/60 hover:bg-surface-1 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">
                      {z.type === 'meeting'
                        ? '📊'
                        : z.type === 'focus'
                          ? '🎧'
                          : z.type === 'private'
                            ? '🔒'
                            : z.type === 'lounge'
                              ? '☕'
                              : '🌿'}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-ink-900">{z.name}</div>
                      <div className="text-[11px] text-ink-400 capitalize">
                        {z.type} room · {z.geometry.w}×{z.geometry.h}px{' '}
                        {z.audioIsolated && '· 🔒 Isolated'}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteRoom(z.id)}
                    disabled={loading || zones.length <= 1}
                    className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
