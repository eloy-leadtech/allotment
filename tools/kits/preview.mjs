import { writeFileSync, mkdirSync } from 'node:fs';
import { renderCamiseta } from './kit-svg.mjs';
import { MUESTRA } from './equipaciones.mjs';

const OUT = new URL('./out/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const NOMBRE_PATRON = {
  liso: 'Liso', rayas: 'Rayas verticales', bandas: 'Bandas horizontales',
  mitades: 'Mitades', diagonal: 'Banda diagonal', cuadros: 'Cuadros', 'banda-pecho': 'Banda al pecho',
};

const cards = MUESTRA.map((e) => {
  writeFileSync(new URL(`./${e.id}.svg`, OUT), renderCamiseta(e, { id: e.id, size: 240 }));
  const grande = renderCamiseta(e, { id: `${e.id}-g`, size: 160 });
  const medio = renderCamiseta(e, { id: `${e.id}-m`, size: 64 });
  const mini = renderCamiseta(e, { id: `${e.id}-p`, size: 28 });
  return `<article class="card">
    <div class="big">${grande}</div>
    <h2>${e.nombre}</h2>
    <p class="meta">${e.temporada} · ${NOMBRE_PATRON[e.patron] ?? e.patron}</p>
    <div class="sizes"><span>${medio}</span><span>${mini}</span><em>64px / 28px</em></div>
  </article>`;
}).join('\n');

writeFileSync(new URL('./kits.html', OUT), `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Generador de equipaciones — Mister</title>
<style>
 :root{--bg:#12161d;--panel:#1b212b;--line:#2c3542;--tinta:#e8edf5;--tenue:#8b97a8}
 *{box-sizing:border-box} body{margin:0;padding:32px;background:var(--bg);color:var(--tinta);
   font-family:"Segoe UI",system-ui,sans-serif}
 h1{font-size:20px;margin:0 0 4px} .sub{color:var(--tenue);margin:0 0 28px;font-size:14px}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px}
 .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;text-align:center}
 .big{min-height:180px;display:flex;align-items:center;justify-content:center}
 h2{font-size:15px;margin:10px 0 2px} .meta{color:var(--tenue);font-size:12px;margin:0 0 12px}
 .sizes{display:flex;align-items:center;justify-content:center;gap:10px;
   border-top:1px solid var(--line);padding-top:12px}
 .sizes em{color:var(--tenue);font-size:11px;font-style:normal}
</style></head><body>
<h1>Generador paramétrico de equipaciones</h1>
<p class="sub">6 equipos · 5 patrones · SVG generado desde datos de color. Ni un pixel de EA ni de Dinamic.</p>
<div class="grid">${cards}</div>
</body></html>`);

console.log(`OK — ${MUESTRA.length} equipaciones en tools/kits/out/`);
