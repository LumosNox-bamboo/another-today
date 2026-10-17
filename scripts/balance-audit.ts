import { writeFileSync } from 'node:fs';
import { createWorld, defaultCharacter } from '../src/content/people';
import { jobs, HOUR, DAY, type World } from '../src/engine/model';
import { advance } from '../src/engine/SimulationEngine';
import { validateWorld } from '../src/engine/validation';
const report = jobs.map((job, i) => {
  const w = createWorld(
    { ...structuredClone(defaultCharacter), job },
    Date.UTC(2026, 9, 19, 8),
    100 + i,
  );
  const activities: Record<string, number> = {};
  let minEnergy = 100,
    minMood = 100,
    minHealth = 100;
  const start = performance.now();
  for (let j = 0; j < 30 * 24; j++) {
    advance(w, HOUR);
    activities[w.activity.kind] = (activities[w.activity.kind] || 0) + 1;
    minEnergy = Math.min(minEnergy, w.needs.energy);
    minMood = Math.min(minMood, w.needs.mood);
    minHealth = Math.min(minHealth, w.needs.health);
  }
  validateWorld(w);
  return {
    job,
    seed: 100 + i,
    gameDays: 30,
    elapsedMs: Math.round(performance.now() - start),
    hourlyActivitySamples: activities,
    finalMoney: Math.round(w.money),
    minimum: { energy: minEnergy, mood: minMood, health: minHealth },
    finalNeeds: w.needs,
    diaries: w.diaries.length,
    relationships: w.npcs.filter((n) => n.relation.familiarity > 0).length,
    pendingDecisions: w.decisions.length,
    chains: w.chains.map((c) => ({ id: c.id, stage: c.stage, status: c.status })),
    salaryDays: w.ledger.filter((l) => l.reason === '当日职业收入').length,
  };
});
writeFileSync(
  'docs/BALANCE_AUDIT.json',
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scope:
        '10 starting occupations, fixed seed per occupation, 30 game days, no player intervention',
      report,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    report.map((r) => ({
      job: r.job,
      money: r.finalMoney,
      minEnergy: r.minimum.energy,
      minHealth: r.minimum.health,
      activities: r.hourlyActivitySamples,
      chains: r.chains.length,
    })),
    null,
    2,
  ),
);
