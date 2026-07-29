# CLAUDE.md — Reglas del proyecto PCFutbol Ultimate

Eres un agente de desarrollo de este proyecto. Estas reglas son obligatorias.

## Fuentes de verdad (en este orden)
1. `SPEC.md` — diseño y alcance. Si una tarea lo contradice, para y pregunta.
2. `research/` — cómo funcionaban los juegos originales. Consúltalo antes de implementar cualquier mecánica de juego.
3. La issue que estás implementando — define el alcance exacto de tu trabajo.

## Alcance y disciplina
- Implementa SOLO lo que pide la issue. Nada de refactors, mejoras ni features extra no pedidas.
- Si la issue es ambigua, incompleta o imposible: NO improvises. Comenta tus dudas en la issue, etiquétala `blocked` y termina.
- Una issue = una rama `feat/issue-<n>` = un PR pequeño y revisable.
- Nunca hagas push directo a `main`. Nunca toques `.github/`, `SPEC.md`, `CLAUDE.md` ni `CODEOWNERS` salvo que la issue lo pida explícitamente.

## Código
- TypeScript estricto. Código, identificadores y comentarios en **inglés**; textos de juego y UI en **español**.
- `/engine` y `/game` son TS puro: prohibido importar React o APIs de navegador ahí.
- Los datos de juego (equipos, jugadores, competiciones) viven en `/data/*.json` con esquemas Zod. Prohibido hardcodearlos.
- Nada de dependencias nuevas sin justificarlo en el PR. Ninguna librería de UI (el tema retro es CSS propio).
- El simulador es determinista: mismo seed → mismo resultado. Todo cambio en el engine debe mantener esta propiedad.

## Calidad
- Todo módulo nuevo o modificado en `/engine` y `/game` lleva tests (Vitest).
- Antes de abrir PR ejecuta y deja en verde: `npm run typecheck && npm run lint && npm run test -- --run && npm run build`. Prohibido abrir PR en rojo.
- Prohibido debilitar tests, silenciar errores (`any`, `@ts-ignore`, `eslint-disable`) o tocar la CI para que pase.

## Contenido y legalidad
- Replicamos mecánicas e ideas de los juegos originales. PROHIBIDO copiar assets, gráficos, sonidos, textos o código de Dinamic o de terceros.
- Todo asset (sprites, sonidos, fuentes) debe ser original o con licencia libre compatible, documentada en `ASSETS.md`.

## PRs
- Título: `feat: <resumen> (closes #<issue>)` (o `fix:`/`chore:` según toque).
- Descripción: qué se hizo, cómo probarlo, decisiones tomadas y por qué.
- Idioma de PRs, issues y comunicación con el propietario: español.
