import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ScribbleDrawStroke,
  ScribbleGameState,
  ScribbleMessage,
  ScribblePlayer,
  ScribbleRoomState,
  ServerToClientEvents,
} from '@vicinity/shared';

export function scribbleRoomKey(workspaceId: string, zoneId: string): string {
  return `scribble:${workspaceId}:${zoneId}`;
}

const DEFAULT_DICTIONARY: string[] = [
  // Animals
  'cat', 'dog', 'elephant', 'giraffe', 'monkey', 'penguin', 'lion', 'tiger', 'dolphin',
  'butterfly', 'kangaroo', 'octopus', 'owl', 'rabbit', 'snake', 'turtle', 'whale',
  'zebra', 'flamingo', 'crocodile', 'frog', 'parrot', 'eagle', 'shark', 'bear', 'panda',
  'koala', 'bee', 'spider', 'fox', 'wolf', 'crab', 'duck', 'horse', 'mouse', 'peacock',
  'hedgehog', 'camel', 'lobster', 'squirrel', 'hamster', 'chameleon', 'jellyfish',

  // Food & Kitchen
  'pizza', 'burger', 'ice cream', 'taco', 'sushi', 'banana', 'apple', 'watermelon',
  'donut', 'coffee', 'pancake', 'cookie', 'popcorn', 'strawberry', 'cheese', 'sandwich',
  'cake', 'pineapple', 'french fries', 'hot dog', 'chocolate', 'avocado', 'carrot',
  'broccoli', 'egg', 'spaghetti', 'waffle', 'cupcake', 'lollipop', 'croissant', 'lemon',
  'grapes', 'cherry', 'potato', 'mushroom', 'pretzel',

  // Everyday Objects & Tools
  'umbrella', 'clock', 'bicycle', 'camera', 'chair', 'guitar', 'telephone', 'backpack',
  'scissors', 'glasses', 'candle', 'key', 'toothbrush', 'mirror', 'book', 'lamp', 'shoe',
  'balloon', 'watch', 'skateboard', 'ladder', 'hammer', 'flashlight', 'pillow', 'kite',
  'pencil', 'laptop', 'headphones', 'telescope', 'compass', 'paintbrush', 'trophy',
  'envelope', 'battery', 'shovel', 'sword', 'shield', 'ring', 'guitar', 'drum',

  // Nature & Places
  'mountain', 'volcano', 'rainbow', 'waterfall', 'campfire', 'desert', 'beach', 'tree',
  'sun', 'cloud', 'island', 'cave', 'forest', 'snowflake', 'lightning', 'ocean', 'river',
  'moon', 'stars', 'tornado', 'flower', 'cactus', 'glacier', 'oasis', 'swamp',

  // Vehicles & Structures
  'spaceship', 'submarine', 'airplane', 'helicopter', 'castle', 'pirate ship', 'lighthouse',
  'bridge', 'windmill', 'train', 'fire truck', 'police car', 'ambulance', 'skyscraper',
  'igloo', 'tent', 'pyramid', 'rocket', 'tractor', 'yacht', 'hot air balloon',

  // Characters & Roles
  'wizard', 'pirate', 'ninja', 'robot', 'astronaut', 'vampire', 'ghost', 'superhero',
  'alien', 'dragon', 'mermaid', 'king', 'detective', 'monster', 'snowman', 'knight',
  'clown', 'zombie', 'cowboy', 'chef', 'doctor', 'princess', 'giant'
];

interface InternalPlayer extends ScribblePlayer {
  socket?: Socket<ClientToServerEvents, ServerToClientEvents>;
}

interface ScribbleRoom {
  workspaceId: string;
  zoneId: string;
  state: ScribbleGameState;
  currentRound: number;
  totalRounds: number;
  currentDrawerId: string | null;
  drawerOrder: string[];
  drawerIndex: number;
  currentWord: string;
  revealedIndices: Set<number>;
  wordChoices: string[];
  turnDuration: number;
  timeRemaining: number;
  players: Map<string, InternalPlayer>;
  strokes: ScribbleDrawStroke[];
  messages: ScribbleMessage[];
  hostId: string;
  timer: NodeJS.Timeout | null;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export class ScribbleEngine {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private rooms = new Map<string, ScribbleRoom>();

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
  }

