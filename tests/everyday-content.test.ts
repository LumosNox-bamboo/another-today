import { it, expect } from 'vitest';
import { everydayEvents } from '../src/content/everydayEvents';
import { careerTracks } from '../src/content/careers';
import { createWorld, defaultCharacter } from '../src/content/people';
import { validateContent } from '../src/engine/ContentValidator';
import { eligibleEvent, sampleEvent } from '../src/engine/EventEngine';
import { reply } from '../src/engine/ConversationEngine';
import { bindCareerActivity, completeCareerActivity } from '../src/engine/CareerEngine';
import { DAY, HOUR, type Character } from '../src/engine/model';
const now = Date.UTC(2026, 9, 20, 10);
const fresh = () => {
  const w = createWorld(structuredClone(defaultCharacter), now, 72);
  w.time = now;
  return w;
};

it('adds 51 valid authored events without changing existing IDs', () => {
  expect(everydayEvents).toHaveLength(51);
  expect(validateContent()).toEqual([]);
  expect(new Set(everydayEvents.map((e) => e.description)).size).toBe(51);
  const bad = structuredClone(everydayEvents);
  bad[0].careerTrack = 'missing-career';
  expect(validateContent(bad).some((e) => e.includes('职业路线'))).toBe(true);
});

it('each career event is reachable only for its route and place', () => {
  for (const track of careerTracks) {
    const w = fresh();
    w.character.job = track.job;
    w.character.age =
      track.id === 'retired'
        ? 70
        : track.id === 'school-primary'
          ? 10
          : track.id === 'school-secondary'
            ? 16
            : 25;
    w.character.major = track.id.startsWith('student-')
      ? (track.name.replace(/学生$/, '') as Character['major'])
      : undefined;
    w.activity = { kind: track.activity, scene: track.scene, start: now, end: now + HOUR };
    const e = everydayEvents.find((e) => e.careerTrack === track.id)!;
    expect(eligibleEvent(w, e), track.id).toBe(true);
    w.activity.scene = 'park';
    expect(eligibleEvent(w, e)).toBe(false);
    w.activity.scene = track.scene;
    w.character = { ...w.character, age: track.id === 'retired' ? 10 : 70 };
    expect(eligibleEvent(w, e)).toBe(false);
  }
});

it('follow-ups need a real cause and elapsed days; friends must be present', () => {
  const w = fresh();
  const follow = everydayEvents.find((e) => e.eventId === 'daily-follow-recipe')!;
  w.activity.kind = 'eat';
  w.activity.scene = 'apartment';
  expect(eligibleEvent(w, follow)).toBeFalsy();
  w.living.eventHistory[follow.requiresEvent!.id] = { time: now, source: 'actual-event' };
  w.time += DAY;
  expect(eligibleEvent(w, follow)).toBeFalsy();
  w.time += DAY;
  expect(eligibleEvent(w, follow)).toBe(true);
  w.cooldowns[follow.eventId] = Number.MAX_SAFE_INTEGER;
  expect(eligibleEvent(w, follow)).toBeFalsy();
  const friend = everydayEvents.find((e) => e.eventId === 'daily-friend-silence')!;
  w.activity.kind = 'socialize';
  w.npcs.forEach((n) => {
    n.scene = 'park';
    n.relation.familiarity = 20;
  });
  expect(eligibleEvent(w, friend)).toBe(false);
  w.npcs[0].scene = 'apartment';
  expect(eligibleEvent(w, friend)).toBe(true);
});

it('new events execute through the real sampler with effects and cooldowns', () => {
  const w = fresh();
  w.activity.kind = 'read';
  w.activity.scene = 'library';
  w.needs.mood = 30;
  for (let i = 0; i < 500; i++) sampleEvent(w);
  const entry = w.events.find((e) => e.definition === 'daily-small-margin');
  expect(entry).toBeDefined();
  expect(w.living.eventHistory['daily-small-margin'].source).toBe(entry!.id);
  expect(w.cooldowns['daily-small-margin']).toBeGreaterThan(w.time);
  expect(w.needs.mood).toBeGreaterThan(30);
});

it('dialogue varies without inventing memories or changing simulation randomness', () => {
  const w = fresh();
  const saved = JSON.stringify(w.memories),
    rng = w.seed;
  const lines = Array.from({ length: 4 }, () => reply(w, '我今天很累'));
  expect(new Set(lines).size).toBe(4);
  expect(reply(w, '考试没通过')).toContain('不太顺利');
  expect(reply(w, '晚安')).toContain('晚安');
  expect(JSON.stringify(w.memories)).toBe(saved);
  expect(w.seed).toEqual(rng);
});

it('career conversation distinguishes a route from actual completed practice', () => {
  const w = fresh();
  w.character.job = '程序员';
  expect(reply(w, '你的工作或学业怎么样？')).toContain('还没有记下实际完成');
  expect(w.career).toBeUndefined();
  w.activity = { kind: 'work', scene: 'office', start: now, end: now + HOUR };
  bindCareerActivity(w);
  expect(reply(w, '你在忙什么？')).toContain('办公室');
  w.time += HOUR;
  completeCareerActivity(w);
  const text = reply(w, '你的工作或学业怎么样？');
  expect(text).toContain('最近记下了这件事');
  expect(text).toContain(w.events.find((e) => e.definition.startsWith('software-'))!.text);
  w.needs.energy = 10;
  expect(reply(w, '你现在感觉怎么样？')).toContain('休息');
});
