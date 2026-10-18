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
});