  public join(
    workspaceId: string,
    zoneId: string,
    userId: string,
    displayName: string,
    avatarUrl: string | null,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ): void {
    const key = scribbleRoomKey(workspaceId, zoneId);
    void socket.join(key);

    let room = this.rooms.get(key);
    if (!room) {
      room = {
        workspaceId,
        zoneId,
        state: 'LOBBY',
        currentRound: 1,
        totalRounds: 3,
        currentDrawerId: null,
        drawerOrder: [],
        drawerIndex: 0,
        currentWord: '',
        revealedIndices: new Set<number>(),
        wordChoices: [],
        turnDuration: 60,
        timeRemaining: 0,
        players: new Map(),
        strokes: [],
        messages: [],
        hostId: userId,
        timer: null,
      };
      this.rooms.set(key, room);
    }

    const existing = room.players.get(userId);
    if (existing) {
      existing.socket = socket;
      existing.isConnected = true;
      existing.displayName = displayName;
      existing.avatarUrl = avatarUrl;
    } else {
      room.players.set(userId, {
        userId,
        displayName,
        avatarUrl,
        score: 0,
        roundScore: 0,
        hasGuessed: false,
        isDrawing: false,
        isConnected: true,
        socket,
      });
      if (!room.hostId) {
        room.hostId = userId;
      }
    }

    this.sendSystemMessage(room, `${displayName} joined the Scribble room.`);
    this.syncRoom(room);
  }

  public leave(workspaceId: string, zoneId: string, userId: string): void {
    const key = scribbleRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room) return;

    const player = room.players.get(userId);
    if (player) {
      player.isConnected = false;
      player.socket = undefined;
      this.sendSystemMessage(room, `${player.displayName} left the Scribble room.`);
    }

    const activePlayers = Array.from(room.players.values()).filter((p) => p.isConnected);

    if (activePlayers.length === 0) {
      // Room is completely empty, clean up memory
      if (room.timer) clearInterval(room.timer);
      this.rooms.delete(key);
      return;
    }

    // Reassign host if host left
    if (room.hostId === userId) {
      room.hostId = activePlayers[0].userId;
      this.sendSystemMessage(room, `${activePlayers[0].displayName} is now the host.`);
    }

