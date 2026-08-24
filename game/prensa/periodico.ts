/**
 * El periódico del despacho: qué noticias reales del mundo salen el día de una
 * jornada.
 *
 * La regla de oro es que el periódico habla SIEMPRE de su propio momento. Si
 * juegas una jornada de octubre de 1962 lees lo que pasaba entonces, nunca una
 * efeméride de otro año ni un "tal día como hoy". Por eso:
 *
 *  - una noticia solo puede salir si su fecha es anterior o igual a la jornada
 *    (nada del futuro, ni siquiera de la semana siguiente);
 *  - se busca en el mes de la jornada y en los dos anteriores, y siempre del año
 *    que toca;
 *  - no hay rotación ni reciclaje: octubre del 67 no tiene nada que ver con
 *    octubre del 35.
 *
 * Las noticias con `precision: 'month'` valen para cualquier jornada de su mes
 * (sabemos el mes pero no el día exacto), y las de `'day'` se ordenan por
 * cercanía real a la jornada.
 */

/** Cómo de precisa es la fecha de una noticia. */
export type PrecisionNoticia = 'day' | 'month';

/** Ámbito temático, tal y como se archivó en el almanaque. */
export type AmbitoNoticia =
  | 'mundo'
  | 'futbol'
  | 'deporte'
  | 'cultura'
  | 'ciencia'
  | 'sociedad';

/** Una noticia del almanaque, ya exportada para el juego. */
export interface Noticia {
  id: string;
  /** `YYYY-MM-DD` cuando `precision` es `'day'`, `YYYY-MM` cuando es `'month'`. */
  fecha: string;
  precision: PrecisionNoticia;
  ambito: AmbitoNoticia;
  /** Países a los que le importa la noticia; `'*'` = a todo el mundo. */
  paises: string[];
  /** 1 = breve, 2 = destacada, 3 = portada. */
  peso: number;
  titular: string;
  cuerpo: string;
  /** Fichero de la foto libre asociada, si tiene. */
  foto?: string;
}

/** De qué cajón sale una noticia, que es lo que decide su antetítulo. */
export type CajonNoticia = 'dia' | 'semana' | 'mes' | 'cerca';

/** Una noticia ya colocada en el periódico de un día concreto. */
export interface NoticiaDelDia {
  noticia: Noticia;
  cajon: CajonNoticia;
  /** Días transcurridos desde el hecho, o `null` si solo sabemos el mes. */
  diasAtras: number | null;
}

/** Índice por mes (1-12) para no recorrer las 2.000 noticias en cada jornada. */
export type IndicePrensa = ReadonlyMap<number, readonly Noticia[]>;

/** Hasta cuántos días atrás se considera que algo es "de esta semana". */
const MARGEN_SEMANA = 4;

/** Construye el índice por mes. Hazlo una vez al cargar, no en cada render. */
export function indexarNoticias(noticias: readonly Noticia[]): IndicePrensa {
  const indice = new Map<number, Noticia[]>();
  for (const noticia of noticias) {
    const mes = Number(noticia.fecha.slice(5, 7));
    if (!Number.isFinite(mes) || mes < 1 || mes > 12) continue;
    const cubo = indice.get(mes);
    if (cubo) cubo.push(noticia);
    else indice.set(mes, [noticia]);
  }
  return indice;
}

/** Año, mes y día de una fecha ISO, sin pasar por `Date` (que se lía con zonas). */
function partes(fecha: string): { anio: number; mes: number; dia: number | null } {
  return {
    anio: Number(fecha.slice(0, 4)),
    mes: Number(fecha.slice(5, 7)),
    dia: fecha.length >= 10 ? Number(fecha.slice(8, 10)) : null,
  };
}

/** Días entre dos fechas del calendario, contando en UTC para evitar el horario de verano. */
function diasEntre(
  a: { anio: number; mes: number; dia: number },
  b: { anio: number; mes: number; dia: number },
): number {
  const ms =
    Date.UTC(a.anio, a.mes - 1, a.dia) - Date.UTC(b.anio, b.mes - 1, b.dia);
  return Math.round(ms / 86_400_000);
}

/** ¿Le importa esta noticia a un lector de `pais`? `'*'` vale para todos. */
function interesaA(noticia: Noticia, pais: string | null): boolean {
  if (!pais) return true;
  return noticia.paises.includes('*') || noticia.paises.includes(pais);
}

/**
 * Arma el periódico de una fecha: hasta `n` noticias, las más cercanas y
 * más gordas primero, sin repetir y sin nada que aún no haya ocurrido.
 *
 * `fecha` es la de la jornada en formato `YYYY-MM-DD`; `pais` filtra por
 * relevancia (el código de liga del manager, p. ej. `'ESP'`).
 */
