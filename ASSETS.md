# ASSETS.md — Política y procedencia de recursos

## Decisión del propietario (2026-07-30)
El juego usa **escudos, fotos de jugadores y estadios originales de la saga PC Fútbol**
(Dinamic Multimedia), extraídos por ingeniería inversa de los CD originales. El propietario
(Eloy) **asume conscientemente el riesgo legal** de reutilizarlos en un producto público, tras
haber sido informado de que:

- La disponibilidad de los juegos como abandonware **no equivale a una licencia** de reutilización.
- Muchas de esas imágenes (fotos de jugadores → derechos de imagen; escudos → marcas de los
  clubes; fotos de estadios → copyright del fotógrafo) **nunca fueron propiedad de Dinamic**, que
  solo las licenció para su producto.

Es una decisión de producto del propietario. Si en el futuro se prefiere eliminar el riesgo, la
vía es sustituir estos recursos por **arte original pixelado** (estilo retro, obra derivada) o por
**imágenes de licencia libre** (p. ej. Wikimedia Commons), sin tocar el código.

## Procedencia
- **Escudos / fotos / estadios:** extraídos de los packs de la saga (formato BMP indexado dentro de
  los `.pkf`/`.FDI`). Se incluyen en el repo solo los estrictamente necesarios (p. ej. los escudos de
  los equipos de la temporada activa), no el volcado completo.
- **Datos (plantillas, atributos):** son HECHOS (nombres, posiciones, valores), extraídos de las bases
  de datos originales. No tienen copyright.
- **Biografías:** las de los juegos originales son texto con copyright; **no se copian**. Si se
  incluyen biografías, se **reescriben de cero** a partir de los hechos (misma longitud para encajar
  en la UI).

## Recursos propios / libres
Cualquier sprite, sonido o fuente **nuevo** debe ser original o de licencia libre compatible, y se
documenta aquí con su origen y licencia.

## Piel "Mister" del despacho (`public/ui/mister/`, `ui/mister/sprite.svg`)
Portados 1:1 de la maqueta del laboratorio (`pcfutbol-analysis/media/ui-ref/`), aprobada por el
propietario como UI definitiva del despacho:

- **`sprite.svg`** (12 iconos de sección): **ilustración original** hecha para la maqueta. Libre.
- **`logos/*.png`** (laliga, copa, uefa, champions, lfp_1993, seriea, bundesliga, ligue1, manchester):
  logotipos de competición. Mismo criterio que escudos de la saga (decisión 2026-07-30, riesgo asumido).
- **`fondos/*.jpg`** (66 fotos históricas de fútbol, ya procesadas: oscurecidas y viradas a azul) +
  **`fondos.json`** (pie y encuadre por foto). Según los créditos de la maqueta son en su mayoría de
  **Unsplash y Wikimedia Commons** (dominio público o Creative Commons); el crédito de cada una va en
  `fondos.json` y se muestra en pantalla ("La historia"). **Aviso:** 2 de los 66 pies están marcados
  "COPYRIGHT, pedir permiso" (Iniesta 2010 y la falta de Roberto Carlos); conviene sustituirlos o
  recabar permiso si se publica. Son fondos ambientales intercambiables.
- **`facts_es.json`**: curiosidades de equipos para el teletipo. Texto propio (hechos), no copiado.
