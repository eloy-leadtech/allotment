import { create } from 'zustand';
import {
  SEASONS,
  getSeason,
  getSegundaByTemporada,
  getSeasonByTemporada,
  getEuropaByTemporada,
  nextSeasonByTemporada,
  loadSeleccionEuro2000,
  loadSeleccionMundial98,
  fetchLeague,
  catalogEntry,
  catalogFor,
  catalogCountries,
  type League,
  type SeasonEntry,
} from '@data';
import {
  newCareer,
  applyTransition,
  applyDivisionChange,
  careerOutcome,
  nextDivision,
  setCareerTactics,
  advanceMatchday,
  serializeCareer,
  restoreCareer,
  generateBids,
  buyPlayer,
  negotiateBuy,
  acceptCounter,
  acceptBid,
  formatEuros,
  toCompetitionTeam,
  runCareerCopa,
  runCareerEuropa,
  europaQualification,
  currentStandings,
  humanFate,
  seasonIncome,
  runTournament,
  TOURNAMENTS,
  type SeasonIncome,
  type CareerState,
  type CareerTactics,
  type SeasonState,
  type TournamentResult,
  type Bid,
} from '@game';
import type { MatchResult } from '@engine';
import type { Screen } from '@app/navigation';
import { listSlots, readSlot, writeSlot, deleteSlot, type SlotInfo } from '@ui/persistence/saveSlots';

/** A fresh 32-bit seed from the browser CSPRNG (kept in /ui, not the engine). */
function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] ?? 1;
}

/** The next real season after a given league id, or null if there is none yet. */
export function nextSeasonEntry(leagueId: string): SeasonEntry | null {
  const idx = SEASONS.findIndex((s) => s.id === leagueId);
  if (idx < 0) return null;
  return SEASONS[idx + 1] ?? null;
}

/**
 * Build this season's Copa del Rey over the whole domestic field (the human's
 * division plus the other division for that year) and attach it to the career.
 */
function attachCopa(career: CareerState): CareerState {
  const other =
    career.division === 'primera'
      ? getSegundaByTemporada(career.temporada)
      : getSeasonByTemporada(career.temporada);
  const otherTeams = other ? other.load().equipos.map(toCompetitionTeam) : [];
  const domestic = [...career.season.teams, ...otherTeams];
  return { ...career, copa: runCareerCopa(career.seed, career.seasonNumber, domestic) };
}

/**
 * Build this season's European competitions (Champions + UEFA) and attach them
 * to the career. The human is injected into whichever they qualified for by last
 * season's league finish (`history` tail); no European data for a season (e.g.
 * the earliest ones) simply means no continental play that year.
 */
function attachEuropa(career: CareerState): CareerState {
  const entry = getEuropaByTemporada(career.temporada);
  const humanTeam = career.season.teams.find((t) => t.id === career.humanTeamId);
  if (!entry || !humanTeam) return career;
  const europaClubs = entry.load().equipos.map(toCompetitionTeam);
  const last = career.history.at(-1);
  const comp = europaQualification(last?.division, last?.humanPosition);
  return {
    ...career,
    europa: runCareerEuropa(career.seed, career.seasonNumber, career.temporada, europaClubs, {
      team: humanTeam,
      comp,
    }),
  };
}

/** Mean rating of a club's best 11, for seeding the European field. */
function poolStrength(players: readonly { media: number }[]): number {
  const best = [...players].map((p) => p.media).sort((a, b) => b - a).slice(0, 11);
  return best.length ? best.reduce((s, m) => s + m, 0) / best.length : 0;
}

/**
 * Assemble a European field for a catalogue season: the three strongest clubs
 * of every country's Primera that year (ids namespaced by country so slugs from
 * different leagues never collide in the draw). Fetches are cached, so the
 * ~14 league loads only happen once per season.
 */
