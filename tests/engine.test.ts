import { describe, it, expect } from 'vitest';
import { createWorld, defaultCharacter } from '../src/content/people';
import { advance, chooseActivity, resolveDecision } from '../src/engine/SimulationEngine';
import { catchUp, setSpeed } from '../src/engine/SimulationClock';
import { MINUTE, HOUR, DAY, STEP, dayKey, hour, record } from '../src/engine/model';
import { rememberPlayer, forget } from '../src/engine/MemoryEngine';
import { reply, startFocus, returnFocus } from '../src/engine/ConversationEngine';
import { playerDraft, closeDay } from '../src/engine/DiaryEngine';
import { validateWorld } from '../src/engine/validation';
import { events, chains } from '../src/content/events';
import { passesGate } from '../src/engine/EventEngine';
import { advanceChains, resolveChain } from '../src/engine/EventChainEngine';
import { npcTick } from '../src/engine/NPCSimulationEngine';
const NOW = Date.UTC(2026, 9, 19, 8);
const fresh = () => createWorld(structuredClone(defaultCharacter), NOW, 12345);
describe('deterministic world clock', () => {
  it('matches one large advance to many small advances, including fractional steps', () => {
    const a = fresh(),
      b = fresh();
    advance(a, DAY * 3 + 12345);
    for (let i = 0; i < 3 * 24 * 60; i++) advance(b, MINUTE);
    advance(b, 12345);
    expect(a).toEqual(b);
    expect(validateWorld(a)).toEqual(a);
  });
  it('produces identical worlds at 1x, 4x and 12x after equal game time', () => {
    const worlds = ([1, 4, 12] as const).map((speed) => {
      const w = fresh();
      w.settings.speed = speed;
      catchUp(w, NOW + DAY / speed);
      w.lastReal = NOW;
      w.settings.speed = 1;
      return w;
    });
    expect(worlds[0]).toEqual(worlds[1]);
    expect(worlds[0]).toEqual(worlds[2]);
  });
  it('settles elapsed time using old speed before changing rate', () => {
    const w = fresh(),
      t = w.time;
    setSpeed(w, 12, NOW + 15 * MINUTE);
    expect(w.time - t).toBe(HOUR);
    catchUp(w, NOW + 20 * MINUTE);
    expect(w.time - t).toBe(2 * HOUR);
  });
  it('pause never catches up the paused period', () => {
    const w = fresh(),
      t = w.time;
    setSpeed(w, 0, NOW);
    catchUp(w, NOW + DAY);
    expect(w.time).toBe(t);
    setSpeed(w, 1, NOW + DAY);
    catchUp(w, NOW + DAY + MINUTE);
    expect(w.time).toBe(t + MINUTE);
  });
  it('replaying a timestamp cannot repeat events, income or diaries', () => {
    const w = fresh();
    catchUp(w, NOW + DAY);
    const snapshot = structuredClone(w);
    catchUp(w, NOW + DAY);
    expect(w).toEqual(snapshot);
  });
  it('clock rollback keeps a high-water mark', () => {
    const w = fresh();
    catchUp(w, NOW + HOUR);
    const snapshot = structuredClone(w);
    expect(catchUp(w, NOW).clockReversed).toBe(true);
    expect(w).toEqual(snapshot);
    catchUp(w, NOW + HOUR);
    expect(w).toEqual(snapshot);
  });
  it('bounds extreme offline time and preserves numeric ranges', () => {
    const w = fresh();
    w.settings.offlineDays = 30;
    const r = catchUp(w, NOW + 5000 * DAY);
    expect(r.gameElapsed).toBe(30 * DAY);
    expect(r.skipped).toBeGreaterThan(0);
    expect(() => validateWorld(w)).not.toThrow();
    expect(w.diaries.length).toBe(30);
    for (const n of Object.values(w.needs)) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
    expect(w.money).toBeLessThan(20000);
  });
  it('different seeds and personalities lead to different lives', () => {
    const a = fresh(),
      b = fresh();
    b.seed = 4444;
    b.character.traits.extraversion = 99;
    b.character.traits.creativity = 10;
    advance(a, DAY * 3);
    advance(b, DAY * 3);
    expect(a.events.map((e) => e.title)).not.toEqual(b.events.map((e) => e.title));
  });
});
describe('daily routines, economy and consent', () => {
  it('sleeps across the night and wakes in the morning', () => {
    const w = fresh();
    advance(w, 16 * HOUR);
    expect(hour(w.time)).toBe(0);
    expect(w.activity.kind).toBe('sleep');
    advance(w, 6 * HOUR);
    expect(w.activity.kind).toBe('sleep');
    advance(w, 2 * HOUR);
    expect(w.activity.kind).not.toBe('sleep');
  });
  it('default life includes errands, outdoor time and plant care', () => {
    const w = fresh();
    w.settings.advice = 'autonomous';
    const kinds = new Set<string>();
    for (let i = 0; i < 720; i++) {
      advance(w, HOUR);
      kinds.add(w.activity.kind);
    }
    for (const kind of ['walk', 'shop', 'garden', 'sleep', 'work', 'read', 'eat'])
      expect(kinds.has(kind)).toBe(true);
  });
  it('NPC night workers remain at work at midnight', () => {
    const w = fresh();
    w.time = Math.floor(w.time / DAY) * DAY;
    npcTick(w);
    expect(w.npcs.find((n) => n.job === '便利店店员')?.scene).toBe('shop');
  });
  it('night shift has a different sleep schedule', () => {
    const w = fresh();
    w.character.job = '便利店店员';
    w.time = Math.floor(w.time / DAY) * DAY + 10 * HOUR;
    chooseActivity(w);
    expect(w.activity.kind).toBe('sleep');
  });
  it('pays at most once for each working day', () => {
    const w = fresh();
    w.character.job = '办公室职员';
    advance(w, 7 * DAY);
    const salary = w.ledger.filter((l) => l.reason === '当日职业收入');
    expect(salary.length).toBeGreaterThan(0);
    expect(new Set(salary.map((l) => dayKey(l.time))).size).toBe(salary.length);
  });
  it('does not create impossible job/romance events', () => {
    const w = fresh();
    w.character.job = '无业者';
    expect(passesGate(w, 'employed')).toBe(false);
    expect(passesGate(w, 'partner')).toBe(false);
    advance(w, 15 * DAY);
    const gatedIds = events
      .filter(
        (e) => e.triggerConditions.gate === 'employed' || e.triggerConditions.gate === 'partner',
      )
      .map((e) => e.eventId);
    expect(w.events.some((e) => gatedIds.includes(e.definition))).toBe(false);
  });
  it('legacy career decisions and new major life decisions wait without blocking life', () => {
    const w = fresh();
    w.character.skill = 40;
    w.decisions.push({
      id: 'career-first',
      kind: 'career',
      title: '想试试另一种工作',
      text: '旧存档中的自由职业提议',
      created: w.time,
    });
    w.money = 14000;
    advance(w, 2 * DAY);
    expect(w.decisions.some((d) => d.kind === 'career')).toBe(true);
    expect(w.decisions.some((d) => d.kind === 'move')).toBe(true);
    expect(w.character.job).toBe('插画师');
    expect(w.character.housing).toBe('阳光公寓');
    const t = w.time;
    advance(w, DAY);
    expect(w.time - t).toBe(DAY);
  });
  it('decision resolution cannot charge or apply twice', () => {
    const w = fresh();
    w.money = 10000;
    w.decisions.push({ id: 'move', kind: 'move', title: '搬家', text: '', created: w.time });
    resolveDecision(w, 'move', 'yes');
    const copy = structuredClone(w);
    resolveDecision(w, 'move', 'yes');
    expect(w).toEqual(copy);
    expect(w.money).toBe(7000);
  });
  it('romance can be refused and never requires being in a couple', () => {
    const w = fresh();
    w.npcs[0].relation.willing = false;
    w.decisions.push({
      id: 'romance',
      kind: 'romance',
      title: '心意',
      text: '',
      created: w.time,
      npcId: w.npcs[0].id,
    });
    resolveDecision(w, 'romance', 'yes');
    expect(w.npcs[0].relation.type).not.toBe('恋人');
    expect(w.events.at(-1)?.text).toContain('更愿意保持友谊');
  });
  it('daily diaries are idempotent and cite real events', () => {
    const w = fresh();
    advance(w, 3 * DAY);
    const count = w.diaries.length;
    closeDay(w, w.diaries[0].date);
    expect(w.diaries.length).toBe(count);
    for (const d of w.diaries)
      for (const id of d.eventIds) expect(w.events.some((e) => e.id === id)).toBe(true);
    expect(new Set(w.diaries.map((d) => d.date)).size).toBe(count);
  });
  it('personality evolves slowly with recorded reasons', () => {
    const w = fresh();
    advance(w, 10 * DAY);
    expect(w.evolution.length).toBeGreaterThan(0);
    for (const [k, start] of Object.entries(defaultCharacter.traits))
      expect(
        Math.abs(w.character.traits[k as keyof typeof w.character.traits] - start),
      ).toBeLessThan(3);
  });
});
describe('content and chains', () => {
  it('contains at least 150 distinct structured events and 15 complete chains', () => {
    expect(events.length).toBeGreaterThanOrEqual(150);
    expect(new Set(events.map((e) => e.title)).size).toBe(events.length);
    expect(new Set(events.map((e) => e.description)).size).toBe(events.length);
    for (const e of events) {
      expect(e.triggerConditions.activities.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(10);
    }
    expect(chains.length).toBe(15);
    expect(new Set(chains.map((c) => c.id)).size).toBe(15);
  });
  it.each(chains.map((d) => [d.id]))(
    'runs chain %s through all delayed nodes and a quiet ending',
    (id) => {
      const w = fresh();
      const origin = record(w, '起点', '起点事件', '连锁剧情', true).id;
      w.chains.push({ id, stage: 1, due: w.time + DAY, origin, status: 'active' });
      advanceChains(w);
      expect(w.chains[0].stage).toBe(1);
      w.time += 10 * DAY;
      advanceChains(w);
      expect(w.chains[0].stage).toBe(2);
      w.time += 10 * DAY;
      advanceChains(w);
      expect(w.chains[0].stage).toBe(3);
      w.time += 10 * DAY;
      advanceChains(w);
      expect(w.decisions).toHaveLength(1);
      advanceChains(w);
      expect(w.decisions).toHaveLength(1);
      resolveChain(w, id, false);
      expect(w.chains[0].status).toBe('declined');
      expect(w.events.at(-1)?.cause).toBe(origin);
      const count = w.events.length;
      resolveChain(w, id, true);
      expect(w.events).toHaveLength(count);
    },
  );
  it('NPCs live independently without protagonist encounters', () => {
    const w = fresh();
    for (let i = 0; i < 20; i++) {
      w.time += DAY;
      npcTick(w);
    }
    expect(w.npcs.filter((n) => n.memories.length > 0).length).toBeGreaterThan(5);
    expect(new Set(w.npcs.map((n) => n.scene)).size).toBeGreaterThan(1);
  });
});
describe('player facts and privacy', () => {
  it('does not celebrate a failed attempt as a success', () => {
    const w = fresh();
    expect(reply(w, '我今天考试没通过')).toContain('不太顺利');
  });
  it('chat does not save player facts without explicit authorization', () => {
    const w = fresh();
    reply(w, '我今天学习了德语');
    expect(w.memories.filter((m) => m.subject === 'player')).toHaveLength(0);
    expect(playerDraft(w, '2026-10-19')).toBe('');
  });
  it('consented memory is deduplicated, retrievable and deletable', () => {
    const w = fresh();
    rememberPlayer(w, '我正在学德语', NOW);
    rememberPlayer(w, '我正在学德语', NOW);
    expect(w.memories).toHaveLength(1);
    expect(reply(w, '你记得我什么')).toContain('我正在学德语');
    forget(w, w.memories[0].id);
    expect(reply(w, '你记得我什么')).not.toContain('德语');
  });
  it('do-not-remember overrides the consent checkbox', () => {
    const w = fresh();
    expect(rememberPlayer(w, '这件事不要记住', NOW)).toBe(false);
    expect(w.memories).toHaveLength(0);
  });
  it('does not infer actual focus duration from elapsed time', () => {
    const w = fresh();
    startFocus(w, '学习', 30, NOW);
    returnFocus(w, NOW + 50 * MINUTE);
    expect(w.playerActivities[0].confirmedMinutes).toBeUndefined();
    const draft = playerDraft(w, new Date(NOW).toLocaleDateString('en-CA'));
    expect(draft).toContain('实际活动时长未确认');
    expect(draft).not.toContain('学习了50分钟');
  });
  it('preserves explicitly confirmed activity notes', () => {
    const w = fresh();
    startFocus(w, '学习', 30, NOW);
    returnFocus(w, NOW + 50 * MINUTE);
    w.playerActivities[0].confirmedMinutes = 20;
    w.playerActivities[0].note = '复习了英语单词';
    expect(playerDraft(w, new Date(NOW).toLocaleDateString('en-CA'))).toContain('实际20分钟');
  });
  it('rejects impossible or incompatible imported saves', () => {
    const w = fresh();
    expect(() => validateWorld({ ...w, version: 99 })).toThrow();
    expect(() => validateWorld({ ...w, seed: NaN })).toThrow();
    expect(() => validateWorld({ ...w, seed: 0 })).toThrow();
    expect(() => validateWorld({ ...w, sequence: 0 })).toThrow();
    expect(() => validateWorld({ ...w, simulatedUntil: w.time + STEP })).toThrow();
  });
});
