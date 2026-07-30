/**
 * Derive a stable 32-bit seed from an ordered list of parts (numbers/strings).
 *
 * Used to seed a match deterministically from stable inputs, e.g.
 * `hashSeed(leagueSeed, matchday, matchId)`, so a given fixture always plays out
 * the same way regardless of when or in what order it is simulated.
 *
 * Implementation: FNV-1a (32-bit) over the pipe-joined parts.
 */
export function hashSeed(...parts: ReadonlyArray<number | string>): number {
  const str = parts.map((part) => String(part)).join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x0100_0193);
  }
  return hash >>> 0;
}