async function buildCatalogEuropaPool(seasonStr: string, excludeTeamId: string) {
  const pool: ReturnType<typeof toCompetitionTeam>[] = [];
  for (const c of catalogCountries()) {
    const entry = catalogFor(c.code, '1').find((e) => e.season === seasonStr);
    if (!entry) continue;
    try {
      const lg = await fetchLeague(entry.id);
      const top = lg.equipos
        .map(toCompetitionTeam)
        .sort((a, b) => poolStrength(b.players) - poolStrength(a.players))
        .slice(0, 3);
      for (const t of top) {
        if (t.id === excludeTeamId) continue;
        pool.push({ ...t, id: `${c.code}-${t.id}` });
      }
    } catch {
      /* liga ausente ese año: se omite */
    }
  }
  return pool;
}

interface GameStore {
  screen: Screen;
  /** Season chosen for the next new game. */
  seasonId: string;
  /** Seed chosen for the next new game (deterministic once fixed). */
  seed: number;
  /** League loaded for the chosen season (drives team select). */
  league: League;
  /**
   * True when the current/next game is a catalogue league (any of the 692), not
   * one of the hand-built classic Spanish seasons. Catalogue careers skip the
   * Spain-only cup/Europe attach and chain by the catalogue, not the SEASONS
   * registry.
   */
  isCatalogCareer: boolean;
  /** id→nombre for the European field of a catalogue career (ids are namespaced). */
  europaNames: Record<string, string>;
  /** The whole career (source of truth); null before a game starts. */
  career: CareerState | null;
  /** Mirror of `career.season`, the in-progress season (drives the season screens). */
  season: SeasonState | null;
  /** Results of the most recently played matchday (for the season screen list). */
  lastResults: MatchResult[];
  viewingMatch: MatchResult | null;
  /** Current-squad player ids the human chose to RETAIN at season end. */
  retainIds: string[];
  /** A finished national-team tournament (Euro 2000), if one was played. */
  tournament: TournamentResult | null;
  /** The nation the human picked for the tournament. */
  tournamentNationId: string | null;
  /** Which tournament was played ('euro2000' | 'mundial98'). */
  tournamentId: string | null;
  /** AI offers for your players this transfer window (snapshot on market entry). */
  bids: Bid[];
  /** Last market action feedback for the UI (e.g. "sin presupuesto"). */
  marketMessage: string | null;
  /** A pending counter-offer from a selling club: {playerId, counter} euros. */
  counterOffer: { playerId: string; counter: number } | null;
  /** Income breakdown from the season just finished (shown on the market screen). */
  lastIncome: SeasonIncome | null;
  /** Snapshot of the save slots (for the slots screen). */
  slots: Array<SlotInfo | null>;
  goTo: (screen: Screen) => void;
  chooseSeason: (id: string) => void;
  /** Load a catalogue league by id (async) and go to team select. */
  openCatalogLeague: (leagueId: string) => Promise<void>;
  setSeed: (seed: number) => void;
  randomizeSeed: () => void;
  startCareer: (teamId: string) => void;
  /** Advance a catalogue career to the next season of the same country/division. */
  continueCatalogCareer: () => void;
  playNextMatchday: () => void;
  watchNextMatchday: () => void;
  toggleRetain: (playerId: string) => void;
  setTactics: (tactics: CareerTactics) => void;
  startTournament: (tournamentId: string, nationId: string) => void;
  continueCareer: () => void;
  buyInMarket: (playerId: string) => void;
  makeOffer: (playerId: string, amount: number) => void;
  acceptCounterOffer: () => void;
  dismissCounter: () => void;
  acceptMarketBid: (bid: Bid) => void;
  startSeasonFromMarket: () => void;
  openMatch: (result: MatchResult) => void;
  refreshSlots: () => void;
  saveToSlot: (slot: number) => void;
  loadFromSlot: (slot: number) => void;
  deleteSlotAt: (slot: number) => void;
}

/**
 * The single bridge between the React UI and the pure game/engine layers. Every
 * action delegates to `@game`; components never run simulation logic themselves.
 * A career owns the world; `season` mirrors its in-progress season for the views.
 */