    // If active drawer disconnected during a turn, advance
    if (room.currentDrawerId === userId && (room.state === 'SELECTING_WORD' || room.state === 'DRAWING')) {
      this.sendSystemMessage(room, `The artist disconnected! Ending turn...`);
      this.endTurn(room);
    } else {
      this.syncRoom(room);
    }
  }

  public start(
    workspaceId: string,
    zoneId: string,
    userId: string,
    rounds: number = 3,
    turnDuration: number = 60
  ): void {
    const key = scribbleRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room) return;

    if (room.hostId !== userId) {
      this.sendPrivateMessage(room, userId, 'Only the host can start the game.', 'system');
      return;
    }

    const activePlayers = Array.from(room.players.values()).filter((p) => p.isConnected);
    if (activePlayers.length === 0) return;

    // Reset scores & rounds
    room.totalRounds = Math.min(Math.max(rounds, 1), 10);
    room.turnDuration = Math.min(Math.max(turnDuration, 30), 120);
    room.currentRound = 1;
    room.drawerOrder = activePlayers.map((p) => p.userId);
    room.drawerIndex = 0;

    for (const p of room.players.values()) {
      p.score = 0;
      p.roundScore = 0;
      p.hasGuessed = false;
      p.isDrawing = false;
    }

    this.sendSystemMessage(room, `Game started! Round 1 of ${room.totalRounds}.`);
    this.startWordSelection(room);
  }

  private startWordSelection(room: ScribbleRoom): void {
    if (room.timer) clearInterval(room.timer);

    const activePlayers = Array.from(room.players.values()).filter((p) => p.isConnected);
    if (activePlayers.length === 0) return;

    if (room.drawerIndex >= room.drawerOrder.length) {
      // Round completed
      if (room.currentRound >= room.totalRounds) {
        this.endGame(room);
        return;
      }
      room.currentRound += 1;
      room.drawerIndex = 0;
      room.drawerOrder = activePlayers.map((p) => p.userId);
      this.sendSystemMessage(room, `Starting Round ${room.currentRound} of ${room.totalRounds}!`);
    }

    const drawerId = room.drawerOrder[room.drawerIndex];
    const drawer = room.players.get(drawerId);

    // If player disconnected, advance index
    if (!drawer || !drawer.isConnected) {
      room.drawerIndex++;
      this.startWordSelection(room);
      return;
    }

    room.state = 'SELECTING_WORD';
    room.currentDrawerId = drawerId;
    room.strokes = [];
    room.revealedIndices = new Set();
    room.currentWord = '';

    for (const p of room.players.values()) {
      p.hasGuessed = false;
      p.isDrawing = p.userId === drawerId;
      p.roundScore = 0;
    }

    // Pick 3 random words from dictionary
    const shuffled = [...DEFAULT_DICTIONARY].sort(() => 0.5 - Math.random());
    room.wordChoices = shuffled.slice(0, 3);
    room.timeRemaining = 15; // 15 seconds to pick

    this.sendSystemMessage(room, `${drawer.displayName} is choosing a word...`);
    this.syncRoom(room);

    room.timer = setInterval(() => {
      room.timeRemaining -= 1;
      if (room.timeRemaining <= 0) {
        // Auto-select first choice if drawer didn't click
        const autoWord = room.wordChoices[0] || 'cat';
        this.startDrawingTurn(room, autoWord);
      } else {
        this.syncRoom(room);
      }
    }, 1000);
  }

  public chooseWord(workspaceId: string, zoneId: string, userId: string, word: string): void {
    const key = scribbleRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room || room.state !== 'SELECTING_WORD') return;
    if (room.currentDrawerId !== userId) return;

    this.startDrawingTurn(room, word);
  }

  private startDrawingTurn(room: ScribbleRoom, word: string): void {
    if (room.timer) clearInterval(room.timer);

    room.state = 'DRAWING';
    room.currentWord = word.trim().toLowerCase();
    room.wordChoices = [];
    room.strokes = [];
    room.revealedIndices = new Set();
    room.timeRemaining = room.turnDuration;

    const drawer = room.currentDrawerId ? room.players.get(room.currentDrawerId) : null;
    this.sendSystemMessage(
      room,
      `${drawer ? drawer.displayName : 'The artist'} is now drawing!`
    );

    this.syncRoom(room);

    // Timer loop for drawing turn
    const halfTime = Math.floor(room.turnDuration * 0.5);
    const quarterTime = Math.floor(room.turnDuration * 0.25);

    room.timer = setInterval(() => {
      room.timeRemaining -= 1;

      // Reveal hints at checkpoints
      if (room.timeRemaining === halfTime && room.currentWord.length > 3) {
        this.revealRandomLetter(room);
      } else if (room.timeRemaining === quarterTime && room.currentWord.length > 5) {
        this.revealRandomLetter(room);
      }

      if (room.timeRemaining <= 0) {
        this.endTurn(room);
      } else {
        this.syncRoom(room);
      }
    }, 1000);
  }

  private revealRandomLetter(room: ScribbleRoom): void {
    const word = room.currentWord;
    const unrevealed: number[] = [];
    for (let i = 0; i < word.length; i++) {
      if (word[i] !== ' ' && !room.revealedIndices.has(i)) {
        unrevealed.push(i);
      }
    }
    if (unrevealed.length > 0) {
      const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      room.revealedIndices.add(pick);
      this.sendSystemMessage(room, `Hint: A letter was revealed!`);
    }
  }

  private endTurn(room: ScribbleRoom): void {
    if (room.timer) clearInterval(room.timer);

    room.state = 'ROUND_END';
    room.timeRemaining = 5; // 5 seconds intermission

    // Calculate score for the drawer
    let correctGuesserCount = 0;
    for (const p of room.players.values()) {
      if (p.hasGuessed && p.userId !== room.currentDrawerId) {
        correctGuesserCount++;
      }
    }

    if (room.currentDrawerId) {
      const drawer = room.players.get(room.currentDrawerId);
      if (drawer && correctGuesserCount > 0) {
        const drawerPoints = correctGuesserCount * 25;
        drawer.score += drawerPoints;
        drawer.roundScore = drawerPoints;
        this.sendSystemMessage(
          room,
          `${drawer.displayName} earned +${drawerPoints} points as the artist!`
        );
      }
    }

    this.sendSystemMessage(room, `The word was: "${room.currentWord.toUpperCase()}"!`);
    this.syncRoom(room);

    room.timer = setInterval(() => {
      room.timeRemaining -= 1;
      if (room.timeRemaining <= 0) {
        if (room.timer) clearInterval(room.timer);
        room.drawerIndex++;
        this.startWordSelection(room);
      } else {
        this.syncRoom(room);
      }
    }, 1000);
  }

  private endGame(room: ScribbleRoom): void {
    if (room.timer) clearInterval(room.timer);

    room.state = 'GAME_OVER';
    room.timeRemaining = 0;
    room.currentDrawerId = null;

    // Sort players by score
    const podium = Array.from(room.players.values())
      .filter((p) => p.isConnected)
      .sort((a, b) => b.score - a.score);

    const winnerName = podium[0] ? podium[0].displayName : 'Nobody';
    this.sendSystemMessage(room, `Game Over! 🏆 Winner is ${winnerName}!`);
    this.syncRoom(room);
  }

  public drawStroke(
    workspaceId: string,
    zoneId: string,
    userId: string,
    stroke: ScribbleDrawStroke
  ): void {
    const key = scribbleRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room || room.state !== 'DRAWING') return;
    if (room.currentDrawerId !== userId) return;

    room.strokes.push(stroke);

    // Broadcast stroke to other connected sockets (excluding sender to prevent echo)
    const player = room.players.get(userId);
    if (player?.socket) {
      player.socket.to(key).emit('scribble:stroke', stroke);
    } else {
      this.io.to(key).emit('scribble:stroke', stroke);
    }
  }

  public clearCanvas(workspaceId: string, zoneId: string, userId: string): void {
    const key = scribbleRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room || room.state !== 'DRAWING') return;
    if (room.currentDrawerId !== userId) return;

    room.strokes = [];
    this.io.to(key).emit('scribble:clear');
  }

  public undo(workspaceId: string, zoneId: string, userId: string): void {
    const key = scribbleRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room || room.state !== 'DRAWING') return;
    if (room.currentDrawerId !== userId) return;

    if (room.strokes.length > 0) {
      room.strokes.pop();
      this.io.to(key).emit('scribble:undo');
    }
  }

  public guess(workspaceId: string, zoneId: string, userId: string, text: string): void {
    const key = scribbleRoomKey(workspaceId, zoneId);
    const room = this.rooms.get(key);
    if (!room) return;

    const player = room.players.get(userId);
    if (!player) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    // Normal chat if not in DRAWING phase
    if (room.state !== 'DRAWING') {
      this.broadcastChatMessage(room, player.displayName, trimmed, 'chat');
      return;
    }

    // Artist cannot guess their own drawing
    if (room.currentDrawerId === userId) {
      this.sendPrivateMessage(room, userId, "You are drawing! You can't guess.", 'system');
      return;
    }

    // Player already guessed correctly
    if (player.hasGuessed) {
      // Send chat visible only to other players who have already guessed
      this.sendGuessedOnlyMessage(room, player.displayName, trimmed);
      return;
    }

    const cleanGuess = trimmed.toLowerCase();
    const cleanWord = room.currentWord.toLowerCase();

    if (cleanGuess === cleanWord) {
      // Correct guess!
      player.hasGuessed = true;
      const pts = Math.max(50, Math.round(50 + (room.timeRemaining / room.turnDuration) * 50));
      player.roundScore = pts;
      player.score += pts;

      this.sendPrivateMessage(room, userId, `You guessed the word! (+${pts} pts)`, 'correct');

      // Public notification (without showing the word)
      this.broadcastChatMessage(room, 'System', `${player.displayName} guessed the word!`, 'correct');

      // Check if all guessers have guessed
      const remainingGuessers = Array.from(room.players.values()).filter(
        (p) => p.isConnected && p.userId !== room.currentDrawerId && !p.hasGuessed
      );

      if (remainingGuessers.length === 0) {
        // Fast-forward turn ending
        this.sendSystemMessage(room, 'Everyone has guessed the word!');
        this.endTurn(room);
        return;
      }

      this.syncRoom(room);
      return;
    }

    // Check if guess is close (Levenshtein distance = 1)
    if (cleanWord.length > 2 && levenshteinDistance(cleanGuess, cleanWord) === 1) {
      this.sendPrivateMessage(room, userId, `"${trimmed}" is very close!`, 'close');
    }

    // Regular incorrect guess: broadcast to chat
    this.broadcastChatMessage(room, player.displayName, trimmed, 'chat');
  }

  private getMaskedWord(room: ScribbleRoom): string {
    if (!room.currentWord) return '';
    const chars: string[] = [];
    for (let i = 0; i < room.currentWord.length; i++) {
      const char = room.currentWord[i];
      if (char === ' ') {
        chars.push('  ');
      } else if (room.revealedIndices.has(i)) {
        chars.push(char.toUpperCase());
      } else {
        chars.push('_');
      }
    }
    return chars.join(' ');
  }

  private syncRoom(room: ScribbleRoom): void {
    const baseState: ScribbleRoomState = {
      workspaceId: room.workspaceId,
      zoneId: room.zoneId,
      state: room.state,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      currentDrawerId: room.currentDrawerId,
      currentDrawerName: room.currentDrawerId
        ? room.players.get(room.currentDrawerId)?.displayName ?? null
        : null,
      maskedWord: this.getMaskedWord(room),
      wordLength: room.currentWord.length,
      revealedWord: room.state === 'ROUND_END' || room.state === 'GAME_OVER' ? room.currentWord : null,
      timeRemaining: room.timeRemaining,
      turnDuration: room.turnDuration,
      players: Array.from(room.players.values()).map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        score: p.score,
        roundScore: p.roundScore,
        hasGuessed: p.hasGuessed,
        isDrawing: p.isDrawing,
        isConnected: p.isConnected,
      })),
      strokes: room.strokes,
      messages: room.messages,
      hostId: room.hostId,
    };

    // Emit tailored states: drawer sees wordChoices & revealedWord, non-drawers don't
    for (const player of room.players.values()) {
      if (!player.isConnected || !player.socket) continue;

      const isDrawer = player.userId === room.currentDrawerId;
      player.socket.emit('scribble:state', {
        ...baseState,
        myPlayerId: player.userId,
        isCurrentDrawer: isDrawer,
        wordChoices: isDrawer && room.state === 'SELECTING_WORD' ? room.wordChoices : undefined,
        revealedWord: isDrawer
          ? room.currentWord || null
          : room.state === 'ROUND_END' || room.state === 'GAME_OVER'
          ? room.currentWord
          : null,
      });
    }
  }

  private sendSystemMessage(room: ScribbleRoom, text: string): void {
    const msg: ScribbleMessage = {
      id: `sys-${Date.now()}-${Math.random()}`,
      text,
      type: 'system',
      timestamp: Date.now(),
    };
    room.messages.push(msg);
    if (room.messages.length > 50) room.messages.shift();
    const key = scribbleRoomKey(room.workspaceId, room.zoneId);
    this.io.to(key).emit('scribble:message', msg);
  }

  private broadcastChatMessage(
    room: ScribbleRoom,
    senderName: string,
    text: string,
    type: ScribbleMessage['type']
  ): void {
    const msg: ScribbleMessage = {
      id: `chat-${Date.now()}-${Math.random()}`,
      senderName,
      text,
      type,
      timestamp: Date.now(),
    };
    room.messages.push(msg);
    if (room.messages.length > 50) room.messages.shift();
    const key = scribbleRoomKey(room.workspaceId, room.zoneId);
    this.io.to(key).emit('scribble:message', msg);
  }

  private sendPrivateMessage(
    room: ScribbleRoom,
    userId: string,
    text: string,
    type: ScribbleMessage['type']
  ): void {
    const player = room.players.get(userId);
    if (!player || !player.socket) return;

    const msg: ScribbleMessage = {
      id: `priv-${Date.now()}-${Math.random()}`,
      text,
      type,
      timestamp: Date.now(),
    };
    player.socket.emit('scribble:message', msg);
  }

  private sendGuessedOnlyMessage(room: ScribbleRoom, senderName: string, text: string): void {
    const msg: ScribbleMessage = {
      id: `guessers-${Date.now()}-${Math.random()}`,
      senderName,
      text: `${text} (guessed)`,
      type: 'chat',
      timestamp: Date.now(),
    };

    // Only send to drawer and players who have already guessed
    for (const p of room.players.values()) {
      if (!p.isConnected || !p.socket) continue;
      if (p.hasGuessed || p.userId === room.currentDrawerId) {
        p.socket.emit('scribble:message', msg);
      }
    }
  }
}
