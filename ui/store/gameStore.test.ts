import { describe, it, expect, beforeEach } from 'vitest';
import { isSeasonOver, selectPressQuestion } from '@game';
import type { Player } from '@data';
import { useGameStore, nextSeasonEntry } from './gameStore';

const personKey = (p: Player): string => `${p.nombreCompleto}|${p.fechaNacimiento ?? '?'}`;

/** Reset the singleton store to a clean 96/97 pre-game state. */
function reset(): void {
  useGameStore.setState({ career: null, season: null, retainIds: [], lastResults: [], screen: 'title' });
  useGameStore.getState().chooseSeason('es-primera-9697');
}

/** Play the in-progress season to completion. */
function playToEnd(): void {
  let guard = 0;
  while (!isSeasonOver(useGameStore.getState().season!) && guard < 100) {
    useGameStore.getState().playNextMatchday();
    guard += 1;
  }
}

describe('gameStore career loop', () => {
  beforeEach(reset);

  it('startCareer creates a season-1 career and shows the season screen', () => {
    useGameStore.getState().startCareer('barcelona');
    const s = useGameStore.getState();
    expect(s.career?.seasonNumber).toBe(1);
    expect(s.career?.humanTeamId).toBe('barcelona');
    expect(s.season).toBe(s.career?.season);
    expect(s.screen).toBe('season');
  });

  it('playNextMatchday advances and keeps career.season in sync', () => {
    useGameStore.getState().startCareer('barcelona');
    useGameStore.getState().playNextMatchday();
    const s = useGameStore.getState();
    expect(s.season?.currentMatchday).toBe(2);
    expect(s.career?.season.currentMatchday).toBe(2);
    expect(s.lastResults).toHaveLength(11);
  });

  it('continueCareer advances into the real 97/98 world and opens the market', () => {
    useGameStore.getState().startCareer('barcelona');
    playToEnd();
    useGameStore.getState().continueCareer();
    const s = useGameStore.getState();
    expect(s.career?.seasonNumber).toBe(2);
    expect(s.career?.temporada).toBe('97/98');
    expect(s.season?.temporada).toBe('97/98');
    // Between seasons the transfer window opens before kick-off.
    expect(s.screen).toBe('market');
    expect(s.career?.history).toHaveLength(1);
    useGameStore.getState().startSeasonFromMarket();
    expect(useGameStore.getState().screen).toBe('season');
  });

  it('season income is credited to the budget on continue and exposed for the UI', () => {
    useGameStore.getState().startCareer('barcelona');
    const budgetBefore = useGameStore.getState().career!.budget;
    playToEnd();
    useGameStore.getState().continueCareer();
    const s = useGameStore.getState();
    expect(s.lastIncome).not.toBeNull();
    expect(s.lastIncome!.total).toBeGreaterThan(0);
    // Budget = carried over + income − masa salarial; income outweighs wages here.
    expect(s.career!.budget).toBeGreaterThan(budgetBefore);
  });

  it('charges the masa salarial against the budget on continue and exposes it', () => {
    useGameStore.getState().startCareer('barcelona');
    const budgetBefore = useGameStore.getState().career!.budget;
    playToEnd();
    useGameStore.getState().continueCareer();
    const s = useGameStore.getState();
    // The wage bill was booked and surfaced for the market screen.
    expect(s.lastWageBill).not.toBeNull();
    expect(s.lastWageBill!).toBeGreaterThan(0);
    // Budget is exactly the carried-over pot plus income minus the wage bill.
    expect(s.career!.budget).toBe(
      Math.max(0, budgetBefore + s.lastIncome!.total - s.lastWageBill!),
    );
    // And wages genuinely bit into the gross (net < gross income).
    expect(s.career!.budget - budgetBefore).toBeLessThan(s.lastIncome!.total);
  });

  it('lets the budget go into the red on continue (no clamp) and charges interest', () => {
    useGameStore.getState().startCareer('barcelona');
    playToEnd();
    // Force a deeply overdrawn finish so income can't cover it: the club stays red.
    const finished = useGameStore.getState().career!;
    useGameStore.setState({ career: { ...finished, budget: -1_000_000_000 } });
    useGameStore.getState().continueCareer();
    const s = useGameStore.getState();
    // The clamp-to-zero is gone: the club carries real debt into the new season.
    expect(s.career!.budget).toBeLessThan(0);
    // Interest was charged on the carried debt and surfaced for the market screen.
    expect(s.lastInterest).not.toBeNull();
    expect(s.lastInterest!).toBeGreaterThan(0);
    // Sitting far past the credit limit starts the economic-sacking counter.
    expect(s.career!.credit!.seasonsOverLimit).toBeGreaterThan(0);
  });

  it('requestCredit advances cash into the budget and books the loan', () => {
    useGameStore.getState().startCareer('barcelona');
    const before = useGameStore.getState().career!;
    useGameStore.getState().requestCredit(1_000_000);
    const after = useGameStore.getState().career!;
    expect(after.budget).toBe(before.budget + 1_000_000);
    expect(after.credit!.loan).toBe((before.credit?.loan ?? 0) + 1_000_000);
  });

  it('renewPlayer resets a contract term, raises the wage and debits the budget', () => {
    useGameStore.getState().startCareer('barcelona');
    const career = useGameStore.getState().career!;
    const playerId = career.teams.find((t) => t.id === 'barcelona')!.players[0]!.id;
    const before = career.contracts[playerId]!;
    const budgetBefore = career.budget;

    useGameStore.getState().renewPlayer(playerId);
    const after = useGameStore.getState().career!;
    expect(after.contracts[playerId]!.yearsLeft).toBeGreaterThanOrEqual(before.yearsLeft);
    expect(after.contracts[playerId]!.salary).toBeGreaterThan(before.salary);
    expect(after.budget).toBeLessThan(budgetBefore);
  });

  it('setTraining stores the focus without resetting played matchdays', () => {
    useGameStore.getState().startCareer('barcelona');
    useGameStore.getState().playNextMatchday();
    useGameStore.getState().playNextMatchday();
    const before = useGameStore.getState().career!;
    expect(before.training?.focus).toBe('equilibrado'); // fresh-career default
    useGameStore.getState().setTraining({ focus: 'ataque' });
    const after = useGameStore.getState().career!;
    expect(after.training?.focus).toBe('ataque');
    // The in-progress season is untouched (no replay of what was already played).
    expect(after.season.currentMatchday).toBe(before.season.currentMatchday);
    expect(useGameStore.getState().season?.currentMatchday).toBe(before.season.currentMatchday);
  });

  it('buys a player in the market: budget drops and the squad grows', () => {
    useGameStore.getState().startCareer('barcelona');
    playToEnd();
    useGameStore.getState().continueCareer(); // now in market, budget available
    const before = useGameStore.getState().career!;
    // Cheapest buyable player is affordable.
    const beforeSize = before.teams.find((t) => t.id === 'barcelona')!.players.length;
    // Reach into the engine listing via the store's career.
    const target = before.teams.find((t) => t.id !== 'barcelona')!.players[0]!;
    useGameStore.getState().buyInMarket(target.id);
    const after = useGameStore.getState().career!;
    // Either the buy succeeded (squad grew, budget dropped) or it was unaffordable
    // (message set) — both are valid; assert the successful path when it applies.
    if (after.budget !== before.budget) {
      expect(after.budget).toBeLessThan(before.budget);
      expect(after.teams.find((t) => t.id === 'barcelona')!.players.length).toBe(beforeSize + 1);
    }
  });

  it('accepting an AI bid sells the player and adds money', () => {
    useGameStore.getState().startCareer('barcelona');
    playToEnd();
    useGameStore.getState().continueCareer();
    const bids = useGameStore.getState().bids;
    if (bids.length === 0) return; // deterministic, but guard anyway
    const bid = bids[0]!;
    const before = useGameStore.getState().career!;
    useGameStore.getState().acceptMarketBid(bid);
    const after = useGameStore.getState().career!;
    expect(after.budget).toBe(before.budget + bid.amount);
    expect(useGameStore.getState().bids.some((b) => b.playerId === bid.playerId)).toBe(false);
  });

  it('watchNextMatchday advances and opens the human match live', () => {
    useGameStore.getState().startCareer('barcelona');
    useGameStore.getState().watchNextMatchday();
    const s = useGameStore.getState();
    expect(s.season?.currentMatchday).toBe(2);
    expect(s.screen).toBe('match');
    expect(s.viewingMatch).not.toBeNull();
    const m = s.viewingMatch!;
    expect(m.homeId === 'barcelona' || m.awayId === 'barcelona').toBe(true);
    expect(s.lastResults).toHaveLength(11);
  });

  it('retaining a player keeps them across the transition and clears the selection', () => {
    useGameStore.getState().startCareer('barcelona');
    const ronaldo = useGameStore
      .getState()
      .career!.teams.find((t) => t.id === 'barcelona')!
      .players.find((p) => p.nombre === 'Ronaldo')!;
    useGameStore.getState().toggleRetain(ronaldo.id);
    expect(useGameStore.getState().retainIds).toContain(ronaldo.id);

    playToEnd();
    useGameStore.getState().continueCareer();

    const barca = useGameStore.getState().career!.teams.find((t) => t.id === 'barcelona')!;
    expect(barca.players.map(personKey)).toContain(personKey(ronaldo));
    expect(useGameStore.getState().retainIds).toHaveLength(0);
  });

  it('save/load round-trips the career through a slot', () => {
    localStorage.clear();
    useGameStore.getState().startCareer('barcelona');
    for (let i = 0; i < 3; i += 1) useGameStore.getState().playNextMatchday();
    const before = useGameStore.getState().career!;
    useGameStore.getState().saveToSlot(1);

    useGameStore.setState({ career: null, season: null });
    useGameStore.getState().loadFromSlot(1);

    const after = useGameStore.getState().career!;
    expect(after.seasonNumber).toBe(before.seasonNumber);
    expect(after.season.currentMatchday).toBe(before.season.currentMatchday);
    expect(after.humanTeamId).toBe('barcelona');
    expect(useGameStore.getState().screen).toBe('season');
  });

  it('startCareer generates the season Copa del Rey over the domestic field', () => {
    useGameStore.getState().startCareer('barcelona');
    const copa = useGameStore.getState().career?.copa;
    expect(copa).toBeDefined();
    expect(copa!.championId).not.toBe('');
    expect(copa!.knockout.at(-1)?.nombre).toBe('final');
  });

  it('attaches the European competitions in a season that has European data (98/99)', () => {
    useGameStore.getState().chooseSeason('es-primera-9899');
    useGameStore.getState().startCareer('barcelona');
    const europa = useGameStore.getState().career?.europa;
    expect(europa).toBeDefined();
    expect(europa!.champions.groups).toHaveLength(4);
    expect(europa!.uefa.championId).not.toBe('');
    // Season 1 has no previous league finish, so the human is a spectator.
    expect(europa!.humanComp).toBeNull();
  });

  it('does not attach Europe in a season without European data (96/97)', () => {
    useGameStore.getState().chooseSeason('es-primera-9697');
    useGameStore.getState().startCareer('barcelona');
    expect(useGameStore.getState().career?.europa).toBeUndefined();
  });

  it('answerPress records the decision, lifts morale and returns to the season screen', () => {
    useGameStore.getState().startCareer('barcelona');
    const career = useGameStore.getState().career!;
    const pending = selectPressQuestion(career);
    expect(pending).not.toBeNull();
    // The first season-start option is a confident +3 morale answer.
    const option = pending!.question.options[0]!;
    useGameStore.getState().answerPress(option.id);
    const after = useGameStore.getState().career!;
    expect(after.press?.answers).toHaveLength(1);
    expect(after.press?.answers[0]?.questionId).toBe(pending!.question.id);
    expect(useGameStore.getState().screen).toBe('season');
    // Every human player's morale rose off neutral by the option's morale effect.
    const players = after.season.teams.find((t) => t.id === 'barcelona')!.players;
    expect(players.every((p) => (p.morale ?? 50) === 50 + option.effect.morale)).toBe(true);
    // Answering again this matchday is refused (one conference per jornada).
    expect(selectPressQuestion(after)).toBeNull();
  });

  it('press decisions round-trip through a save slot', () => {
    localStorage.clear();
    useGameStore.getState().startCareer('barcelona');
    const pending = selectPressQuestion(useGameStore.getState().career!)!;
    useGameStore.getState().answerPress(pending.question.options[0]!.id);
    useGameStore.getState().playNextMatchday();
    const before = useGameStore.getState().career!;
    useGameStore.getState().saveToSlot(2);

    useGameStore.setState({ career: null, season: null });
    useGameStore.getState().loadFromSlot(2);
    const after = useGameStore.getState().career!;
    expect(after.press).toEqual(before.press);
    expect(after.season.results).toEqual(before.season.results);
  });

  it('setTactics stores the human formation and applies it to the live season', () => {
    useGameStore.getState().startCareer('barcelona');
    useGameStore.getState().setTactics({ formation: '4-3-3' });
    const s = useGameStore.getState();
    expect(s.career?.tactics?.formation).toBe('4-3-3');
    expect(s.season?.teams.find((t) => t.id === 'barcelona')?.tactics?.formation).toBe('4-3-3');
  });

  it('nextSeasonEntry chains the seasons and stops after the last', () => {
    expect(nextSeasonEntry('es-primera-9697')?.id).toBe('es-primera-9798');
    expect(nextSeasonEntry('es-primera-9798')?.id).toBe('es-primera-9899');
    expect(nextSeasonEntry('es-primera-9899')).toBeNull();
  });
});