export const useGameStore = create<GameStore>((set, get) => {
  // Default to 96/97 (the flagship, full-fidelity season); 95/96 is selectable
  // but its attributes are synthesized.
  const first = getSeason('es-primera-9697') ?? SEASONS[0];
  if (!first) {
    throw new Error('No seasons available');
  }
  return {
    screen: 'title',
    seasonId: first.id,
    seed: randomSeed(),
    league: first.load(),
    isCatalogCareer: false,
    europaNames: {},
    career: null,
    season: null,
    lastResults: [],
    viewingMatch: null,
    retainIds: [],
    tournament: null,
    tournamentNationId: null,
    tournamentId: null,
    bids: [],
    marketMessage: null,
    counterOffer: null,
    lastIncome: null,
    slots: listSlots(),
    goTo: (screen) => set({ screen }),
    chooseSeason: (id) => {
      const entry = getSeason(id);
      if (entry) set({ seasonId: id, league: entry.load(), isCatalogCareer: false });
    },
    openCatalogLeague: async (leagueId) => {
      const league = await fetchLeague(leagueId);
      set({ seasonId: leagueId, league, isCatalogCareer: true, screen: 'teamSelect' });
    },
    setSeed: (seed) => set({ seed }),
    randomizeSeed: () => set({ seed: randomSeed() }),
    startCareer: (teamId) => {
      const { league, seed, isCatalogCareer } = get();
      const base = newCareer(league, teamId, seed);
      // Copa del Rey and European cups are wired to the Spanish registry only;
      // a catalogue league (any country) plays its league season without them
      // until foreign competitions arrive (Fase 3).
      const career = isCatalogCareer ? base : attachEuropa(attachCopa(base));
      set({
        career,
        season: career.season,
        lastResults: [],
        viewingMatch: null,
        retainIds: [],
        bids: [],
        marketMessage: null,
        screen: 'season',
      });
    },
    continueCatalogCareer: () => {
      const { career, retainIds, league } = get();
      if (!career) return;
      const cur = catalogEntry(career.leagueId);
      if (!cur) return;
      const byYear = (list: typeof cur[]) => list.slice().sort((a, b) => a.season.localeCompare(b.season));
      const div1 = byYear(catalogFor(cur.country, '1'));
      const div2 = byYear(catalogFor(cur.country, '2'));
      const curChain = cur.division === '2' ? div2 : div1;
      const idx = curChain.findIndex((e) => e.id === career.leagueId);
      const nextSeasonStr = idx >= 0 ? curChain[idx + 1]?.season : undefined;
      if (!nextSeasonStr) {
        set({ marketMessage: 'No hay más temporadas de esta liga en el catálogo.' });
        return;
      }
      // Promotion/relegation from the finished table.
      const relegationSpots = league.competicion.relegationSpots || 3;
      const finishedStandings = currentStandings(career.season);
      const humanPos = finishedStandings.findIndex((r) => r.teamId === career.humanTeamId) + 1;
      const outcome = humanFate({
        division: cur.division === '2' ? 'segunda' : 'primera',
        standings: finishedStandings,
        humanTeamId: career.humanTeamId,
        relegationSpots,
        promotionSpots: relegationSpots,
      });
      let targetDiv = cur.division;
      if (outcome === 'relegated' && cur.division === '1') targetDiv = '2';
      if (outcome === 'promoted' && cur.division === '2') targetDiv = '1';
      let targetEntry = (targetDiv === '2' ? div2 : div1).find((e) => e.season === nextSeasonStr);
      let changedDiv = targetDiv !== cur.division;
      if (!targetEntry) {
        // Target division has no data that year: stay in the current one.
        targetEntry = curChain.find((e) => e.season === nextSeasonStr);
        changedDiv = false;
        targetDiv = cur.division;
      }
      if (!targetEntry) {
        set({ marketMessage: 'No hay más temporadas de esta liga en el catálogo.' });
        return;
      }
      const target = targetEntry;
      const finalDiv = targetDiv;
      void (async () => {
        try {
          const targetLeague = await fetchLeague(target.id);
          const income = seasonIncome(career);
          const transitioned = changedDiv
            ? applyDivisionChange(career, finalDiv === '2' ? 'segunda' : 'primera', targetLeague)
            : applyTransition(career, targetLeague, new Set(retainIds));
          let nextCareer = { ...transitioned, budget: transitioned.budget + income.total };
          let europaNames: Record<string, string> = {};
          // European qualification from the finished Primera season.
          try {
            const comp = europaQualification(cur.division === '1' ? 'primera' : 'segunda', humanPos);
            const humanTeam = nextCareer.season.teams.find((t) => t.id === nextCareer.humanTeamId);
            if (comp && humanTeam) {
              const pool = await buildCatalogEuropaPool(target.season, nextCareer.humanTeamId);
              if (pool.length >= 8) {
                europaNames = Object.fromEntries(pool.map((t) => [t.id, t.nombre]));
                nextCareer = {
                  ...nextCareer,
                  europa: runCareerEuropa(
                    nextCareer.seed,
                    nextCareer.seasonNumber,
                    nextCareer.temporada,
                    pool,
                    { team: humanTeam, comp },
                  ),
                };
              }
            }
          } catch {
            /* Europa es opcional: si falla, la temporada sigue sin ella */
          }
          set({
            career: nextCareer,
            season: nextCareer.season,
            seasonId: target.id,
            league: targetLeague,
            isCatalogCareer: true,
            europaNames,
            retainIds: [],
            bids: generateBids(nextCareer),
            marketMessage: changedDiv
              ? finalDiv === '1'
                ? '¡Ascenso a Primera División!'
                : 'Desciendes a Segunda División.'
              : null,
            counterOffer: null,
            lastIncome: income,
            lastResults: [],
            viewingMatch: null,
            screen: 'market',
          });
        } catch {
          set({ marketMessage: 'No se pudo avanzar a la siguiente temporada.' });
        }
      })();
    },
    playNextMatchday: () => {
      const { career } = get();
      if (!career) return;
      const step = advanceMatchday(career.season);
      set({ career: { ...career, season: step.state }, season: step.state, lastResults: step.played });
    },
    watchNextMatchday: () => {
      const { career } = get();
      if (!career) return;
      const step = advanceMatchday(career.season);
      // Show the human's own match live (teletype); the rest is simulated too.
      const mine =
        step.played.find(
          (r) => r.homeId === career.humanTeamId || r.awayId === career.humanTeamId,
        ) ?? null;
      set({
        career: { ...career, season: step.state },
        season: step.state,
        lastResults: step.played,
        viewingMatch: mine,
        screen: mine ? 'match' : 'season',
      });
    },
    toggleRetain: (playerId) =>
      set((state) => ({
        retainIds: state.retainIds.includes(playerId)
          ? state.retainIds.filter((id) => id !== playerId)
          : [...state.retainIds, playerId],
      })),
    setTactics: (tactics) => {
      const { career } = get();
      if (!career) return;
      const next = setCareerTactics(career, tactics);
      set({ career: next, season: next.season });
    },
    continueCareer: () => {
      const { career, retainIds } = get();
      if (!career) return;
      // Seasons advance by year; the human's division depends on their result.
      const nextPrimera = nextSeasonByTemporada(career.temporada);
      if (!nextPrimera) return; // no more seasons available yet
      const toDivision = nextDivision(career.division, careerOutcome(career));
      const targetEntry =
        toDivision === 'primera' ? nextPrimera : getSegundaByTemporada(nextPrimera.temporada);
      if (!targetEntry) return; // no data for the target division that year
      const targetLeague = targetEntry.load();
      // The finished season pays out: TV, gate, league prize and cup/European
      // bonuses, added to the budget carried into the transfer window.
      const income = seasonIncome(career);
      const transitioned = attachEuropa(
        attachCopa(
          toDivision === career.division
            ? applyTransition(career, targetLeague, new Set(retainIds))
            : applyDivisionChange(career, toDivision, targetLeague),
        ),
      );
      const next = { ...transitioned, budget: transitioned.budget + income.total };
      // Between seasons the transfer window opens: buy/sell before kick-off.
      set({
        career: next,
        season: next.season,
        seasonId: targetEntry.id,
        league: targetLeague,
        retainIds: [],
        bids: generateBids(next),
        marketMessage: null,
        counterOffer: null,
        lastIncome: income,
        lastResults: [],
        viewingMatch: null,
        screen: 'market',
      });
    },
    buyInMarket: (playerId) => {
      const { career } = get();
      if (!career) return;
      const result = buyPlayer(career, playerId);
      if (!result.ok) {
        set({ marketMessage: result.reason === 'presupuesto' ? 'No te llega el presupuesto.' : 'No disponible.' });
        return;
      }
      set({ career: result.career, season: result.career.season, marketMessage: null });
    },
    makeOffer: (playerId, amount) => {
      const { career } = get();
      if (!career) return;
      const outcome = negotiateBuy(career, playerId, amount);
      switch (outcome.status) {
        case 'accepted':
          set({
            career: outcome.career,
            season: outcome.career.season,
            marketMessage: `Fichaje cerrado por ${formatEuros(outcome.price)}.`,
            counterOffer: null,
          });
          return;
        case 'countered':
          set({
            marketMessage: `El club rechaza tu oferta pero acepta ${formatEuros(outcome.counter)}.`,
            counterOffer: { playerId, counter: outcome.counter },
          });
          return;
        case 'no-budget':
          set({ marketMessage: 'No te llega el presupuesto para esa cifra.', counterOffer: null });
          return;
        case 'rejected':
          set({ marketMessage: 'Oferta demasiado baja: el club la rechaza.', counterOffer: null });
          return;
        default:
          set({ marketMessage: 'Jugador no disponible.', counterOffer: null });
      }
    },
    acceptCounterOffer: () => {
      const { career, counterOffer } = get();
      if (!career || !counterOffer) return;
      const result = acceptCounter(career, counterOffer.playerId, counterOffer.counter);
      if (!result.ok) {
        set({ marketMessage: result.reason === 'presupuesto' ? 'No te llega el presupuesto.' : 'No disponible.' });
        return;
      }
      set({
        career: result.career,
        season: result.career.season,
        marketMessage: `Fichaje cerrado por ${formatEuros(counterOffer.counter)}.`,
        counterOffer: null,
      });
    },
    dismissCounter: () => set({ counterOffer: null, marketMessage: null }),
    acceptMarketBid: (bid) => {
      const { career, bids } = get();
      if (!career) return;
      const result = acceptBid(career, bid);
      if (!result.ok) return;
      set({
        career: result.career,
        season: result.career.season,
        bids: bids.filter((b) => b.playerId !== bid.playerId),
        marketMessage: null,
      });
    },
    startSeasonFromMarket: () => set({ screen: 'season', marketMessage: null }),
    startTournament: (tournamentId, nationId) => {
      const def = TOURNAMENTS.find((t) => t.id === tournamentId);
      if (!def) return;
      const league = def.dbId === 'seleccion-mundial98' ? loadSeleccionMundial98() : loadSeleccionEuro2000();
      const teams = league.equipos
        .filter((t) => def.finalistIds.includes(t.id))
        .map(toCompetitionTeam);
      const tournament = runTournament(teams, get().seed, def.numGroups);
      set({ tournament, tournamentNationId: nationId, tournamentId, screen: 'tournament' });
    },
    openMatch: (result) => set({ viewingMatch: result, screen: 'match' }),
    refreshSlots: () => set({ slots: listSlots() }),
    saveToSlot: (slot) => {
      const { career } = get();
      if (!career) return;
      writeSlot(slot, serializeCareer(career), Date.now());
      set({ slots: listSlots() });
    },
    loadFromSlot: (slot) => {
      const info = readSlot(slot);
      if (!info) return;
      const leagueId = info.save.leagueId;
      const classic = getSeason(leagueId);
      const enter = (league: League, isCatalog: boolean): void => {
        const restored = restoreCareer(info.save, league);
        const career = isCatalog ? restored : attachEuropa(attachCopa(restored));
        set({
          career,
          season: career.season,
          seasonId: leagueId,
          league,
          isCatalogCareer: isCatalog,
          lastResults: [],
          viewingMatch: null,
          retainIds: [],
          bids: [],
          marketMessage: null,
          screen: 'season',
        });
      };
      if (classic) {
        enter(classic.load(), false);
      } else if (catalogEntry(leagueId)) {
        void fetchLeague(leagueId).then((league) => enter(league, true));
      }
    },
    deleteSlotAt: (slot) => {
      deleteSlot(slot);
      set({ slots: listSlots() });
    },
  };
});
