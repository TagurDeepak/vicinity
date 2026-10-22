export interface ScribbleDrawPoint {
  x: number;
  y: number;
}

export interface ScribbleDrawStroke {
  id?: string;
  points: ScribbleDrawPoint[];
  color: string;
  size: number;
  isEraser?: boolean;
}

export interface ScribblePlayer {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  roundScore: number;
  hasGuessed: boolean;
  isDrawing: boolean;
  isConnected: boolean;
}

export type ScribbleMessageType = 'chat' | 'correct' | 'close' | 'system' | 'drawer';

export interface ScribbleMessage {
  id: string;
  senderId?: string;
  senderName?: string;
  text: string;
  type: ScribbleMessageType;
  timestamp: number;
}

export type ScribbleGameState = 'LOBBY' | 'SELECTING_WORD' | 'DRAWING' | 'ROUND_END' | 'GAME_OVER';

export interface ScribbleRoomState {
  workspaceId: string;
  zoneId: string;
  state: ScribbleGameState;
  currentRound: number;
  totalRounds: number;
  currentDrawerId: string | null;
  currentDrawerName: string | null;
  wordChoices?: string[]; // strictly visible to drawer
  maskedWord: string;
  wordLength: number;
  revealedWord?: string | null;
  timeRemaining: number;
  turnDuration: number;
  players: ScribblePlayer[];
  strokes: ScribbleDrawStroke[];
  messages: ScribbleMessage[];
  hostId: string;
  myPlayerId?: string;
  isCurrentDrawer?: boolean;
}

// Client -> Server events
export interface ScribbleClientEvents {
  'scribble:join': (payload: { workspaceId: string; zoneId: string }) => void;
  'scribble:leave': (payload: { workspaceId: string; zoneId: string }) => void;
  'scribble:start': (payload: {
    workspaceId: string;
    zoneId: string;
    rounds?: number;
    turnDuration?: number;
  }) => void;
  'scribble:choose-word': (payload: {
    workspaceId: string;
    zoneId: string;
    word: string;
  }) => void;
  'scribble:draw-stroke': (payload: {
    workspaceId: string;
    zoneId: string;
    stroke: ScribbleDrawStroke;
  }) => void;
  'scribble:clear-canvas': (payload: { workspaceId: string; zoneId: string }) => void;
  'scribble:undo': (payload: { workspaceId: string; zoneId: string }) => void;
  'scribble:guess': (payload: { workspaceId: string; zoneId: string; text: string }) => void;
}

// Server -> Client events
export interface ScribbleServerEvents {
  'scribble:state': (state: ScribbleRoomState) => void;
  'scribble:stroke': (stroke: ScribbleDrawStroke) => void;
  'scribble:clear': () => void;
  'scribble:undo': () => void;
  'scribble:message': (message: ScribbleMessage) => void;
}
