# NOTAS — Carrera de seleccionador (E11)

Bitácora de decisiones/dudas de la rama `claude/seleccion-976222`. Resuelvo dudas aquí y sigo (doctrina autónoma).

## Alcance (issue/backlog)
1. Modelo de clasificación de selecciones sobre motor liga/knockout existente. Determinista por seed.
2. Carrera de seleccionador: convocatorias, amistosos, clasificación y clasificar (o no) al torneo final; engancha con `runTournament` (torneos sueltos).
3. Continuidad entre ediciones (siguiente ciclo) + persistencia versionada con round-trip.
4. Pantalla: extender `ui/screens/TournamentScreen.tsx` (la poseo).

## Propiedad (para no pisar a otros agentes)
- POSEO: `game/tournament/*`, NUEVO `game/career/seleccion.ts`, `ui/screens/TournamentScreen.tsx`.
- Hook quirúrgico en `game/career/index.ts` (una línea `export * from './seleccion'`). Anotado: el frente multiliga también roza ese índice.
- NO toco `game/save/save.ts` (no es mío y es infra compartida). Ver decisión de serialización.

## Decisiones de diseño
- **`seleccion.ts` es PURO** (como el resto de `/engine` y `/game`): recibe el `pool: CompetitionTeam[]` como entrada; el store carga el DB (`loadSeleccionEuro2000/98`) y mapea con `toCompetitionTeam`. Así es testeable con equipos sintéticos, igual que `tournament.test.ts`.
- **Modelo de clasificación**: pool completo del DB (euro=51, mundial=68 selecciones). `Q = F/2` grupos de clasificación (F = plazas del torneo final = `numGroups*4`: euro 16→Q=8, mundial 32→Q=16). Reparto equilibrado (grupos difieren ≤1). Doble vuelta (ida/vuelta) con `buildCalendar`+`simulateFixture`+`computeStandings`. **Clasifican los 2 primeros de cada grupo** → exactamente F selecciones. Humano clasifica si acaba 1º o 2º de su grupo.
  - *Faithful-but-pragmatic*: el Mundial real clasifica por confederaciones; aquí uso un único pool estilo UEFA para todas. Futuro: pots/bombos por fuerza y confederaciones. Anotado como refinamiento.
- **Fase final**: reutiliza `runTournament(qualified, finalsSeed, numGroups, humanId)` sobre las selecciones que CLASIFICARON (no los finalistas históricos fijos). El modo torneo suelto sigue usando los finalistas históricos por separado (no lo toco).
- **Convocatorias**: el DB ya trae plantillas de ~22. La convocatoria = elegir formación (+ XI opcional) de tu selección, guardada como `tactics` (reutiliza `CareerTactics`) y aplicada a tu `CompetitionTeam` en TODOS tus partidos (amistosos, clasificación, final). Mejor XI/formación → mejores resultados.
- **Amistosos**: 2 partidos de preparación antes de la clasificación, contra rivales sorteados del pool (deterministas). No afectan a la clasificación; sirven de calentamiento y teletipo.
- **Edición determinista**: `buildEdition(pool, tournamentId, humanNationId, seed, cycle, tactics)` es pura y devuelve la edición completa (amistosos + grupo + clasificado + final + puesto). La `phase` sólo controla cuánto revela la UI.
- **Seeds**: base de edición `hashSeed(seed,'seleccion',cycle)`; derivados `'q-draw'`, `'q-group',i`, `'friendly',i`, `'finals'`.

## Serialización (decisión sobre "reutiliza serializeCareer/restoreCareer")
- La `CareerState` de club está atada a una liga concreta; meter la carrera de selección ahí sería forzado y chocaría con `game/save/save.ts` (ajeno). 
- **Interpretación**: reutilizo el *patrón/disciplina* de `serializeCareer/restoreCareer` (snapshot pequeño + Zod versionado + replay determinista + test round-trip), implementado en MI módulo `seleccion.ts` como `serializeSeleccion/restoreSeleccion`.
- Payload mínimo: `{version, seed, humanNationId, tournamentId, cycle, phase, tactics, history[], palmares[]}`. La edición en curso se re-deriva con `buildEdition`. `history`/`palmares` se persisten explícitos (como el club persiste `history`/`palmares`, no los re-deriva). Round-trip test incluido.

## Pendiente/ideas futuras (no en este PR)
- Bombos/pots por fuerza en el sorteo de clasificación; repesca (play-offs) de mejores segundos.
- Confederaciones reales para el Mundial.
- Selección del XI jugador a jugador en la UI (de momento, formación).
