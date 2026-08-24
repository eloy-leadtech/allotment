/**
 * Generador paramétrico de camisetas.
 * Entrada: una "spec" de equipación (patrón + colores). Salida: SVG.
 * Sin dependencias: la misma función vale para el script de preview y para React.
 */

// Silueta de la camiseta (viewBox 0 0 120 130)
const CAMISETA =
  'M48,13 L40,9 C30,13 18,20 9,29 C11,40 13,50 16,60 C23,55 30,50 36,45' +
  ' C33,70 31,95 30,121 C50,124 70,124 90,121 C89,95 87,70 84,45' +
  ' C90,50 97,55 104,60 C107,50 109,40 111,29 C102,20 90,13 80,9 L72,13' +
  ' C64,19 56,19 48,13 Z';

const MANGA_IZQ = 'M40,9 C30,13 18,20 9,29 C11,40 13,50 16,60 C23,55 30,50 36,45 C37,32 38,20 40,9 Z';
const MANGA_DER = 'M80,9 C90,13 102,20 111,29 C109,40 107,50 104,60 C97,55 90,50 84,45 C83,32 82,20 80,9 Z';
const CUELLO = 'M48,13 C56,19 64,19 72,13';

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

/** Dibuja el patrón dentro del recorte de la camiseta. */
function patron(spec) {
  const { patron: p, color2, color3, franjas = 7 } = spec;
  const out = [];

  if (p === 'rayas') {
    const w = 120 / franjas;
    for (let i = 1; i < franjas; i += 2) {
      out.push(`<rect x="${(i * w).toFixed(2)}" y="0" width="${w.toFixed(2)}" height="130" fill="${color2}"/>`);
    }
  } else if (p === 'bandas') {
    const h = 130 / franjas;
    for (let i = 1; i < franjas; i += 2) {
      out.push(`<rect x="0" y="${(i * h).toFixed(2)}" width="120" height="${h.toFixed(2)}" fill="${color2}"/>`);
    }
  } else if (p === 'mitades') {
    out.push(`<rect x="60" y="0" width="60" height="130" fill="${color2}"/>`);
  } else if (p === 'diagonal') {
    out.push(`<polygon points="0,10 34,0 120,96 120,130 86,130 0,44" fill="${color2}"/>`);
  } else if (p === 'banda-pecho') {
    out.push(`<rect x="0" y="46" width="120" height="24" fill="${color2}"/>`);
    if (color3) out.push(`<rect x="0" y="70" width="120" height="6" fill="${color3}"/>`);
  } else if (p === 'cuadros') {
    const s = 15;
    for (let y = 0; y < 130; y += s) {
      for (let x = 0; x < 120; x += s) {
        if (((x / s) + (y / s)) % 2) out.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${color2}"/>`);
      }
    }
  }
  return out.join('');
}

/**
 * @param {object} spec  { base, patron, color2, color3, franjas, mangas, cuello, ribete }
 * @param {object} opts  { id, size }
 */
export function renderCamiseta(spec, opts = {}) {
  const id = opts.id ?? 'k';
  const size = opts.size ?? 120;
  const mangas = spec.mangas ?? 'patron';
  const cuello = spec.cuello ?? spec.color2 ?? '#222';
  const ribete = spec.ribete ?? cuello;

  const mangasPropias =
    mangas !== 'patron'
      ? `<path d="${MANGA_IZQ}" fill="${mangas}"/><path d="${MANGA_DER}" fill="${mangas}"/>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 130" width="${size}" height="${(size * 130) / 120}" role="img" aria-label="Camiseta ${esc(spec.nombre ?? '')}">
  <defs>
    <clipPath id="c-${id}"><path d="${CAMISETA}"/></clipPath>
    <linearGradient id="luz-${id}" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0%" stop-color="#000" stop-opacity="0.20"/>
      <stop offset="35%" stop-color="#fff" stop-opacity="0.14"/>
      <stop offset="70%" stop-color="#000" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.22"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#c-${id})">
    <rect x="0" y="0" width="120" height="130" fill="${spec.base}"/>
    ${patron(spec)}
    ${mangasPropias}
    <rect x="0" y="0" width="120" height="130" fill="url(#luz-${id})"/>
  </g>
  <path d="${CAMISETA}" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="${CUELLO}" fill="none" stroke="${cuello}" stroke-width="5" stroke-linecap="round"/>
  <path d="M9,29 C11,40 13,50 16,60" fill="none" stroke="${ribete}" stroke-width="3.5"/>
  <path d="M111,29 C109,40 107,50 104,60" fill="none" stroke="${ribete}" stroke-width="3.5"/>
</svg>`;
}
