# E13 — Puente PES6 (H7 Estadio)

EPIC: #99

> Objetivo: que el usuario juegue sus partidos en su copia original de Pro Evolution Soccer 6 y el resultado vuelva a la partida. La gestión (Mister, economía, fichajes) es nuestra; PES6 solo pone el partido.
> Diseño y reglas legales: `SPEC.md` §4.4 (ejecutores) y §4.6 (Puente PES6).

Cada issue es un PR pequeño en `feat/issue-<n>`. Orden: de menos a más riesgo. La fase A no toca código y puede ir en paralelo a otros hitos.

**Hito de prueba de vida (después de A4 + B5 + C4):** juegas un partido en PES6 a mano y su resultado aparece en la partida. Si eso funciona, el resto es trabajo; si no, se replantea antes de invertir más.

---

## Fase A — Investigación (`research/pes6/`, sin código de juego)

| # | Issue | Hecho cuando |
|---|---|---|
| A0 · #100 | **Instalación y versión** (propietario) | PES6 instalado desde el disco original y arranca en Windows 11. Documentados: versión del exe, hash SHA-256, ruta de instalación y ruta del option file. Si la protección del disco no arranca en Windows 11, se para aquí y se decide (no se elude la protección) |
| A1 · #101 | **Formato del option file** | `research/pes6/option-file.md`: cifrado/checksum, estructura de equipos, jugadores, alineaciones y tácticas. Partiendo de la documentación de la comunidad de mods y verificado contra el fichero real |
| A2 · #102 | **Atributos de PES6 y mapeo** | `research/pes6/atributos.md`: lista de atributos, rangos, posiciones, habilidades especiales. Propuesta de tabla PC Fútbol (10 atributos) → PES6 con ejemplos de jugadores conocidos |
| A3 · #103 | **Memoria del partido** | `research/pes6/memoria-partido.md`: en qué direcciones (para la versión de A0) están el marcador, el minuto, el estado del partido (en juego / terminado / abandonado), goleadores, tarjetas, lesiones y cambios. Método reproducible (Cheat Engine / x64dbg) |
| A4 · #104 | **Arranque al partido** | `research/pes6/arranque.md`: ¿se puede arrancar un partido concreto (inyección estilo Kitserver, solo como técnica de referencia) o hace falta el plan B con menú guiado? Recomendación con pros y contras |

## Fase B — Núcleo TS puro (`/bridge`, `/engine`, `/data`; con tests Vitest)

| # | Issue | Hecho cuando |
|---|---|---|
| B1 · #105 | **Contrato `MatchExecutor` + `MatchReport`** | Interfaz en `/engine`. El simulador actual pasa a ser `SimulatedExecutor` sin cambiar resultados (tests: mismo seed → mismo `MatchReport` que antes). El resto del juego solo consume `MatchReport` |
| B2 · #106 | **Codec del option file** | `/bridge/pes6/optionfile`: decode/encode + checksum según A1. Test de ida y vuelta con un fixture **sintético** (nunca el fichero real de Konami en el repo) |
| B3 · #107 | **Mapeo de atributos** | `/data/pes6-mapping.json` + esquema Zod + función pura `toPes6Player()`. Tests con jugadores de ejemplo |
| B4 · #108 | **Escritura de equipo** | Plantilla + alineación + táctica → bloques del option file, sobrescribiendo un "slot" de equipo de PES6. Tests sobre el fixture sintético |
| B5 · #109 | **Normalizador de resultado** | Estructura cruda leída de memoria (A3) → `MatchReport`. Tests con casos: victoria, empate, expulsión, lesión, abandono |

## Fase C — Escritorio (`/desktop`)

| # | Issue | Hecho cuando |
|---|---|---|
| C1 · #110 | **Shell de escritorio** | Electron (SPEC §4.1; dependencia justificada en el PR) abre la app actual sin cambios, con las reglas de seguridad del SPEC. Build de Windows en local y en CI |
| C2 · #111 | **Detectar PES6 + copia de seguridad** | El helper encuentra la instalación, comprueba la versión soportada (hash de A0) y hace copia de seguridad / restauración del option file. Nunca borra el original |
| C3 · #112 | **Lanzar y esperar** | Lanza PES6, detecta cuándo se cierra y avisa a la app |
| C4 · #113 | **Lector de resultado** | Lee de memoria lo documentado en A3 mientras PES6 está abierto y entrega la estructura cruda a B5 |
| C5 · #114 | **Arranque directo** (o plan B) | Implementa lo recomendado en A4 |

## Fase D — Integración en el juego (UI Mister)

| # | Issue | Hecho cuando |
|---|---|---|
| D1 · #115 | **"Jugar en PES6" en la previa** | Botón en la previa del partido, visible solo en escritorio con PES6 detectado. Pantalla de espera mientras se juega y vuelta con el resultado aplicado |
| D2 · #116 | **Fallos y abandonos** | Si PES6 se cierra, se cuelga o se abandona: elegir simular, repetir o dar por perdido. La partida y el option file quedan siempre intactos |
| D3 · #117 | **Ajustes del puente** | Ruta de PES6, duración y dificultad del partido, modo (siempre / preguntar / nunca) |
| D4 · #118 | **Prueba de punta a punta** | Checklist manual: temporada completa con varios partidos jugados en PES6 (liga, copa con prórroga/penaltis, expulsiones, lesiones) sin errores |

---

## Dependencias

```
A0 → A1 → B2 → B4 ─┐
A0 → A2 → B3 ──────┤
A0 → A3 → B5 → C4 ─┼→ C5 → D1 → D2 → D3 → D4
A0 → A4 ───────────┘
B1 (independiente, se puede empezar ya)
C1 → C2 → C3 → C4
```
