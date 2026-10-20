import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { createWorld, defaultCharacter } from '../src/content/people';
import { chanceEvents } from '../src/content/chanceEvents';
import { advance } from '../src/engine/SimulationEngine';
import { validateWorld } from '../src/engine/validation';
import { DAY, type Traits } from '../src/engine/model';

const profiles: { name: string; traits: Partial<Traits> }[] = [
  {
    name: '内向自律',
    traits: { extraversion: 10, discipline: 95, adventure: 20, sensitivity: 35 },
  },
  {
    name: '外向浪漫',
    traits: { extraversion: 95, romance: 95, kindness: 90, discipline: 40, independence: 25 },
  },
  {
    name: '随性自由',
    traits: { discipline: 10, sensitivity: 15, independence: 90, adventure: 65, curiosity: 35 },
  },
  {
    name: '敏感好奇',
    traits: { sensitivity: 95, curiosity: 95, creativity: 90, openness: 95, extraversion: 35 },
  },
  {
    name: '理性探索',
    traits: {
      sensitivity: 10,
      independence: 95,
      adventure: 95,
      curiosity: 90,
      openness: 85,
      discipline: 70,
    },
  },
];
const report = profiles.map((profile) => {
  const runs = [];
  for (let seed = 1; seed <= 20; seed++) {
    const character = structuredClone(defaultCharacter);
    character.traits = { ...character.traits, ...profile.traits };
    let w = createWorld(character, Date.UTC(2026, 9, 19, 8), Math.imul(seed, 0x9e3779b9) >>> 0);
    const start = w.time;
    let spending = 0,
      meals = 0,
      mealCost = 0,
      lowMoodDays = 0;
    const outcomes: Record<string, number> = {};
    const prices = new Set<number>();
    for (let day = 0; day < 30; day++) {
      const before = w.time;
      advance(w, DAY);
      const entries = w.ledger.filter((l) => l.time > before && l.reason.startsWith('日常消费 · '));
      for (const entry of entries) {
        spending -= entry.amount;
        prices.add(-entry.amount);
        if (entry.reason.startsWith('日常消费 · 吃饭')) {
          meals++;
          mealCost -= entry.amount;
        }
      }
      for (const e of w.events.filter((e) => e.time > before)) {
        const d = chanceEvents.find((d) => d.eventId === e.definition);
        if (!d) continue;
        const index = d.outcomes!.findIndex((o) => e.text.includes(o.text));
        assert.ok(index >= 0);
        const key = `${d.eventId}:${index}`;
        outcomes[key] = (outcomes[key] || 0) + 1;
      }
      if (w.needs.mood < 30) lowMoodDays++;
      w = validateWorld(JSON.parse(JSON.stringify(w)));
      assert.ok(w.money >= 0);
    }
    assert.equal(w.time - start, 30 * DAY);
    assert.equal(w.diaries.length, 30);
    assert.ok(lowMoodDays < 6);
    assert.ok(prices.size >= 5);
    runs.push({
      seed,
      spending,
      meals,
      mealCost,
      endingBalance: w.money,
      prices: [...prices].sort((a, b) => a - b),
      outcomes,
      lowMoodDays,
    });
  }
  const totals: Record<string, number> = {};
  for (const r of runs)
    for (const [key, n] of Object.entries(r.outcomes)) totals[key] = (totals[key] || 0) + n;
  return {
    name: profile.name,
    meanSpending: runs.reduce((sum, r) => sum + r.spending, 0) / runs.length,
    meanMealCost:
      runs.reduce((sum, r) => sum + r.mealCost, 0) / runs.reduce((sum, r) => sum + r.meals, 0),
    minBalance: Math.min(...runs.map((r) => r.endingBalance)),
    outcomes: totals,
    runs,
  };
});
const covered = new Set(report.flatMap((p) => Object.keys(p.outcomes)));
assert.equal(covered.size, 36, 'every authored outcome should occur during autonomous life');
const output = {
  worlds: 100,
  pairedSeeds: 20,
  profiles: 5,
  days: 30,
  anomalies: 0,
  outcomesCovered: covered.size,
  report,
};
writeFileSync('docs/RANDOM_LIFE_AUDIT.json', JSON.stringify(output, null, 2) + '\n');
console.log(
  JSON.stringify(
    { ...output, report: report.map(({ runs, outcomes, ...summary }) => summary) },
    null,
    2,
  ),
);
