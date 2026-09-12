'use client';

import { useState } from 'react';
import { Button } from '@vicinity/ui';
import { UserStatus } from '@vicinity/shared';
import { useMediaStore } from '@/stores/media';

/**
 * Meeting controls, wired to real media tracks via the WebRTC hook. Toggles
 * reflect live state from the media store; status is emitted over presence.
 */
export function MediaControls({
  onToggleMic,
  onToggleCam,
  onToggleShare,
  onStatusChange,
}: {
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleShare: () => void;
  onStatusChange: (status: UserStatus) => void;
}) {
  const micOn = useMediaStore((s) => s.micOn);
  const camOn = useMediaStore((s) => s.camOn);
  const sharing = useMediaStore((s) => s.sharing);
  const [status, setStatus] = useState<UserStatus>(UserStatus.Available);

  return (
    <div className="flex items-center gap-2">
      <ToggleButton active={micOn} onClick={onToggleMic} label={micOn ? 'Mute microphone' : 'Unmute microphone'}>
        {micOn ? 'Mic on' : 'Mic off'}
      </ToggleButton>
      <ToggleButton active={camOn} onClick={onToggleCam} label={camOn ? 'Turn camera off' : 'Turn camera on'}>
        {camOn ? 'Camera on' : 'Camera off'}
      </ToggleButton>
      <ToggleButton active={sharing} onClick={onToggleShare} label={sharing ? 'Stop sharing screen' : 'Share screen'}>
        {sharing ? 'Sharing' : 'Share screen'}
      </ToggleButton>

      <label className="sr-only" htmlFor="status-select">
        Set your status
      </label>
      <select
        id="status-select"
        value={status}
        onChange={(e) => {
          const next = e.target.value as UserStatus;
          setStatus(next);
          onStatusChange(next);
        }}
        className="h-9 rounded-xl border border-surface-3 bg-surface-0 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <option value={UserStatus.Available}>Available</option>
        <option value={UserStatus.Busy}>Busy</option>
        <option value={UserStatus.InMeeting}>In a meeting</option>
        <option value={UserStatus.Away}>Away</option>
      </select>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'primary' : 'secondary'}
      size="sm"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
