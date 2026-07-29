# PCFutbol Ultimate — Montaje completo del repo 🏭

Guía única y actualizada. Repo: `eloy-leadtech/allotment` (público ✅).
Tiempo estimado: 45-60 min. Sigue el orden.

## Qué contiene este pack
```
SPEC.md                        → diseño del juego COMPLETO (v0.3, sin MVP)
CLAUDE.md                      → reglas para los agentes
research/screenshots/          → carpeta para tus capturas de referencia
.github/CODEOWNERS             → blindaje de CI y docs maestros
.github/workflows/
  ci.yml        → typecheck + lint + tests + build en cada PR (el guardián)
  claude.yml    → agente interactivo: menciona @claude en issues/PRs
  nightly.yml   → agente nocturno: cron 23:00/01:00/03:00, una issue por pasada
  pr-review.yml → segundo Claude revisa cada PR y marca 'needs-human' si hay peligro
  deploy.yml    → publica el juego en GitHub Pages con cada merge (tu build de cada mañana)
```

## Paso 1 — Subir el contenido
1. Clona el repo: `git clone https://github.com/eloy-leadtech/allotment && cd allotment`
2. Copia DENTRO todo el contenido de este pack (incluida la carpeta oculta `.github`).
3. En `.github/CODEOWNERS` sustituye `TU_USUARIO` por `eloy-leadtech`.
4. `git add -A && git commit -m "chore: infraestructura de la factoría" && git push`

## Paso 2 — Conectar Claude (tu suscripción Max)
Dentro de la carpeta del repo:
```
claude
> /install-github-app
```
Instala la GitHub App de Claude y crea el secret del token OAuth.
Verifica en GitHub: Settings → Secrets and variables → Actions → debe existir
`CLAUDE_CODE_OAUTH_TOKEN`. Si no: `claude setup-token` y créalo a mano.
(La App instalada es también lo que hace que los PRs del agente disparen la CI.)

## Paso 3 — Etiquetas
```
gh label create ready --color 0e8a16 --description "Lista para el agente"
gh label create in-progress --color fbca04 --description "En curso"
gh label create blocked --color d93f0b --description "Necesita ayuda humana"
gh label create needs-human --color b60205 --description "El revisor detectó algo grave"
```

## Paso 4 — GitHub Pages
Settings → Pages → Source: **GitHub Actions**. Nada más.
Tu juego vivirá en: `https://eloy-leadtech.github.io/allotment/`

## Paso 5 — Protección de main + auto-merge
Settings → General → ✅ "Allow auto-merge".
Settings → Branches → ruleset para `main`:
- ✅ Require a pull request before merging
- ✅ Require status checks → check **verify** (aparece tras la primera CI)
- ✅ Require review from Code Owners
- ❌ NO exigir aprobación general de PRs (bloquearía el auto-merge)

## Paso 6 — Arranque supervisado (el primer PR es especial)
Con el repo vacío la CI falla: el scaffolding se hace de día y lo mergeas tú.
1. Crea la issue #1:
   "E1-01: Scaffolding Vite + React + TypeScript + Capacitor.
   Scripts npm obligatorios: typecheck, lint, test, build.
   Vite debe leer la variable VITE_BASE como `base` (para GitHub Pages).
   Incluir test de humo mínimo."
   Etiqueta: `ready`.
2. Actions → Nightly Agent → **Run workflow** (botón manual).
3. Revisa el PR (aquí sí, aunque sea por encima) y mergéalo tú.
4. Comprueba que la CI corre en verde y que Pages publica la URL.
Desde ese momento la factoría queda en automático.

## Rutina de crucero
- **Día**: creas/refinas issues con criterios de aceptación → etiqueta `ready`.
  Para trabajo interactivo, menciona `@claude` en cualquier issue o PR.
- **Noche**: el cron hace hasta 3 issues (23:00, 01:00, 03:00 hora peninsular verano).
- **Mañana**: café ☕ → abre https://eloy-leadtech.github.io/allotment/ en el móvil
  y JUEGA. Lo que falle → issue en cristiano → `ready`.
  Mira también si hay PRs con `needs-human` o issues `blocked`.

## Avisos
- Tu rol es product owner: pruebas el juego, no lees el código. Las redes de
  seguridad son: CI + revisor automático + build jugable diaria.
- La cuota Max se comparte con tu uso diurno (ventanas de 5h + límite semanal).
  Noche sin actividad = probablemente límite alcanzado, no avería.
- Si los workflows fallan con error de autenticación: `claude setup-token`
  y actualiza el secret.
- Repo público: ni un secreto ni dato personal en el código. La db del juego
  es pública por diseño.
