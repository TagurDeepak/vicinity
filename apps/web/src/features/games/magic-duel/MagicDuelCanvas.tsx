'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  GameClientInput,
  GameMapTheme,
  GameWorldState,
  SpellType,
} from '@vicinity/shared';
import { getSocket } from '@/lib/ws';
import { useAuthStore } from '@/stores/auth';
import { useMagicDuelAudio } from './useMagicDuelAudio';

interface FloatingNumber {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  createdAt: number;
}

function checkCircleRectCollision(cx: number, cy: number, radius: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function shortestAngleDiff(targetDeg: number, currentDeg: number): number {
  let diff = (targetDeg - currentDeg) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  return diff;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof (ctx as unknown as { roundRect?: unknown }).roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

interface WizardColors {
  robeBase: string;
  robeHighlight: string;
  robeTrim: string;
  hatBase: string;
  hatTrim: string;
  crystalGlow: string;
  crystalCore: string;
  eyeColor: string;
}

const WIZARD_PALETTES: WizardColors[] = [
  // 0: Sapphire Arcane (Local Player)
  {
    robeBase: '#1e40af',
    robeHighlight: '#3b82f6',
    robeTrim: '#38bdf8',
    hatBase: '#172554',
    hatTrim: '#fbbf24',
    crystalGlow: 'rgba(56, 189, 248, 0.5)',
    crystalCore: '#38bdf8',
    eyeColor: '#38bdf8',
  },
  // 1: Crimson Pyromancer (Bot / Rival)
  {
    robeBase: '#991b1b',
    robeHighlight: '#ef4444',
    robeTrim: '#f59e0b',
    hatBase: '#450a0a',
    hatTrim: '#f59e0b',
    crystalGlow: 'rgba(239, 68, 68, 0.5)',
    crystalCore: '#f97316',
    eyeColor: '#facc15',
  },
  // 2: Emerald Chronomancer
  {
    robeBase: '#065f46',
    robeHighlight: '#10b981',
    robeTrim: '#6ee7b7',
    hatBase: '#022c22',
    hatTrim: '#a7f3d0',
    crystalGlow: 'rgba(16, 185, 129, 0.5)',
    crystalCore: '#34d399',
    eyeColor: '#a7f3d0',
  },
  // 3: Amethyst Voidwalker
  {
    robeBase: '#5b21b6',
    robeHighlight: '#8b5cf6',
    robeTrim: '#c084fc',
    hatBase: '#2e1065',
    hatTrim: '#e9d5ff',
    crystalGlow: 'rgba(168, 85, 247, 0.5)',
    crystalCore: '#c084fc',
    eyeColor: '#f472b6',
  },
];

function drawWizardCharacter(
  ctx: CanvasRenderingContext2D,
  colorIndex: number,
  isMe: boolean,
  angleDeg: number,
  isDashing: boolean,
  hitFlashTimer: number,
  hasShield: boolean,
  activeSpell: SpellType,
  time: number,
): void {
  ctx.save();

  // 1. Ground Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 22, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const rad = (angleDeg * Math.PI) / 180;

  // 2. Selection / Target Aura Disc on Ground
  if (isMe) {
    const pulse = Math.sin(time / 200) * 2;
    // Outer vibrant pulsing ring
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 16, 25 + pulse, 12 + pulse * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner dashed indicator
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(0, 16, 19, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Directional orientation pointer on ground
    const arrowDist = 30;
    const ax = Math.cos(rad) * arrowDist;
    const ay = Math.sin(rad) * (arrowDist * 0.5) + 16;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Enemy / Bot ground ring
    ctx.strokeStyle = colorIndex === 1 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(168, 85, 247, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 16, 22, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 3. Dashing Motion Trails
  if (isDashing) {
    const oppRad = ((angleDeg + 180) * Math.PI) / 180;
    for (const d of [15, 30, 45]) {
      const alpha = 0.4 - d * 0.007;
      ctx.fillStyle = `rgba(56, 189, 248, ${Math.max(0.05, alpha)})`;
      ctx.beginPath();
      ctx.arc(Math.cos(oppRad) * d, Math.sin(oppRad) * d, 18 - d * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4. Hit Flash Glow
  if (hitFlashTimer > 0) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Robe & Cloak
  const pIndex = Math.max(0, Math.min(3, colorIndex));
  const palette = WIZARD_PALETTES[pIndex] ?? (WIZARD_PALETTES[0] as WizardColors);
  const bob = Math.sin(time / 180) * 2;

  // Robe Mantle
  ctx.fillStyle = hitFlashTimer > 0 ? '#fee2e2' : palette.robeBase;
  ctx.beginPath();
  ctx.moveTo(-16, 15 + bob);
  ctx.quadraticCurveTo(-18, 0 + bob, -13, -8 + bob);
  ctx.lineTo(13, -8 + bob);
  ctx.quadraticCurveTo(18, 0 + bob, 16, 15 + bob);
  ctx.quadraticCurveTo(0, 19 + bob, -16, 15 + bob);
  ctx.closePath();
  ctx.fill();

  // Robe Hem Trim
  ctx.strokeStyle = hitFlashTimer > 0 ? '#ef4444' : palette.robeTrim;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Robe Center Pleat / Highlight
  ctx.fillStyle = hitFlashTimer > 0 ? '#fca5a5' : palette.robeHighlight;
  ctx.beginPath();
  ctx.moveTo(-5, -6 + bob);
  ctx.lineTo(5, -6 + bob);
  ctx.lineTo(8, 16 + bob);
  ctx.lineTo(-8, 16 + bob);
  ctx.closePath();
  ctx.fill();

  // Belt & Golden Buckle
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-11, 4 + bob, 22, 4);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-4, 3 + bob, 8, 6);
  ctx.fillStyle = palette.crystalCore;
  ctx.fillRect(-1.5, 4.5 + bob, 3, 3);

  // 6. Arcane Cowl & Glowing Eyes
  // Cowl Shadow
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.ellipse(0, -9 + bob, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes gaze towards crosshair/aim direction
  const lookX = Math.cos(rad) * 3.5;
  const lookY = Math.sin(rad) * 2.2;
  const eyeGlowColor = hitFlashTimer > 0 ? '#ffffff' : palette.eyeColor;

  // Eye outer glow discs
  ctx.fillStyle = eyeGlowColor;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(-4 + lookX, -10 + bob + lookY, 3.2, 0, Math.PI * 2);
  ctx.arc(4 + lookX, -10 + bob + lookY, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Eye radiant pupils
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-4 + lookX, -10 + bob + lookY, 1.6, 0, Math.PI * 2);
  ctx.arc(4 + lookX, -10 + bob + lookY, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // 7. Wizard Hat
  // Hat Brim
  ctx.fillStyle = hitFlashTimer > 0 ? '#fee2e2' : palette.hatBase;
  ctx.beginPath();
  ctx.ellipse(0, -14 + bob, 18, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = palette.robeTrim;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Hat Cone (tilts subtly relative to aim)
  const tipX = -Math.cos(rad) * 7;
  const tipY = -36 + bob;
  ctx.fillStyle = hitFlashTimer > 0 ? '#fee2e2' : palette.hatBase;
  ctx.beginPath();
  ctx.moveTo(-12, -15 + bob);
  ctx.quadraticCurveTo(-14, -26 + bob, tipX, tipY);
  ctx.quadraticCurveTo(6, -26 + bob, 12, -15 + bob);
  ctx.closePath();
  ctx.fill();

  // Cone Highlight
  ctx.fillStyle = hitFlashTimer > 0 ? '#fca5a5' : palette.robeHighlight;
  ctx.beginPath();
  ctx.moveTo(-3, -15 + bob);
  ctx.quadraticCurveTo(-4, -25 + bob, tipX, tipY);
  ctx.lineTo(tipX + 2, tipY);
  ctx.quadraticCurveTo(2, -25 + bob, 3, -15 + bob);
  ctx.closePath();
  ctx.fill();

  // Golden Hat Ribbon
  ctx.fillStyle = palette.hatTrim;
  ctx.beginPath();
  ctx.ellipse(0, -15 + bob, 12.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Glowing Hat Star
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(tipX, tipY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // 8. Wizard Staff & Arcane Spell Crystal
  const handDist = 14;
  const handAngle = rad + Math.PI * 0.35;
  const hx = Math.cos(handAngle) * handDist;
  const hy = Math.sin(handAngle) * handDist * 0.7 + bob;

  const orbDist = 32;
  const ox = Math.cos(rad) * orbDist;
  const oy = Math.sin(rad) * orbDist + bob;

  // Sturdy wooden shaft
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(ox, oy);
  ctx.stroke();

  // Golden crystal ferrule
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ox, oy, 6.5, rad - 1.2, rad + 1.2);
  ctx.stroke();

  // Spell-specific Crystal Colors
  let orbGlow = 'rgba(249, 115, 22, 0.4)';
  let orbCore = '#f97316';
  let orbCenter = '#fef08a';
  if (activeSpell === 'frost') {
    orbGlow = 'rgba(56, 189, 248, 0.45)';
    orbCore = '#38bdf8';
    orbCenter = '#ffffff';
  } else if (activeSpell === 'lightning') {
    orbGlow = 'rgba(168, 85, 247, 0.45)';
    orbCore = '#c084fc';
    orbCenter = '#fdf4ff';
  } else if (activeSpell === 'shield') {
    orbGlow = 'rgba(16, 185, 129, 0.45)';
    orbCore = '#10b981';
    orbCenter = '#ecfdf5';
  }

  // Pulsing Arcane Orb
  const orbPulse = Math.sin(time / 140) * 1.5;
  ctx.fillStyle = orbGlow;
  ctx.beginPath();
  ctx.arc(ox, oy, 8.5 + orbPulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = orbCore;
  ctx.beginPath();
  ctx.arc(ox, oy, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = orbCenter;
  ctx.beginPath();
  ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Orbiting magic mote
  const m1Angle = time / 160;
  ctx.fillStyle = orbCenter;
  ctx.beginPath();
  ctx.arc(ox + Math.cos(m1Angle) * 9, oy + Math.sin(m1Angle) * 9, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // 9. Arcane Shield Bubble
  if (hasShield) {
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Orbiting arcane rune arcs
    const sAngle = time / 300;
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 36, sAngle, sAngle + Math.PI * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 36, sAngle + Math.PI, sAngle + Math.PI * 1.6);
    ctx.stroke();
  }

  ctx.restore();
}

interface MagicDuelCanvasProps {
  workspaceId: string;
  zoneId: string;
  onClose?: () => void;
}

export function MagicDuelCanvas({ workspaceId, zoneId, onClose }: MagicDuelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const userRef = useRef(user);
  userRef.current = user;

  const audio = useMagicDuelAudio();
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const gameStateRef = useRef<GameWorldState | null>(null);
  const [hasInitialState, setHasInitialState] = useState(false);
  const hasInitialStateRef = useRef(false);
  const patternsRef = useRef<Map<string, CanvasPattern>>(new Map());

  const [selectedSpell, setSelectedSpell] = useState<SpellType>('fireball');
  const selectedSpellRef = useRef<SpellType>('fireball');
  selectedSpellRef.current = selectedSpell;

  const [activeMap, setActiveMap] = useState<GameMapTheme>('catacombs');
  const [isConnected, setIsConnected] = useState(false);

  const [cooldowns, setCooldowns] = useState<Record<SpellType, number>>({
    fireball: 0,
    frost: 0,
    lightning: 0,
    shield: 0,
    dash: 0,
  });

  // Smooth Camera & Entity Prediction states
  const camPosRef = useRef<{ x: number; y: number }>({ x: 1000, y: 700 });
  const localPredRef = useRef<{ x: number; y: number; initialized: boolean }>({ x: 1000, y: 700, initialized: false });
  const smoothEntitiesRef = useRef<Map<string, { x: number; y: number; angle: number }>>(new Map());
  const smoothProjectilesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastFrameTimeRef = useRef<number>(performance.now());

  const selectSpell = (type: SpellType) => {
    setSelectedSpell(type);
    selectedSpellRef.current = type;
  };

  const triggerDash = () => {
    isRightMouseDownRef.current = true;
    setTimeout(() => {
      isRightMouseDownRef.current = false;
    }, 80);
  };

  const floatingNumbersRef = useRef<FloatingNumber[]>([]);
  const prevPlayersHealthRef = useRef<Map<string, number>>(new Map());

  // Input states
  const keysDownRef = useRef<Set<string>>(new Set());
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isMouseDownRef = useRef(false);
  const isRightMouseDownRef = useRef(false);
  const currentAngleRef = useRef(0);

  // Virtual Joystick states (for touch)
  const isTouchDeviceRef = useRef(false);
  const touchMoveRef = useRef<{ active: boolean; startX: number; startY: number; curX: number; curY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
  });

  // Textures cache
  const texturesRef = useRef<{
    loaded: boolean;
    wizards: HTMLImageElement[];
    spells: Record<string, HTMLImageElement>;
    floors: Record<string, HTMLImageElement>;
    walls: HTMLImageElement | null;
    pillar: HTMLImageElement | null;
    torch: HTMLImageElement | null;
    heart: HTMLImageElement | null;
    mana: HTMLImageElement | null;
    skull: HTMLImageElement | null;
    crown: HTMLImageElement | null;
    radarBezel: HTMLImageElement | null;
    vignetteDanger: HTMLImageElement | null;
  }>({
    loaded: false,
    wizards: [],
    spells: {},
    floors: {},
    walls: null,
    pillar: null,
    torch: null,
    heart: null,
    mana: null,
    skull: null,
    crown: null,
    radarBezel: null,
    vignetteDanger: null,
  });

  // Preload textures
  useEffect(() => {
    let active = true;
    const textures = texturesRef.current;
    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
      });

    const promises: Promise<unknown>[] = [];

    // 16 directional wizard sprites
    textures.wizards = [];
    for (let i = 0; i <= 15; i++) {
      const p = loadImg(`/magic-duel/textures/wizard_${i}.png`).then((img) => {
        textures.wizards[i] = img;
      });
      promises.push(p);
    }

    // Spell icons
    const spellTypes = ['fire', 'frost', 'lightning', 'shield', 'dash'];
    for (const st of spellTypes) {
      promises.push(
        loadImg(`/magic-duel/textures/spell_${st}.png`).then((img) => {
          textures.spells[st] = img;
        }),
      );
    }

    // Floors
    promises.push(
      loadImg('/magic-duel/textures/stone_floor.png').then((img) => {
        textures.floors['catacombs'] = img;
      }),
    );
    promises.push(
      loadImg('/magic-duel/textures/forest_floor.png').then((img) => {
        textures.floors['forest-ruins'] = img;
      }),
    );
    promises.push(
      loadImg('/magic-duel/textures/lava_floor.png').then((img) => {
        textures.floors['lava-citadel'] = img;
      }),
    );

    // Decor & Obstacles
    promises.push(
      loadImg('/magic-duel/textures/stone_wall.png').then((img) => {
        textures.walls = img;
      }),
    );
    promises.push(
      loadImg('/magic-duel/textures/pillar.png').then((img) => {
        textures.pillar = img;
      }),
    );
    promises.push(
      loadImg('/magic-duel/textures/torch.png').then((img) => {
        textures.torch = img;
      }),
    );

    // HUD icons
    promises.push(
      loadImg('/magic-duel/textures/icon_heart.png').then((img) => {
        textures.heart = img;
      }),
    );
    promises.push(
      loadImg('/magic-duel/textures/icon_mana.png').then((img) => {
        textures.mana = img;
      }),
    );
    promises.push(
      loadImg('/magic-duel/textures/icon_skull.png').then((img) => {
        textures.skull = img;
      }),
    );
    promises.push(
      loadImg('/magic-duel/textures/icon_crown.png').then((img) => {
        textures.crown = img;
      }),
    );
    promises.push(
      loadImg('/magic-duel/textures/radar_bezel.png').then((img) => {
        textures.radarBezel = img;
      }),
    );
    promises.push(
      loadImg('/magic-duel/textures/vignette_danger.png').then((img) => {
        textures.vignetteDanger = img;
      }),
    );

    Promise.all(promises).then(() => {
      if (active) textures.loaded = true;
    });

    return () => {
      active = false;
    };
  }, []);

  // Connect to Socket.IO game session
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const joinRoom = () => {
      socket.emit('game:join', { workspaceId, zoneId });
      setIsConnected(true);
    };

    joinRoom();
    socket.on('connect', joinRoom);
    socket.on('disconnect', () => setIsConnected(false));

    const onGameState = (state: GameWorldState) => {
      try {
        if (!state) return;
        setIsConnected(true);
        gameStateRef.current = state;
        if (!hasInitialStateRef.current) {
          hasInitialStateRef.current = true;
          setHasInitialState(true);
          setActiveMap(state.mapId);
        }

        // Detect health drops to spawn floating combat numbers and play audio
        const prevMap = prevPlayersHealthRef.current;
        const myId = userRef.current?.id;
        if (Array.isArray(state.players)) {
          for (const p of state.players) {
            const prevHp = prevMap.get(p.id);
            if (prevHp !== undefined && prevHp > p.health) {
              const dmg = prevHp - p.health;
              floatingNumbersRef.current.push({
                id: `fn-${Date.now()}-${Math.random()}`,
                x: p.posX,
                y: p.posY - 35,
                text: `-${dmg}`,
                color: '#ef4444',
                createdAt: Date.now(),
              });
              if (p.id === myId) {
                try {
                  audioRef.current.playHit();
                } catch {
                  // Audio error safety
                }
              }
            }
            prevMap.set(p.id, p.health);
          }
        }
      } catch (err) {
        console.error('onGameState processing error:', err);
      }
    };

    socket.on('game:state', onGameState);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('game:state', onGameState);
      socket.emit('game:leave', { workspaceId, zoneId });
    };
  }, [token, workspaceId, zoneId]);

  // Input listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const code = e.code;
      const key = e.key.toLowerCase();

      keysDownRef.current.add(code);
      keysDownRef.current.add(key);

      // Spell switching 1-4
      if (code === 'Digit1' || code === 'Numpad1' || key === '1') selectSpell('fireball');
      if (code === 'Digit2' || code === 'Numpad2' || key === '2') selectSpell('frost');
      if (code === 'Digit3' || code === 'Numpad3' || key === '3') selectSpell('lightning');
      if (code === 'Digit4' || code === 'Numpad4' || key === '4') selectSpell('shield');

      // Dash
      if (code === 'Space' || key === ' ' || code === 'KeyK' || key === 'k') {
        e.preventDefault();
        triggerDash();
      }
      if (code.startsWith('Arrow')) {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current.delete(e.code);
      keysDownRef.current.delete(e.key.toLowerCase());
    };

    const onMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      mousePosRef.current = {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDownRef.current = true;
      } else if (e.button === 2) {
        e.preventDefault();
        triggerDash();
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isMouseDownRef.current = false;
      if (e.button === 2) isRightMouseDownRef.current = false;
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  // Send input tick to server at 60 Hz
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const interval = setInterval(() => {
      const keys = keysDownRef.current;
      let moveX = 0;
      let moveY = 0;

      if (keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('a')) moveX -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight') || keys.has('d')) moveX += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp') || keys.has('w')) moveY -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown') || keys.has('s')) moveY += 1;

      // Handle touch joystick override
      if (touchMoveRef.current.active) {
        const dx = touchMoveRef.current.curX - touchMoveRef.current.startX;
        const dy = touchMoveRef.current.curY - touchMoveRef.current.startY;
        const len = Math.hypot(dx, dy);
        if (len > 10) {
          moveX = dx / Math.max(len, 50);
          moveY = dy / Math.max(len, 50);
        }
      }

      // Normalize diagonal
      const mag = Math.hypot(moveX, moveY);
      if (mag > 1) {
        moveX /= mag;
        moveY /= mag;
      }

      const isFiring = isMouseDownRef.current || keys.has('KeyJ') || keys.has('j');
      const isDashing = isRightMouseDownRef.current || keys.has('Space') || keys.has('KeyK') || keys.has(' ') || keys.has('k');

      const input: GameClientInput = {
        moveX,
        moveY,
        facingAngle: currentAngleRef.current,
        activeSpell: selectedSpellRef.current,
        isFiring,
        isDashing,
      };

      socket.emit('game:input', { workspaceId, zoneId, input });
    }, 16); // 60 FPS input transmission

    return () => clearInterval(interval);
  }, [token, workspaceId, zoneId]);

  // Main 60-144 FPS Render Loop with Client Prediction and Entity Interpolation
  useEffect(() => {
    let animId: number;

    const render = () => {
      animId = requestAnimationFrame(render);
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const now = performance.now();
        const dt = Math.min(0.05, (now - lastFrameTimeRef.current) / 1000);
        lastFrameTimeRef.current = now;

        // Find local player
        const state = gameStateRef.current;
        const myId = userRef.current?.id;
        const localPlayer =
          state?.players?.find((p) => myId && p.id === myId) ||
          state?.players?.find((p) => !p.isBot) ||
          state?.players?.[0] ||
          null;

      // 1. Client-Side Prediction for Local Player (Zero Input Latency)
      if (localPlayer) {
        if (!localPredRef.current.initialized) {
          localPredRef.current.x = localPlayer.posX;
          localPredRef.current.y = localPlayer.posY;
          localPredRef.current.initialized = true;
          camPosRef.current.x = localPlayer.posX;
          camPosRef.current.y = localPlayer.posY;
        } else {
          // Reconcile with authoritative server coordinates
          const errX = localPlayer.posX - localPredRef.current.x;
          const errY = localPlayer.posY - localPredRef.current.y;
          const errDist = Math.hypot(errX, errY);

          if (errDist > 140) {
            // Large jump (teleport/respawn) -> snap
            localPredRef.current.x = localPlayer.posX;
            localPredRef.current.y = localPlayer.posY;
          } else if (errDist > 0.5) {
            const blendRate = 1 - Math.exp(-14 * dt);
            localPredRef.current.x += errX * blendRate;
            localPredRef.current.y += errY * blendRate;
          }

          // Advance prediction using current local input
          const keys = keysDownRef.current;
          let mx = 0;
          let my = 0;
          if (keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('a')) mx -= 1;
          if (keys.has('KeyD') || keys.has('ArrowRight') || keys.has('d')) mx += 1;
          if (keys.has('KeyW') || keys.has('ArrowUp') || keys.has('w')) my -= 1;
          if (keys.has('KeyS') || keys.has('ArrowDown') || keys.has('s')) my += 1;

          if (touchMoveRef.current.active) {
            const tdx = touchMoveRef.current.curX - touchMoveRef.current.startX;
            const tdy = touchMoveRef.current.curY - touchMoveRef.current.startY;
            const tlen = Math.hypot(tdx, tdy);
            if (tlen > 10) {
              mx = tdx / Math.max(tlen, 50);
              my = tdy / Math.max(tlen, 50);
            }
          }

          const mag = Math.hypot(mx, my);
          if (mag > 1) {
            mx /= mag;
            my /= mag;
          }

          let speed = localPlayer.isDashing ? 720 : 240;

          const pRadius = 24;
          const mapW = state?.mapWidth || 2000;
          const mapH = state?.mapHeight || 1400;

          let predX = localPredRef.current.x + mx * speed * dt;
          predX = Math.max(pRadius + 15, Math.min(mapW - pRadius - 15, predX));
          if (state?.obstacles) {
            let collidesX = false;
            for (const obs of state.obstacles) {
              if (checkCircleRectCollision(predX, localPredRef.current.y, pRadius, obs.x, obs.y, obs.w, obs.h)) {
                collidesX = true;
                break;
              }
            }
            if (!collidesX) localPredRef.current.x = predX;
          } else {
            localPredRef.current.x = predX;
          }

          let predY = localPredRef.current.y + my * speed * dt;
          predY = Math.max(pRadius + 15, Math.min(mapH - pRadius - 15, predY));
          if (state?.obstacles) {
            let collidesY = false;
            for (const obs of state.obstacles) {
              if (checkCircleRectCollision(localPredRef.current.x, predY, pRadius, obs.x, obs.y, obs.w, obs.h)) {
                collidesY = true;
                break;
              }
            }
            if (!collidesY) localPredRef.current.y = predY;
          } else {
            localPredRef.current.y = predY;
          }
        }
      }

      // 2. Smooth Damped Camera Tracking
      const targetCamX = localPlayer ? localPredRef.current.x : width / 2;
      const targetCamY = localPlayer ? localPredRef.current.y : height / 2;
      const camSmoothRate = 1 - Math.exp(-18 * dt);
      camPosRef.current.x += (targetCamX - camPosRef.current.x) * camSmoothRate;
      camPosRef.current.y += (targetCamY - camPosRef.current.y) * camSmoothRate;
      const camX = camPosRef.current.x;
      const camY = camPosRef.current.y;

      // 3. Smooth Remote Players & Bot Interpolation
      if (state?.players) {
        const smoothMap = smoothEntitiesRef.current;
        const entitySmoothRate = 1 - Math.exp(-24 * dt);
        for (const p of state.players) {
          if (p.id === localPlayer?.id) continue;
          let sm = smoothMap.get(p.id);
          if (!sm) {
            sm = { x: p.posX, y: p.posY, angle: p.facingAngle };
            smoothMap.set(p.id, sm);
          } else {
            const dist = Math.hypot(p.posX - sm.x, p.posY - sm.y);
            if (dist > 150) {
              sm.x = p.posX;
              sm.y = p.posY;
            } else {
              sm.x += (p.posX - sm.x) * entitySmoothRate;
              sm.y += (p.posY - sm.y) * entitySmoothRate;
            }
            sm.angle += shortestAngleDiff(p.facingAngle, sm.angle) * entitySmoothRate;
          }
        }
      }

      // 4. Smooth Projectile Extrapolation & Smoothing
      if (state?.projectiles) {
        const pMap = smoothProjectilesRef.current;
        for (const proj of state.projectiles) {
          let sm = pMap.get(proj.id);
          if (!sm) {
            sm = { x: proj.posX, y: proj.posY };
            pMap.set(proj.id, sm);
          } else {
            sm.x += proj.velX * dt;
            sm.y += proj.velY * dt;
            sm.x += (proj.posX - sm.x) * 0.25;
            sm.y += (proj.posY - sm.y) * 0.25;
          }
        }
      }

      // Calculate aiming angle to mouse cursor
      const screenCenterX = width / 2;
      const screenCenterY = height / 2;
      const mouseDx = mousePosRef.current.x - screenCenterX;
      const mouseDy = mousePosRef.current.y - screenCenterY;
      const mouseAngle = (Math.atan2(mouseDy, mouseDx) * 180) / Math.PI;
      currentAngleRef.current = (mouseAngle + 360) % 360;

      // Clear Canvas
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      // Apply camera transform
      ctx.translate(screenCenterX - camX, screenCenterY - camY);

      const textures = texturesRef.current;
      const mapW = state?.mapWidth || 2000;
      const mapH = state?.mapHeight || 1400;

      // Render Arena Floor Pattern (Cached to eliminate GPU pattern reallocation)
      const currentMapId = state?.mapId || 'catacombs';
      let ptrn = patternsRef.current.get(currentMapId);
      if (!ptrn) {
        const floorImg = textures.floors[currentMapId];
        if (floorImg && floorImg.complete && floorImg.naturalWidth > 0) {
          try {
            const created = ctx.createPattern(floorImg, 'repeat');
            if (created) {
              patternsRef.current.set(currentMapId, created);
              ptrn = created;
            }
          } catch {
            ptrn = undefined;
          }
        }
      }
      if (ptrn) {
        ctx.fillStyle = ptrn;
        ctx.fillRect(0, 0, mapW, mapH);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, mapW, mapH);
      }

      // Perimeter wall borders
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 14;
      ctx.strokeRect(0, 0, mapW, mapH);

      // Inner neon boundary line
      ctx.strokeStyle = state?.mapId === 'lava-citadel' ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, mapW - 20, mapH - 20);

      // Render Obstacles (Pillars / Walls)
      if (state?.obstacles) {
        for (const obs of state.obstacles) {
          // Drop shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.fillRect(obs.x + 8, obs.y + 8, obs.w, obs.h);

          // Obstacle body
          ctx.fillStyle = '#334155';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

          if (textures.walls && textures.walls.complete) {
            ctx.drawImage(textures.walls, obs.x, obs.y, obs.w, obs.h);
          }

          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 2;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        }
      }

      // Render Visual Effects
      if (state?.visualEffects) {
        for (const fx of state.visualEffects) {
          const age = (now - fx.createdAt) / (fx.duration * 1000);
          if (age >= 1) continue;
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - age);
          ctx.fillStyle = fx.color;
          ctx.strokeStyle = fx.color;

          if (fx.type === 'cast_aura') {
            ctx.beginPath();
            ctx.arc(fx.x, fx.y, 20 + age * 30, 0, Math.PI * 2);
            ctx.lineWidth = 3;
            ctx.stroke();
          } else if (fx.type === 'spark_explosion') {
            for (let i = 0; i < 8; i++) {
              const a = (i * Math.PI) / 4;
              const r = 10 + age * 40;
              ctx.beginPath();
              ctx.arc(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            ctx.beginPath();
            ctx.arc(fx.x, fx.y, 10 + age * 50, 0, Math.PI * 2);
            ctx.lineWidth = 4;
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Render Projectiles
      if (state?.projectiles) {
        const pMap = smoothProjectilesRef.current;
        for (const proj of state.projectiles) {
          const smP = pMap.get(proj.id);
          const pX = smP ? smP.x : proj.posX;
          const pY = smP ? smP.y : proj.posY;

          ctx.save();
          ctx.translate(pX, pY);
          const angle = Math.atan2(proj.velY, proj.velX);
          ctx.rotate(angle);

          if (proj.spellType === 'fireball') {
            // High-perf outer glow ring
            ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
            ctx.beginPath();
            ctx.arc(0, 0, proj.radius + 6, 0, Math.PI * 2);
            ctx.fill();

            // Glowing Fireball body
            ctx.fillStyle = '#ea580c';
            ctx.beginPath();
            ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
            ctx.fill();

            // Inner bright core
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(2, 0, proj.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (proj.spellType === 'frost') {
            // High-perf outer glow disc
            ctx.fillStyle = 'rgba(14, 165, 233, 0.35)';
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();

            // Frost Shard Diamond
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(-8, -8);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-8, 8);
            ctx.closePath();
            ctx.fill();
          } else {
            // High-perf outer glow rect
            ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
            ctx.fillRect(-24, -6, 48, 12);

            // Lightning Bolt Beam
            ctx.fillStyle = '#c084fc';
            ctx.fillRect(-20, -3, 40, 6);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-15, -1.5, 30, 3);
          }
          ctx.restore();
        }
      }

      // Render Wizards
      if (state?.players) {
        const smoothMap = smoothEntitiesRef.current;
        for (const player of state.players) {
          const isMe = player.id === localPlayer?.id;
          const sm = smoothMap.get(player.id);
          const drawX = isMe ? localPredRef.current.x : sm ? sm.x : player.posX;
          const drawY = isMe ? localPredRef.current.y : sm ? sm.y : player.posY;
          const drawAngle = isMe ? currentAngleRef.current : sm ? sm.angle : player.facingAngle;

          if (!player.isAlive) {
            // Tombstone / elimination marker
            ctx.save();
            ctx.fillStyle = '#64748b';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💀 Respawning...', drawX, drawY);
            ctx.restore();
            continue;
          }

          ctx.save();
          ctx.translate(drawX, drawY);

          // Aiming Laser line for local player
          if (isMe) {
            const rad = (drawAngle * Math.PI) / 180;
            ctx.save();
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(rad) * 450, Math.sin(rad) * 450);
            ctx.stroke();

            // Target crosshair
            const crossX = Math.cos(rad) * 200;
            const crossY = Math.sin(rad) * 200;
            ctx.strokeStyle = '#38bdf8';
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(crossX, crossY, 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          drawWizardCharacter(
            ctx,
            player.colorIndex,
            isMe,
            drawAngle,
            player.isDashing,
            player.hitFlashTimer,
            player.hasShield,
            isMe ? selectedSpellRef.current : player.activeSpell,
            now,
          );

          ctx.restore();

          // Draw Overhead UI in world space
          ctx.save();
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';

          // Player name with clean text shadow
          const playerName = (isMe ? '⭐ ' : '') + player.name + (player.isBot ? ' [BOT]' : '');
          ctx.fillStyle = '#000000';
          ctx.fillText(playerName, drawX + 1, drawY - 45);
          ctx.fillStyle = isMe ? '#38bdf8' : player.isBot ? '#f87171' : '#f8fafc';
          ctx.fillText(playerName, drawX, drawY - 46);

          // Mini Health Bar
          const barW = 46;
          const barH = 5;
          const barX = drawX - barW / 2;
          const barY = drawY - 41;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

          const hpRatio = Math.max(0, player.health / player.maxHealth);
          ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
          ctx.fillRect(barX, barY, barW * hpRatio, barH);
          ctx.restore();
        }
      }

      // Render Floating Combat Numbers (Offset drop shadow, zero blur lag)
      const aliveFloating: FloatingNumber[] = [];
      for (const fn of floatingNumbersRef.current) {
        const age = (now - fn.createdAt) / 900;
        if (age < 1) {
          ctx.save();
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.globalAlpha = 1 - age;
          ctx.fillStyle = '#000000';
          ctx.fillText(fn.text, fn.x + 1, fn.y - age * 35 + 1);
          ctx.fillStyle = fn.color;
          ctx.fillText(fn.text, fn.x, fn.y - age * 35);
          ctx.restore();
          aliveFloating.push(fn);
        }
      }
      floatingNumbersRef.current = aliveFloating;

      ctx.restore(); // Restore camera transform

      // ==========================================
      // SCREEN-SPACE HUD OVERLAYS
      // ==========================================

      // 1. Danger Vignette (if local player HP < 30%)
      if (localPlayer && localPlayer.health < 30 && localPlayer.isAlive) {
        const pulse = 0.4 + 0.3 * Math.sin(now / 150);
        const grad = ctx.createRadialGradient(
          width / 2,
          height / 2,
          width * 0.3,
          width / 2,
          height / 2,
          width * 0.7,
        );
        grad.addColorStop(0, 'rgba(239, 68, 68, 0)');
        grad.addColorStop(1, `rgba(239, 68, 68, ${pulse})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Top-Left Player Status Bar (Hearts & Mana)
      if (localPlayer) {
        ctx.save();
        ctx.translate(20, 20);

        // Panel background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        roundRectPath(ctx, 0, 0, 260, 68, 12);
        ctx.fill();
        ctx.stroke();

        // Hearts Bar
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`HP  ${localPlayer.health} / 100`, 16, 24);

        const hpW = 228;
        ctx.fillStyle = '#334155';
        ctx.fillRect(16, 30, hpW, 8);
        ctx.fillStyle = localPlayer.health > 40 ? '#22c55e' : '#ef4444';
        ctx.fillRect(16, 30, (hpW * localPlayer.health) / 100, 8);

        // Mana Bar
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`MANA  ${localPlayer.mana} / 100`, 16, 52);

        ctx.fillStyle = '#334155';
        ctx.fillRect(16, 56, hpW, 6);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(16, 56, (hpW * localPlayer.mana) / 100, 6);

        ctx.restore();
      }

      // 3. Top-Center Kill Feed
      if (state?.killFeed && state.killFeed.length > 0) {
        ctx.save();
        ctx.translate(width / 2, 20);
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px sans-serif';

        state.killFeed.slice(0, 3).forEach((item, idx) => {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          roundRectPath(ctx, -150, idx * 26, 300, 22, 6);
          ctx.fill();

          ctx.fillStyle = '#f8fafc';
          ctx.fillText(`⚡ ${item.killerName} defeated ${item.victimName}`, 0, idx * 26 + 15);
        });
        ctx.restore();
      }

      // 4. Top-Right Scoreboard Pill
      if (localPlayer) {
        ctx.save();
        ctx.translate(width - 180, 20);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        roundRectPath(ctx, 0, 0, 160, 48, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`KILLS: ${localPlayer.kills}`, 16, 22);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`DEATHS: ${localPlayer.deaths}`, 16, 40);
        ctx.fillText(`SCORE: ${localPlayer.score}`, 85, 22);
        ctx.restore();
      }
    } catch (err) {
      console.error('Magic Duel render error:', err);
    }
  };

  animId = requestAnimationFrame(render);
  return () => cancelAnimationFrame(animId);
}, []); // Run continuously with uninterrupted vsync

// Periodic cooldown badge update (100ms throttled to eliminate React DOM thrashing)
useEffect(() => {
  const timer = setInterval(() => {
    try {
      const state = gameStateRef.current;
      const currentUserId = userRef.current?.id;
      const lp = state?.players?.find((p) => p.id === currentUserId) || state?.players?.find((p) => !p.isBot);
      if (lp?.cooldowns) {
        setCooldowns({ ...lp.cooldowns });
      }
    } catch {
      // Cooldown safety
    }
  }, 100);
  return () => clearInterval(timer);
}, []);

  // Handle map selection
  const handleSelectMap = (mapId: GameMapTheme) => {
    setActiveMap(mapId);
    if (!token) return;
    const socket = getSocket(token);
    socket.emit('game:select-map', { workspaceId, zoneId, mapId });
  };

  const spellsList: { type: SpellType; label: string; key: string; iconName: string; mana: number }[] = [
    { type: 'fireball', label: 'Fireball', key: '1', iconName: 'fire', mana: 15 },
    { type: 'frost', label: 'Frost', key: '2', iconName: 'frost', mana: 12 },
    { type: 'lightning', label: 'Lightning', key: '3', iconName: 'lightning', mana: 25 },
    { type: 'shield', label: 'Shield', key: '4', iconName: 'shield', mana: 20 },
    { type: 'dash', label: 'Dash', key: 'SPC', iconName: 'dash', mana: 20 },
  ];

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-slate-950 font-sans text-white">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="h-full w-full cursor-crosshair object-cover"
        onTouchStart={(e) => {
          isTouchDeviceRef.current = true;
          const touch = e.touches[0];
          if (!touch) return;
          touchMoveRef.current = {
            active: true,
            startX: touch.clientX,
            startY: touch.clientY,
            curX: touch.clientX,
            curY: touch.clientY,
          };
        }}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          if (!touch) return;
          touchMoveRef.current.curX = touch.clientX;
          touchMoveRef.current.curY = touch.clientY;
        }}
        onTouchEnd={() => {
          touchMoveRef.current.active = false;
        }}
      />

      {/* Connection Indicator */}
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold backdrop-blur shadow-lg">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-slate-200">{isConnected ? 'Live Arena · 60 FPS Ultra-Smooth' : 'Connecting to Server...'}</span>
        </div>
      </div>

      {/* Top Map Switcher / Control Buttons */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <div className="flex items-center rounded-xl border border-slate-700/80 bg-slate-900/90 p-1 text-xs backdrop-blur shadow-lg">
          <span className="px-2 text-slate-400 font-semibold">Map:</span>
          {(['catacombs', 'forest-ruins', 'lava-citadel'] as GameMapTheme[]).map((m) => (
            <button
              key={m}
              onClick={() => handleSelectMap(m)}
              className={`rounded-lg px-2.5 py-1 font-semibold capitalize transition ${
                activeMap === m ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {m.replace('-', ' ')}
            </button>
          ))}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/90 text-sm font-bold text-slate-300 hover:bg-red-600 hover:text-white transition backdrop-blur shadow-lg"
            title="Exit to Office"
          >
            ✕
          </button>
        )}
      </div>

      {/* Loading Overlay if waiting for initial game state */}
      {!hasInitialState && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 border border-sky-500/30 text-3xl animate-bounce">
            ⚡
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-100">Joining Magic Duel Arena...</h3>
          <p className="mt-1 text-xs text-slate-400">Synchronizing 60Hz server physics & sparring bot...</p>
          <button
            onClick={() => {
              if (token) {
                const s = getSocket(token);
                s.emit('game:join', { workspaceId, zoneId });
              }
            }}
            className="mt-4 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition shadow-lg shadow-sky-600/30"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Interactive Spell Selection Bar (Clickable HTML Dock) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/90 p-2 shadow-2xl backdrop-blur-md">
        {spellsList.map((sp) => {
          const isSelected = selectedSpell === sp.type;
          const cd = cooldowns[sp.type] || 0;
          return (
            <button
              key={sp.type}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (sp.type === 'dash') {
                  triggerDash();
                } else {
                  selectSpell(sp.type);
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`group relative flex h-16 w-16 flex-col items-center justify-center rounded-xl border transition-all select-none cursor-pointer ${
                isSelected
                  ? 'border-sky-400 bg-sky-500/25 shadow-lg shadow-sky-500/30 scale-105'
                  : 'border-slate-800 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-800'
              }`}
              title={`${sp.label} (${sp.mana} MP) - Press [${sp.key}] or Click to Select`}
            >
              {/* Badge */}
              <span className="absolute left-1.5 top-1 rounded bg-slate-800/90 px-1 font-mono text-[9px] font-bold text-sky-300">
                {sp.key}
              </span>
              {/* Icon */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/magic-duel/textures/spell_${sp.iconName}.png`}
                alt={sp.label}
                className="h-7 w-7 object-contain pointer-events-none"
              />
              {/* Label */}
              <span className="mt-0.5 text-[10px] font-semibold text-slate-200">
                {sp.label}
              </span>
              {/* Mana Cost */}
              <span className="text-[8px] text-sky-400 font-mono">
                {sp.mana} MP
              </span>
              {/* Cooldown Overlay */}
              {typeof cd === 'number' && Number.isFinite(cd) && cd > 0 && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/75 backdrop-blur-sm">
                  <span className="font-mono text-xs font-bold text-amber-400">{cd.toFixed(1)}s</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Controls Cheat Sheet */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/85 p-3 text-xs text-slate-300 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-sky-400">WASD</kbd>
          <span>Move</span>
          <kbd className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-sky-400">Mouse</kbd>
          <span>Aim</span>
          <kbd className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-sky-400">Click</kbd>
          <span>Cast</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-amber-400">1 - 4</kbd>
          <span>Select Spell</span>
          <kbd className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-amber-400">Space / Right Click</kbd>
          <span>Dash</span>
        </div>
      </div>
    </div>
  );
}
