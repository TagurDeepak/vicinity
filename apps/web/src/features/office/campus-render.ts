import { roundRect } from './OfficeCanvas';

let campus3dImg: HTMLImageElement | null = null;
let campus3dLoaded = false;

/** Preloads the high-definition 3D isometric campus artwork */
export function getCampus3DImage(): HTMLImageElement | null {
  if (typeof window === 'undefined') return null;
  if (!campus3dImg) {
    campus3dImg = new Image();
    campus3dImg.src = '/campus-3d.jpg';
    campus3dImg.onload = () => {
      campus3dLoaded = true;
    };
  }
  return campus3dLoaded ? campus3dImg : null;
}

/** Draws the 3D aesthetic campus backdrop. Returns true if image rendered. */
export function drawCampus3DBackdrop(
  ctx: CanvasRenderingContext2D,
  s: number,
  h: number = 1080,
): boolean {
  const img = getCampus3DImage();
  if (img) {
    ctx.drawImage(img, 0, 0, 1600 * s, h * s);
    return true;
  }
  return false;
}

/** Draws living, animated water ripples and fountain sparkle directly over the 3D plaza fountains */
export function drawCampusFountainRipples(
  ctx: CanvasRenderingContext2D,
  s: number,
  now: number,
): void {
  ctx.save();
  const animTime = now * 0.001;
  CAMPUS_FOUNTAINS.forEach((f, idx) => {
    const fx = f.x * s;
    const fy = f.y * s;
    const fr = f.r * s;

    const ripple1 = (animTime * 1.4 + idx * 0.75) % 1;
    const ripple2 = (animTime * 1.4 + idx * 0.75 + 0.5) % 1;

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * (1 - ripple1)})`;
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.arc(fx, fy, 4 * s + ripple1 * (fr - 8 * s), 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - ripple2)})`;
    ctx.beginPath();
    ctx.arc(fx, fy, 4 * s + ripple2 * (fr - 8 * s), 0, Math.PI * 2);
    ctx.stroke();

    // Central nozzle water sparkle
    const sparkle = (Math.sin(animTime * 4.5 + idx * 1.2) + 1) * 0.5;
    ctx.fillStyle = `rgba(240, 249, 255, ${0.45 + sparkle * 0.5})`;
    ctx.beginPath();
    ctx.arc(fx, fy, (3 + sparkle * 2) * s, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// Campus trees layout (pine conifers, deciduous oaks, and pink cherry blossoms)
const CAMPUS_TREES = [
  // Left border trees
  { x: 50, y: 80, type: 'pine', r: 28 },
  { x: 70, y: 170, type: 'oak', r: 24 },
  { x: 45, y: 260, type: 'pine', r: 26 },
  { x: 65, y: 350, type: 'oak', r: 25 },
  { x: 50, y: 440, type: 'pine', r: 28 },
  { x: 70, y: 530, type: 'oak', r: 26 },
  { x: 45, y: 620, type: 'pine', r: 27 },
  { x: 60, y: 710, type: 'oak', r: 25 },
  { x: 50, y: 800, type: 'pine', r: 28 },
  { x: 70, y: 890, type: 'oak', r: 26 },
  { x: 55, y: 990, type: 'pine', r: 28 },

  // Right border trees & blossoms
  { x: 1530, y: 80, type: 'pine', r: 28 },
  { x: 1550, y: 160, type: 'blossom', r: 24 },
  { x: 1530, y: 240, type: 'pine', r: 26 },
  { x: 1545, y: 320, type: 'blossom', r: 26 },
  { x: 1530, y: 400, type: 'oak', r: 25 },
  { x: 1545, y: 490, type: 'oak', r: 26 },
  { x: 1530, y: 570, type: 'blossom', r: 26 },
  { x: 1550, y: 650, type: 'blossom', r: 25 },
  { x: 1530, y: 730, type: 'pine', r: 28 },
  { x: 1545, y: 820, type: 'oak', r: 26 },
  { x: 1530, y: 910, type: 'blossom', r: 26 },
  { x: 1550, y: 1000, type: 'pine', r: 28 },

  // Top garden divider trees
  { x: 735, y: 60, type: 'oak', r: 24 },
  { x: 770, y: 60, type: 'blossom', r: 24 },
  { x: 830, y: 60, type: 'oak', r: 24 },
  { x: 865, y: 60, type: 'blossom', r: 24 },

  // Bottom garden divider trees
  { x: 735, y: 940, type: 'blossom', r: 24 },
  { x: 770, y: 940, type: 'blossom', r: 24 },
  { x: 830, y: 940, type: 'oak', r: 24 },
  { x: 865, y: 940, type: 'oak', r: 24 },

  // Plaza perimeter trees
  { x: 535, y: 240, type: 'pine', r: 24 },
  { x: 540, y: 395, type: 'pine', r: 22 },
  { x: 1060, y: 395, type: 'pine', r: 22 },
  { x: 540, y: 670, type: 'pine', r: 22 },
  { x: 1060, y: 670, type: 'pine', r: 22 },
  { x: 580, y: 335, type: 'oak', r: 18 },
  { x: 1020, y: 335, type: 'oak', r: 18 },
];

const CAMPUS_LAMPS = [
  { x: 580, y: 395 }, { x: 1020, y: 395 },
  { x: 580, y: 705 }, { x: 1020, y: 705 },
  { x: 470, y: 312 }, { x: 1130, y: 312 },
  { x: 470, y: 788 }, { x: 1130, y: 788 },
  { x: 620, y: 312 }, { x: 980, y: 312 },
  { x: 620, y: 788 }, { x: 980, y: 788 },
];

const CAMPUS_FOUNTAINS = [
  { x: 755, y: 505, r: 35 },
  { x: 845, y: 505, r: 35 },
  { x: 755, y: 595, r: 35 },
  { x: 845, y: 595, r: 35 },
];

/** 1. Lush grass grounds with subtle stippling */
export function drawCampusGrass(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  s: number,
): void {
  // Vibrant green garden grass gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#537d38');
  grad.addColorStop(0.5, '#5c873f');
  grad.addColorStop(1, '#4f7535');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle grass texture
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  for (let i = 0; i < width; i += 32 * s) {
    for (let j = 0; j < height; j += 32 * s) {
      if ((Math.round(i + j)) % 64 === 0) {
        ctx.fillRect(i + 4 * s, j + 8 * s, 3 * s, 4 * s);
        ctx.fillRect(i + 18 * s, j + 20 * s, 2 * s, 3 * s);
      }
    }
  }
}

/** 2. Paved concrete walkways */
export function drawCampusWalkways(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.save();
  ctx.fillStyle = '#e2e8f0';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5 * s;

  // Outer Perimeter Path Loop (extended to connect to Coworking rooms)
  ctx.fillRect(280 * s, 290 * s, 1040 * s, 44 * s);
  ctx.strokeRect(280 * s, 290 * s, 1040 * s, 44 * s);

  ctx.fillRect(280 * s, 766 * s, 1040 * s, 44 * s);
  ctx.strokeRect(280 * s, 766 * s, 1040 * s, 44 * s);

  ctx.fillRect(480 * s, 290 * s, 44 * s, 520 * s);
  ctx.strokeRect(480 * s, 290 * s, 44 * s, 520 * s);

  ctx.fillRect(1076 * s, 290 * s, 44 * s, 520 * s);
  ctx.strokeRect(1076 * s, 290 * s, 44 * s, 520 * s);

  // Connector branches into Meeting Rooms
  ctx.fillRect(400 * s, 395 * s, 82 * s, 44 * s);
  ctx.fillRect(400 * s, 635 * s, 82 * s, 44 * s);
  ctx.fillRect(1118 * s, 395 * s, 84 * s, 44 * s);
  ctx.fillRect(1118 * s, 635 * s, 84 * s, 44 * s);

  // Connector branches into Focus Pods
  ctx.fillRect(575 * s, 260 * s, 60 * s, 32 * s);
  ctx.fillRect(965 * s, 260 * s, 60 * s, 32 * s);
  ctx.fillRect(575 * s, 808 * s, 60 * s, 34 * s);
  ctx.fillRect(965 * s, 808 * s, 60 * s, 34 * s);

  // Connector branches to Outdoor Garden Dining Areas
  ctx.fillRect(180 * s, 535 * s, 302 * s, 55 * s);
  ctx.fillRect(1118 * s, 535 * s, 290 * s, 55 * s);
  ctx.fillRect(785 * s, 25 * s, 40 * s, 267 * s);
  ctx.fillRect(785 * s, 808 * s, 40 * s, 265 * s);

  // Central Plaza (Grand Fountain Square)
  ctx.fillStyle = '#eceff1';
  ctx.fillRect(590 * s, 375 * s, 420 * s, 350 * s);
  ctx.strokeRect(590 * s, 375 * s, 420 * s, 350 * s);

  // Entrances into plaza
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(778 * s, 334 * s, 44 * s, 42 * s);
  ctx.fillRect(778 * s, 724 * s, 44 * s, 43 * s);
  ctx.fillRect(524 * s, 528 * s, 67 * s, 44 * s);
  ctx.fillRect(1009 * s, 528 * s, 68 * s, 44 * s);

  ctx.restore();
}

/** 3. 4 Tiered Water Fountains + Modular Plush Sofas */
export function drawCampusFountainsAndPlaza(
  ctx: CanvasRenderingContext2D,
  s: number,
  now: number,
): void {
  ctx.save();
  const animTime = now * 0.001;

  // 4 Fountains in 2x2 grid
  CAMPUS_FOUNTAINS.forEach((f, idx) => {
    const fx = f.x * s;
    const fy = f.y * s;
    const fr = f.r * s;

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.arc(fx + 3 * s, fy + 6 * s, fr + 3 * s, 0, Math.PI * 2);
    ctx.fill();

    // Outer Stone Lip
    const stoneGrad = ctx.createLinearGradient(fx - fr, fy - fr, fx + fr, fy + fr);
    stoneGrad.addColorStop(0, '#ffffff');
    stoneGrad.addColorStop(0.5, '#e2e8f0');
    stoneGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = stoneGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // Water Basin
    const waterGrad = ctx.createRadialGradient(fx, fy, 4 * s, fx, fy, fr - 4 * s);
    waterGrad.addColorStop(0, '#38bdf8');
    waterGrad.addColorStop(0.5, '#0284c7');
    waterGrad.addColorStop(1, '#0369a1');
    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, fr - 5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Animated water ripples
    const ripple1 = (animTime * 1.5 + idx * 0.8) % 1;
    const ripple2 = (animTime * 1.5 + idx * 0.8 + 0.5) % 1;

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - ripple1)})`;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.arc(fx, fy, 6 * s + ripple1 * (fr - 12 * s), 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - ripple2)})`;
    ctx.beginPath();
    ctx.arc(fx, fy, 6 * s + ripple2 * (fr - 12 * s), 0, Math.PI * 2);
    ctx.stroke();

    // Middle tier pedestal & water
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(fx, fy, 16 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(fx, fy, 12 * s, 0, Math.PI * 2);
    ctx.fill();

    // Center fountain jet nozzle
    ctx.fillStyle = '#f0f9ff';
    ctx.beginPath();
    ctx.arc(fx, fy, 4 * s, 0, Math.PI * 2);
    ctx.fill();
  });

  // Sky-Blue Plush Modular Sofas Surrounding Fountains
  const sofas = [
    { x: 630, y: 395, w: 70, h: 28, dir: 'S' },
    { x: 865, y: 395, w: 70, h: 28, dir: 'S' },
    { x: 630, y: 677, w: 70, h: 28, dir: 'N' },
    { x: 865, y: 677, w: 70, h: 28, dir: 'N' },
    { x: 605, y: 445, w: 28, h: 65, dir: 'E' },
    { x: 605, y: 590, w: 28, h: 65, dir: 'E' },
    { x: 967, y: 445, w: 28, h: 65, dir: 'W' },
    { x: 967, y: 590, w: 28, h: 65, dir: 'W' },
  ];

  sofas.forEach((sofa) => {
    const sx = sofa.x * s;
    const sy = sofa.y * s;
    const sw = sofa.w * s;
    const sh = sofa.h * s;

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    roundRect(ctx, sx + 2 * s, sy + 4 * s, sw, sh, 6 * s);
    ctx.fill();

    // Plush sky-blue base
    ctx.fillStyle = '#bae6fd';
    roundRect(ctx, sx, sy, sw, sh, 6 * s);
    ctx.fill();
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // Cushion accents
    ctx.fillStyle = '#e0f2fe';
    if (sofa.dir === 'S' || sofa.dir === 'N') {
      ctx.fillRect(sx + 4 * s, sy + 4 * s, (sw - 12 * s) / 2, sh - 8 * s);
      ctx.fillRect(sx + 4 * s + (sw - 12 * s) / 2 + 4 * s, sy + 4 * s, (sw - 12 * s) / 2, sh - 8 * s);
    } else {
      ctx.fillRect(sx + 4 * s, sy + 4 * s, sw - 8 * s, (sh - 12 * s) / 2);
      ctx.fillRect(sx + 4 * s, sy + 4 * s + (sh - 12 * s) / 2 + 4 * s, sw - 8 * s, (sh - 12 * s) / 2);
    }
  });

  // White planters between sofas
  const planters = [
    { x: 720, y: 405 }, { x: 845, y: 405 },
    { x: 720, y: 685 }, { x: 845, y: 685 },
    { x: 615, y: 535 }, { x: 975, y: 535 },
  ];
  planters.forEach((p) => {
    const px = p.x * s;
    const py = p.y * s;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, px - 7 * s, py - 7 * s, 14 * s, 14 * s, 3 * s);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(px, py - 1 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

/** 4. Outdoor Garden Dining Sets */
export function drawCampusOutdoorGardens(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.save();

  // West Garden: Teak Picnic Table
  drawPicnicTable(ctx, 200 * s, 535 * s, 120 * s, 54 * s, s);

  // East Garden: Matching Teak Picnic Table
  drawPicnicTable(ctx, 1280 * s, 535 * s, 120 * s, 54 * s, s);

  // North & South Patio Sets (round table + umbrella + 2 chairs)
  drawPatioSet(ctx, 800 * s, 30 * s, s);
  drawPatioSet(ctx, 800 * s, 1020 * s, s);

  ctx.restore();
}

function drawPicnicTable(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
): void {
  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(x + 3 * s, y + 5 * s, w, h);

  // Teak wood top
  ctx.fillStyle = '#d4a373';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#b08968';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(x, y, w, h);

  // Wood slats
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  for (let py = y + 11 * s; py < y + h; py += 11 * s) {
    ctx.beginPath();
    ctx.moveTo(x, py);
    ctx.lineTo(x + w, py);
    ctx.stroke();
  }

  // 6 White dining chairs
  for (let i = 0; i < 3; i++) {
    drawCampusChair(ctx, x + (18 + i * 36) * s, y - 14 * s, 18 * s, 14 * s, s, '#ffffff', '#e2e8f0');
    drawCampusChair(ctx, x + (18 + i * 36) * s, y + h + 2 * s, 18 * s, 14 * s, s, '#ffffff', '#e2e8f0');
  }
  // 2 Folding end chairs
  drawCampusChair(ctx, x - 16 * s, y + 18 * s, 14 * s, 18 * s, s, '#ffffff', '#e2e8f0');
  drawCampusChair(ctx, x + w + 2 * s, y + 18 * s, 14 * s, 18 * s, s, '#ffffff', '#e2e8f0');
}

function drawCampusChair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
  fill: string,
  stroke: string,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  roundRect(ctx, x + 1 * s, y + 2 * s, w, h, 3 * s);
  ctx.fill();

  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, 3 * s);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawPatioSet(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  // 2 Dark garden chairs
  drawCampusChair(ctx, cx - 34 * s, cy - 8 * s, 18 * s, 18 * s, s, '#334155', '#1e293b');
  drawCampusChair(ctx, cx + 16 * s, cy - 8 * s, 18 * s, 18 * s, s, '#334155', '#1e293b');

  // Round Table
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.arc(cx + 2 * s, cy + 3 * s, 20 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(cx, cy, 20 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.stroke();

  // Center umbrella hub
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.arc(cx, cy, 5 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** 5. Conifer Pines, Round Oaks, and Pink Cherry Blossoms */
export function drawCampusTrees(ctx: CanvasRenderingContext2D, s: number): void {
  CAMPUS_TREES.forEach((t) => {
    ctx.save();
    const tx = t.x * s;
    const ty = t.y * s;
    const tr = t.r * s;

    // Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.ellipse(tx + 4 * s, ty + 6 * s, tr + 2 * s, tr * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    if (t.type === 'pine') {
      // 3-Tier Layered Conical Pine
      const tiers = [
        { yOff: 0, r: tr },
        { yOff: -10 * s, r: tr * 0.78 },
        { yOff: -18 * s, r: tr * 0.52 },
      ];
      tiers.forEach((tier) => {
        const grad = ctx.createLinearGradient(tx - tier.r, ty + tier.yOff - tier.r, tx + tier.r, ty + tier.yOff + tier.r);
        grad.addColorStop(0, '#2dd4bf');
        grad.addColorStop(0.5, '#0f766e');
        grad.addColorStop(1, '#115e59');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(tx, ty + tier.yOff, tier.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.stroke();
      });
    } else if (t.type === 'blossom') {
      // Pink Cherry Blossom Tree
      const grad = ctx.createRadialGradient(tx - 4 * s, ty - 6 * s, 4 * s, tx, ty, tr);
      grad.addColorStop(0, '#f472b6');
      grad.addColorStop(0.6, '#db2777');
      grad.addColorStop(1, '#9d174d');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(tx, ty, tr, 0, Math.PI * 2);
      ctx.fill();

      // Blossom cluster petals
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(tx - 6 * s, ty - 5 * s, 5 * s, 0, Math.PI * 2);
      ctx.arc(tx + 7 * s, ty - 4 * s, 4.5 * s, 0, Math.PI * 2);
      ctx.arc(tx + 1 * s, ty + 6 * s, 5 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Deciduous Round Oak Tree
      const grad = ctx.createRadialGradient(tx - 5 * s, ty - 8 * s, 4 * s, tx, ty, tr);
      grad.addColorStop(0, '#86efac');
      grad.addColorStop(0.6, '#22c55e');
      grad.addColorStop(1, '#15803d');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(tx, ty, tr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.stroke();
    }

    ctx.restore();
  });
}

/** 6. Black Iron Streetlamps with Spherical Milk-Glass Globes */
export function drawCampusStreetLamps(ctx: CanvasRenderingContext2D, s: number): void {
  CAMPUS_LAMPS.forEach((l) => {
    ctx.save();
    const lx = l.x * s;
    const ly = l.y * s;

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(lx + 2 * s, ly + 4 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Black post base
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(lx, ly, 4.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Spherical milk-glass glowing globe
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(lx, ly, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.restore();
  });
}

/** 7. Specific Furniture for Campus Rooms */
export function drawCampusFurniture(
  ctx: CanvasRenderingContext2D,
  zoneName: string,
  type: string,
  X: number,
  Y: number,
  W: number,
  H: number,
  s: number,
): void {
  const zn = zoneName.toLowerCase();

  // Coworking desk pods
  if (zn.includes('coworking')) {
    if (zn.includes('north-west') || zn.includes('north-east')) {
      drawDeskWorkbench(ctx, X + 50 * s, Y + 40 * s, 160 * s, 42 * s, 3, s);
      drawDeskWorkbench(ctx, X + 80 * s, Y + 140 * s, 220 * s, 68 * s, 6, s);
    } else {
      drawDeskWorkbench(ctx, X + 60 * s, Y + 60 * s, 240 * s, 68 * s, 6, s);
    }

    // Floats & features per quadrant
    if (zn.includes('north-west')) {
      drawDonutFloat(ctx, X + 50 * s, Y + 180 * s, s);
    } else if (zn.includes('north-east')) {
      drawFlamingoFloat(ctx, X + 70 * s, Y + 175 * s, s);
    } else if (zn.includes('south-west')) {
      drawUnicornFloat(ctx, X + 310 * s, Y + 175 * s, s);
      drawCorkboard(ctx, X + 80 * s, Y + 15 * s, 80 * s, 20 * s, s);
    } else if (zn.includes('south-east')) {
      drawDuckFloat(ctx, X + 240 * s, Y + 160 * s, s);
      drawCorkboard(ctx, X + 80 * s, Y + 15 * s, 80 * s, 20 * s, s);

      // Cozy corner: circular gray rug + sleeping puppy + loveseat couch
      const rugX = X + 310 * s;
      const rugY = Y + 170 * s;
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(rugX, rugY, 44 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();

      // Blue loveseat couch
      ctx.fillStyle = '#93c5fd';
      roundRect(ctx, rugX - 30 * s, rugY - 36 * s, 60 * s, 24 * s, 6 * s);
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.stroke();

      // Sleeping golden puppy
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(rugX + 16 * s, rugY + 14 * s, 10 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rugX + 22 * s, rugY + 9 * s, 6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(rugX + 24 * s, rugY + 7 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 1-to-1 Focus Pods
  else if (zn.includes('focus') || type === 'focus') {
    const cx = X + W / 2;
    const cy = Y + H / 2 + 10 * s;

    // Dual black club armchairs
    drawClubArmchair(ctx, cx - 38 * s, cy - 14 * s, s);
    drawClubArmchair(ctx, cx + 14 * s, cy - 14 * s, s);

    // Round coffee table
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.arc(cx + 1 * s, cy + 2 * s, 12 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 12 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();
  }

  // Meeting Suites
  else if (zn.includes('meeting') || type === 'meeting') {
    const cx = X + W / 2;
    const cy = Y + H / 2 + 5 * s;
    const tw = 140 * s;
    const th = 48 * s;

    // Table shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    roundRect(ctx, cx - tw / 2 + 3 * s, cy - th / 2 + 5 * s, tw, th, 16 * s);
    ctx.fill();

    // White rounded conference table
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cx - tw / 2, cy - th / 2, tw, th, 16 * s);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    // Center floral plant
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(cx, cy, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(cx, cy, 3 * s, 0, Math.PI * 2);
    ctx.fill();

    // 8 Sky-blue conference chairs
    for (let i = 0; i < 3; i++) {
      drawCampusChair(ctx, cx - tw / 2 + (25 + i * 40) * s, cy - th / 2 - 14 * s, 20 * s, 14 * s, s, '#93c5fd', '#60a5fa');
      drawCampusChair(ctx, cx - tw / 2 + (25 + i * 40) * s, cy + th / 2 + 2 * s, 20 * s, 14 * s, s, '#93c5fd', '#60a5fa');
    }
    drawCampusChair(ctx, cx - tw / 2 - 16 * s, cy - 8 * s, 14 * s, 18 * s, s, '#93c5fd', '#60a5fa');
    drawCampusChair(ctx, cx + tw / 2 + 2 * s, cy - 8 * s, 14 * s, 18 * s, s, '#93c5fd', '#60a5fa');

    // Presentation whiteboard
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5 * s;
    ctx.fillRect(X + W - 36 * s, Y + 18 * s, 26 * s, 14 * s);
    ctx.strokeRect(X + W - 36 * s, Y + 18 * s, 26 * s, 14 * s);
  }
}

function drawDeskWorkbench(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seats: number,
  s: number,
): void {
  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  roundRect(ctx, x + 2 * s, y + 4 * s, w, h, 6 * s);
  ctx.fill();

  // White desk surface
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, w, h, 6 * s);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();

  const cols = seats === 3 ? 3 : Math.ceil(seats / 2);
  const colW = w / cols;

  for (let i = 0; i < cols; i++) {
    const px = x + i * colW + colW / 2;
    if (seats === 3) {
      drawSilverLaptop(ctx, px - 7 * s, y + 14 * s, s);
      drawCampusChair(ctx, px - 9 * s, y - 12 * s, 18 * s, 12 * s, s, '#93c5fd', '#60a5fa');
    } else {
      drawSilverLaptop(ctx, px - 7 * s, y + 10 * s, s);
      drawCampusChair(ctx, px - 9 * s, y - 12 * s, 18 * s, 12 * s, s, '#93c5fd', '#60a5fa');

      drawSilverLaptop(ctx, px - 7 * s, y + h - 22 * s, s);
      drawCampusChair(ctx, px - 9 * s, y + h + 2 * s, 18 * s, 12 * s, s, '#93c5fd', '#60a5fa');
    }
  }
}

function drawSilverLaptop(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#64748b';
  ctx.fillRect(x, y + 6 * s, 14 * s, 5 * s);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(x + 1 * s, y, 12 * s, 6 * s);
}

function drawClubArmchair(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  roundRect(ctx, x + 2 * s, y + 4 * s, 24 * s, 24 * s, 5 * s);
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  roundRect(ctx, x, y, 24 * s, 24 * s, 5 * s);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#334155';
  roundRect(ctx, x + 4 * s, y + 4 * s, 16 * s, 16 * s, 3 * s);
  ctx.fill();
}

function drawCorkboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
): void {
  ctx.fillStyle = '#b45309';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#d97706';
  ctx.fillRect(x + 2 * s, y + 2 * s, w - 4 * s, h - 4 * s);

  ctx.fillStyle = '#fef08a';
  ctx.fillRect(x + 6 * s, y + 5 * s, 8 * s, 8 * s);
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(x + 18 * s, y + 5 * s, 8 * s, 8 * s);
  ctx.fillStyle = '#67e8f9';
  ctx.fillRect(x + 30 * s, y + 5 * s, 8 * s, 8 * s);
}

function drawDonutFloat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  ctx.beginPath();
  ctx.arc(x + 2 * s, y + 3 * s, 16 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fbcfe8';
  ctx.beginPath();
  ctx.arc(x, y, 16 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(x, y, 13 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e8dcc8';
  ctx.beginPath();
  ctx.arc(x, y, 6 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 8 * s, y - 4 * s, 2 * s, 3 * s);
  ctx.fillRect(x + 5 * s, y - 6 * s, 2 * s, 3 * s);
  ctx.fillRect(x - 2 * s, y + 7 * s, 3 * s, 2 * s);
  ctx.restore();
}

function drawFlamingoFloat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.fillStyle = '#fda4af';
  ctx.beginPath();
  ctx.arc(x, y, 14 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8dcc8';
  ctx.beginPath();
  ctx.arc(x, y, 5 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(x - 12 * s, y - 8 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(x - 16 * s, y - 8 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawUnicornFloat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 14 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8dcc8';
  ctx.beginPath();
  ctx.arc(x, y, 5 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + 12 * s, y - 8 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.moveTo(x + 14 * s, y - 12 * s);
  ctx.lineTo(x + 19 * s, y - 18 * s);
  ctx.lineTo(x + 17 * s, y - 10 * s);
  ctx.fill();
  ctx.restore();
}

function drawDuckFloat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(x, y, 14 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8dcc8';
  ctx.beginPath();
  ctx.arc(x, y, 5 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(x - 11 * s, y - 6 * s, 7 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(x - 16 * s, y - 5 * s, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
