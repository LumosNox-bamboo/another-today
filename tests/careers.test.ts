import { it, expect } from 'vitest';
import { careerTracks, majors } from '../src/content/careers';
import { createWorld, defaultCharacter } from '../src/content/people';
import {
  careerTrack,
  careerProgress,
  careerOnDuty,
  bindCareerActivity,
  completeCareerActivity,
  setOccupation,
  setCareerDirection,
} from '../src/engine/CareerEngine';
import { validateCareerContent } from '../src/engine/CareerValidator';
import { validateWorld } from '../src/engine/validation';
import { advance, chooseActivity, isWorking } from '../src/engine/SimulationEngine';
import {
  addResident,
  selectResident,
  commandResident,
  resident,
} from '../src/engine/HouseholdEngine';
import { DAY, MINUTE, HOUR, type Character } from '../src/engine/model';
import { npcTick } from '../src/engine/NPCSimulationEngine';
const now = Date.UTC(2026, 9, 19, 8);
const fresh = (job: Character['job'] = '程序员', major?: Character['major']) =>
  createWorld({ ...structuredClone(defaultCharacter), job, major }, now, 72);
function session(w: ReturnType<typeof fresh>, minutes = 90) {
  const t = careerTrack(w.character);
  w.activity = { kind: t.activity, scene: t.scene, start: w.time, end: w.time + minutes * MINUTE };
  bindCareerActivity(w);
  w.time = w.activity.end;
  w.simulatedUntil = w.time;
  completeCareerActivity(w);
}
it('validates every existing profession, 16 specialist majors and all distinct daily outcomes', () => {
  expect(validateCareerContent()).toEqual([]);
  expect(majors).toHaveLength(17);
  expect(careerTracks).toHaveLength(29);
  expect(careerTracks.reduce((n, t) => n + t.duties.length, 0)).toBe(132);
  const bad = structuredClone(careerTracks);
  bad[0].duties[0].id = bad[1].duties[0].id;
  bad[0].hours = [9, 9];
  bad[1].duties[0].success = '';
  expect(validateCareerContent(bad).length).toBeGreaterThanOrEqual(3);
});
it('migrates old saves without invented practice and keeps each member progress independent', () => {
  const w = fresh();
  delete w.character.major;
  w.character.careerLevel = 5;
  const old = validateWorld(JSON.parse(JSON.stringify(w)));
  expect(old.career).toBeUndefined();
  session(old);
  expect(old.character.careerLevel).toBe(5);
  expect(careerProgress(old).minutes).toBe(90);
  const id = addResident(old, '同住者', 25, '室友');
  selectResident(old, id);
  expect(old.career).toBeUndefined();
  setOccupation(old, '学生', '音乐');
  session(old, 60);
  expect(careerProgress(old).id).toBe('student-music');
  expect(careerProgress(old).minutes).toBe(60);
  selectResident(old, 'resident-0');
  expect(careerProgress(old).id).toBe('software');
  expect(careerProgress(old).minutes).toBe(90);
  const saved = validateWorld(JSON.parse(JSON.stringify(old)));
  expect(resident(saved, id)!.career!.tracks.find((p) => p.id === 'student-music')!.minutes).toBe(
    60,
  );
});
it('completes real tasks once, records bounded outcomes, and progresses only from varied vocational practice', () => {
  const w = fresh();
  w.character.skill = 100;
  w.activity = { kind: 'read', scene: 'library', start: w.time, end: w.time + HOUR };
  bindCareerActivity(w);
  expect(w.activity.career).toBeUndefined();
  completeCareerActivity(w);
  expect(w.career).toBeUndefined();
  const titles: string[] = [];
  for (let i = 0; i < 80; i++) {
    session(w);
    titles.push(w.activity.career!.duty);
    const before = JSON.stringify(w.career);
    completeCareerActivity(w);
    expect(JSON.stringify(w.career)).toBe(before);
  }
  expect(titles.every((id, i) => i === 0 || id !== titles[i - 1])).toBe(true);
  expect(careerProgress(w).stage).toBe(2);
  expect(w.character.careerLevel).toBe(4);
  expect(w.events.some((e) => e.definition === 'career-milestone-software-2')).toBe(true);
  expect(w.memories.some((m) => m.content.includes('独立交付'))).toBe(true);
  expect(w.living.causes.some((c) => c.title.includes('独立交付') && c.parents.length > 0)).toBe(
    true,
  );
  expect(validateWorld(w).career).toEqual(w.career);
});
it('does not credit interrupted, unfinished, mismatched or too short work', () => {
  const w = fresh();
  w.activity = { kind: 'work', scene: 'office', start: w.time, end: w.time + 90 * MINUTE };
  bindCareerActivity(w);
  completeCareerActivity(w);
  expect(careerProgress(w).minutes).toBe(0);
  commandResident(w, 'resident-0', 'rest', 'apartment', 15);
  advance(w, 5 * MINUTE);
  expect(careerProgress(w).minutes).toBe(0);
  w.activity = { kind: 'work', scene: 'park', start: w.time, end: w.time + HOUR };
  bindCareerActivity(w);
  expect(w.activity.career).toBeUndefined();
  session(w, 5);
  expect(careerProgress(w).minutes).toBe(0);
});
it('keeps night shifts tied to their start day, gives service jobs rest days, and protects student ages', () => {
  const w = fresh('便利店店员');
  expect(careerOnDuty(w.character, Date.UTC(2026, 9, 19, 2))).toBe(true); // Sunday shift continues into Monday
  expect(careerOnDuty(w.character, Date.UTC(2026, 9, 19, 23))).toBe(false);
  expect(careerOnDuty(w.character, Date.UTC(2026, 9, 21, 23))).toBe(true);
  expect(careerOnDuty({ ...w.character, job: '咖啡师' }, Date.UTC(2026, 9, 24, 8))).toBe(true);
  expect(careerOnDuty({ ...w.character, job: '程序员' }, Date.UTC(2026, 9, 24, 10))).toBe(false);
  w.character.age = 12;
  expect(careerTrack(w.character).id).toBe('school-primary');
  expect(isWorking(w)).toBe(false);
  expect(() => setOccupation(w, '程序员')).toThrow();
  w.character.age = 70;
  expect(careerTrack(w.character).id).toBe('retired');
  expect(() => setOccupation(w, '教师')).toThrow();
});
it('preserves old routes on career or major changes and cancels obsolete work without pay', () => {
  const w = fresh();
  session(w);
  commandResident(w, 'resident-0', 'work', 'office', 60);
  const money = w.money;
  setOccupation(w, '学生', '医学');
  expect(w.household.members[0].queue).toHaveLength(0);
  expect(w.activity.kind).toBe('rest');
  session(w, 60);
  expect(careerProgress(w).id).toBe('student-medicine');
  expect(w.money).toBe(money);
  setOccupation(w, '程序员');
  expect(careerProgress(w).minutes).toBe(90);
  expect(w.career!.tracks.find((p) => p.id === 'student-medicine')!.minutes).toBe(60);
  const malformed = structuredClone(w);
  malformed.career!.tracks[0].counts.fake = 1;
  expect(() => validateWorld(malformed)).toThrow();
});
it('direction changes task weights while maintaining variation and never auto changing profession', () => {
  const counts = [0, 1].map((focus) => {
    const w = fresh();
    setCareerDirection(w, focus as 0 | 1);
    let n = 0;
    for (let i = 0; i < 120; i++) {
      session(w);
      const task = careerTrack(w.character).duties.find((d) => d.id === w.activity.career!.duty)!;
      if (task.skill === 2) n++;
    }
    expect(w.character.job).toBe('程序员');
    return n;
  });
  expect(counts[1]).toBeGreaterThan(counts[0]);
});
it('autonomous professional and student days produce different tasks and factual diaries', () => {
  for (const [job, major] of [
    ['程序员', undefined],
    ['学生', '音乐'],
    ['学生', '医学'],
  ] as const) {
    const w = fresh(job, major);
    advance(w, 7 * DAY);
    const t = careerTrack(w.character);
    expect(w.career?.tracks.find((p) => p.id === t.id)?.minutes).toBeGreaterThan(120);
    expect(w.diaries.some((d) => t.duties.some((task) => d.body.includes(task.process)))).toBe(
      true,
    );
    expect(
      w.events
        .filter((e) => e.category === '职业日常' || e.category === '学习与生活')
        .every((e) => e.definition.startsWith(t.id)),
    ).toBe(true);
    if (job === '学生') expect(w.ledger.some((l) => l.reason === '当日职业收入')).toBe(false);
    expect(() => validateWorld(w)).not.toThrow();
  }
}, 15000);
it('NPC duty plans match their professions and locations', () => {
  const w = fresh();
  w.time = Date.UTC(2026, 9, 21, 11);
  npcTick(w);
  expect(w.npcs.find((n) => n.job === '便利店店员')!.scene).toBe('apartment');
  for (const n of w.npcs) {
    const t = careerTrack(n);
    if (careerOnDuty(n, w.time)) {
      expect(n.scene).toBe(t.scene);
      expect(t.duties.some((d) => d.title === n.plan)).toBe(true);
    }
  }
});
it('selected students usually choose their coursework during scheduled hours', () => {
  let studying = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const w = fresh('学生', '建筑学');
    w.seed = seed * 1234567;
    w.time = Date.UTC(2026, 9, 19, 10);
    w.needs.energy = 95;
    w.needs.hunger = 10;
    chooseActivity(w);
    if (w.activity.kind === 'study') {
      studying++;
      expect(w.activity.career?.track).toBe('student-architecture');
    }
  }
  expect(studying).toBeGreaterThanOrEqual(16);
});
it('opening and handover tasks respect shift windows', () => {
  const cafe = fresh('咖啡师');
  cafe.time = Date.UTC(2026, 9, 21, 14);
  for (let i = 0; i < 30; i++) {
    cafe.activity = { kind: 'work', scene: 'cafe', start: cafe.time, end: cafe.time + HOUR };
    bindCareerActivity(cafe);
    expect(cafe.activity.career!.duty).not.toBe('barista-0');
  }
  const shop = fresh('便利店店员');
  shop.time = Date.UTC(2026, 9, 21, 23);
  for (let i = 0; i < 30; i++) {
    shop.activity = { kind: 'work', scene: 'shop', start: shop.time, end: shop.time + HOUR };
    bindCareerActivity(shop);
    expect(['retail-3', 'retail-4', 'retail-5']).not.toContain(shop.activity.career!.duty);
  }
});
it('professional exchanges only involve actual colocated peers and persist their relationship', () => {
  const w = fresh();
  const peer = w.npcs.find((n) => n.job === '程序员')!;
  w.npcs.forEach((n) => {
    n.scene = 'park';
  });
  peer.scene = 'office';
  const before = peer.relation.familiarity;
  for (let i = 0; i < 60; i++) {
    w.time += DAY;
    w.simulatedUntil = w.time;
    w.activity = {
      kind: 'work',
      scene: 'office',
      start: w.time,
      end: w.time + HOUR,
      career: { track: 'software', duty: 'software-2' },
    };
    w.time = w.activity.end;
    w.simulatedUntil = w.time;
    completeCareerActivity(w);
  }
  expect(peer.relation.familiarity).toBeGreaterThan(before);
  expect(peer.relation.type).toBe('同事');
  expect(w.events.some((e) => e.definition === 'software-2' && e.npcId === peer.id)).toBe(true);
  expect(
    w.npcs
      .filter((n) => n.id !== peer.id && n.job === '程序员')
      .every((n) => n.relation.familiarity === 0),
  ).toBe(true);
  expect(() => validateWorld(w)).not.toThrow();
});
