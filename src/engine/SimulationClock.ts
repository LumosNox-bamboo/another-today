import { syncRealCalendar } from './SeasonEngine';
import { type World, MINUTE, DAY } from './model';
import { advance } from './SimulationEngine';
export interface CatchUpReport {
  residentId: string;
  recentTransactions: World['ledger'];
  realElapsed: number;
  gameElapsed: number;
  skipped: number;
  events: string[];
  moneyDelta: number;
  moodDelta: number;
  newMemories: number;
  relationshipDelta: number;
  newItems: number;
  crossedNight: boolean;
  clockReversed: boolean;
}
export function catchUp(w: World, now = Date.now()): CatchUpReport {
  if (!Number.isFinite(now) || now < 0) throw new Error('Invalid clock');
  const elapsed = Math.max(0, now - w.lastReal),
    requested = elapsed * w.settings.speed;
  const gameElapsed = Math.min(requested, w.settings.offlineDays * DAY);
  const money = w.money,
    mood = w.needs.mood,
    mem = w.memories.length,
    items = w.items.length,
    relation = w.npcs.reduce((s, n) => s + n.relation.familiarity, 0),
    start = w.time,
    seq = w.sequence;
  advance(w, gameElapsed);
  if (now >= w.lastReal) syncRealCalendar(w, now);
  const reversed = now < w.lastReal;
  // Retain the high-water mark when the OS clock moves backwards; elapsed time cannot be replayed.
  w.lastReal = Math.max(w.lastReal, now);
  return {
    residentId: w.household.active,
    recentTransactions: w.ledger
      .filter((l) => l.payerId === w.household.active && Number(l.id.split('-').at(-1)) > seq)
      .slice(-5)
      .map((l) => ({ ...l })),
    realElapsed: elapsed,
    gameElapsed,
    skipped: requested - gameElapsed,
    events: w.events
      .filter((e) => Number(e.id.split('-').at(-1)) > seq)
      .slice(-100)
      .map((e) => e.id),
    moneyDelta: w.money - money,
    moodDelta: w.needs.mood - mood,
    newMemories: Math.max(0, w.memories.length - mem),
    relationshipDelta: w.npcs.reduce((s, n) => s + n.relation.familiarity, 0) - relation,
    newItems: w.items.length - items,
    crossedNight: Math.floor(start / DAY) !== Math.floor(w.time / DAY),
    clockReversed: reversed,
  };
}
export function setSpeed(w: World, speed: World['settings']['speed'], now = Date.now()) {
  const report = catchUp(w, now);
  w.settings.speed = speed;
  return report;
}
export function shouldWelcome(r: CatchUpReport) {
  return r.realElapsed >= 5 * MINUTE;
}
