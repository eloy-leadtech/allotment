import { useMemo, useState } from 'react';
import {
  antetitulo,
  brevesDelDia,
  epocaDe,
  lemaDeEpoca,
  fechaDeJornada,
  maquetar,
  paisDeLiga,
  periodicoDelDia,
  personajesDelDia,
  suplementoDelDia,
  teamName,
  type NoticiaDelDia,
  type PiezaDeportiva,
  type PiezaPersonaje,
} from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { usePrensa, useSuplemento, urlFoto, type CreditoImagen } from '@ui/hooks/usePrensa';
import { Crest } from '@ui/components/Crest';
import { urlRetrato } from '@ui/hooks/useFichaPhoto';
import { RetroButton } from '@ui/components/RetroButton';
import { GestHeader } from '@ui/components/GestHeader';

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "1969-07-20" -> "domingo, 20 de julio de 1969". */
function fechaLarga(iso: string): string {
  const anio = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  const dia = Number(iso.slice(8, 10));
  const nombreDia = DIAS[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()] ?? '';
  return `${nombreDia}, ${dia} de ${MESES[mes - 1] ?? ''} de ${anio}`;
}

/** El ámbito, en la etiqueta que se imprime en la sección. */
const SECCION: Record<string, string> = {
  mundo: 'Internacional',
  futbol: 'Fútbol',
  deporte: 'Deportes',
  cultura: 'Cultura',
  ciencia: 'Ciencia',
  sociedad: 'Sociedad',
};

/** Una pieza del periódico: la de apertura va a lo ancho y con foto grande. */
function Pieza({ pieza, apertura }: { pieza: NoticiaDelDia; apertura?: boolean }) {
  const { noticia } = pieza;
  // Si la foto no está en disco (el paquete de imágenes se genera aparte) la
  // pieza se maqueta sin ella en vez de dejar el hueco roto.
  const [sinFoto, setSinFoto] = useState(false);
  return (
    <article className={`diario-pieza${apertura ? ' diario-pieza--apertura' : ''}`}>
      {noticia.foto && !sinFoto ? (
        <figure className="diario-pieza__foto">
          <img
            src={urlFoto(noticia.foto)}
            alt={noticia.titular.toLowerCase()}
            onError={() => setSinFoto(true)}
          />
        </figure>
      ) : null}
      <div className="diario-pieza__texto">
        <p className="diario-pieza__ante">
          <span className="diario-pieza__cajon">{antetitulo(pieza)}</span>
          <span className="diario-pieza__seccion">{SECCION[noticia.ambito] ?? ''}</span>
        </p>
        <h3 className="diario-pieza__titular">{noticia.titular}</h3>
        <p className="diario-pieza__cuerpo">{noticia.cuerpo}</p>
      </div>
    </article>
  );
}

/**
 * Pieza del suplemento deportivo. El marcador va en su propia chapa y por eso el
 * titular nunca lo repite; la foto es el retrato real del mejor jugador del
 * equipo que da la noticia esa temporada.
 */
function PiezaDep({
  pieza,
  apertura,
}: {
  pieza: PiezaDeportiva | PiezaPersonaje;
  apertura?: boolean;
}) {
  const [sinFoto, setSinFoto] = useState(false);
  const retrato = pieza.foto && !sinFoto;
  return (
    <article className={`diario-dep${apertura ? ' diario-dep--apertura' : ''}`}>
      <figure className="diario-dep__foto">
        {retrato ? (
          <img src={urlRetrato(pieza.foto!)} alt="" onError={() => setSinFoto(true)} />
        ) : pieza.escudo ? (
          <span className="diario-dep__escudo">
            <Crest teamId={pieza.escudo} size={64} />
          </span>
        ) : pieza.trofeo ? (
          <span className="diario-dep__trofeo">
            <img
              src={`${import.meta.env.BASE_URL}prensa/trofeos/${pieza.trofeo}.png`}
              alt=""
            />
          </span>
        ) : (
          // Sin imagen posible: placa tipográfica, como cuando el periódico no
          // tenía foto del partido y componía el nombre de la competición.
          <span className="diario-dep__placa">{pieza.seccion}</span>
        )}
        {/* Si el retrato no llega, el pie no puede seguir nombrando al jugador. */}
        <figcaption>{retrato || pieza.escudo ? (pieza.pie ?? pieza.seccion) : pieza.seccion}</figcaption>
      </figure>
      <div className="diario-pieza__texto">
        <p className="diario-pieza__ante">
          <span className="diario-pieza__seccion">{pieza.seccion}</span>
          <span className="diario-dep__marcador">{pieza.marcador}</span>
        </p>
        <h3 className="diario-pieza__titular">{pieza.titular}</h3>
        <p className="diario-pieza__cuerpo">{pieza.cuerpo}</p>
      </div>
    </article>
  );
}