export function periodicoDelDia(
  indice: IndicePrensa,
  fecha: string,
  n = 4,
  pais: string | null = null,
): NoticiaDelDia[] {
  const hoy = partes(fecha);
  if (!Number.isFinite(hoy.anio) || hoy.dia == null) return [];
  const hoyExacto = { anio: hoy.anio, mes: hoy.mes, dia: hoy.dia };

  const candidatas: Array<{ rango: number; dias: number; noticia: Noticia }> = [];
  for (let salto = 0; salto < 3; salto += 1) {
    let mes = hoy.mes - salto;
    let anio = hoy.anio;
    if (mes < 1) {
      mes += 12;
      anio -= 1;
    }
    for (const noticia of indice.get(mes) ?? []) {
      const cuando = partes(noticia.fecha);
      if (cuando.anio !== anio) continue;
      if (!interesaA(noticia, pais)) continue;

      if (cuando.dia == null) {
        // Solo sabemos el mes: vale para cualquier jornada de ese mes.
        candidatas.push({ rango: salto === 0 ? 2 : 3, dias: 0, noticia });
        continue;
      }
      const dias = diasEntre(hoyExacto, { anio, mes, dia: cuando.dia });
      if (dias < 0) continue; // todavía no ha pasado
      const rango =
        dias === 0 ? 0 : dias <= MARGEN_SEMANA ? 1 : salto === 0 ? 2 : 3;
      candidatas.push({ rango, dias, noticia });
    }
  }

  candidatas.sort(
    (a, b) =>
      a.rango - b.rango || a.dias - b.dias || b.noticia.peso - a.noticia.peso,
  );

  const cajones: CajonNoticia[] = ['dia', 'semana', 'mes', 'cerca'];
  const vistas = new Set<string>();
  const salida: NoticiaDelDia[] = [];
  for (const c of candidatas) {
    if (salida.length >= n) break;
    if (vistas.has(c.noticia.id)) continue;
    vistas.add(c.noticia.id);
    salida.push({
      noticia: c.noticia,
      cajon: cajones[c.rango] ?? 'cerca',
      diasAtras: c.noticia.precision === 'day' ? c.dias : null,
    });
  }
  return salida;
}

/** El antetítulo que se imprime encima del titular según su cajón. */
export function antetitulo(pieza: NoticiaDelDia): string {
  switch (pieza.cajon) {
    case 'dia':
      return 'HOY';
    case 'semana':
      return pieza.diasAtras === 1 ? 'AYER' : 'ESTA SEMANA';
    case 'mes':
      return 'ESTE MES';
    default:
      return 'HACE UNAS SEMANAS';
  }
}

/** Calendario real de jornadas: temporada ("93/94") -> fecha de cada jornada. */
export type CalendarioPrensa = Readonly<Record<string, readonly string[]>>;

/**
 * Fecha que le corresponde a una jornada. Si la temporada está en el calendario
 * real usamos el día en que se jugó de verdad; si no (ligas o años sin datos),
 * se reparte una jornada por semana desde el 1 de septiembre, que es la
 * aproximación honrada y deja el periódico dentro del año correcto.
 */
export function fechaDeJornada(
  calendario: CalendarioPrensa,
  temporada: string,
  jornada: number,
): string | null {
  const fechas = calendario[temporada];
  if (fechas && fechas.length > 0) {
    return fechas[Math.min(Math.max(jornada, 1), fechas.length) - 1] ?? null;
  }
  const anio = anioDeTemporada(temporada);
  if (anio == null) return null;
  const inicio = Date.UTC(anio, 8, 1); // 1 de septiembre
  const d = new Date(inicio + (jornada - 1) * 7 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Año natural en que arranca una temporada escrita "93/94" o "1993-94". */
export function anioDeTemporada(temporada: string): number | null {
  const largo = /^(\d{4})-\d{2}$/.exec(temporada);
  if (largo) return Number(largo[1]);
  const corto = /^(\d{2})\/(\d{2})$/.exec(temporada);
  if (corto) {
    const yy = Number(corto[1]);
    // La primera Liga es la 1928-29: por debajo de 28 estamos ya en los 2000.
    return yy >= 28 ? 1900 + yy : 2000 + yy;
  }
  return null;
}

/**
 * Código de país de una liga a partir de su id, que es lo que decide a quién le
 * importa cada noticia. El catálogo histórico usa `"ita-1-1968-69"` y las ligas
 * empaquetadas usan `"es-primera-9697"`; ambos empiezan por el país.
 */
export function paisDeLiga(leagueId: string): string | null {
  const trozo = leagueId.split('-')[0]?.toUpperCase();
  if (!trozo) return null;
  if (trozo === 'ES') return 'ESP';
  return trozo.length === 3 ? trozo : null;
}

/**
 * Ordena las piezas de un periódico para maquetarlo: de apertura va la mejor que
 * tenga foto (una portada sin imagen queda pobre) y detrás el resto en el orden
 * que traían. Si ninguna tiene foto se respeta el orden tal cual.
 */
export function maquetar(piezas: readonly NoticiaDelDia[]): NoticiaDelDia[] {
  const i = piezas.findIndex((p) => p.noticia.foto);
  if (i <= 0) return [...piezas];
  return [piezas[i]!, ...piezas.filter((_, j) => j !== i)];
}

/** Cómo se imprimía el periódico en cada tramo de la historia. */
export type EpocaPrensa =
  | 'republica'
  | 'posguerra'
  | 'desarrollo'
  | 'transicion'
  | 'moderno'
  | 'digital';

/**
 * La época de impresión de un número. No es un capricho estético: un diario de
 * 1933 se imprimía a una tinta sobre papel malo, el color no llega a la prensa
 * española hasta finales de los ochenta y las portadas de los 2000 ya son otra
 * cosa. El periódico del juego cambia de piel con su tiempo.
 */
export function epocaDe(fecha: string): EpocaPrensa {
  const anio = Number(fecha.slice(0, 4));
  if (anio < 1940) return 'republica';
  if (anio < 1960) return 'posguerra';
  if (anio < 1976) return 'desarrollo';
  if (anio < 1990) return 'transicion';
  if (anio < 2005) return 'moderno';
  return 'digital';
}

/** El nombre que se imprime en la mancheta según la época. */
export function lemaDeEpoca(epoca: EpocaPrensa): string {
  switch (epoca) {
    case 'republica':
      return 'Diario de la mañana · Fundado en 1929';
    case 'posguerra':
      return 'Diario de la tarde · Precio: 1 peseta';
    case 'desarrollo':
      return 'Diario deportivo y de información general';
    case 'transicion':
      return 'Diario independiente de la mañana';
    case 'moderno':
      return 'El diario del deporte';
    default:
      return 'Edición diaria';
  }
}
