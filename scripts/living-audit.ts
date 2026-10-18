import { writeFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { createWorld, defaultCharacter } from '../src/content/people';
import { events } from '../src/content/events';
import { destinations, discoveries } from '../src/content/places';
import { outskirtsEvents } from '../src/content/outskirtsEvents';
import { gifts } from '../src/content/living';
import { advance } from '../src/engine/SimulationEngine';
import { validateWorld } from '../src/engine/validation';
import { validateContent } from '../src/engine/ContentValidator';
import { giveGift } from '../src/engine/GiftEngine';
import { DAY, HOUR, type Traits } from '../src/engine/model';
assert.deepEqual(validateContent(), []);
const now = new Date(2026, 9, 19, 8).getTime();
const categoryCounts: Record<string, number> = {};
const ordinaryIds = new Set(events.map((e) => e.eventId));
const start = performance.now();
const runs = Array.from({ length: 100 }, (_, i) => {
  const seed = i + 1,
    w = createWorld(undefined, now, seed);
  const min: Record<string, number> = Object.fromEntries(Object.keys(w.needs).map((k) => [k, 100]));
  const max: Record<string, number> = Object.fromEntries(Object.keys(w.needs).map((k) => [k, 0]));
  let badDays = 0,
    maxPending = 0;
  // Every tenth world receives one gift, to exercise genuine gift-to-interest causality.
  if (i % 10 === 0) giveGift(w, gifts[(i / 10) * 3].id);
  for (let day = 0; day < 30; day++) {
    for (let hour = 0; hour < 24; hour++) {
      advance(w, HOUR);
      for (const k of ['energy', 'mood', 'health', 'hunger', 'stress', 'social', 'fun'] as const) {
        min[k] = Math.min(min[k], w.needs[k]);
        max[k] = Math.max(max[k], w.needs[k]);
      }
    }
    validateWorld(w);
    if (w.needs.mood < 30 || w.needs.health < 40) badDays++;
    maxPending = Math.max(maxPending, w.decisions.length);
  }
  assert.equal(w.diaries.length, 30, `seed ${seed}: missing diary`);
  assert.ok(w.living.stats.npcChanges > 0, `seed ${seed}: NPC world is static`);
  assert.ok(badDays < 6, `seed ${seed}: persistent distress`);
  assert.ok(
    w.living.arcs.filter((a) => a.status === 'active' || a.status === 'paused').length <= 2,
  );
  assert.ok(
    w.living.arcs.filter((a) => a.status === 'active' || a.status === 'paused').length +
      w.chains.filter((a) => a.status === 'active').length <=
      3,
  );
  const ordinary = Object.entries(w.living.stats.definitions).filter(([id]) => ordinaryIds.has(id));
  const count = ordinary.reduce((s, [, n]) => s + n, 0);
  assert.ok(count >= 30 && count <= 600, `seed ${seed}: ordinary event flood/starvation ${count}`);
  Object.entries(w.living.stats.categories).forEach(([key, n]) => {
    categoryCounts[key] = (categoryCounts[key] || 0) + n;
  });
  return {
    seed,
    gameDays: 30,
    ordinaryEvents: count,
    uniqueOrdinaryEvents: ordinary.length,
    repeatRatio: 1 - ordinary.length / count,
    mostRepeated: ordinary.sort((a, b) => b[1] - a[1]).slice(0, 5),
    important: w.living.stats.important,
    activities: w.living.stats.activities,
    min,
    max,
    badDays,
    npcChanges: w.living.stats.npcChanges,
    npcBonds: w.living.npcBonds.length,
    npcRomances: w.living.npcBonds.filter((b) => b.status === '恋人').length,
    careerChanges: w.living.stats.careerChanges,
    characterJob: w.character.job,
    characterCareerLevel: w.character.careerLevel,
    characterPromotions: w.living.stats.definitions.promotion || 0,
    diaries: w.diaries.length,
    habits: w.living.habits.filter((h) => h.formed).length,
    arcs: w.living.arcs.map((a) => ({ id: a.id, status: a.status, stage: a.stage })),
    creations: w.living.creations.filter((c) => c.completed).length,
    secrets: w.living.secrets.length,
    maxPending,
    saveBytes: Buffer.byteLength(JSON.stringify(w)),
    visits: w.living.exploration.visits,
    discoveries: w.living.exploration.discoveries.map((d) => d.id),
    newEvents: Object.entries(w.living.stats.definitions).filter(([id]) =>
      outskirtsEvents.some((e) => e.eventId === id),
    ),
    anomalies: [],
  };
});
const personalities: { id: string; description: string; traits: Partial<Traits> }[] = [
  {
    id: 'A',
    description: '内向、自律、成就主义',
    traits: {
      extraversion: 10,
      discipline: 95,
      independence: 75,
      creativity: 45,
      adventure: 20,
      sensitivity: 35,
    },
  },
  {
    id: 'B',
    description: '外向、浪漫、关系主义',
    traits: {
      extraversion: 95,
      romance: 95,
      kindness: 90,
      discipline: 40,
      independence: 25,
      creativity: 55,
      adventure: 65,
    },
  },
  {
    id: 'C',
    description: '懒散、乐观、自由主义',
    traits: {
      extraversion: 55,
      discipline: 10,
      sensitivity: 15,
      independence: 90,
      adventure: 65,
      curiosity: 35,
      creativity: 40,
    },
  },
  {
    id: 'D',
    description: '敏感、好奇、理想主义',
    traits: {
      sensitivity: 95,
      curiosity: 95,
      creativity: 90,
      openness: 95,
      extraversion: 35,
      discipline: 50,
    },
  },
  {
    id: 'E',
    description: '理性、独立、探索主义',
    traits: {
      sensitivity: 10,
      independence: 95,
      adventure: 95,
      curiosity: 90,
      openness: 85,
      discipline: 70,
      extraversion: 35,
    },
  },
];
const comparisons = personalities.map((p) => {
  const samples = Array.from({ length: 5 }, (_, seedIndex) => {
    const character = structuredClone(defaultCharacter);
    character.traits = { ...character.traits, ...p.traits };
    const w = createWorld(character, now, 500 + seedIndex);
    advance(w, 30 * DAY);
    validateWorld(w);
    return {
      seed: 500 + seedIndex,
      activities: w.living.stats.activities,
      acquaintances: w.npcs.filter((n) => n.relation.familiarity > 0).length,
      socialInteractions: w.events.filter((e) => e.definition === 'encounter').length,
      work: w.living.stats.activities.work || 0,
      skill: w.character.skill,
      interests: w.living.interests,
      habits: w.living.habits.filter((h) => h.formed).map((h) => h.id),
      creations: w.living.creations.filter((c) => c.completed).length,
      diary: w.diaries.at(-1)?.body,
      arcs: w.living.arcs.map((a) => ({ id: a.id, ending: a.ending || a.status })),
    };
  });
  const mean = (key: string) =>
    samples.reduce((s, r) => s + (r.activities[key] || 0), 0) / samples.length;
  return {
    ...p,
    samples,
    meanActivities: Object.fromEntries(
      ['read', 'study', 'work', 'create', 'socialize', 'walk', 'play', 'rest'].map((k) => [
        k,
        mean(k),
      ]),
    ),
  };
});
assert.ok(
  comparisons[1].meanActivities.socialize > comparisons[0].meanActivities.socialize,
  'B should socialize more than A',
);
assert.ok(
  comparisons[0].meanActivities.work > comparisons[2].meanActivities.work,
  'A should work more than C',
);
assert.ok(
  comparisons[3].meanActivities.create > comparisons[2].meanActivities.create,
  'D should create more than C',
);
assert.equal(new Set(comparisons.map((p) => JSON.stringify(p.meanActivities))).size, 5);
assert.equal(new Set(comparisons.map((p) => p.samples[0].diary)).size, 5);
const total = Object.values(categoryCounts).reduce((s, n) => s + n, 0);
const report = {
  scope:
    '100 seeds × 30 game days; 90 unattended worlds and 10 single-gift worlds; hourly state sampling and validation after every day. Five personalities × five paired seeds × 30 days, identical job/interest/world apart from traits.',
  elapsedMs: Math.round(performance.now() - start),
  baseEvents: events.length,
  baseCategories: new Set(events.map((e) => e.category)).size,
  summary: {
    anomalies: 0,
    diaries: runs.reduce((s, r) => s + r.diaries, 0),
    ordinaryRange: [
      Math.min(...runs.map((r) => r.ordinaryEvents)),
      Math.max(...runs.map((r) => r.ordinaryEvents)),
    ],
    averageRepeatRatio: runs.reduce((s, r) => s + r.repeatRatio, 0) / 100,
    npcChanges: runs.reduce((s, r) => s + r.npcChanges, 0),
    careerChanges: runs.reduce((s, r) => s + r.careerChanges, 0),
    maxSaveBytes: Math.max(...runs.map((r) => r.saveBytes)),
    worldsWithNewPlaces: runs.filter((r) => Object.keys(r.visits).length > 0).length,
    worldsWithNewStories: runs.filter((r) =>
      r.arcs.some((a) => a.id.startsWith('arc-') && !/^arc-\d+$/.test(a.id)),
    ).length,
    distinctDiscoveries: new Set(runs.flatMap((r) => r.discoveries)).size,
    discoveryCatalog: discoveries.length,
    newEventCoverage: new Set(runs.flatMap((r) => r.newEvents.map(([id]) => id))).size,
    newEventCatalog: outskirtsEvents.length,
    missingNewEvents: outskirtsEvents
      .filter((e) => !runs.some((r) => r.newEvents.some(([id]) => id === e.eventId)))
      .map((e) => ({
        id: e.eventId,
        title: e.title,
        scene: e.scenes?.[0],
        activity: e.triggerConditions.activities[0],
        gate: e.triggerConditions.gate,
      })),
    placeReach: Object.fromEntries(
      destinations.map((d) => [d.scene, runs.filter((r) => r.visits[d.scene]).length]),
    ),
    maxPending: Math.max(...runs.map((r) => r.maxPending)),
  },
  categoryProportions: Object.fromEntries(
    Object.entries(categoryCounts).map(([k, v]) => [k, { count: v, proportion: v / total }]),
  ),
  runs,
  personalities: comparisons,
};
writeFileSync('docs/OUTSKIRTS_AUDIT.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      summary: report.summary,
      elapsedMs: report.elapsedMs,
      personalityActivities: comparisons.map((p) => ({ id: p.id, ...p.meanActivities })),
    },
    null,
    2,
  ),
);

assert.equal(
  report.summary.worldsWithNewPlaces,
  100,
  'all unattended worlds should discover new places',
);
assert.equal(
  report.summary.distinctDiscoveries,
  discoveries.length,
  'every discovery must occur across the audit',
);
assert.ok(
  report.summary.newEventCoverage >= 100,
  'new content should be visible in natural simulation',
);
