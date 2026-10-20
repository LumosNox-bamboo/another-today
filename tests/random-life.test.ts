import { it, expect } from 'vitest';
import { createWorld, defaultCharacter } from '../src/content/people';
import { chanceEvents } from '../src/content/chanceEvents';
import { events } from '../src/content/events';
import { spendOnActivity, optionalSpendingBudget } from '../src/engine/SpendingEngine';
import { eventOutcome, eventWeight, sampleEvent } from '../src/engine/EventEngine';
import { validateContent } from '../src/engine/ContentValidator';
import { validateWorld } from '../src/engine/validation';
import { addResident, selectResident } from '../src/engine/HouseholdEngine';
import { reply } from '../src/engine/ConversationEngine';
import { advance } from '../src/engine/SimulationEngine';
import { DAY, MINUTE } from '../src/engine/model';
const now = Date.UTC(2026, 9, 20, 9);
const fresh = (seed = 72) =>
  // Spread test seeds across the existing 32-bit RNG space (adjacent tiny seeds share their first draw).
  createWorld(structuredClone(defaultCharacter), now, Math.imul(seed, 0x9e3779b9) >>> 0);

it('validates all authored random outcomes and rejects malformed traits and effects', () => {
  expect(chanceEvents).toHaveLength(12);
  expect(chanceEvents.reduce((sum, d) => sum + d.outcomes!.length, 0)).toBe(36);
  expect(validateContent()).toEqual([]);
  const broken = structuredClone(chanceEvents);
  broken[0].outcomes![0].stress = NaN;
  broken[1].outcomes = [];
  expect(validateContent(broken).filter((s) => s.includes('随机结果'))).toHaveLength(2);
});

it('personality changes purchase distributions while keeping varied bounded prices', () => {
  const costs = [[], []] as number[][];
  for (let seed = 1; seed <= 300; seed++) {
    for (let profile = 0; profile < 2; profile++) {
      const w = fresh(seed);
      w.character.traits.discipline = profile === 0 ? 95 : 5;
      w.character.traits.curiosity = profile === 0 ? 5 : 95;
      w.character.traits.romance = profile === 0 ? 5 : 95;
      const before = w.money;
      spendOnActivity(w, 'eat');
      const cost = before - w.money;
      costs[profile].push(cost);
      expect(cost).toBeGreaterThanOrEqual(5);
      expect(cost).toBeLessThanOrEqual(20);
      expect(w.ledger.at(-1)!.amount).toBe(-cost);
      expect(w.events.at(-1)!.text).toContain(`¥${cost}`);
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  expect(mean(costs[1]) - mean(costs[0])).toBeGreaterThan(3);
  expect(new Set(costs[0]).size).toBeGreaterThan(10);
  expect(new Set(costs[1]).size).toBeGreaterThan(10);
});

it('respects daily wallet limits, basic reserves, fractional balances and zero funds', () => {
  const w = fresh();
  for (let i = 0; i < 20; i++) spendOnActivity(w, i % 2 ? 'coffee' : 'shop');
  expect(3000 - w.money).toBeLessThanOrEqual(45);
  w.time += DAY;
  expect(optionalSpendingBudget(w)).toBe(45);
  w.money = 65.5;
  spendOnActivity(w, 'coffee');
  expect(w.money).toBe(65.5);
  w.money = 3.25;
  spendOnActivity(w, 'eat');
  expect(w.money).toBe(0);
  expect(w.ledger.at(-1)!.amount).toBe(-3.25);
  const count = w.ledger.length;
  spendOnActivity(w, 'eat');
  expect(w.ledger).toHaveLength(count);
  expect(w.money).toBe(0);
});

it('shares limits only within core-family wallets and reports the selected person purchases', () => {
  const w = fresh();
  const roommate = addResident(w, '室友', 25, '室友', 800);
  const spouse = addResident(w, '伴侣', 25, '夫妻', 800);
  for (let i = 0; i < 10; i++) spendOnActivity(w, 'shop');
  const budget = optionalSpendingBudget(w);
  selectResident(w, spouse);
  expect(optionalSpendingBudget(w)).toBe(budget);
  expect(reply(w, '最近花了什么钱？')).toContain('还没有');
  selectResident(w, roommate);
  expect(w.money).toBe(800);
  expect(optionalSpendingBudget(w)).toBe(45);
  spendOnActivity(w, 'coffee');
  expect(reply(w, '最近花了什么钱？')).toContain('饮品');
  expect(() => validateWorld(w)).not.toThrow();
});

it('the same situation has multiple outcomes, with a measurable but nonabsolute personality effect', () => {
  const d = chanceEvents.find((d) => d.eventId === 'chance-detour')!;
  const counts = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let seed = 1; seed <= 500; seed++) {
    for (let profile = 0; profile < 2; profile++) {
      const w = fresh(seed);
      w.character.traits.adventure = profile ? 95 : 5;
      const result = eventOutcome(w, d)!;
      counts[profile][d.outcomes!.indexOf(result)]++;
    }
  }
  expect(counts[1][0]).toBeGreaterThan(counts[0][0] * 2);
  expect(counts[0][1]).toBeGreaterThan(counts[1][1] * 2);
  expect(counts.flat().every((n) => n > 0)).toBe(true);
  const w = fresh();
  w.character.traits.adventure = 5;
  const low = eventWeight(w, d);
  w.character.traits.adventure = 95;
  expect(eventWeight(w, d)).toBeGreaterThan(low);
});

it('the sampler records exactly the selected outcome and applies its actual effects', () => {
  const w = fresh();
  const d = chanceEvents.find((d) => d.eventId === 'chance-detour')!;
  w.activity.kind = 'walk';
  w.activity.scene = 'park';
  w.needs.mood = 50;
  w.needs.stress = 50;
  events
    .filter((e) => e !== d)
    .forEach((e) => {
      w.cooldowns[e.eventId] = Number.MAX_SAFE_INTEGER;
    });
  for (let i = 0; i < 100 && !w.living.eventHistory[d.eventId]; i++) sampleEvent(w);
  const e = w.events.find((e) => e.definition === d.eventId)!;
  const chosen = d.outcomes!.filter((o) => e.text.includes(o.text));
  expect(chosen).toHaveLength(1);
  expect(w.needs.mood).toBe(50 + chosen[0].mood);
  expect(w.needs.stress).toBe(50 + chosen[0].stress);
});

it('completed activities charge once and seeded progression survives saving and reopening', () => {
  const w = fresh();
  w.activity = {
    kind: 'eat',
    scene: 'apartment',
    start: w.time - 20 * MINUTE,
    end: w.time + 5 * MINUTE,
  };
  advance(w, 5 * MINUTE);
  expect(w.ledger.filter((l) => l.reason.startsWith('日常消费 · 吃饭'))).toHaveLength(1);
  const saved = validateWorld(JSON.parse(JSON.stringify(w)));
  advance(saved, 0);
  expect(saved.ledger).toEqual(w.ledger);
  advance(w, DAY);
  advance(saved, DAY);
  expect(saved).toEqual(w);
});
