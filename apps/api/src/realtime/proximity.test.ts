import { UserStatus, type PresenceState } from '@vicinity/shared';
import { computeGroups } from './proximity';

function user(id: string, x: number, y: number, zoneId: string | null = null): PresenceState {
  return {
    userId: id,
    displayName: id,
    avatarUrl: null,
    status: UserStatus.Available,
    position: { x, y },
    zoneId,
  };
}

describe('computeGroups', () => {
  it('groups two nearby users into one conversation', () => {
    const groups = computeGroups([user('a', 0, 0), user('b', 50, 0)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.members).toEqual(['a', 'b']);
    expect(groups[0]!.mode).toBe('mesh');
  });

  it('does not group users beyond the proximity radius', () => {
    const groups = computeGroups([user('a', 0, 0), user('b', 1000, 0)]);
    expect(groups).toHaveLength(0);
  });

  it('promotes a large cluster to SFU mode', () => {
    const groups = computeGroups([
      user('a', 0, 0),
      user('b', 10, 0),
      user('c', 20, 0),
      user('d', 30, 0),
      user('e', 40, 0),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.mode).toBe('sfu');
    expect(groups[0]!.roomName).toBe(groups[0]!.groupId);
  });

  it('isolates users in an audio-isolated zone from nearby outsiders', () => {
    const isolated = new Set(['z1']);
    const groups = computeGroups(
      [user('a', 0, 0, 'z1'), user('b', 10, 0, null)],
      isolated,
    );
    // b is nearby but not in the isolated zone, so no conversation forms.
    expect(groups).toHaveLength(0);
  });

  it('connects two users inside the same isolated zone regardless of distance', () => {
    const isolated = new Set(['z1']);
    const groups = computeGroups(
      [user('a', 0, 0, 'z1'), user('b', 900, 900, 'z1')],
      isolated,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.members).toEqual(['a', 'b']);
  });
});
