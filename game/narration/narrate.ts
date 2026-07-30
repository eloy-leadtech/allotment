import type { MatchEvent, MatchResult } from '@engine';

/** Turn one match event into a Spanish teletipo line. */
export function narrateEvent(event: MatchEvent, homeName: string, awayName: string): string {
  const team = event.team === 'home' ? homeName : awayName;
  switch (event.type) {
    case 'goal':
      return `${event.min}' GOL de ${event.playerName} (${team})`;
    case 'chance':
      return `${event.min}' Ocasion de ${event.playerName} (${team}), la despeja el portero`;
    case 'yellow':
      return `${event.min}' Tarjeta amarilla para ${event.playerName} (${team})`;
    case 'secondYellow':
      return `${event.min}' Segunda amarilla: ${event.playerName} (${team}) se va expulsado`;
    case 'red':
      return `${event.min}' Roja directa a ${event.playerName} (${team})`;
  }
}

/** Narrate a whole match as teletipo lines, closing with the final score. */
export function narrateMatch(result: MatchResult, homeName: string, awayName: string): string[] {
  const lines = result.events.map((event) => narrateEvent(event, homeName, awayName));
  lines.push(`FINAL: ${homeName} ${result.homeGoals}-${result.awayGoals} ${awayName}`);
  return lines;
}
