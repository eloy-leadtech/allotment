import { afterEach, describe, expect, it } from 'vitest';
import { getAudioManager, resetAudioManagerForTests } from './defaultManager';

describe('getAudioManager', () => {
  afterEach(() => resetAudioManagerForTests());

  it('hands out one engine for the whole page', () => {
    expect(getAudioManager()).toBe(getAudioManager());
  });

  it('is silent but safe where there is no Web Audio (jsdom)', () => {
    const manager = getAudioManager();
    expect(manager.supported).toBe(false);
    expect(() => manager.play('goal')).not.toThrow();
    expect(() => manager.startLoop('crowd')).not.toThrow();
  });

  it('can be reset, giving a fresh engine next time', () => {
    const first = getAudioManager();
    resetAudioManagerForTests();
    expect(getAudioManager()).not.toBe(first);
  });
});
