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

interface MagicDuelCanvasProps {
  workspaceId: string;
  zoneId: string;
  onClose?: () => void;
}

export function MagicDuelCanvas({ workspaceId, zoneId, onClose }: MagicDuelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const audio = useMagicDuelAudio();

  const [gameState, setGameState] = useState<GameWorldState | null>(null);
  const [selectedSpell, setSelectedSpell] = useState<SpellType>('fireball');
  const [activeMap, setActiveMap] = useState<GameMapTheme>('catacombs');

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

    socket.emit('game:join', { workspaceId, zoneId });

    const onGameState = (state: GameWorldState) => {
      setGameState(state);
      setActiveMap(state.mapId);

      // Detect health drops to spawn floating combat numbers and play audio
      const prevMap = prevPlayersHealthRef.current;
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
          if (p.id === user?.id) {
            audio.playHit();
          }
        }
        prevMap.set(p.id, p.health);
      }
    };

    socket.on('game:state', onGameState);

    return () => {
      socket.off('game:state', onGameState);
      socket.emit('game:leave', { workspaceId, zoneId });
    };
  }, [token, workspaceId, zoneId, user?.id, audio]);

  // Input listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keysDownRef.current.add(e.code);

      // Spell switching 1-4
      if (e.code === 'Digit1') setSelectedSpell('fireball');
      if (e.code === 'Digit2') setSelectedSpell('frost');
      if (e.code === 'Digit3') setSelectedSpell('lightning');
      if (e.code === 'Digit4') setSelectedSpell('shield');
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current.delete(e.code);
    };

    const onMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDownRef.current = true;
      } else if (e.button === 2) {
        e.preventDefault();
        isRightMouseDownRef.current = true;
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

  // Send input tick to server at 30 Hz
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const interval = setInterval(() => {
      const keys = keysDownRef.current;
      let moveX = 0;
      let moveY = 0;

      if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) moveY -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveY += 1;

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

      const isFiring = isMouseDownRef.current || keys.has('KeyJ');
      const isDashing = isRightMouseDownRef.current || keys.has('Space') || keys.has('KeyK');

      const input: GameClientInput = {
        moveX,
        moveY,
        facingAngle: currentAngleRef.current,
        activeSpell: selectedSpell,
        isFiring,
        isDashing,
      };

      socket.emit('game:input', { workspaceId, zoneId, input });
    }, 33);

    return () => clearInterval(interval);
  }, [token, workspaceId, zoneId, selectedSpell]);

  // Main 60 FPS Render Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const now = Date.now();

      // Find local player
      const state = gameState;
      const localPlayer = state?.players.find((p) => p.id === user?.id);

      // Camera view coordinates
      const camX = localPlayer ? localPlayer.posX : width / 2;
      const camY = localPlayer ? localPlayer.posY : height / 2;

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

      // Render Arena Floor Pattern
      const floorImg = textures.floors[state?.mapId || 'catacombs'];
      if (floorImg && floorImg.complete && floorImg.width > 0) {
        const ptrn = ctx.createPattern(floorImg, 'repeat');
        if (ptrn) {
          ctx.fillStyle = ptrn;
          ctx.fillRect(0, 0, mapW, mapH);
        }
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
        for (const proj of state.projectiles) {
          ctx.save();
          ctx.translate(proj.posX, proj.posY);
          const angle = Math.atan2(proj.velY, proj.velX);
          ctx.rotate(angle);

          if (proj.spellType === 'fireball') {
            // Glowing Fireball
            ctx.fillStyle = '#ea580c';
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
            ctx.fill();

            // Inner bright core
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(2, 0, proj.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (proj.spellType === 'frost') {
            // Frost Shard Diamond
            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#0ea5e9';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(-8, -8);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-8, 8);
            ctx.closePath();
            ctx.fill();
          } else {
            // Lightning Bolt Beam
            ctx.fillStyle = '#c084fc';
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 16;
            ctx.fillRect(-20, -3, 40, 6);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-15, -1.5, 30, 3);
          }
          ctx.restore();
        }
      }

      // Render Wizards
      if (state?.players) {
        for (const player of state.players) {
          if (!player.isAlive) {
            // Tombstone / elimination marker
            ctx.save();
            ctx.fillStyle = '#64748b';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💀 Respawning...', player.posX, player.posY);
            ctx.restore();
            continue;
          }

          ctx.save();
          ctx.translate(player.posX, player.posY);

          // Aiming Laser line for local player
          if (player.id === user?.id) {
            const rad = (player.facingAngle * Math.PI) / 180;
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

          // Wizard Sprite Selection (16 angles)
          // 360 / 16 = 22.5 deg per slice
          const slice = Math.round(player.facingAngle / 22.5) % 16;
          const wizardImg = textures.wizards[slice];

          // Hit flash / Dashing tint
          if (player.hitFlashTimer > 0) {
            ctx.filter = 'brightness(2.2) drop-shadow(0 0 10px #ef4444)';
          } else if (player.isDashing) {
            ctx.filter = 'drop-shadow(0 0 12px #38bdf8)';
          }

          if (wizardImg && wizardImg.complete && wizardImg.width > 0) {
            ctx.drawImage(wizardImg, -24, -28, 48, 56);
          } else {
            // Fallback colored circle
            ctx.fillStyle = player.colorIndex === 0 ? '#3b82f6' : '#ef4444';
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.filter = 'none';

          // Arcane Shield Bubble
          if (player.hasShield) {
            ctx.save();
            ctx.strokeStyle = '#38bdf8';
            ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          // Overhead Name & Health Bar
          ctx.restore();

          // Draw Overhead UI in world space
          ctx.save();
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';

          // Player name
          ctx.fillStyle = player.id === user?.id ? '#38bdf8' : '#f8fafc';
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 4;
          ctx.fillText(player.name + (player.isBot ? ' [BOT]' : ''), player.posX, player.posY - 36);

          // Mini Health Bar
          const barW = 44;
          const barH = 5;
          const barX = player.posX - barW / 2;
          const barY = player.posY - 32;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

          const hpRatio = Math.max(0, player.health / player.maxHealth);
          ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
          ctx.fillRect(barX, barY, barW * hpRatio, barH);
          ctx.restore();
        }
      }

      // Render Floating Combat Numbers
      const aliveFloating: FloatingNumber[] = [];
      for (const fn of floatingNumbersRef.current) {
        const age = (now - fn.createdAt) / 900;
        if (age < 1) {
          ctx.save();
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = fn.color;
          ctx.globalAlpha = 1 - age;
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 6;
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
        ctx.roundRect(0, 0, 260, 68, 12);
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
          ctx.roundRect(-150, idx * 26, 300, 22, 6);
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
        ctx.roundRect(0, 0, 160, 48, 10);
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

      // 5. Bottom Spell Bar (Icons + Cooldown rings)
      if (localPlayer) {
        ctx.save();
        const barWidth = 320;
        ctx.translate(width / 2 - barWidth / 2, height - 85);

        // Spell buttons
        const spellsList: { type: SpellType; label: string; key: string }[] = [
          { type: 'fireball', label: 'Fire', key: '1' },
          { type: 'frost', label: 'Frost', key: '2' },
          { type: 'lightning', label: 'Light', key: '3' },
          { type: 'shield', label: 'Shield', key: '4' },
          { type: 'dash', label: 'Dash', key: 'SPC' },
        ];

        spellsList.forEach((sp, idx) => {
          const btnX = idx * 64;
          const isSelected = selectedSpell === sp.type && sp.type !== 'dash';

          // Background
          ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.35)' : 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(148, 163, 184, 0.3)';
          ctx.lineWidth = isSelected ? 2.5 : 1;
          ctx.beginPath();
          ctx.roundRect(btnX, 0, 56, 56, 12);
          ctx.fill();
          ctx.stroke();

          // Icon
          const iconImg = textures.spells[sp.type];
          if (iconImg && iconImg.complete) {
            ctx.drawImage(iconImg, btnX + 8, 8, 40, 40);
          } else {
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(sp.label, btnX + 28, 32);
          }

          // Key badge
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(sp.key, btnX + 4, 14);

          // Cooldown radial sweep
          const cd = localPlayer.cooldowns[sp.type] || 0;
          if (cd > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.beginPath();
            ctx.roundRect(btnX, 0, 56, 56, 12);
            ctx.fill();

            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${cd.toFixed(1)}s`, btnX + 28, 34);
          }
        });
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [gameState, selectedSpell, user?.id]);

  // Handle map selection
  const handleSelectMap = (mapId: GameMapTheme) => {
    if (!token) return;
    const socket = getSocket(token);
    socket.emit('game:select-map', { workspaceId, zoneId, mapId });
  };

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-slate-950 font-sans text-white">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={1000}
        height={650}
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

      {/* Top Map Switcher / Control Buttons */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900/90 p-1 text-xs backdrop-blur">
          <span className="px-2 text-slate-400">Map:</span>
          {(['catacombs', 'forest-ruins', 'lava-citadel'] as GameMapTheme[]).map((m) => (
            <button
              key={m}
              onClick={() => handleSelectMap(m)}
              className={`rounded px-2.5 py-1 font-medium capitalize transition ${
                activeMap === m ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {m.replace('-', ' ')}
            </button>
          ))}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/90 text-sm font-bold text-slate-300 hover:bg-red-600 hover:text-white transition backdrop-blur"
            title="Exit to Office"
          >
            ✕
          </button>
        )}
      </div>

      {/* Quick Controls Cheat Sheet */}
      <div className="pointer-events-none absolute bottom-4 left-4 flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/85 p-3 text-xs text-slate-300 shadow-lg backdrop-blur">
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
