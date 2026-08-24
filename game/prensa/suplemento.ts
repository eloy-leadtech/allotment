/**
 * El suplemento deportivo de La Gaceta.
 *
 * En Mister solo se simulan los partidos del club que dirige el jugador: todo
 * lo demás pasó de verdad. Así que el suplemento no inventa nada — lee los
 * hechos reales de esa semana (líder, goleada, campanada, racha, noche europea,
 * final), ya redactados en el exportador a partir de los resultados de BDFutbol.
 *
 * Aquí solo se decide QUÉ entra en la página: cerca de casa primero, variedad
 * de ligas y de tipos, y fuera lo que tenga que ver con tu propio equipo, que
 * ya tiene sus pantallas.
 */

/** Una pieza del suplemento, tal y como sale del exportador. */
export interface PiezaDeportiva {
  titular: string;
  cuerpo: string;
  /** El resultado o el dato, que se imprime en su propia chapa. */
  marcador: string;
  /** Competición o liga a la que pertenece. */
  seccion: string;
  pais: string;
  division: string;
  tipo: 'lider' | 'goleada' | 'sorpresa' | 'racha' | 'europa' | 'final';
  /** Equipos implicados, para poder apartar los del club del jugador. */
  equipos: string[];
  /** Retrato BDFutbol de un protagonista: "2403/2403.jpg". */
  foto?: string;
  /** Escudo del club, cuando no hay retrato de nadie de esa plantilla. */
  escudo?: string;
  /** Trofeo de la competición, último recurso con imagen. */
  trofeo?: string;
  /** Pie de foto: "Makaay, del Tenerife". */
  pie?: string;
}

/** ¿Trae la pieza algo que enseñar? Si no, la página imprime una placa. */
export function tieneImagen(p: PiezaDeportiva): boolean {
  return Boolean(p.foto || p.escudo || p.trofeo);
}

/**
 * Un personaje de la temporada: quien debuta con diecisiete años, quien juega su
 * última campaña, quien llega a las doce. Sale de las carreras, no de los
 * resultados, y por eso vive en su propia página del suplemento.
 */
export interface PiezaPersonaje {
  clase: 'debut' | 'retirada' | 'veterano' | 'fichaje';
  titular: string;
  cuerpo: string;
  marcador: string;
  seccion: string;
  club: string;
  pais: string;
  media: number;
  foto?: string;
  escudo?: string;
  /** Nunca lo trae un personaje, pero la pieza se pinta con el mismo molde. */
  trofeo?: undefined;
  pie?: string;
}

/** Lo que trae el fichero de una temporada: semana (lunes ISO) -> piezas. */
export interface SuplementoTemporada {
  temporada: string;
  semanas: Record<string, PiezaDeportiva[]>;
  /** Debuts, despedidas y veteranos, repartidos por semana. */
  personajes?: Record<string, PiezaPersonaje[]>;
}

/** Cuánto le importa cada liga al lector, según dónde entrena. */
const PESO_TIPO: Record<string, number> = {
  final: 12,
  lider: 8,
  sorpresa: 7,
  europa: 6,
  goleada: 5,
  racha: 4,
};

/** El lunes de la semana ISO de una fecha `YYYY-MM-DD`, que es como se archiva. */
export function lunesDe(fecha: string): string {
  const d = new Date(
    Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)),
  );
  const dia = (d.getUTCDay() + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}

/**
 * Arma la página de deportes de una fecha: `n` piezas, la liga de casa primero,
 * sin más de dos por país ni dos del mismo tipo, y sin nada de tu propio club.
 */
export function suplementoDelDia(
  temporada: SuplementoTemporada | null,
  fecha: string,
  n = 5,
  pais: string | null = null,
  miEquipo: string | null = null,
): PiezaDeportiva[] {
  if (!temporada) return [];
  const semana = temporada.semanas[lunesDe(fecha)] ?? [];

  // A igualdad de interés manda la que trae imagen: una página de deportes sin
  // fotos no es una página de deportes.
  const puntuada = (p: PiezaDeportiva): number =>
    (p.pais === pais ? 20 : p.pais ? 7 : 12) +
    (PESO_TIPO[p.tipo] ?? 0) +
    (p.division === '1' ? 6 : 0) +
    (tieneImagen(p) ? 4 : 0);

  const candidatas = semana
    .filter((p) => !miEquipo || !p.equipos.includes(miEquipo))
    .slice()
    .sort((a, b) => puntuada(b) - puntuada(a));

  const porPais = new Map<string, number>();
  const porTipo = new Map<string, number>();
  const salida: PiezaDeportiva[] = [];
  for (const p of candidatas) {
    if (salida.length >= n) break;
    const clave = p.pais || 'EUR';
    if ((porPais.get(clave) ?? 0) >= 2) continue;
    const tope = p.tipo === 'racha' ? 1 : 2;
    if ((porTipo.get(p.tipo) ?? 0) >= tope) continue;
    porPais.set(clave, (porPais.get(clave) ?? 0) + 1);
    porTipo.set(p.tipo, (porTipo.get(p.tipo) ?? 0) + 1);
    salida.push(p);
  }
  return salida;
}

/**
 * Temporada en el formato en que se archivan los hechos ("1998-99"), a partir
 * de como la nombra el juego ("98/99").
 */
export function temporadaLarga(temporada: string): string | null {
  if (/^\d{4}-\d{2}$/.test(temporada)) return temporada;
  const m = /^(\d{2})\/(\d{2})$/.exec(temporada);
  if (!m) return null;
  const yy = Number(m[1]);
  const inicio = yy >= 28 ? 1900 + yy : 2000 + yy;
  return `${inicio}-${m[2]}`;
}

/**
 * Los breves: lo que la primera página del suplemento no tuvo sitio para contar.
 * Se le pasan las piezas ya publicadas para no repetirlas.
 */
export function brevesDelDia(
  temporada: SuplementoTemporada | null,
  fecha: string,
  publicadas: readonly PiezaDeportiva[],
  n = 6,
  miEquipo: string | null = null,
): PiezaDeportiva[] {
  if (!temporada) return [];
  const yaVistas = new Set(publicadas.map((p) => p.titular + p.marcador));
  return (temporada.semanas[lunesDe(fecha)] ?? [])
    .filter((p) => !yaVistas.has(p.titular + p.marcador))
    .filter((p) => !miEquipo || !p.equipos.includes(miEquipo))
    .slice(0, n);
}

/**
 * Los personajes de esa semana, los de casa primero y por orden de renombre:
 * un debut de un chaval del Barcelona interesa más que el de un belga de
 * segunda, por mucho que los dos sean ciertos.
 */
export function personajesDelDia(
  temporada: SuplementoTemporada | null,
  fecha: string,
  n = 4,
  pais: string | null = null,
): PiezaPersonaje[] {
  if (!temporada?.personajes) return [];
  const semana = temporada.personajes[lunesDe(fecha)] ?? [];
  return semana
    .slice()
    .sort(
      (a, b) =>
        (b.pais === pais ? 1 : 0) - (a.pais === pais ? 1 : 0) || b.media - a.media,
    )
    .slice(0, n);
}
