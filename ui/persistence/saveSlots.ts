import type { AnySave } from '@game';

/**
 * localStorage-backed save slots. Lives in /ui because localStorage is a browser
 * API; the save payload itself comes from the pure `game/save` layer. A slot may
 * hold either a v1 season save or a v2 career snapshot (`AnySave`).
 */
const NUM_SLOTS = 3;
const key = (slot: number): string => `pcf.save.${slot}`;

export interface SlotInfo {
  slot: number;
  save: AnySave;
  savedAt: number;
}

export function slotCount(): number {
  return NUM_SLOTS;
}

export function readSlot(slot: number): SlotInfo | null {
  try {
    const raw = localStorage.getItem(key(slot));
    if (!raw) return null;
    return JSON.parse(raw) as SlotInfo;
  } catch {
    return null;
  }
}

export function listSlots(): Array<SlotInfo | null> {
  return Array.from({ length: NUM_SLOTS }, (_, i) => readSlot(i + 1));
}

export function writeSlot(slot: number, save: AnySave, now: number): SlotInfo {
  const info: SlotInfo = { slot, save, savedAt: now };
  localStorage.setItem(key(slot), JSON.stringify(info));
  return info;
}

export function deleteSlot(slot: number): void {
  localStorage.removeItem(key(slot));
}
