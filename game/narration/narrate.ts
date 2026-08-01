import type { MatchEvent, MatchResult } from '@engine';
import { hashSeed, derbyInfo } from '@engine';

/**
 * Deterministically pick one variant from a list, keyed on the event so replays
 * always read identically (no RNG involved — narration is a pure function of the
 * event). Different minute/player/type yield different phrasings.
 */
function variant(event: MatchEvent, variants: readonly string[]): string {
  const idx = hashSeed(event.type, event.min, event.playerId) % variants.length;
  return variants[idx] ?? variants[0] ?? '';
}

/** Turn one match event into a Spanish teletipo line. In a derbi the big beats
 * (goles) get a tenser phrasing; everything else reads the same. */
export function narrateEvent(
  event: MatchEvent,
  homeName: string,
  awayName: string,
  derby = false,
): string {
  const team = event.team === 'home' ? homeName : awayName;
  const p = event.playerName;
  switch (event.type) {
    case 'goal':
      return derby
        ? `${event.min}' GOOOL de ${event.playerName} (${team})! ¡Estalla el derbi!`
        : `${event.min}' GOL de ${event.playerName} (${team})`;
    case 'chance':
      return `${event.min}' Ocasion de ${event.playerName} (${team}), la despeja el portero`;
    case 'yellow':
      return `${event.min}' Tarjeta amarilla para ${event.playerName} (${team})`;
    case 'secondYellow':
      return `${event.min}' Segunda amarilla: ${event.playerName} (${team}) se va expulsado`;
    case 'red':
      return `${event.min}' Roja directa a ${event.playerName} (${team})`;
    case 'injury': {
      const n = event.matchesOut ?? 1;
      const jornadas = n === 1 ? '1 jornada' : `${n} jornadas`;
      return `${event.min}' Lesion de ${event.playerName} (${team}), baja ${jornadas}`;
    }
    // --- Eventos de sabor (no cambian el marcador) ---
    case 'saved':
      return `${event.min}' ${variant(event, [
        `Gran parada del portero al disparo de ${p} (${team})`,
        `Paradon! El meta ataja el remate de ${p} (${team})`,
        `${p} (${team}) prueba fortuna, pero el portero responde`,
        `Mano providencial del guardameta ante ${p} (${team})`,
      ])}`;
    case 'offTarget':
      return `${event.min}' ${variant(event, [
        `${p} (${team}) dispara alto, se marcha fuera`,
        `Ocasion fallada de ${p} (${team}), el balon se pierde por la banda`,
        `${p} (${team}) no acierta y el remate se va rozando el poste`,
        `La tuvo ${p} (${team}) pero manda el balon a las nubes`,
      ])}`;
    case 'post':
      return `${event.min}' ${variant(event, [
        `Al palo! El disparo de ${p} (${team}) se estrella en la madera`,
        `${p} (${team}) estrella el balon en el larguero`,
        `El poste salva al portero tras el remate de ${p} (${team})`,
      ])}`;
    case 'corner':
      return `${event.min}' ${variant(event, [
        `Saque de esquina para ${team} tras acoso de ${p}`,
        `Corner botado por ${team}, remata ${p}`,
        `Llega el balon a corner para ${team} (${p})`,
        `Presiona ${p} y ${team} fuerza un corner`,
      ])}`;
    case 'foul':
      return `${event.min}' ${variant(event, [
        `Falta de ${p} (${team}), el arbitro detiene el juego`,
        `Entrada dura de ${p} (${team}), llega la falta`,
        `${p} (${team}) corta con falta una jugada peligrosa`,
      ])}`;
  }
}

/** Narrate a whole match as teletipo lines, closing with the final score. When
 * the fixture is a derbi it opens with a tension banner and the goles read
 * tenser. Derby detection comes from the result flag, falling back to the team
 * ids so results built without the flag are still narrated correctly. */
export function narrateMatch(result: MatchResult, homeName: string, awayName: string): string[] {
  const info = derbyInfo(result.homeId, result.awayId);
  const derby = result.derby ?? info !== null;
  const lines: string[] = [];
  if (derby) {
    const name = info?.name ?? 'Derbi';
    lines.push(`DERBI - ${name}: ${homeName} vs ${awayName}, se masca la tension`);
  }
  for (const event of result.events) {
    lines.push(narrateEvent(event, homeName, awayName, derby));
  }
  lines.push(`FINAL: ${homeName} ${result.homeGoals}-${result.awayGoals} ${awayName}`);
  return lines;
}
