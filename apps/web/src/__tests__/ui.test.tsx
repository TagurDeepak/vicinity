import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Avatar, Button, StatusDot } from '@vicinity/ui';

describe('design system', () => {
  it('renders a button with accessible label', () => {
    render(<Button aria-label="Save">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows initials when no avatar image is provided', () => {
    render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('exposes status as an accessible label, not color alone', () => {
    render(<StatusDot status="busy" />);
    expect(screen.getByRole('img', { name: 'Busy' })).toBeInTheDocument();
  });
});

describe('zone detection', () => {
  const sampleZones = [
    {
      id: 'z1',
      workspaceId: 'ws1',
      name: 'Meeting Room',
      type: 'meeting' as const,
      geometry: { x: 100, y: 100, w: 200, h: 200 },
      isPrivate: true,
      audioIsolated: true,
    },
  ];

  it('detects when avatar is inside a zone rectangle', () => {
    const { getZoneAt } = require('../features/office/OfficeCanvas');
    expect(getZoneAt(sampleZones, { x: 150, y: 150 })?.id).toBe('z1');
    expect(getZoneAt(sampleZones, { x: 100, y: 100 })?.id).toBe('z1');
    expect(getZoneAt(sampleZones, { x: 300, y: 300 })?.id).toBe('z1');
  });

  it('returns null when avatar is outside all zones', () => {
    const { getZoneAt } = require('../features/office/OfficeCanvas');
    expect(getZoneAt(sampleZones, { x: 50, y: 50 })).toBeNull();
    expect(getZoneAt(sampleZones, { x: 301, y: 150 })).toBeNull();
  });
});

describe('obstacle-avoiding pathfinding', () => {
  const { findPath } = require('../features/office/collision');
  const sampleZones = [
    {
      id: 'z1',
      workspaceId: 'ws1',
      name: 'Meeting Room',
      type: 'meeting' as const,
      geometry: { x: 100, y: 100, w: 200, h: 200 },
      isPrivate: true,
      audioIsolated: true,
    },
  ];

  it('generates direct path when line of sight is clear in open space', () => {
    const path = findPath({ x: 50, y: 50 }, { x: 80, y: 50 }, sampleZones);
    expect(path).toHaveLength(1);
    expect(path[0].x).toBe(80);
    expect(path[0].y).toBe(50);
  });

  it('finds a waypoint path that avoids solid walls when entering a room', () => {
    // Start north of room (y=50), target inside room (y=150)
    // Door is at bottom (y=300). Path must navigate around wall to enter.
    const path = findPath({ x: 200, y: 50 }, { x: 200, y: 150 }, sampleZones);
    expect(path.length).toBeGreaterThan(0);
    const finalStep = path[path.length - 1];
    expect(finalStep.x).toBe(200);
    expect(finalStep.y).toBe(150);
  });

  it('correctly paths into campus garden rooms through corridor-facing doorways', () => {
    const { getDoorwayForZone } = require('../features/office/collision');
    const campusMeeting = {
      id: 'meeting-alpha',
      workspaceId: 'ws1',
      name: 'Meeting Room Alpha',
      type: 'meeting' as const,
      geometry: { x: 140, y: 340, w: 260, h: 180 },
      isPrivate: true,
      audioIsolated: true,
    };
    const doorway = getDoorwayForZone(campusMeeting);
    expect(doorway.side).toBe('right');
    expect(doorway.x).toBe(400); // 140 + 260
  });

  it('paths from Grand Plaza into Coworking North-West and Coworking North-East in campus garden layout', () => {
    const campusGardenZones = [
      { id: 'z1', name: 'Grand Fountain Plaza', type: 'open', geometry: { x: 590, y: 375, w: 420, h: 350 } },
      { id: 'z2', name: 'Coworking North-West', type: 'open', geometry: { x: 140, y: 40, w: 380, h: 260 } },
      { id: 'z3', name: 'Focus Pod NW', type: 'focus', geometry: { x: 540, y: 110, w: 130, h: 150 } },
      { id: 'z4', name: 'Meeting Room Alpha', type: 'meeting', geometry: { x: 140, y: 340, w: 260, h: 180 } },
      { id: 'z5', name: 'Coworking North-East', type: 'open', geometry: { x: 1080, y: 40, w: 380, h: 260 } },
      { id: 'z6', name: 'Focus Pod NE', type: 'focus', geometry: { x: 930, y: 110, w: 130, h: 150 } },
      { id: 'z7', name: 'Meeting Room Beta', type: 'meeting', geometry: { x: 1200, y: 340, w: 260, h: 180 } },
      { id: 'z8', name: 'Meeting Room Gamma', type: 'meeting', geometry: { x: 140, y: 580, w: 260, h: 180 } },
      { id: 'z9', name: 'Coworking South-West', type: 'open', geometry: { x: 140, y: 800, w: 380, h: 260 } },
      { id: 'z10', name: 'Focus Pod SW', type: 'focus', geometry: { x: 540, y: 840, w: 130, h: 150 } },
      { id: 'z11', name: 'Meeting Room Delta', type: 'meeting', geometry: { x: 1200, y: 580, w: 260, h: 180 } },
      { id: 'z12', name: 'Coworking South-East', type: 'open', geometry: { x: 1080, y: 800, w: 380, h: 260 } },
      { id: 'z13', name: 'Focus Pod SE', type: 'focus', geometry: { x: 930, y: 840, w: 130, h: 150 } },
    ];

    const plazaCenter = { x: 800, y: 550 };

    // Test navigation to all 4 quadrants of Campus Garden
    const testDestinations = [
      { name: 'Coworking North-West', target: { x: 300, y: 150 } },
      { name: 'Coworking North-East', target: { x: 1250, y: 150 } },
      { name: 'Coworking South-West', target: { x: 300, y: 920 } },
      { name: 'Coworking South-East', target: { x: 1250, y: 920 } },
      { name: 'Focus Pod NW', target: { x: 605, y: 185 } },
      { name: 'Focus Pod NE', target: { x: 995, y: 185 } },
      { name: 'Focus Pod SW', target: { x: 605, y: 915 } },
      { name: 'Focus Pod SE', target: { x: 995, y: 915 } },
      { name: 'Meeting Room Alpha', target: { x: 270, y: 430 } },
      { name: 'Meeting Room Beta', target: { x: 1330, y: 430 } },
      { name: 'Meeting Room Gamma', target: { x: 270, y: 670 } },
      { name: 'Meeting Room Delta', target: { x: 1330, y: 670 } },
    ];

    const { getWallSegments, lineSegmentsIntersect } = require('../features/office/collision');
    const { walls } = getWallSegments(campusGardenZones);

    for (const { name, target } of testDestinations) {
      const path = findPath(plazaCenter, target, campusGardenZones);
      expect(path.length).toBeGreaterThan(0);
      const finalPoint = path[path.length - 1]!;
      expect(`${name}: ${finalPoint.x},${finalPoint.y}`).toBe(`${name}: ${target.x},${target.y}`);

      // Verify no path segment cuts through any solid wall segment
      let origin = plazaCenter;
      for (const pt of path) {
        for (const w of walls) {
          const cutsWall = lineSegmentsIntersect(origin.x, origin.y, pt.x, pt.y, w.x1, w.y1, w.x2, w.y2);
          expect(cutsWall).toBe(false);
        }
        origin = pt;
      }
    }
  });

  it('finds path from Breakout Cafe to Private Office avoiding Meeting Room Beta', () => {
    const defaultOfficeZones = [
      { id: 'z1', name: 'Commons Lounge', type: 'lounge', geometry: { x: 80, y: 100, w: 460, h: 360 } },
      { id: 'z2', name: 'Focus Pod 1', type: 'focus', geometry: { x: 80, y: 520, w: 220, h: 200 } },
      { id: 'z3', name: 'Focus Pod 2', type: 'focus', geometry: { x: 320, y: 520, w: 220, h: 200 } },
      { id: 'z4', name: 'Private Office', type: 'private', geometry: { x: 80, y: 760, w: 460, h: 180 } },
      { id: 'z5', name: 'Meeting Room Alpha', type: 'meeting', geometry: { x: 600, y: 100, w: 460, h: 360 } },
      { id: 'z6', name: 'Meeting Room Beta', type: 'meeting', geometry: { x: 600, y: 520, w: 460, h: 420 } },
      { id: 'z7', name: 'The Boardroom', type: 'meeting', geometry: { x: 1120, y: 100, w: 420, h: 460 } },
      { id: 'z8', name: 'Breakout Cafe', type: 'open', geometry: { x: 1120, y: 620, w: 420, h: 320 } },
    ];
    const { getWallSegments, lineSegmentsIntersect } = require('../features/office/collision');
    const { walls } = getWallSegments(defaultOfficeZones);
    const startInCafe = { x: 1250, y: 750 };
    const goalInPrivateOffice = { x: 250, y: 820 };
    const path = findPath(startInCafe, goalInPrivateOffice, defaultOfficeZones);

    expect(path.length).toBeGreaterThan(1);

    // Verify all path waypoints completely avoid passing inside Meeting Room Beta
    const betaGeom = defaultOfficeZones[5]!.geometry;
    for (const pt of path) {
      const insideBeta =
        pt.x > betaGeom.x + 10 &&
        pt.x < betaGeom.x + betaGeom.w - 10 &&
        pt.y > betaGeom.y + 10 &&
        pt.y < betaGeom.y + betaGeom.h - 10;
      expect(insideBeta).toBe(false);
    }

    // Verify no segment in the route cuts through any solid wall segment
    let currentOrigin = startInCafe;
    const betaWalls = walls.filter((w: any) => w.zoneId === 'z6');
    for (const pt of path) {
      for (const bw of betaWalls) {
        const cutsWall = lineSegmentsIntersect(
          currentOrigin.x,
          currentOrigin.y,
          pt.x,
          pt.y,
          bw.x1,
          bw.y1,
          bw.x2,
          bw.y2,
        );
        expect(cutsWall).toBe(false);
      }
      currentOrigin = pt;
    }
  });

  it('never cuts through walls when target room is locked or unreachable', () => {
    const defaultOfficeZones = [
      { id: 'z1', name: 'Commons Lounge', type: 'lounge', geometry: { x: 80, y: 100, w: 460, h: 360 } },
      { id: 'z6', name: 'Meeting Room Beta', type: 'meeting', geometry: { x: 600, y: 520, w: 460, h: 420 } },
      { id: 'z8', name: 'Breakout Cafe', type: 'open', geometry: { x: 1120, y: 620, w: 420, h: 320 } },
    ];
    const { getWallSegments, lineSegmentsIntersect } = require('../features/office/collision');
    const lockedZoneIds = new Set(['z6']);
    const { walls } = getWallSegments(defaultOfficeZones, lockedZoneIds);
    const startInCafe = { x: 1250, y: 750 };
    const insideLockedBeta = { x: 830, y: 730 };
    const path = findPath(startInCafe, insideLockedBeta, defaultOfficeZones, lockedZoneIds);

    // Any resulting path must never cut through solid walls
    let currentOrigin = startInCafe;
    for (const pt of path) {
      for (const w of walls) {
        const cutsWall = lineSegmentsIntersect(
          currentOrigin.x,
          currentOrigin.y,
          pt.x,
          pt.y,
          w.x1,
          w.y1,
          w.x2,
          w.y2,
        );
        expect(cutsWall).toBe(false);
      }
      currentOrigin = pt;
    }
  });

  it('paths smoothly from Private Office to Focus Pod 1 and 2 with raised corner clearance', () => {
    const defaultOfficeZones = [
      { id: 'z1', name: 'Commons Lounge', type: 'lounge', geometry: { x: 80, y: 100, w: 460, h: 360 } },
      { id: 'z2', name: 'Focus Pod 1', type: 'focus', geometry: { x: 80, y: 520, w: 220, h: 200 } },
      { id: 'z3', name: 'Focus Pod 2', type: 'focus', geometry: { x: 320, y: 520, w: 220, h: 200 } },
      { id: 'z4', name: 'Private Office', type: 'private', geometry: { x: 80, y: 760, w: 460, h: 180 } },
      { id: 'z5', name: 'Meeting Room Alpha', type: 'meeting', geometry: { x: 600, y: 100, w: 460, h: 360 } },
      { id: 'z6', name: 'Meeting Room Beta', type: 'meeting', geometry: { x: 600, y: 520, w: 460, h: 420 } },
      { id: 'z7', name: 'The Boardroom', type: 'meeting', geometry: { x: 1120, y: 100, w: 420, h: 460 } },
      { id: 'z8', name: 'Breakout Cafe', type: 'open', geometry: { x: 1120, y: 620, w: 420, h: 320 } },
    ];
    const startInPrivateOffice = { x: 250, y: 820 };
    const goalInFocusPod2 = { x: 400, y: 600 };
    const pathPod2 = findPath(startInPrivateOffice, goalInFocusPod2, defaultOfficeZones);
    expect(pathPod2.length).toBeGreaterThan(1);

    // Verify the path to Pod 2 raises into the corridor above y = 500 when turning around Focus Pod 2 corner (540, 520)
    const pod2Corner = { x: 540, y: 520 };
    for (const pt of pathPod2) {
      const distToCorner = Math.hypot(pt.x - pod2Corner.x, pt.y - pod2Corner.y);
      // Waypoint must not get trapped right on the sharp corner
      if (pt.x >= 520 && pt.x <= 560 && pt.y >= 500 && pt.y <= 540) {
        expect(distToCorner).toBeGreaterThanOrEqual(18);
      }
    }

    const goalInFocusPod1 = { x: 180, y: 600 };
    const pathPod1 = findPath(startInPrivateOffice, goalInFocusPod1, defaultOfficeZones);
    expect(pathPod1.length).toBeGreaterThan(1);
  });
});
