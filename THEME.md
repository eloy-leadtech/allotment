# THEME.md — La piel de Mister

Sistema visual del juego. Deriva de la maqueta del despacho construida en el
laboratorio (`pcfutbol-analysis/media/ui-ref`, "ADN de scr_032"): misma paleta,
mismas tipografías y mismos componentes, reescritos como CSS y React propios.
Ni un bitmap original de Dinamic: la piel se dibuja entera con CSS/SVG.

## Capas CSS (orden de import en `ui/theme/global.css`)

| Capa | Fichero | Qué contiene |
|---|---|---|
| Tokens | `ui/theme/tokens.css` | Colores, tipografías, radios, biseles, sombras |
| Calco PCF7 | `ui/theme/pcf7-calco.css` | Piel transitoria de las pantallas aún no migradas |
| **Mister** | `ui/theme/mister.css` | La piel definitiva: placa metálica, botón de torre, pips |

El orden de los `@import` está pinado por `ui/theme/global.css.test.ts`.

## Paleta

La base ya estaba muestreada de las pantallas reales (scr_022/026/032) y es la
misma que usa la maqueta:

- Fondos: `--c-bg #0a0a28` · `--c-bg-base #14143c` · `--c-bg-panel #1e3462` ·
  `--c-bg-raised #2a3f7a` · `--c-bg-sunken #0a1024`
- Acero: `--c-panel-top #5c7eae` · `--c-edge-light #7f9fff` ·
  `--c-electric #2a3faa` · `--c-steel #555faa` · `--c-steel-lit #5c7eae` ·
  `--c-gleam #7593bb` · `--c-metal #8890a8`
- Tinta: `--c-ink #fff` · `--c-ink-dim #b8c8e8` · `--c-ink-soft #8ea3cc`
- Señales: `--c-danger #c81e1e` (rojo) · `--c-amber #c8961e` (ámbar) ·
  `--c-accent-2 #2a9d4a` / `--c-pitch #117f2b` (verdes de campo) ·
  `--c-gold #f2c94c`

## Tipografía

Autoalojada con `@fontsource` (imports en `app/main.tsx`), sin CDN:

- `--font-ui` → **Barlow Condensed**. Rótulos y cabeceras: 700, MAYÚSCULAS,
  itálica en los nombres grandes (club, jugador, fecha).
- `--font-data` → **Barlow Condensed**. Datos tabulares, chips y etiquetas,
  con `font-variant-numeric: tabular-nums` en columnas de números.
- `--font-body` → **Barlow**. Texto corrido (bios, prensa, avisos).

## La placa metálica

Metal sólido, nunca cristal: gradiente vertical de acero (claro arriba →
oscuro abajo), filo iluminado arriba/izquierda, filo en sombra abajo/derecha,
sombra proyectada. En CSS:

- `.mst-plate` — placa genérica (componente `MetalPlate`).
- `.mst-sec` — botón de torre (componente `TowerButton`): miniatura en pocillo
  (`.mst-sec__thumb`, el icono gira al entrar el ratón), nombre en condensada
  700 (`.mst-sec__n`), dato vivo debajo (`.mst-sec__d`, con `<em>` para el
  acento y modificadores `--alert`/`--good`), y pip de aviso opcional
  (`.mst-pip` rojo = requiere respuesta, `.mst-pip--q` ámbar = pendiente).
- Torres: `.mst-tower` (146px) con grupos `.mst-grp` y rótulo `.mst-grp__h`.

Todo respeta `prefers-reduced-motion`.

## Escala de valoración (5 niveles)

Común a medias y atributos en toda la interfaz (llega con el componente de
jugador): `top` azul metal (≥88) · `alto` verde (≥78) · `medio` amarillo
(≥68) · `bajo` naranja (≥58) · `malo` rojo (<58).

## Reglas de la piel

1. Texto visible al jugador: **castellano**. Código y comentarios: inglés.
2. Sin librerías de UI: todo CSS propio sobre estos tokens.
3. Cada pantalla cabe en su marco: sin scroll horizontal, sin texto cortado.
   Se verifica con captura antes de dar por buena una pantalla.
4. Un jugador se presenta SIEMPRE igual (dorsal + banderita + nombre +
   demarcación coloreada por línea); el componente único llega en la Fase 1
   (`PlayerTag`) y todas las listas deben usarlo.
5. Las pantallas migran de la piel calco a la Mister por fases; ver
   `PLAN-FASE1-COSTURA` (documentos del propietario) y la hoja de ruta del
   laboratorio.
