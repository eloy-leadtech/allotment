import { useMemo, useState } from 'react';
import { loadSeleccionEuro2000, loadSeleccionMundial98 } from '@data';
import { TOURNAMENTS, teamProgress, type SeleccionCareer, type TournamentResult } from '@game';
import { FORMATION_LIST, DEFAULT_FORMATION, type Formation } from '@engine';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { StandingsTable } from '@ui/components/StandingsTable';

type Def = (typeof TOURNAMENTS)[number];

const loadDb = (dbId: string) =>
  dbId === 'seleccion-mundial98' ? loadSeleccionMundial98() : loadSeleccionEuro2000();

/** Render a finished tournament (group stage + knockout) — shared by quick mode and the career final. */
function TournamentResultView({
  result,
  name,
  highlightTeamId,
}: {
  result: TournamentResult;
  name: (id: string) => string;
  highlightTeamId?: string;
}) {
  return (
    <>
      <RetroPanel title="Fase de grupos">
        <div className="groups-grid">
          {result.groups.map((g, i) => (
            <div key={i} className="group">
              <h3>Grupo {String.fromCharCode(65 + i)}</h3>
              <StandingsTable rows={g.standings} teamName={name} highlightTeamId={highlightTeamId} />
            </div>
          ))}
        </div>
      </RetroPanel>

      <RetroPanel title="Eliminatorias">
        {result.knockout.map((round) => (
          <div key={round.nombre} className="ko-round">
            <h3>{round.nombre}</h3>
            <ul className="market-list">
              {round.ties.map((tie, i) => (
                <li key={i} className="ko-tie">
                  <span className={tie.winnerId === tie.homeId ? 'ko-win' : ''}>{name(tie.homeId)}</span>
                  <span className="ko-score">
                    {tie.homeGoals}-{tie.awayGoals}
                    {tie.onPenalties ? ' (pen)' : ''}
                  </span>
                  <span className={tie.winnerId === tie.awayId ? 'ko-win' : ''}>{name(tie.awayId)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </RetroPanel>
    </>
  );
}

/** The carrera de seleccionador view: convocatoria → amistosos → clasificación → final → fin. */
function CareerView({ career, name }: { career: SeleccionCareer; name: (id: string) => string }) {
  const setFormation = useGameStore((s) => s.seleccionSetFormation);
  const advance = useGameStore((s) => s.seleccionAdvance);
  const nextCycle = useGameStore((s) => s.seleccionNextCycle);
  const goTo = useGameStore((s) => s.goTo);

  const { edition, phase } = career;
  const nation = name(career.humanNationId);
  const formation = career.tactics?.formation ?? DEFAULT_FORMATION;

  const header = (
    <header className="season-head">
      <h1>{nation}</h1>
      <span className="matchday">
        {edition.nombre} · Ciclo {career.cycle}
        {career.palmares.length > 0 ? ` · 🏆×${career.palmares.length}` : ''}
      </span>
    </header>
  );

  // --- Convocatoria: pick your formation, then kick off the warm-up friendlies. ---
  if (phase === 'convocatoria') {
    return (
      <main className="screen">
        {header}
        <RetroPanel title="Convocatoria">
          <p>Elige el dibujo táctico de tu selección para este ciclo.</p>
          <div className="team-grid">
            {FORMATION_LIST.map((f: Formation) => (
              <RetroButton
                key={f}
                variant={f === formation ? 'primary' : undefined}
                onClick={() => setFormation(f)}
              >
                {f}
              </RetroButton>
            ))}
          </div>
        </RetroPanel>
        <div className="season-actions">
          <RetroButton variant="primary" onClick={advance}>
            Jugar amistosos →
          </RetroButton>
          <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
        </div>
      </main>
    );
  }

  // --- Amistosos: the warm-up results. ---
  if (phase === 'amistosos') {
    return (
      <main className="screen">
        {header}
        <RetroPanel title="Amistosos de preparación">
          <ul className="market-list">
            {edition.friendlies.map((f, i) => (
              <li key={i} className="ko-tie">
                <span className="ko-win">{name(f.homeId)}</span>
                <span className="ko-score">
                  {f.homeGoals}-{f.awayGoals}
                </span>
                <span>{name(f.opponentId)}</span>
              </li>
            ))}
          </ul>
        </RetroPanel>
        <div className="season-actions">
          <RetroButton variant="primary" onClick={advance}>
            Ir a la clasificación →
          </RetroButton>
          <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
        </div>
      </main>
    );
  }

  // --- Clasificación: your qualifying group + whether you made the finals. ---
  if (phase === 'clasificacion') {
    return (
      <main className="screen">
        {header}
        <p className="champion">
          {edition.qualified ? '✅ CLASIFICADO' : '❌ Eliminado'} —{' '}
          <strong>
            {edition.humanGroupPosition}º de grupo
          </strong>
        </p>
        <RetroPanel title="Tu grupo de clasificación">
          <StandingsTable
            rows={edition.group.standings}
            teamName={name}
            highlightTeamId={career.humanNationId}
          />
          <p className="hint">Clasifican los 2 primeros de cada grupo.</p>
        </RetroPanel>
        {edition.qualified ? (
          <RetroPanel title={`Clasificados (${edition.qualifiedIds.length})`}>
            <p className="hint">{edition.qualifiedIds.map(name).join(' · ')}</p>
          </RetroPanel>
        ) : null}
        <div className="season-actions">
          <RetroButton variant="primary" onClick={advance}>
            {edition.qualified ? 'Jugar la fase final →' : 'Ver resumen →'}
          </RetroButton>
          <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
        </div>
      </main>
    );
  }

  // --- Final: the tournament itself (reusing the shared result view). ---
  if (phase === 'final' && edition.final) {
    return (
      <main className="screen">
        <header className="season-head">
          <h1>{edition.nombre}</h1>
          <span className="matchday">🏆 {name(edition.final.championId)}</span>
        </header>
        <p className="champion">
          {nation} — <strong>{edition.finish}</strong>
        </p>
        <TournamentResultView
          result={edition.final}
          name={name}
          highlightTeamId={career.humanNationId}
        />
        <div className="season-actions">
          <RetroButton variant="primary" onClick={advance}>
            Ver resumen →
          </RetroButton>
          <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
        </div>
      </main>
    );
  }

  // --- Fin del ciclo: outcome, palmarés, history and the road to the next edition. ---
  return (
    <main className="screen">
      {header}
      <p className="champion">
        Ciclo {career.cycle}: <strong>{edition.finish}</strong>
      </p>
      {career.palmares.length > 0 ? (
        <RetroPanel title="Palmarés">
          <ul className="market-list">
            {career.palmares.map((t, i) => (
              <li key={i}>
                🏆 {t.nombre} (ciclo {t.cycle})
              </li>
            ))}
          </ul>
        </RetroPanel>
      ) : null}
      <RetroPanel title="Historial">
        <ul className="market-list">
          {[...career.history, {
            cycle: edition.cycle,
            nombre: edition.nombre,
            qualified: edition.qualified,
            finish: edition.finish,
            champion: edition.champion,
          }].map((h, i) => (
            <li key={i}>
              Ciclo {h.cycle} — {h.nombre}: <strong>{h.finish}</strong>
            </li>
          ))}
        </ul>
      </RetroPanel>
      <div className="season-actions">
        <RetroButton variant="primary" onClick={nextCycle}>
          Siguiente clasificación →
        </RetroButton>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </div>
    </main>
  );
}

export function TournamentScreen() {
  const tournament = useGameStore((s) => s.tournament);
  const nationId = useGameStore((s) => s.tournamentNationId);
  const tournamentId = useGameStore((s) => s.tournamentId);
  const startTournament = useGameStore((s) => s.startTournament);
  const seleccionCareer = useGameStore((s) => s.seleccionCareer);
  const seleccionSaveExists = useGameStore((s) => s.seleccionSaveExists);
  const startSeleccionCareer = useGameStore((s) => s.startSeleccionCareer);
  const resumeSeleccionCareer = useGameStore((s) => s.resumeSeleccionCareer);
  const goTo = useGameStore((s) => s.goTo);

  // Top-level mode: the menu, the standalone "quick" tournament, or the career.
  const [mode, setMode] = useState<'menu' | 'quick' | 'career'>(seleccionCareer ? 'career' : 'menu');
  // Picker sub-flow (shared by quick + career entry): 'tournament' -> 'nation' -> null.
  const [phase, setPhase] = useState<'tournament' | 'nation' | null>(null);
  const [chosenDef, setChosenDef] = useState<Def | null>(null);

  const activeDef: Def =
    (mode === 'career' && seleccionCareer
      ? TOURNAMENTS.find((t) => t.id === seleccionCareer.tournamentId)
      : null) ??
    chosenDef ??
    TOURNAMENTS.find((t) => t.id === tournamentId) ??
    TOURNAMENTS[0]!;

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of loadDb(activeDef.dbId).equipos) map.set(t.id, t.nombre);
    return map;
  }, [activeDef]);
  const name = (id: string): string => nameById.get(id) ?? id;

  // The nation list depends on mode: quick = the historical finalists; career = every nation.
  const nations = useMemo(() => {
    const ids =
      mode === 'career'
        ? loadDb(activeDef.dbId).equipos.map((t) => t.id)
        : [...activeDef.finalistIds];
    return ids.sort((a, b) => name(a).localeCompare(name(b)));
  }, [activeDef, mode, nameById]);

  // ===== Career mode =====
  if (mode === 'career' && seleccionCareer) {
    return <CareerView career={seleccionCareer} name={name} />;
  }

  // ===== Main menu =====
  if (mode === 'menu') {
    return (
      <main className="screen">
        <header className="season-head">
          <h1>Selecciones</h1>
          <span className="matchday">Elige modo</span>
        </header>
        <div className="team-grid">
          <RetroButton
            variant="primary"
            onClick={() => { setMode('career'); setPhase('tournament'); setChosenDef(null); }}
          >
            Carrera de seleccionador
          </RetroButton>
          {seleccionSaveExists ? (
            <RetroButton onClick={() => { resumeSeleccionCareer(); setMode('career'); }}>
              Reanudar carrera
            </RetroButton>
          ) : null}
          <RetroButton
            onClick={() => { setMode('quick'); setPhase('tournament'); setChosenDef(null); }}
          >
            Torneo rápido
          </RetroButton>
        </div>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const showQuickResult = mode === 'quick' && tournament !== null && phase === null;

  // ===== Step 1: choose the tournament (quick + career entry) =====
  if (!showQuickResult && phase !== 'nation') {
    return (
      <main className="screen">
        <header className="season-head">
          <h1>{mode === 'career' ? 'Carrera de seleccionador' : 'Torneo rápido'}</h1>
          <span className="matchday">Elige competición</span>
        </header>
        <div className="team-grid">
          {TOURNAMENTS.map((def) => (
            <RetroButton key={def.id} variant="primary" onClick={() => { setChosenDef(def); setPhase('nation'); }}>
              {def.nombre}
            </RetroButton>
          ))}
        </div>
        <RetroButton onClick={() => setMode('menu')}>Atrás</RetroButton>
      </main>
    );
  }

  // ===== Step 2: choose your nation =====
  if (!showQuickResult) {
    return (
      <main className="screen">
        <header className="season-head">
          <h1>{activeDef.nombre}</h1>
          <span className="matchday">Elige tu selección</span>
        </header>
        <div className="team-grid">
          {nations.map((id) => (
            <RetroButton
              key={id}
              onClick={() => {
                if (mode === 'career') startSeleccionCareer(activeDef.id, id);
                else { startTournament(activeDef.id, id); setChosenDef(null); setPhase(null); }
              }}
            >
              {name(id)}
            </RetroButton>
          ))}
        </div>
        <RetroButton onClick={() => setPhase('tournament')}>Atrás</RetroButton>
      </main>
    );
  }

  // ===== Quick-mode result view =====
  const played = tournament!;
  const yourRun = nationId ? teamProgress(played, nationId) : null;

  return (
    <main className="screen">
      <header className="season-head">
        <h1>{activeDef.nombre}</h1>
        <span className="matchday">🏆 {name(played.championId)}</span>
      </header>

      {nationId ? (
        <p className="champion">
          {name(nationId)} — <strong>{yourRun}</strong>
        </p>
      ) : null}

      <TournamentResultView result={played} name={name} highlightTeamId={nationId ?? undefined} />

      <div className="season-actions">
        <RetroButton variant="primary" onClick={() => { setPhase('tournament'); setChosenDef(null); }}>
          Jugar otro
        </RetroButton>
        <RetroButton onClick={() => setMode('menu')}>Modos</RetroButton>
      </div>
    </main>
  );
}
