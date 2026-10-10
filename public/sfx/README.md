# public/sfx — efectos de sonido

Nueve ficheros WAV mono de 16 bits (≈ 745 KiB en total). **Todos son obra original del proyecto**:
están sintetizados por código (osciladores, ruido filtrado y envolventes), sin muestras de ninguna
grabación y sin material de Dinamic ni de terceros.

| Fichero | Qué es |
|---|---|
| `click.wav` | tic suave de interfaz |
| `confirm.wav` | dos notas ascendentes para acciones primarias |
| `whistle-start.wav` | pitido de saque (una pitada) |
| `whistle-end.wav` | pitido final (corto, corto, largo) |
| `goal.wav` | rugido de grada con un breve arpegio chiptune |
| `cheer.wav` | vítores más cortos (victoria) |
| `card-yellow.wav` | pitido corto + gesto de tarjeta |
| `card-red.wav` | pitido largo + gesto + golpe grave |
| `crowd.wav` | ambiente de estadio, bucle continuo de 10 s |

## Regenerar

```bash
npx tsx ui/audio/synth/generate.ts
```

La salida es determinista (misma semilla → mismos bytes), y un test (`ui/audio/synth/sounds.test.ts`)
comprueba que estos ficheros coinciden con lo que renderizan las recetas de `ui/audio/synth/sounds.ts`.

## Cambiar un sonido

- **Con la receta:** edita `ui/audio/synth/sounds.ts` y regenera.
- **Con una grabación externa (propia o de licencia libre):** sustituye el `.wav` (mismo nombre, mono 16 bit),
  pon `origin: 'external'` y `credit` (autor, fuente y licencia) en su entrada de `ui/audio/catalog.ts`, borra su
  receta de `RECIPES` y documéntalo en `ASSETS.md`. Los tests dejan de exigir que ese fichero salga de una receta.
