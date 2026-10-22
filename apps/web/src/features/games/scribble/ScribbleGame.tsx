'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type {
  ScribbleDrawStroke,
  ScribbleMessage,
  ScribbleRoomState,
} from '@vicinity/shared';
import { useAuthStore } from '@/stores/auth';
import { getSocket } from '@/lib/ws';
import { ScribbleHeader } from './ScribbleHeader';
import { ScribbleCanvas } from './ScribbleCanvas';
import { ScribblePlayerList } from './ScribblePlayerList';
import { ScribbleChat } from './ScribbleChat';

interface ScribbleGameProps {
  workspaceId: string;
  zoneId: string;
  onClose?: () => void;
}

export function ScribbleGame({ workspaceId, zoneId }: ScribbleGameProps) {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const [roomState, setRoomState] = useState<ScribbleRoomState | null>(null);
  const [messages, setMessages] = useState<ScribbleMessage[]>([]);
  const [incomingStroke, setIncomingStroke] = useState<ScribbleDrawStroke | null>(null);
  const [clearTrigger, setClearTrigger] = useState<number>(0);
  const [undoTrigger, setUndoTrigger] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  // Initialize Socket.IO connection and event bindings
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('scribble:join', { workspaceId, zoneId });
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onState = (state: ScribbleRoomState) => {
      setRoomState(state);
      if (state.messages) {
        setMessages(state.messages);
      }
    };

    const onStroke = (stroke: ScribbleDrawStroke) => {
      setIncomingStroke(stroke);
    };

    const onClear = () => {
      setClearTrigger((prev) => prev + 1);
    };

    const onUndo = () => {
      setUndoTrigger((prev) => prev + 1);
    };

    const onMessage = (msg: ScribbleMessage) => {
      setMessages((prev) => {
        // Prevent duplicates
        if (prev.some((m) => m.id === msg.id)) return prev;
        const next = [...prev, msg];
        if (next.length > 60) next.shift();
        return next;
      });
    };

    if (socket.connected) {
      onConnect();
    }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('scribble:state', onState);
    socket.on('scribble:stroke', onStroke);
    socket.on('scribble:clear', onClear);
    socket.on('scribble:undo', onUndo);
    socket.on('scribble:message', onMessage);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('scribble:state', onState);
      socket.off('scribble:stroke', onStroke);
      socket.off('scribble:clear', onClear);
      socket.off('scribble:undo', onUndo);
      socket.off('scribble:message', onMessage);
      socket.emit('scribble:leave', { workspaceId, zoneId });
    };
  }, [token, workspaceId, zoneId]);

  // Player action callbacks
  const handleStartGame = useCallback(
    (rounds: number, turnDuration: number) => {
      socketRef.current?.emit('scribble:start', {
        workspaceId,
        zoneId,
        rounds,
        turnDuration,
      });
    },
    [workspaceId, zoneId]
  );

  const handleChooseWord = useCallback(
    (word: string) => {
      socketRef.current?.emit('scribble:choose-word', {
        workspaceId,
        zoneId,
        word,
      });
    },
    [workspaceId, zoneId]
  );

  const handleDrawStroke = useCallback(
    (stroke: ScribbleDrawStroke) => {
      socketRef.current?.emit('scribble:draw-stroke', {
        workspaceId,
        zoneId,
        stroke,
      });
    },
    [workspaceId, zoneId]
  );

  const handleClearCanvas = useCallback(() => {
    socketRef.current?.emit('scribble:clear-canvas', {
      workspaceId,
      zoneId,
    });
  }, [workspaceId, zoneId]);

  const handleUndo = useCallback(() => {
    socketRef.current?.emit('scribble:undo', {
      workspaceId,
      zoneId,
    });
  }, [workspaceId, zoneId]);

  const handleSendGuess = useCallback(
    (text: string) => {
      socketRef.current?.emit('scribble:guess', {
        workspaceId,
        zoneId,
        text,
      });
    },
    [workspaceId, zoneId]
  );

  const currentUserId = user?.id || '';

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 overflow-hidden select-none">
      {/* Top Header */}
      <ScribbleHeader
        roomState={roomState}
        currentUserId={currentUserId}
        isConnected={isConnected}
      />

      {/* Main 3-Column Game Lounge */}
      <div className="flex flex-1 overflow-hidden p-3 gap-3">
        {/* Left Column: Player Roster & Lobby Controls */}
        <div className="hidden md:flex w-64 shrink-0 h-full">
          <ScribblePlayerList
            roomState={roomState}
            currentUserId={currentUserId}
            onStartGame={handleStartGame}
          />
        </div>

        {/* Center Column: Interactive Canvas & Drawing Tools */}
        <div className="flex-1 flex flex-col h-full overflow-hidden items-center justify-center">
          <ScribbleCanvas
            roomState={roomState}
            currentUserId={currentUserId}
            onDrawStroke={handleDrawStroke}
            onClearCanvas={handleClearCanvas}
            onUndo={handleUndo}
            onChooseWord={handleChooseWord}
            incomingStroke={incomingStroke}
            clearTrigger={clearTrigger}
            undoTrigger={undoTrigger}
          />
        </div>

        {/* Right Column: Game Chat & Live Guesses */}
        <div className="w-80 shrink-0 h-full flex flex-col">
          <ScribbleChat
            messages={messages}
            roomState={roomState}
            currentUserId={currentUserId}
            onSendGuess={handleSendGuess}
          />
        </div>
      </div>
    </div>
  );
}
