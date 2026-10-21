'use client';

import { ArcadeModal, type GameTab } from '../ArcadeModal';

interface MagicDuelModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  zoneId: string;
  zoneName: string;
  initialTab?: GameTab;
}

export function MagicDuelModal(props: MagicDuelModalProps) {
  return <ArcadeModal {...props} />;
}

export { ArcadeModal };
