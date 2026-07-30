import { describe, it, expect, beforeEach } from 'vitest';
import { listSlots, readSlot, writeSlot, deleteSlot, slotCount } from './saveSlots';
import type { SaveGame } from '@game';

const sample: SaveGame = {
  version: 1,
  leagueId: 'es-primera-9697',
  temporada: '96/97',
  seed: 12345,
  humanTeamId: 'barcelona',
  currentMatchday: 5,
};

describe('saveSlots', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', () => {
    expect(listSlots()).toEqual(new Array(slotCount()).fill(null));
  });

  it('writes and reads a slot round-trip', () => {
    writeSlot(1, sample, 1_700_000_000_000);
    const info = readSlot(1);
    expect(info?.save).toEqual(sample);
    expect(info?.savedAt).toBe(1_700_000_000_000);
  });

  it('lists occupied and empty slots', () => {
    writeSlot(2, sample, 1);
    const slots = listSlots();
    expect(slots[0]).toBeNull();
    expect(slots[1]?.save.humanTeamId).toBe('barcelona');
  });

  it('deletes a slot', () => {
    writeSlot(1, sample, 1);
    deleteSlot(1);
    expect(readSlot(1)).toBeNull();
  });

  it('tolerates corrupted data', () => {
    localStorage.setItem('pcf.save.1', '{not json');
    expect(readSlot(1)).toBeNull();
  });
});
