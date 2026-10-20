import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { careerTracks, majors } from '../src/content/careers';
import { createWorld, defaultCharacter } from '../src/content/people';
import { advance } from '../src/engine/SimulationEngine';
import { careerTrack } from '../src/engine/CareerEngine';
import { validateWorld } from '../src/engine/validation';
import { validateCareerContent } from '../src/engine/CareerValidator';
import { DAY } from '../src/engine/model';
assert.deepEqual(validateCareerContent(), []);
const runs = [];
for (let seed = 1; seed <= 100; seed++) {
  const track = careerTracks[(seed - 1) % careerTracks.length];
  const age =
    track.id === 'school-primary'
      ? 10
      : track.id === 'school-secondary'
        ? 16
        : track.id === 'retired'
          ? 70
          : 24;
  const major = majors.find((m) => track.name === `${m}学生`);
  let w = createWorld(
    { ...structuredClone(defaultCharacter), age, job: track.job, major },
    Date.UTC(2026, 9, 19, 8),
    seed * 1951,
  );
  let lowMoodDays = 0;
  for (let day = 0; day < 30; day++) {
    advance(w, DAY);
    if (w.needs.mood < 30) lowMoodDays++;
    // Exercise the same schema used by local saves and cloud handoff every day.
    w = validateWorld(JSON.parse(JSON.stringify(w)));
  }
  const p = w.career?.tracks.find((p) => p.id === track.id);
  assert.equal(careerTrack(w.character).id, track.id);
  assert.ok(p && p.minutes >= 300, `${track.id}: no autonomous practice`);
  assert.ok(Object.keys(p.counts).length >= 3, `${track.id}: repetitive practice`);
  assert.equal(w.diaries.length, 30);
  assert.ok(lowMoodDays < 6, `${track.id}: persistent distress`);
  assert.ok(
    w.diaries.some((d) => track.duties.some((task) => d.body.includes(task.process))),
    `${track.id}: no factual vocational diary`,
  );
  assert.ok(Object.values(w.needs).every((n) => n >= 0 && n <= 100));
  const income = w.ledger
    .filter((l) => l.reason === '当日职业收入')
    .reduce((sum, l) => sum + l.amount, 0);
  if (track.activity === 'study') assert.equal(income, 0, `${track.id}: non-worker salary`);
  runs.push({
    seed,
    track: track.id,
    name: track.name,
    minutes: p.minutes,
    stage: p.stage,
    skills: p.skills,
    dutyCounts: p.counts,
    income,
    diaries: w.diaries.length,
    npcChanges: w.living.stats.npcChanges,
    lowMoodDays,
  });
}
const summary = {
  seeds: 100,
  gameDays: 30,
  tracks: new Set(runs.map((r) => r.track)).size,
  duties: careerTracks.reduce((s, t) => s + t.duties.length, 0),
  minPractice: Math.min(...runs.map((r) => r.minutes)),
  minVariety: Math.min(...runs.map((r) => Object.keys(r.dutyCounts).length)),
  stages: [0, 1, 2, 3, 4].map((stage) => ({
    stage,
    worlds: runs.filter((r) => r.stage === stage).length,
  })),
  abnormalWorlds: 0,
};
writeFileSync('docs/CAREER_AUDIT.json', JSON.stringify({ summary, runs }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
