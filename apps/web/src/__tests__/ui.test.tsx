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
