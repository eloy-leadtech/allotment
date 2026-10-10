# Sonido (`ui/audio`)

**TL;DR:** `<AudioProvider>` se monta UNA vez en `app/main.tsx`. Ninguna pantalla hace nada:
los clics, el partido en directo y el fin de jornada suenan solos.

## Qué suena y cuándo

| Evento | Sonido | De dónde sale |
|---|---|---|
| Clic en botón / enlace / pestaña | `click` (`confirm` si es `.retro-btn--primary`) | un listener delegado en `document` |
| Entrar en un partido en directo | `crowd` (ambiente en bucle) | `screen === 'match'` en el store |
| Gol / amarilla / roja / saque / final durante un partido | `goal` / `card-yellow` / `card-red` / `whistle-start` / `whistle-end` | reloj del marcador (`.sb__status`) + `viewingMatch.events` |
| Final del partido con victoria tuya | `cheer` | `viewingMatch` + `career.humanTeamId` |
| "Simular jornada" (sin ver partido) | `whistle-end` (+ `cheer` si ganas) | `lastResults` del store |

Un salto al final ("Ver resumen", botón "Final" del visor, `prefers-reduced-motion`) solo hace sonar el pitido final.

## Lo único frágil: el reloj del marcador

La pantalla de partido revela el partido beat a beat y no emite eventos. Para no tocarla, el director
lee su **marcador**: `.sb__status` muestra el minuto del último beat (`14'`) y al acabar `Final`. Con ese
minuto busca en `viewingMatch.events` (los eventos reales del motor) los que el reloj acaba de pasar y
dispara su sonido. Por eso suena igual con el teletipo, con el visor 2D, a cualquier velocidad, en pausa
(no hay minuto nuevo, no hay sonido) o saltando al final.

Si reestructuras `MatchScreen`, mantén ese reloj legible en el DOM. `matchScreen.contract.test.tsx`
monta la pantalla REAL con el store REAL y el director, y falla si el sonido se queda mudo.
`BEAT_CUES` está tipado con `EventType` del motor: renombrar un tipo de evento rompe `tsc`.

## Desde una pantalla (todo opcional)

- Silenciar un botón o una zona: `data-sound="off"`. Cambiar su sonido: `data-sound="goal"` (cualquier id de `catalog.ts`).
- Un sonido propio: `const { play } = useSound(); play('goal')`. Sin provider (tests de pantallas sueltas) es un no-op.
- Pantalla de opciones: renderiza `<SoundSettings />` y monta el provider con `floatingControl={false}`.
- Si el botón flotante estorba en alguna pantalla: `<AudioProvider corner="top-left" …>`.

## Piezas

- `catalog.ts` — ids, fichero, mezcla (`gain`) y hueco mínimo entre repeticiones de cada sonido.
- `AudioManager.ts` — volumen/mute persistidos (`localStorage`, con `try/catch`), precarga, one-shots y bucles.
- `WebAudioBackend.ts` — motor Web Audio (latencia baja, bucle sin cortes). Sin `AudioContext` → silencio, sin errores.
- `director.ts` — decide CUÁNDO suena algo (clics, store, teletipo). TS plano: se testea sin React.
- `AudioProvider.tsx`, `useSound.ts`, `SoundControl.tsx`, `SoundSettings.tsx`, `audio.css` — capa React.
- `synth/` — sintetizador de los SFX (ver `public/sfx/README.md`).

## Añadir o cambiar un sonido

1. Receta en `synth/sounds.ts` + entrada en `catalog.ts`.
2. `npx tsx ui/audio/synth/generate.ts` (reescribe `public/sfx/*.wav`).
3. `npm run test -- --run ui/audio`: comprueba que los WAV commiteados coinciden con las recetas.

Los navegadores no dejan arrancar audio sin un gesto del usuario: el director despierta el motor en el
primer `pointerdown`/`keydown`/`click`; antes de eso todo es silencio (y por eso el primer clic ya suena).
