# PCFUTBOL ULTIMATE — Documento de Diseño (SPEC v0.3)

> Manager de fútbol para Android con estética retro años 90 y plantillas históricas de la saga (temporadas clásicas, p. ej. 96/97; objetivo: 93/94→actualidad).
> **Mashup de toda la saga futbolística de Dinamic Multimedia**: PC Fútbol (1.0→2001),
> PC Calcio, PC Premier y PC Selección — lo mejor de cada título, replicando
> mecánicas e ideas (nunca assets, gráficos ni código originales).
> Este documento es la fuente de verdad de los agentes de desarrollo.

**Changelog v0.3**: se elimina el enfoque MVP — el objetivo es el JUEGO COMPLETO en v1.0. Los hitos pasan a ser internos (orden de construcción), no releases recortadas.
**Changelog v0.2**: enfoque mashup multi-título; arquitectura multi-competición; visor 2D; carpeta `research/`.

---

## 1. Filosofía de diseño

1. **Retro en la piel, moderno en los huesos**: estética 90s (paleta, tipografía pixelada, sonido) pero UX pensada para táctil: botones grandes, navegación por gestos, sin dobles clics ni menús profundos.
2. **Mecánicas, no copias**: replicamos ideas de diseño documentadas en `research/`; el código es original. Uso de assets originales de la saga: ver `ASSETS.md` (decisión del propietario).
3. **Motor agnóstico de competición**: aunque el MVP es la liga española, el engine se diseña desde el día 1 para cualquier liga, copa o torneo de selecciones. Añadir Italia debe ser añadir datos, no reescribir código.
4. **Datos abiertos**: todo en `/data/*.json`, editable a mano. Actualizar temporada = editar JSON.
5. **Siempre jugable**: cada versión se puede jugar de principio a fin de temporada.

## 2. Herencia por título (resumen; detalle en `research/`)

| Título | Qué aporta al mashup |
|---|---|
| PC Fútbol 5.0 | ProManager (gestión deportiva+económica, despidos, ofertas), estructura de menús, entrenamientos |
| PC Fútbol 6/7/2001 | Profundidad económica (estadio, socios, TV), cesiones y cláusulas, multidivisión |
| PC Calcio | Liga italiana; variantes tácticas defensivas |
| PC Premier | Liga inglesa; calendario congestionado y copas domésticas |
| PC Selección | Modo selecciones: clasificación, Eurocopa y Mundial, convocatorias |
| Saga (todos) | Narración teletipo + radio, visor 2D cenital, base de datos consultable, prensa |

La carpeta `research/` contendrá un documento por título (modos, mecánicas, pantallas, qué adoptamos y qué no). Los agentes DEBEN consultarla antes de implementar una mecánica.

## 3. Alcance: JUEGO COMPLETO (v1.0)

No hay MVP ni releases recortadas. La v1.0 incluye TODO:
- **Ligas**: España (1ª y 2ª con ascensos/descensos), Italia (Serie A), Inglaterra (Premier), con sus copas domésticas (Copa del Rey, Coppa Italia, FA Cup)
- **Modos**: Liga simple, **ProManager** completo (economía, despidos, ofertas, estadio, cantera), **Selecciones** (fases de clasificación, Eurocopa, Mundial, convocatorias) y amistosos
- **Partido**: narración teletipo + visor 2D cenital + cambios y tácticas en vivo
- **Sistemas**: fichajes/cesiones/cláusulas, mercado internacional, entrenamientos, evolución y envejecimiento, lesiones y sanciones, prensa dinámica, histórico multi-temporada
- **Plataforma**: APK Android + navegador, guardado multi-ranura, estética retro completa con sonido

### Hitos internos de construcción (orden, no releases)
Los hitos H1→H6 marcan dependencias técnicas: los agentes trabajan las épicas en este orden porque el código lo exige, pero nada se considera "terminado" hasta que el juego completo está entero.
- **H1 Cimientos**: scaffolding, CI, tema retro, datos España
- **H2 Corazón**: engine de liga + partida jugable de temporada española
- **H3 Espectáculo**: teletipo + visor 2D
- **H4 ProManager**: economía completa, cantera, estadio, prensa
- **H5 Mundo**: Italia + Inglaterra + copas + mercado internacional
- **H6 Gloria**: selecciones, Eurocopa, Mundial, carrera total
Regla intacta: al cierre de cada hito el juego es jugable de principio a fin con lo construido hasta entonces (es la red de seguridad para "reparar después").

## 4. Arquitectura técnica

### 4.1 Stack
TypeScript + React + Vite; Capacitor → APK Android (y navegador); Zustand para estado; CSS propio con variables (tema retro, sin UI kits); Vitest. 100% offline, guardado local.

