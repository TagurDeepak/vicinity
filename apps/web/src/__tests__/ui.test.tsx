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
});
