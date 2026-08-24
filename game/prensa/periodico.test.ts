import { describe, expect, it } from 'vitest';
import {
  anioDeTemporada,
  epocaDe,
  fechaDeJornada,
  indexarNoticias,
  maquetar,
  paisDeLiga,
  periodicoDelDia,
  type Noticia,
} from './periodico';

function noticia(id: string, fecha: string, extra: Partial<Noticia> = {}): Noticia {
  return {
    id,
    fecha,
    precision: fecha.length >= 10 ? 'day' : 'month',
    ambito: 'mundo',
    paises: ['*'],
    peso: 1,
    titular: id.toUpperCase(),
    cuerpo: 'Cuerpo.',
    ...extra,
  };
}

describe('periodicoDelDia', () => {
  it('nunca publica algo que aún no ha pasado', () => {
    const indice = indexarNoticias([
      noticia('pasado', '1969-07-20'),
      noticia('futuro', '1969-07-25'),
    ]);
    const piezas = periodicoDelDia(indice, '1969-07-21');
    expect(piezas.map((p) => p.noticia.id)).toEqual(['pasado']);
  });

  it('no mezcla años: octubre del 67 no trae nada de octubre del 35', () => {
    const indice = indexarNoticias([noticia('viejo', '1935-10-12')]);
    expect(periodicoDelDia(indice, '1967-10-15')).toEqual([]);
  });

  it('ordena por cercanía y luego por peso', () => {
    const indice = indexarNoticias([
      noticia('lejana-gorda', '1980-03-02', { peso: 3 }),
      noticia('hoy', '1980-03-30'),
      noticia('anteayer', '1980-03-28'),
    ]);
    const piezas = periodicoDelDia(indice, '1980-03-30');
    expect(piezas.map((p) => p.noticia.id)).toEqual(['hoy', 'anteayer', 'lejana-gorda']);
    expect(piezas[0]?.cajon).toBe('dia');
    expect(piezas[1]?.cajon).toBe('semana');
    expect(piezas[2]?.cajon).toBe('mes');
  });

  it('las noticias de solo mes valen para cualquier jornada de ese mes', () => {
    const indice = indexarNoticias([noticia('de-mes', '1945-08')]);
    expect(periodicoDelDia(indice, '1945-08-05')[0]?.noticia.id).toBe('de-mes');
    expect(periodicoDelDia(indice, '1945-08-28')[0]?.noticia.id).toBe('de-mes');
    expect(periodicoDelDia(indice, '1945-07-28')).toEqual([]);
  });

  it('alcanza hasta dos meses atrás y cruza el cambio de año', () => {
    const indice = indexarNoticias([noticia('noviembre', '1962-11-10')]);
    const piezas = periodicoDelDia(indice, '1963-01-06');
    expect(piezas[0]?.cajon).toBe('cerca');
  });

  it('filtra por país cuando se le pide', () => {
    const indice = indexarNoticias([
      noticia('solo-italia', '1970-02-10', { paises: ['ITA'] }),
      noticia('global', '1970-02-11'),
    ]);
    const piezas = periodicoDelDia(indice, '1970-02-12', 4, 'ESP');
    expect(piezas.map((p) => p.noticia.id)).toEqual(['global']);
  });

  it('respeta el número de piezas pedido y no repite', () => {
    const indice = indexarNoticias([
      noticia('a', '1990-05-01'),
      noticia('b', '1990-05-02'),
      noticia('c', '1990-05-03'),
    ]);
    expect(periodicoDelDia(indice, '1990-05-10', 2)).toHaveLength(2);
  });
});

describe('fechaDeJornada', () => {
  it('usa el día real cuando la temporada está en el calendario', () => {
    const cal = { '93/94': ['1993-09-04', '1993-09-11'] };
    expect(fechaDeJornada(cal, '93/94', 2)).toBe('1993-09-11');
  });

  it('no se sale del calendario si la jornada se pasa de rango', () => {
    const cal = { '93/94': ['1993-09-04', '1993-09-11'] };
    expect(fechaDeJornada(cal, '93/94', 40)).toBe('1993-09-11');
    expect(fechaDeJornada(cal, '93/94', 0)).toBe('1993-09-04');
  });

  it('inventa un calendario semanal cuando no hay datos', () => {
    expect(fechaDeJornada({}, '96/97', 1)).toBe('1996-09-01');
    expect(fechaDeJornada({}, '96/97', 3)).toBe('1996-09-15');
  });
});

describe('anioDeTemporada', () => {
  it('entiende los dos formatos y corta el siglo en la primera Liga', () => {
    expect(anioDeTemporada('1928-29')).toBe(1928);
    expect(anioDeTemporada('93/94')).toBe(1993);
    expect(anioDeTemporada('05/06')).toBe(2005);
    expect(anioDeTemporada('28/29')).toBe(1928);
    expect(anioDeTemporada('vaya')).toBeNull();
  });
});

describe('maquetar', () => {
  const pieza = (id: string, foto?: string) => ({
    noticia: noticia(id, '1975-04-10', foto ? { foto } : {}),
    cajon: 'mes' as const,
    diasAtras: 3,
  });

  it('sube a apertura la primera pieza con foto', () => {
    const salida = maquetar([pieza('sin'), pieza('con', 'con.jpg'), pieza('otra')]);
    expect(salida.map((p) => p.noticia.id)).toEqual(['con', 'sin', 'otra']);
  });

  it('deja el orden intacto si ya abre con foto o si no hay ninguna', () => {
    expect(maquetar([pieza('a', 'a.jpg'), pieza('b')]).map((p) => p.noticia.id)).toEqual(['a', 'b']);
    expect(maquetar([pieza('a'), pieza('b')]).map((p) => p.noticia.id)).toEqual(['a', 'b']);
  });
});

describe('paisDeLiga', () => {
  it('saca el país del id de la liga en los dos formatos', () => {
    expect(paisDeLiga('ita-1-1968-69')).toBe('ITA');
    expect(paisDeLiga('es-primera-9697')).toBe('ESP');
    expect(paisDeLiga('esp-2-1994-95')).toBe('ESP');
    expect(paisDeLiga('')).toBeNull();
  });
});

describe('epocaDe', () => {
  it('corta las épocas por donde cambia la imprenta', () => {
    expect(epocaDe('1933-04-14')).toBe('republica');
    expect(epocaDe('1945-08-15')).toBe('posguerra');
    expect(epocaDe('1969-07-20')).toBe('desarrollo');
    expect(epocaDe('1982-07-11')).toBe('transicion');
    expect(epocaDe('1998-07-12')).toBe('moderno');
    expect(epocaDe('2010-07-11')).toBe('digital');
  });
});