### 4.2 Módulos
```
/research   → documentos de diseño por título original (solo lectura para agentes)
/data       → esquemas Zod + JSON (ligas, clubes, jugadores, competiciones)
/engine     → TS puro sin React: simulador, calendario, competiciones, clasificación
/game       → partida: gestión, fichajes, evolución, guardado/carga
/ui         → React: pantallas, tema retro, visor 2D (canvas)
/app        → shell Capacitor, navegación
```
Regla dura: `/engine` y `/game` no importan React. UI = capa fina.

### 4.3 Modelo de datos (borrador)
```ts
Competition =
  | { kind: "league"; rounds: 2; promotion/relegation rules }
  | { kind: "cup"; knockout; ida/vuelta }
  | { kind: "tournament"; groups + knockout }   // v4

Player { id, nombre, edad, pos: POR|DEF|MED|DEL, media,
  atributos { calidad, agresividad, resistencia, velocidad, fisico,
              remate, ofensivo, pase, entrada, porteria },   // 10 attrs 0-99 (de PC Futbol 5.0)
  potencial?,   // techo por atributo (cantera/evolucion; opcional)
  forma(0-9), moral, cansancio, estado: OK|LES(sem)|SANC(part),
  clubId, ficha, valorMercado }

Club { id, nombre, colores, divisionId, presupuesto, plantilla[], estadio }
League { id, pais, divisiones[], calendario }
SaveGame { version, seed, clubJugador, temporada, historial[] }
```
Script `anonymize.ts` para generar nombres alternativos (uso personal = nombres reales OK; publicación = anonimizado).

### 4.4 Motor de partido
- Determinista por seed (testeable, reproducible)
- Ticks de 1 min; probabilidad de eventos según fuerza de líneas, forma, moral, localía, táctica
- Salida: `MatchEvent[]` (min, tipo, jugadores, posición en campo) — una sola fuente que alimenta AMBAS vistas:
  - **Teletipo**: narración de texto por evento (plantillas variadas en español)
  - **Visor 2D**: canvas cenital que interpola posiciones/animaciones a partir de los eventos (no es simulación física: es teatro del evento, como el original)
- Cambios y ajustes tácticos en vivo con pausa
- Calibración: ~2.6 goles/partido de media, sorpresas plausibles

### 4.5 UX móvil retro
- Pantallas completas tipo menú clásico, tipografía pixelada legible (mín. 14px equivalente)
- Zonas táctiles ≥ 48px; navegación: barra inferior retro + gesto atrás
- Modo vertical por defecto; visor 2D en horizontal opcional
- Sonido: clics, ambiente de estadio, música tracker en menús (toggle)
- `THEME.md` definirá paleta y componentes (pendiente)

## 5. Factoría
Ver `SETUP.md`. Flujo: issues `ready` → agente (Actions nocturno o night-shift local) → PR → CI (typecheck+lint+test+build) → auto-merge. `.github/**`, `SPEC.md` y `CLAUDE.md` protegidos por CODEOWNERS.

## 6. Épicas (full game)
1. **E0 Research**: documentos `research/` de toda la saga (PC Fútbol 3.0-2001, Calcio, Premier, Selección)
2. **E1 Fundaciones** (H1): scaffolding, CI, tema retro base, navegación
3. **E2 Datos España** (H1): esquemas, db 1ª+2ª de una temporada clásica (arranque: 96/97), validador
4. **E3 Engine Liga** (H2): calendario, simulador de eventos, clasificación, ascensos/descensos
5. **E4 Game Core** (H2): nueva partida, avance de jornada, fichajes, guardado
6. **E5 UI Core** (H2): menús, selección de equipo, jornada, clasificación, fichas
7. **E6 Partido** (H3): teletipo + visor 2D canvas + cambios en vivo
8. **E7 ProManager** (H4): economía, despidos/ofertas, estadio, cantera, evolución profunda
9. **E8 Prensa e histórico** (H4): titulares dinámicos, hemeroteca, palmarés multi-temporada
10. **E9 Copas** (H5): motor knockout, Copa del Rey y equivalentes
11. **E10 Multi-liga** (H5): datos Italia e Inglaterra, mercado internacional
12. **E11 Selecciones** (H6): convocatorias, clasificación, Eurocopa, Mundial, carrera total
13. **E12 Pulido** (H6): sonido, transiciones, rendimiento, APK firmada

## 7. Decisiones abiertas
- Nombre definitivo y logo
- ¿Base de datos inicial: generada a mano, o script de importación desde fuente abierta?
- Paleta y tipografía concretas (THEME.md)