/** Ficha de crédito de una imagen (autor, licencia y enlace a la fuente). */
function Credito({ credito }: { credito: CreditoImagen }) {
  return (
    <li className="diario-credito">
      <span className="diario-credito__autor">{credito.autor || 'Autor no acreditado'}</span>
      <span className="diario-credito__licencia">{credito.licencia}</span>
      <a href={credito.fuente} target="_blank" rel="noreferrer noopener">
        fuente
      </a>
    </li>
  );
}

/**
 * EL QUIOSCO: el periódico de la jornada. Recoge lo que pasaba de verdad en el
 * mundo la semana en que se juega — mundo, ciencia, cultura, deporte y fútbol —
 * con su foto libre cuando la hay. Nunca publica nada posterior a la jornada, y
 * no recicla efemérides de otros años: cada periódico habla de su propio momento.
 */
export function DiarioScreen() {
  const season = useGameStore((s) => s.season);
  const goTo = useGameStore((s) => s.goTo);
  const prensa = usePrensa();
  const suplemento = useSuplemento(season?.temporada ?? null);
  const [atras, setAtras] = useState(0);
  const [verCreditos, setVerCreditos] = useState(false);
  const [seccion, setSeccion] = useState<'portada' | 'deportes'>('portada');

  const jornadaActual = season
    ? Math.min(Math.max(season.currentMatchday, 1), season.totalMatchdays)
    : 1;
  const jornada = Math.max(1, jornadaActual - atras);

  const fecha = useMemo(() => {
    if (!prensa || !season) return null;
    return fechaDeJornada(prensa.calendario, season.temporada, jornada);
  }, [prensa, season, jornada]);

  const piezas = useMemo(() => {
    if (!prensa || !fecha || !season) return [];
    // Se piden un par de más para que la apertura pueda ser una con foto sin
    // dejar el periódico corto.
    const pais = paisDeLiga(season.leagueId);
    // La hoja se lee bajando, así que no hay motivo para dejarse noticias fuera.
    return maquetar(periodicoDelDia(prensa.indice, fecha, 12, pais));
  }, [prensa, fecha, season]);

  const deportes = useMemo(() => {
    if (!suplemento || !fecha || !season) return [];
    // Tu propio partido tiene sus pantallas: el suplemento cuenta el resto.
    return suplementoDelDia(
      suplemento,
      fecha,
      5,
      paisDeLiga(season.leagueId),
      teamName(season, season.humanTeamId),
    );
  }, [suplemento, fecha, season]);

  const personajes = useMemo(() => {
    if (!suplemento || !fecha || !season) return [];
    return personajesDelDia(suplemento, fecha, 4, paisDeLiga(season.leagueId));
  }, [suplemento, fecha, season]);

  const breves = useMemo(() => {
    if (!suplemento || !fecha || !season) return [];
    return brevesDelDia(
      suplemento,
      fecha,
      deportes,
      6,
      teamName(season, season.humanTeamId),
    );
  }, [suplemento, fecha, season, deportes]);

  if (!season) {
    return (
      <main className="screen">
        <p>No hay temporada en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const epoca = epocaDe(fecha ?? '1990-01-01');

  const creditos = piezas
    .map((p) => prensa?.creditos.get(p.noticia.id))
    .filter((c): c is CreditoImagen => c != null);

  const [apertura, ...resto] = piezas;

  return (
    <main className="screen screen--diario">
      <GestHeader
        title="El quiosco"
        subtitle="Lo que pasaba en el mundo la semana de la jornada"
        icon="📰"
        chips={[
          { label: 'Jornada', value: jornada },
          { label: 'Temporada', value: season.temporada },
          { label: 'Noticias', value: prensa ? prensa.total : '…' },
        ]}
      />

      <nav className="diario__secciones">
        <RetroButton
          onClick={() => setSeccion('portada')}
          disabled={seccion === 'portada'}
        >
          Portada
        </RetroButton>
        <RetroButton
          onClick={() => setSeccion('deportes')}
          disabled={seccion === 'deportes'}
        >
          Deportes
        </RetroButton>
      </nav>

      <div
        className={`diario diario--${epoca}${
          seccion !== 'portada' ? ' diario--deportes' : ''
        }`}
      >
        <header className="diario__cabecera">
          <h2 className="diario__cabecera-nombre">
            LA GACETA
            {seccion === 'deportes' ? (
              <em className="diario__suplemento">DEPORTES</em>
            ) : null}
          </h2>
          <p className="diario__cabecera-lema">{lemaDeEpoca(epoca)}</p>
          <p className="diario__cabecera-fecha">{fecha ? fechaLarga(fecha) : 'Cargando…'}</p>
        </header>

        {seccion === 'deportes' ? (
          !suplemento ? (
            <p className="diario__aviso">Abriendo el suplemento…</p>
          ) : deportes.length === 0 && personajes.length === 0 ? (
            <p className="diario__aviso">Semana sin competición.</p>
          ) : (
            <>
              {deportes.length > 0 ? (
                <>
                  <p className="diario__lema">Lo que dejó la jornada en Europa</p>
                  <PiezaDep pieza={deportes[0]!} apertura />
                  {deportes.length > 1 ? (
                    <div className="diario__columnas diario__columnas--dep">
                      {deportes.slice(1).map((p) => (
                        <PiezaDep key={p.titular + p.marcador} pieza={p} />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}

              {personajes.length > 0 ? (
                <>
                  <p className="diario__lema diario__lema--sep">
                    Los que entran y los que se van
                  </p>
                  <div className="diario__columnas diario__columnas--dep">
                    {personajes.map((p) => (
                      <PiezaDep key={p.titular} pieza={p} />
                    ))}
                  </div>
                </>
              ) : null}

              {breves.length > 0 ? (
                <div className="diario__breves">
                  <p className="diario__lema">Y además</p>
                  <ul>
                    {breves.map((b) => (
                      <li key={b.titular + b.marcador}>
                        <span className="diario__breve-marcador">{b.marcador}</span>
                        <span className="diario__breve-texto">{b.titular}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )
        ) : !prensa ? (
          <p className="diario__aviso">Abriendo el periódico…</p>
        ) : piezas.length === 0 ? (
          <p className="diario__aviso">
            No hay nada archivado de estos días. La hemeroteca del mundo todavía no
            llega a esta fecha.
          </p>
        ) : (
          <>
            <Pieza pieza={apertura!} apertura />
            {resto.length > 0 ? (
              <div className="diario__columnas">
                {resto.map((p) => (
                  <Pieza key={p.noticia.id} pieza={p} />
                ))}
              </div>
            ) : null}
          </>
        )}

        <footer className="diario__pie">
          <RetroButton onClick={() => setAtras((a) => a + 1)} disabled={jornada <= 1}>
            ◀ Número anterior
          </RetroButton>
          <RetroButton onClick={() => setAtras((a) => Math.max(0, a - 1))} disabled={atras === 0}>
            Número siguiente ▶
          </RetroButton>
          {creditos.length > 0 ? (
            <RetroButton onClick={() => setVerCreditos((v) => !v)}>
              {verCreditos ? 'Ocultar créditos' : 'Créditos de las fotos'}
            </RetroButton>
          ) : null}
          <RetroButton onClick={() => goTo('season')}>Volver al despacho</RetroButton>
        </footer>

        {verCreditos && creditos.length > 0 ? (
          <ul className="diario__creditos">
            {creditos.map((c) => (
              <Credito key={c.id} credito={c} />
            ))}
          </ul>
        ) : null}
      </div>
    </main>
  );
}
