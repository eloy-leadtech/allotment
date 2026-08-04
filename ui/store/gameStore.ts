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
  type League,
  type SeasonEntry,
} from '@data';
import {
  newCareer,
  applyTransition,
  applyDivisionChange,
  careerOutcome,
  economicDismissal,
  liquidateSeason,
  creditLimit,
  requestCredit,
  isManagerDismissed,
  nextDivision,
  setCareerTactics,
  setCareerTraining,
  selectPressQuestion,
  answerPressConference,
  advanceMatchday,
  serializeCareer,
  restoreCareer,
  generateBids,
  expandStadium,
  buyPlayer,
  negotiateBuy,
  acceptCounter,
  acceptBid,
  promoteProspect,
  discardProspect,
  observePlayer,
  renewContract,
  acceptRenewal,
  offerRenewal,
  letGoPlayer,
  chooseSponsor,
  loanOutPlayer,
  loanInPlayer,
  wageBill,
  formatEuros,
  toCompetitionTeam,
  runCareerCopa,
  runCareerEuropa,
  europaQualification,
  seasonIncome,
  runTournament,
  TOURNAMENTS,
  type SeasonIncome,
  type SponsorId,
  type CareerState,
  type CareerTactics,
  type TrainingState,
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
  return {
    ...career,
    copa: runCareerCopa(career.seed, career.seasonNumber, domestic, career.humanTeamId),
  };
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

interface GameStore {
  screen: Screen;
  /** Season chosen for the next new game. */
  seasonId: string;
  /** Seed chosen for the next new game (deterministic once fixed). */
  seed: number;
  /** League loaded for the chosen season (drives team select). */
  league: League;
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
  /** Masa salarial charged for the season just finished (shown on the market screen). */
  lastWageBill: number | null;
  /** Interest charged on the club's debt at the last liquidation (shown on the market screen). */
  lastInterest: number | null;
  /** Snapshot of the save slots (for the slots screen). */
  slots: Array<SlotInfo | null>;
  /** Player whose rich card (ficha) is open, if any. */
  selectedPlayerId: string | null;
  goTo: (screen: Screen) => void;
  /** Open a player's rich card (ficha) from the squad list. */
  openPlayer: (playerId: string) => void;
  chooseSeason: (id: string) => void;
  setSeed: (seed: number) => void;
  randomizeSeed: () => void;
  startCareer: (teamId: string) => void;
  playNextMatchday: () => void;
  watchNextMatchday: () => void;
  toggleRetain: (playerId: string) => void;
  setTactics: (tactics: CareerTactics) => void;
  setTraining: (training: TrainingState) => void;
  answerPress: (optionId: string) => void;
  promoteYouth: (playerId: string) => void;
  discardYouth: (playerId: string) => void;
  scoutPlayer: (playerId: string) => void;
  renewPlayer: (playerId: string) => void;
  /** Accept an expiring player's full renewal demand (season-end negotiation). */
  acceptRenewal: (playerId: string) => void;
  /** Counter-offer a renewal at your own ficha (in euros) and term (in seasons). */
  offerRenewal: (playerId: string, salary: number, years: number) => void;
  /** Let an expiring player run down his deal and leave FREE (Bosman). */
  letGoPlayer: (playerId: string) => void;
  chooseSponsor: (sponsorId: SponsorId) => void;
  requestCredit: (amount: number) => void;
  expandStadium: () => void;
  startTournament: (tournamentId: string, nationId: string) => void;
  continueCareer: () => void;
  buyInMarket: (playerId: string) => void;
  makeOffer: (playerId: string, amount: number) => void;
  acceptCounterOffer: () => void;
  dismissCounter: () => void;
  acceptMarketBid: (bid: Bid) => void;
  loanOut: (playerId: string) => void;
  loanIn: (playerId: string) => void;
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
    lastWageBill: null,
    lastInterest: null,
    slots: listSlots(),
    selectedPlayerId: null,
    goTo: (screen) => set({ screen }),
    openPlayer: (playerId) => set({ selectedPlayerId: playerId, screen: 'playerCard' }),
    chooseSeason: (id) => {
      const entry = getSeason(id);
      if (entry) set({ seasonId: id, league: entry.load() });
    },
    setSeed: (seed) => set({ seed }),
    randomizeSeed: () => set({ seed: randomSeed() }),
    startCareer: (teamId) => {
      const { league, seed } = get();
      const career = attachEuropa(attachCopa(newCareer(league, teamId, seed)));
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
    setTraining: (training) => {
      const { career } = get();
      if (!career) return;
      // Training never resets played matchdays; it shapes next season's development.
      const next = setCareerTraining(career, training);
      set({ career: next, season: next.season });
    },
    answerPress: (optionId) => {
      const { career } = get();
      if (!career) return;
      // The pending question is derived deterministically from the career; answering
      // records the decision and nudges dressing-room morale (future matchdays only).
      const pending = selectPressQuestion(career);
      if (!pending) {
        set({ screen: 'season' });
        return;
      }
      const next = answerPressConference(career, pending.question.id, optionId);
      set({ career: next, season: next.season, screen: 'season' });
    },
    promoteYouth: (playerId) => {
      const { career } = get();
      if (!career) return;
      const next = promoteProspect(career, playerId);
      set({ career: next, season: next.season });
    },
    discardYouth: (playerId) => {
      const { career } = get();
      if (!career) return;
      const next = discardProspect(career, playerId);
      set({ career: next, season: next.season });
    },
    scoutPlayer: (playerId) => {
      const { career } = get();
      if (!career) return;
      const result = observePlayer(career, playerId);
      if (!result.ok) {
        set({
          marketMessage:
            result.reason === 'ya-ojeado'
              ? 'Ya has enviado un ojeador a este jugador esta temporada.'
              : result.reason === 'propio'
                ? 'Es de tu plantilla: ya conoces su nivel.'
                : 'Jugador no disponible.',
        });
        return;
      }
      // Scouting changes no rosters, only your reports; keep the season as-is.
      set({ career: result.career, season: result.career.season, marketMessage: null });
    },
    renewPlayer: (playerId) => {
      const { career } = get();
      if (!career) return;
      const result = renewContract(career, playerId);
      if (!result.ok) {
        set({ marketMessage: result.reason === 'presupuesto' ? 'No te llega para la prima de renovación.' : 'No se puede renovar.' });
        return;
      }
      // The squad is unchanged (only the wage book + budget), so keep the season.
      set({ career: result.career, marketMessage: null });
    },
    acceptRenewal: (playerId) => {
      const { career } = get();
      if (!career) return;
      const outcome = acceptRenewal(career, playerId);
      if (outcome.status !== 'renewed') {
        set({
          marketMessage:
            outcome.status === 'presupuesto'
              ? 'No te llega para la prima de renovación.'
              : 'No se puede renovar a ese jugador.',
        });
        return;
      }
      // Only the wage book + budget change; the squad and season stay put.
      set({ career: outcome.career, marketMessage: null });
    },
    offerRenewal: (playerId, salary, years) => {
      const { career } = get();
      if (!career) return;
      const outcome = offerRenewal(career, playerId, salary, years);
      switch (outcome.status) {
        case 'renewed':
          set({ career: outcome.career, marketMessage: null });
          return;
        case 'rejected':
          set({
            marketMessage: `Rechaza tu oferta: no baja de ${formatEuros(outcome.demand.minSalary)}/año.`,
          });
          return;
        case 'presupuesto':
          set({ marketMessage: 'No te llega para la prima de renovación.' });
          return;
        default:
          set({ marketMessage: 'No se puede renovar a ese jugador.' });
      }
    },
    letGoPlayer: (playerId) => {
      const { career } = get();
      if (!career) return;
      const outcome = letGoPlayer(career, playerId);
      if (outcome.status !== 'released') {
        set({ marketMessage: 'No se puede gestionar a ese jugador.' });
        return;
      }
      set({ career: outcome.career, marketMessage: 'Jugador no renovado: se marchará libre a final de temporada.' });
    },
    chooseSponsor: (sponsorId) => {
      const { career } = get();
      if (!career) return;
      // Picking a sponsor is a pure decision: it changes no rosters and the money
      // only lands at season end, so the in-progress season stays exactly as-is.
      const next = chooseSponsor(career, sponsorId);
      set({ career: next, marketMessage: null });
    },
    requestCredit: (amount) => {
      const { career } = get();
      if (!career) return;
      const result = requestCredit(career, amount);
      if (!result.ok) {
        set({
          marketMessage:
            result.reason === 'limite'
              ? 'La directiva no te concede más crédito: has llegado a tu límite.'
              : 'Introduce una cantidad de crédito válida.',
        });
        return;
      }
      // Credit moves only the budget and the loan; the squad and season stay put.
      set({
        career: result.career,
        marketMessage: `La directiva te concede un crédito de ${formatEuros(result.granted)}.`,
      });
    },
    expandStadium: () => {
      const { career } = get();
      if (!career) return;
      const result = expandStadium(career);
      if (!result.ok) {
        set({
          marketMessage:
            result.reason === 'presupuesto'
              ? 'No te llega el presupuesto para la ampliación.'
              : 'El estadio ya está al máximo.',
        });
        return;
      }
      // Only budget + stadium change; the squad and in-progress season stay put.
      set({ career: result.career, season: result.career.season, marketMessage: null });
    },
    continueCareer: () => {
      const { career, retainIds } = get();
      if (!career) return;
      // A sacked manager cannot carry on: the board ended their tenure — by a hard
      // objective miss, the directiva confianza meter collapsing, or ruinous debt.
      if (isManagerDismissed(career) || economicDismissal(career)) return;
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
      // The finished squad's masa salarial is charged against the budget.
      const wages = wageBill(career.contracts);
      const transitioned = attachEuropa(
        attachCopa(
          toDivision === career.division
            ? applyTransition(career, targetLeague, new Set(retainIds))
            : applyDivisionChange(career, toDivision, targetLeague),
        ),
      );
      // Liquidate the finished season: income and wages settle, interest is charged
      // on any carried debt, and the budget may end NEGATIVE ("números rojos") — the
      // clamp-to-zero is gone, so real debt shows and the credit counter updates.
      const liq = liquidateSeason({
        budget: transitioned.budget,
        loan: transitioned.credit?.loan ?? 0,
        income: income.total,
        wages,
        creditLimit: creditLimit(transitioned),
        seasonsOverLimit: transitioned.credit?.seasonsOverLimit ?? 0,
      });
      const next = { ...transitioned, budget: liq.budget, credit: liq.credit };
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
        lastWageBill: wages,
        lastInterest: liq.interest,
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
    loanOut: (playerId) => {
      const { career } = get();
      if (!career) return;
      const result = loanOutPlayer(career, playerId);
      if (!result.ok) {
        set({
          marketMessage:
            result.reason === 'ya-cedido'
              ? 'Ese jugador ya está en tu plantilla como cedido.'
              : 'No se puede ceder a ese jugador.',
        });
        return;
      }
      set({
        career: result.career,
        season: result.career.season,
        marketMessage: 'Jugador cedido: te ahorras su ficha esta temporada.',
      });
    },
    loanIn: (playerId) => {
      const { career } = get();
      if (!career) return;
      const result = loanInPlayer(career, playerId);
      if (!result.ok) {
        set({
          marketMessage:
            result.reason === 'presupuesto'
              ? 'No te llega para la cesión.'
              : 'Ese jugador no está disponible en cesión.',
        });
        return;
      }
      set({
        career: result.career,
        season: result.career.season,
        marketMessage: 'Cedido incorporado hasta final de temporada.',
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
      const entry = getSeason(info.save.leagueId);
      if (!entry) return;
      const league = entry.load();
      const career = attachEuropa(attachCopa(restoreCareer(info.save, league)));
      set({
        career,
        season: career.season,
        seasonId: entry.id,
        league,
        lastResults: [],
        viewingMatch: null,
        retainIds: [],
        bids: [],
        marketMessage: null,
        screen: 'season',
      });
    },
    deleteSlotAt: (slot) => {
      deleteSlot(slot);
      set({ slots: listSlots() });
    },
  };
});
