'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Vec2, Zone } from '@vicinity/shared';
import { usePresenceStore } from '@/stores/presence';

interface SkyCampus3DProps {
  zones: Zone[];
  onMove: (p: Vec2) => void;
  onZoneEnter?: (zoneId: string) => void;
  onZoneLeave?: (zoneId?: string) => void;
  onZoneChange?: (zone: Zone | null) => void;
  onStartDm?: (userId: string, displayName: string) => void;
}

export function SkyCampus3D({
  zones,
  onMove,
  onZoneEnter,
  onZoneLeave,
  onZoneChange,
  onStartDm,
}: SkyCampus3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentZoneIdRef = useRef<string | null>(null);

  const users = usePresenceStore((s) => s.users);
  const myId = usePresenceStore((s) => s.me);

  // Multi-Floor State
  const [currentFloor, setCurrentFloor] = useState<number>(5);
  const [camMode, setCamMode] = useState<'iso' | 'top' | 'follow'>('iso');
  const [themeIndex, setThemeIndex] = useState<number>(0);
  const [addFloorOpen, setAddFloorOpen] = useState(false);
  const [customFloors, setCustomFloors] = useState<Array<{ id: string; level: number; name: string; icon: string }>>([]);

  // Form state
  const [newFloorName, setNewFloorName] = useState('Innovation Loft');
  const [newFloorArchetype, setNewFloorArchetype] = useState('open-collab');

  // Internal 3D world references
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    sunLight: THREE.DirectionalLight;
    avatarGroup: THREE.Group;
    remoteAvatars: Map<string, THREE.Group>;
    floorGroup: THREE.Group;
    floorMeshes: THREE.Mesh[];
    koiFish: Array<{ mesh: THREE.Mesh; angle: number; radius: number; speed: number }>;
    leftLeg?: THREE.Mesh;
    rightLeg?: THREE.Mesh;
    leftArm?: THREE.Mesh;
    rightArm?: THREE.Mesh;
  } | null>(null);

  const avatarPos = useRef<{ x: number; z: number; targetX: number; targetZ: number; isMoving: boolean; angle: number; walkCycle: number }>({
    x: 0,
    z: 0,
    targetX: 0,
    targetZ: 0,
    isMoving: false,
    angle: 0,
    walkCycle: 0,
  });

  const lastMoveSentRef = useRef<number>(0);
  const keysRef = useRef<{ w: boolean; a: boolean; s: boolean; d: boolean }>({ w: false, a: false, s: false, d: false });

  // Lighting Themes
  const THEMES = [
    { name: 'Sunrise', icon: '☀️', sunCol: 0xffedd5, skyCol: 0x060c18, sunPos: [40, 60, 30] },
    { name: 'Daylight', icon: '🏙️', sunCol: 0xffffff, skyCol: 0x0f172a, sunPos: [10, 80, 20] },
    { name: 'Sunset', icon: '🌆', sunCol: 0xf43f5e, skyCol: 0x1e1b4b, sunPos: [-50, 25, 40] },
    { name: 'Night', icon: '🌙', sunCol: 0x38bdf8, skyCol: 0x020617, sunPos: [0, 40, -40] },
  ];

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060c18);
    scene.fog = new THREE.FogExp2(0x060c18, 0.008);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    camera.position.set(0, 52, 62);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Ambient & Sun Light
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.65);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.4);
    sunLight.position.set(40, 60, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // Floor Group
    const floorGroup = new THREE.Group();
    scene.add(floorGroup);

    // Materials
    const M = {
      teak: new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.7 }),
      terrazzo: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35 }),
      white: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25 }),
      cedar: new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.65 }),
      water: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, transparent: true, opacity: 0.85 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.32, transmission: 0.8 }),
      moss: new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.9 }),
      neon: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    };

    const floorMeshes: THREE.Mesh[] = [];
    const koiFish: Array<{ mesh: THREE.Mesh; angle: number; radius: number; speed: number }> = [];

    // Build Terrace Layout
    function buildTerrace() {
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(48, 46, 2.5, 64), M.teak);
      deck.position.y = -1.25;
      deck.receiveShadow = true;
      floorGroup.add(deck);
      floorMeshes.push(deck);

      const rail = new THREE.Mesh(new THREE.CylinderGeometry(48, 48, 3.2, 64, 1, true), M.glass);
      rail.position.y = 1.6;
      floorGroup.add(rail);

      const prom = new THREE.Mesh(new THREE.CylinderGeometry(38, 38, 0.4, 64), M.terrazzo);
      prom.position.y = 0.2;
      prom.receiveShadow = true;
      floorGroup.add(prom);
      floorMeshes.push(prom);

      // Garden & Pond
      const lawn = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 0.5, 48), M.moss);
      lawn.position.y = 0.25;
      lawn.receiveShadow = true;
      floorGroup.add(lawn);
      floorMeshes.push(lawn);

      const pond = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 0.6, 32), M.water);
      pond.scale.set(1.2, 1, 0.8);
      pond.position.set(-1, 0.22, 0);
      floorGroup.add(pond);

      // Bridge
      const bridgeGroup = new THREE.Group();
      for (let i = 0; i < 12; i++) {
        const u = (i / 11) * Math.PI;
        const x = (i - 5.5) * 0.55;
        const y = Math.sin(u) * 0.8 + 0.4;
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 3.8), M.cedar);
        plank.position.set(x, y, 0);
        plank.castShadow = true;
        bridgeGroup.add(plank);
        floorMeshes.push(plank);
      }
      bridgeGroup.position.set(3, 0.25, 0);
      floorGroup.add(bridgeGroup);

      // Boardroom
      const brFl = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.5, 48), M.white);
      brFl.position.set(0, 0.25, -25);
      brFl.receiveShadow = true;
      floorGroup.add(brFl);
      floorMeshes.push(brFl);

      const brWall = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 5.5, 48, 1, true, Math.PI * 0.2, Math.PI * 1.6), M.glass);
      brWall.position.set(0, 3, -25);
      floorGroup.add(brWall);

      // Cafe
      const cafeFl = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 18), M.cedar);
      cafeFl.position.set(26, 0.25, -5);
      cafeFl.receiveShadow = true;
      floorGroup.add(cafeFl);
      floorMeshes.push(cafeFl);

      // Amphitheater
      const ampFl = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 0.5, 48), M.white);
      ampFl.position.set(-26, 0.25, -2);
      ampFl.receiveShadow = true;
      floorGroup.add(ampFl);
      floorMeshes.push(ampFl);

      // Library
      const libFl = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 14), M.cedar);
      libFl.position.set(-10, 0.25, 24);
      libFl.receiveShadow = true;
      floorGroup.add(libFl);
      floorMeshes.push(libFl);
    }

    buildTerrace();

    // 3D Avatar (Local User)
    const avatarGroup = new THREE.Group();

    // Halo
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(4.8, 5.0, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
    );
    halo.position.y = 0.28;
    avatarGroup.add(halo);

    const bodyGroup = new THREE.Group();
    bodyGroup.position.y = 1.0;

    const denimMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a });
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.5, 8), denimMat);
    leftLeg.position.set(-0.35, 0.75, 0);
    bodyGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.5, 8), denimMat);
    rightLeg.position.set(0.35, 0.75, 0);
    bodyGroup.add(rightLeg);

    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.7), shirtMat);
    torso.position.y = 2.1;
    bodyGroup.add(torso);

    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8), shirtMat);
    leftArm.position.set(-0.8, 2.0, 0);
    bodyGroup.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8), shirtMat);
    rightArm.position.set(0.8, 2.0, 0);
    bodyGroup.add(rightArm);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), new THREE.MeshStandardMaterial({ color: 0xf8d7bb }));
    head.position.y = 3.3;
    bodyGroup.add(head);

    avatarGroup.add(bodyGroup);
    avatarGroup.position.set(0, 0.25, 0);
    scene.add(avatarGroup);

    threeRef.current = {
      scene,
      camera,
      renderer,
      sunLight,
      avatarGroup,
      remoteAvatars: new Map(),
      floorGroup,
      floorMeshes,
      koiFish,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
    };

    // Keyboard movement
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.key) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keysRef.current.w = true;
      if (k === 's' || k === 'arrowdown') keysRef.current.s = true;
      if (k === 'a' || k === 'arrowleft') keysRef.current.a = true;
      if (k === 'd' || k === 'arrowright') keysRef.current.d = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!e.key) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keysRef.current.w = false;
      if (k === 's' || k === 'arrowdown') keysRef.current.s = false;
      if (k === 'a' || k === 'arrowleft') keysRef.current.a = false;
      if (k === 'd' || k === 'arrowright') keysRef.current.d = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Click to move raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / containerRef.current.clientWidth) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / containerRef.current.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Check if clicking peer coworker
      if (threeRef.current?.remoteAvatars && onStartDm) {
        const peerGroups = Array.from(threeRef.current.remoteAvatars.values());
        const peerHits = raycaster.intersectObjects(peerGroups, true);
        if (peerHits.length > 0) {
          for (const [userId, group] of threeRef.current.remoteAvatars.entries()) {
            let hit = false;
            group.traverse((child) => {
              if (child === peerHits[0]?.object) hit = true;
            });
            if (hit) {
              const u = users[userId];
              if (u) {
                onStartDm(userId, u.displayName);
                return;
              }
            }
          }
        }
      }

      const intersects = raycaster.intersectObjects(floorMeshes, true);
      if (intersects.length > 0) {
        const pt = intersects[0]!.point;
        if (Math.hypot(pt.x, pt.z) < 46) {
          avatarPos.current.targetX = pt.x;
          avatarPos.current.targetZ = pt.z;
        }
      }
    };
    containerRef.current.addEventListener('click', onPointerClick);

    // Resize
    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Animation Loop
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      animId = requestAnimationFrame(loop);
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const a = avatarPos.current;
      const keys = keysRef.current;
      let mx = 0;
      let mz = 0;
      if (keys.w) mz -= 1;
      if (keys.s) mz += 1;
      if (keys.a) mx -= 1;
      if (keys.d) mx += 1;

      if (mx !== 0 || mz !== 0) {
        const len = Math.hypot(mx, mz);
        a.x += (mx / len) * 20 * delta;
        a.z += (mz / len) * 20 * delta;
        a.targetX = a.x;
        a.targetZ = a.z;
        a.isMoving = true;
        a.angle = Math.atan2(mx, mz);
      } else {
        const dx = a.targetX - a.x;
        const dz = a.targetZ - a.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.4) {
          a.x += (dx / dist) * 20 * delta;
          a.z += (dz / dist) * 20 * delta;
          a.isMoving = true;
          a.angle = Math.atan2(dx, dz);
        } else {
          a.isMoving = false;
        }
      }

      // Keep within bounds
      if (Math.hypot(a.x, a.z) > 45) {
        const rad = Math.atan2(a.z, a.x);
        a.x = Math.cos(rad) * 45;
        a.z = Math.sin(rad) * 45;
      }

      avatarGroup.position.x = a.x;
      avatarGroup.position.z = a.z;

      if (a.isMoving) {
        avatarGroup.rotation.y = a.angle;
        a.walkCycle += delta * 12;
        if (leftLeg) leftLeg.rotation.x = Math.sin(a.walkCycle) * 0.65;
        if (rightLeg) rightLeg.rotation.x = -Math.sin(a.walkCycle) * 0.65;
        if (leftArm) leftArm.rotation.x = -Math.sin(a.walkCycle) * 0.55;
        if (rightArm) rightArm.rotation.x = Math.sin(a.walkCycle) * 0.55;
      } else {
        if (leftLeg) leftLeg.rotation.x = 0;
        if (rightLeg) rightLeg.rotation.x = 0;
      }

      // Camera positioning
      if (camMode === 'follow') {
        camera.position.set(a.x, 24, a.z + 32);
        camera.lookAt(a.x, 2, a.z);
      }

      // Throttled onMove broadcast (60ms)
      if (time - lastMoveSentRef.current > 60) {
        lastMoveSentRef.current = time;
        // Map 3D coords (-45..45) to 2D floor units (0..1600, 0..1080)
        const mappedX = ((a.x + 45) / 90) * 1600;
        const mappedY = ((a.z + 45) / 90) * 1080;
        onMove({ x: mappedX, y: mappedY });

        // Room Detection
        if (zones.length > 0) {
          const match = zones.find(
            (z) =>
              mappedX >= z.geometry.x &&
              mappedX <= z.geometry.x + z.geometry.w &&
              mappedY >= z.geometry.y &&
              mappedY <= z.geometry.y + z.geometry.h
          );
          if (match?.id !== currentZoneIdRef.current) {
            if (currentZoneIdRef.current && onZoneLeave) {
              onZoneLeave(currentZoneIdRef.current);
            }
            if (match && onZoneEnter) {
              onZoneEnter(match.id);
            }
            currentZoneIdRef.current = match?.id ?? null;
            if (onZoneChange) {
              onZoneChange(match ?? null);
            }
          }
        }
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  // Update Remote Peer Avatars
  useEffect(() => {
    if (!threeRef.current) return;
    const { scene, remoteAvatars } = threeRef.current;

    // Add or update remote avatars
    Object.entries(users).forEach(([userId, u]) => {
      if (userId === myId || !u.position) return;

      let peerGroup = remoteAvatars.get(userId);
      if (!peerGroup) {
        peerGroup = new THREE.Group();
        const peerMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.4, 8), peerMat);
        body.position.y = 1.2;
        peerGroup.add(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshStandardMaterial({ color: 0xf8d7bb }));
        head.position.y = 2.8;
        peerGroup.add(head);

        scene.add(peerGroup);
        remoteAvatars.set(userId, peerGroup);
      }

      // Map 2D world coords to 3D coords
      const px = (u.position.x / 1600) * 90 - 45;
      const pz = (u.position.y / 1080) * 90 - 45;
      peerGroup.position.set(px, 0.25, pz);
    });

    // Cleanup disconnected peers
    for (const [userId, group] of remoteAvatars.entries()) {
      if (!users[userId]) {
        scene.remove(group);
        remoteAvatars.delete(userId);
      }
    }
  }, [users, myId]);

  // Handle Camera Mode
  const setCameraMode = (mode: 'iso' | 'top' | 'follow') => {
    setCamMode(mode);
    if (!threeRef.current) return;
    const { camera } = threeRef.current;
    if (mode === 'iso') {
      camera.position.set(0, 52, 62);
      camera.lookAt(0, 0, 0);
    } else if (mode === 'top') {
      camera.position.set(0, 85, 0.1);
      camera.lookAt(0, 0, 0);
    }
  };

  // Handle Theme
  const cycleTheme = () => {
    const next = (themeIndex + 1) % THEMES.length;
    setThemeIndex(next);
    if (!threeRef.current) return;
    const t = THEMES[next]!;
    threeRef.current.sunLight.color.setHex(t.sunCol);
    threeRef.current.scene.background = new THREE.Color(t.skyCol);
    threeRef.current.scene.fog = new THREE.FogExp2(t.skyCol, 0.008);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-slate-950 select-none">
      <canvas ref={canvasRef} className="h-full w-full block" />

      {/* Camera & Lighting Controls (Top Left) */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/85 p-1 backdrop-blur shadow-lg">
          <button
            onClick={() => setCameraMode('iso')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              camMode === 'iso' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            📐 Isometric
          </button>
          <button
            onClick={() => setCameraMode('top')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              camMode === 'top' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            🗺️ Top-Down
          </button>
          <button
            onClick={() => setCameraMode('follow')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              camMode === 'follow' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            🚶‍♂️ Follow Me
          </button>
        </div>

        <button
          onClick={cycleTheme}
          className="rounded-xl border border-white/10 bg-slate-900/85 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur shadow-lg hover:bg-white/10 transition"
          title="Cycle Day/Night Lighting"
        >
          <span>{THEMES[themeIndex]!.icon} {THEMES[themeIndex]!.name}</span>
        </button>
      </div>

      {/* Building Elevator (Left HUD) */}
      <div className="absolute top-16 left-3 z-20 flex w-44 flex-col gap-1.5 rounded-2xl border border-white/10 bg-slate-900/85 p-3 backdrop-blur shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span>🏢 Elevator</span>
          <button
            onClick={() => setAddFloorOpen(true)}
            className="text-sky-400 hover:text-sky-300 text-xs font-bold"
            title="Build a new floor"
          >
            + Add
          </button>
        </div>

        <button
          onClick={() => setCurrentFloor(5)}
          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
            currentFloor === 5 ? 'bg-sky-600 text-white shadow' : 'text-slate-300 hover:bg-white/10'
          }`}
        >
          <span>🌅 Penthouse Terrace</span>
          <span className="rounded bg-black/30 px-1 text-[10px]">ROOF</span>
        </button>

        {[
          { level: 4, name: '🎨 Creative Loft' },
          { level: 3, name: '💼 Executive Suites' },
          { level: 2, name: '⚡ Engineering Lab' },
          { level: 1, name: '🏛️ Grand Atrium' },
        ].map((f) => (
          <button
            key={f.level}
            onClick={() => setCurrentFloor(f.level)}
            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              currentFloor === f.level ? 'bg-sky-600 text-white shadow' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <span className="truncate">{f.name}</span>
            <span className="rounded bg-black/30 px-1 text-[10px]">L{f.level}</span>
          </button>
        ))}

        {customFloors.map((cf) => (
          <button
            key={cf.id}
            onClick={() => setCurrentFloor(cf.level)}
            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              currentFloor === cf.level ? 'bg-sky-600 text-white shadow' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <span className="truncate">{cf.icon} {cf.name}</span>
            <span className="rounded bg-black/30 px-1 text-[10px]">L{cf.level}</span>
          </button>
        ))}
      </div>

      {/* Add Floor Modal */}
      {addFloorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>➕ Add Custom Floor</span>
              </h3>
              <button onClick={() => setAddFloorOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Floor Name</label>
                <input
                  type="text"
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Layout Archetype</label>
                <select
                  value={newFloorArchetype}
                  onChange={(e) => setNewFloorArchetype(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="open-collab">🚀 Open Collaboration & War Rooms</option>
                  <option value="executive">🏛️ Executive Private Suites</option>
                  <option value="creative">🎨 Creative Studio & Lounge</option>
                  <option value="town-hall">🎭 Grand Auditorium</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setAddFloorOpen(false)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const newFloor = {
                    id: `custom-${Date.now()}`,
                    level: 6 + customFloors.length,
                    name: newFloorName.trim() || 'Custom Floor',
                    icon: '✨',
                  };
                  setCustomFloors((prev) => [...prev, newFloor]);
                  setCurrentFloor(newFloor.level);
                  setAddFloorOpen(false);
                }}
                className="flex-1 rounded-lg bg-sky-600 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 shadow"
              >
                Build Floor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
