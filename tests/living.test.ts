import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/content/people';
import { validateWorld } from '../src/engine/validation';
import { scheduleInteraction } from '../src/engine/InteractionScheduler';
import { startShared, returnShared, confirmShared } from '../src/engine/SharedActivityEngine';
import { advance } from '../src/engine/SimulationEngine';
import { rememberPlayer, forget } from '../src/engine/MemoryEngine';
import { linkedOpportunity } from '../src/engine/PlayerLinkedEventEngine';
import { DAY, HOUR, MINUTE } from '../src/engine/model';
const now = new Date(2026, 9, 19, 10).getTime();
const fresh = () => createWorld(undefined, now, 12345);
describe('compatible living world and interactions', () => {
  it('migrates original v1 saves without losing their world', () => {
    const old: any = fresh();
    delete old.living;
    const next = validateWorld(old);
    expect(next.version).toBe(1);
    expect(next.character).toEqual(old.character);
    expect(next.living.notifications.dailyLimit).toBe(4);
    expect(validateWorld(next)).toEqual(next);
  });
  it('respects real daily caps, DND, focus and never penalizes silence', () => {
    const w = fresh(),
      trust = w.companion.trust;
    w.living.notifications.dailyLimit = 1;
    scheduleInteraction(w, now);
    for (let i = 1; i < 10; i++) scheduleInteraction(w, now + i * HOUR);
    expect(w.living.interactions).toHaveLength(1);
    expect(w.companion.trust).toBe(trust);
    w.living.notifications.dnd = true;
    scheduleInteraction(w, now + DAY);
    expect(w.living.interactions).toHaveLength(1);
    w.living.notifications.dnd = false;
    startShared(w, '阅读', 25, now + DAY);
    scheduleInteraction(w, now + DAY);
    expect(w.living.interactions).toHaveLength(1);
  });
  it('records actual simulated activity independently and requires explicit confirmation', () => {
    const w = fresh(),
      before = structuredClone(w.activity);
    startShared(w, '运动', 30, now);
    expect(w.activity).toEqual(before);
    advance(w, 2 * HOUR);
    returnShared(w, now + 30 * MINUTE);
    const a = w.playerActivities[0];
    expect(a.confirmedMinutes).toBeUndefined();
    expect(a.independent!.reduce((sum, x) => sum + x.minutes, 0)).toBe(120);
    confirmShared(w, a.id, 0, '临时接电话，没有运动');
    expect(a.exchange).toContain('0 分钟');
    expect(a.note).toContain('没有运动');
    confirmShared(w, a.id, 30, '重复提交');
    expect(a.confirmedMinutes).toBe(0);
    expect(validateWorld(w)).toEqual(w);
  });
  it('links only consented verbatim topics and removes derived reminders when forgotten', () => {
    const w = fresh();
    expect(linkedOpportunity(w, now + 4 * DAY)).toBeUndefined();
    rememberPlayer(w, '我在准备考试', now);
    const m = w.memories.find((m) => m.subject === 'player')!;
    expect(linkedOpportunity(w, now + 4 * DAY)?.text).toContain('我在准备考试');
    w.living.interactions.push({
      id: 'i',
      time: now,
      text: m.content,
      source: m.id,
      kind: '目标',
      important: false,
      read: false,
    });
    forget(w, m.id);
    expect(w.living.interactions).toHaveLength(0);
    expect(linkedOpportunity(w, now + 4 * DAY)).toBeUndefined();
  });
});

import { gifts, habits, secrets, newsTemplates } from '../src/content/living';
import { giveGift, useGifts, giftBias } from '../src/engine/GiftEngine';
import { practiceHabits, decayHabits } from '../src/engine/HabitEngine';
import { secretsTick, revealSecret, secretBias } from '../src/engine/SecretEngine';
import { setCalendarMode, seasonTick } from '../src/engine/SeasonEngine';
import { publishNews, newsTick, openScene } from '../src/engine/TownNewsEngine';
import { npcLifeTick } from '../src/engine/NPCLifeEngine';
import { traceCauses } from '../src/engine/EventCausalityGraph';
describe('gifts, habits, secrets and persistent town', () => {
  it('ships authored catalogs and gift effects without affection farming', () => {
    expect(gifts.length).toBeGreaterThanOrEqual(30);
    expect(habits.length).toBeGreaterThanOrEqual(40);
    expect(secrets.length).toBeGreaterThanOrEqual(20);
    expect(newsTemplates.length).toBeGreaterThanOrEqual(50);
    const w = fresh(),
      trust = w.companion.trust;
    const g = giveGift(w, 'gift-6-0');
    expect(giftBias(w, 'create')).toBeGreaterThan(0);
    w.time += 2 * DAY;
    for (let i = 0; i < 4; i++) useGifts(w, 'create');
    expect(g.followedUp).toBe(true);
    expect(w.companion.trust).toBe(trust);
    expect(traceCauses(w, w.events.at(-1)!.id).map((e) => e.id)).toContain(g.source);
    expect(() => giveGift(w, 'gift-6-0')).toThrow();
    expect(validateWorld({ ...w, simulatedUntil: w.time })).toBeTruthy();
  });
  it('forms contextual habits across days and weakens unused habits', () => {
    const w = fresh();
    for (let i = 0; i < 12; i++) {
      practiceHabits(w, 'read');
      w.time += DAY;
    }
    expect(w.living.habits.some((h) => h.formed)).toBe(true);
    const strength = w.living.habits.reduce((s, h) => s + h.strength, 0);
    for (let i = 0; i < 30; i++) {
      w.time += DAY;
      decayHabits(w);
    }
    expect(w.living.habits.reduce((s, h) => s + h.strength, 0)).toBeLessThan(strength);
    expect(w.living.habitHistory.some((h) => h.change.includes('弱化'))).toBe(true);
  });
  it('secrets bias behavior, require readiness and resolve after real practice', () => {
    const w = fresh();
    w.living.secrets.push({
      id: 'secret-0',
      started: w.time,
      expires: w.time + 30 * DAY,
      progress: 0,
      status: 'hidden',
      source: w.events[0].id,
    });
    expect(secretBias(w, 'create')).toBeGreaterThan(0);
    expect(revealSecret(w)).toContain('准备好了');
    w.companion.trust = 50;
    for (let i = 0; i < 30; i++) secretsTick(w, 'create');
    expect(w.living.secrets[0].status).toBe('resolved');
    expect(w.memories.some((m) => m.content.includes('旋律'))).toBe(true);
  });
  it('news changes facility availability and NPC updates persist without player presence', () => {
    const w = fresh();
    publishNews(w, 'news-9');
    expect(openScene(w, 'park')).toBe('apartment');
    const first = structuredClone(w.npcs);
    for (let i = 0; i < 30; i++) {
      w.time += DAY;
      npcLifeTick(w);
      newsTick(w);
    }
    expect(w.living.stats.npcChanges).toBeGreaterThan(0);
    expect(w.living.npcBonds.length).toBeGreaterThan(0);
    expect(w.npcs).not.toEqual(first);
    w.simulatedUntil = w.time;
    expect(validateWorld(JSON.parse(JSON.stringify(w))).living.npcBonds).toEqual(w.living.npcBonds);
  });
  it('calendar switching does not settle the same seasonal occurrence twice', () => {
    const w = fresh();
    seasonTick(w);
    const key = w.living.calendar.claimed[0];
    setCalendarMode(w, 'real', now);
    setCalendarMode(w, 'world', now);
    seasonTick(w);
    expect(w.living.calendar.claimed.filter((k) => k === key)).toHaveLength(1);
    expect(w.living.calendar.season).toBe('秋');
  });
});

import { storyArcs } from '../src/content/storyArcs';
import { arcsTick, chooseArc, controlArc } from '../src/engine/StoryArcEngine';
import { creationTick, giftCreation, exhibitCreations } from '../src/engine/CreationEngine';
import { dreamsTick, changeDream } from '../src/engine/RegretAndDreamEngine';
import { events } from '../src/content/events';
describe('long stories, creations and dreams', () => {
  it.each(storyArcs.map((d) => [d.id]))(
    'arc %s has delayed states and two meaningful conclusions',
    (id) => {
      for (const choice of ['bold', 'quiet'] as const) {
        const w = fresh(),
          d = storyArcs.find((d) => d.id === id)!;
        w.activity.scene = d.scene;
        w.living.arcs.push({
          id,
          stage: 1,
          status: 'active',
          started: w.time,
          due: w.time + DAY,
          deadline: w.time + 200 * DAY,
          origin: w.events[0].id,
          lastEvent: w.events[0].id,
          npcId: w.npcs[0].id,
        });
        arcsTick(w);
        expect(w.living.arcs[0].stage).toBe(1);
        w.time += DAY;
        arcsTick(w);
        w.time += d.delay * DAY;
        arcsTick(w);
        chooseArc(w, id, choice);
        w.time += 2 * DAY;
        arcsTick(w);
        expect(w.living.arcs[0].ending).toBe(choice);
        expect(w.memories.at(-1)?.content).toBe(choice === 'bold' ? d.bold : d.quiet);
        expect(w.npcs[0].relation.trust).toBeGreaterThan(15);
      }
    },
  );
  it('paused stories can be missed or explicitly ended without blocking life', () => {
    const w = fresh();
    w.living.arcs.push({
      id: 'arc-0',
      stage: 1,
      status: 'active',
      started: w.time,
      due: w.time + DAY,
      deadline: w.time + 3 * DAY,
      origin: w.events[0].id,
      lastEvent: w.events[0].id,
      npcId: 'npc-0',
    });
    controlArc(w, 'arc-0', 'pause');
    w.time += 4 * DAY;
    arcsTick(w);
    expect(w.living.arcs[0].status).toBe('missed');
  });
  it('artwork retains its gift origin, can be viewed, gifted and exhibited only once', () => {
    const w = fresh();
    const gift = giveGift(w, 'gift-6-0');
    for (let i = 0; i < 8; i++) creationTick(w, 'create');
    const c = w.living.creations[0];
    expect(c.completed).toBeDefined();
    expect(traceCauses(w, c.eventId).map((n) => n.id)).toContain(gift.source);
    giftCreation(w, c.id, 'npc-0');
    const count = w.events.length;
    giftCreation(w, c.id, 'npc-0');
    expect(w.events).toHaveLength(count);
    publishNews(w, 'news-18');
    w.activity.kind = 'socialize';
    w.activity.scene = w.npcs[0].scene;
    exhibitCreations(w);
    expect(c.exhibited).toBe(false);
    w.activity.scene = 'street';
    w.npcs[0].scene = 'street';
    exhibitCreations(w);
    expect(c.exhibited).toBe(true);
  });
  it('abandoned dreams become reflection and can be resumed without losing progress', () => {
    const w = fresh();
    dreamsTick(w, 'create');
    const d = w.living.dreams[0],
      p = d.progress;
    changeDream(w, d.id, false);
    w.time += 15 * DAY;
    dreamsTick(w, 'rest');
    expect(d.status).toBe('regret');
    changeDream(w, d.id, true);
    expect(d.status).toBe('active');
    expect(d.progress).toBe(p);
    expect(d.attempts).toBe(2);
  });
  it('expands authored base events without duplicate descriptions', () => {
    expect(events.length).toBeGreaterThanOrEqual(200);
    expect(new Set(events.map((e) => e.category)).size).toBeGreaterThanOrEqual(20);
    expect(new Set(events.map((e) => e.description)).size).toBe(events.length);
  });
});

import { validateContent } from '../src/engine/ContentValidator';
import { eligibleEvent } from '../src/engine/EventEngine';
import { sceneNames } from '../src/engine/model';
import { syncRealCalendar } from '../src/engine/SeasonEngine';
import { lifeReply } from '../src/engine/LifeInteractionEngine';
describe('content validity and real-world privacy', () => {
  it('validates all catalogs and rejects malformed effects, references, cycles and conditions', () => {
    expect(validateContent()).toEqual([]);
    const broken = structuredClone(events);
    broken[0].followUpEvents = [broken[0].eventId, 'missing'];
    broken[1].weight = -1;
    broken[2].effects.mood = NaN;
    broken[3].scenes = ['missing' as any];
    expect(validateContent(broken).length).toBeGreaterThanOrEqual(5);
  });
  it('constructs a valid triggering world for every ordinary event', () => {
    for (const e of events) {
      const w = fresh();
      w.activity.kind = e.triggerConditions.activities[0];
      w.activity.scene = e.scenes?.[0] || 'apartment';
      w.character.job = e.triggerConditions.gate === 'student' ? '学生' : '插画师';
      w.npcs[0].scene = w.activity.scene;
      w.npcs[0].relation.familiarity = 30;
      w.npcs[0].relation.type = e.triggerConditions.gate === 'partner' ? '恋人' : '朋友';
      if (e.triggerConditions.gate === 'night') w.time = new Date('2026-10-18T23:00:00Z').getTime();
      if (e.triggerConditions.gate === 'weekend')
        w.time = new Date('2026-10-18T12:00:00Z').getTime();
      if (e.triggerConditions.gate === 'rain') w.time = Math.floor(w.time / (4 * DAY)) * 4 * DAY;
      if (e.requiresEvent)
        w.living.eventHistory[e.requiresEvent.id] = {
          time: w.time - e.requiresEvent.days * DAY,
          source: w.events[0].id,
        };
      if (e.season) w.living.calendar.season = e.season;
      if (e.requiredState === 'gift') giveGift(w, gifts[0].id);
      if (e.requiredState === 'habit')
        w.living.habits.push({
          id: habits[0].id,
          strength: 50,
          repetitions: 4,
          last: w.time,
          formed: true,
          lastDecayDay: '',
        });
      if (e.requiredState === 'npc-change') w.living.stats.npcChanges = 1;
      if (e.requiredState === 'news') publishNews(w, 'news-4');
      if (e.requiredState === 'creation') for (let i = 0; i < 9; i++) creationTick(w, 'create');
      expect(eligibleEvent(w, e), e.eventId).toBe(true);
    }
  });
  it('rejects unknown story/gift/NPC references and cyclic causal saves', () => {
    const w = fresh();
    giveGift(w, gifts[0].id);
    w.living.gifts[0].definition = 'missing';
    expect(() => validateWorld(w)).toThrow();
    const b = fresh();
    b.living.causes[0].parents = [b.living.causes[0].id];
    expect(() => validateWorld(b)).toThrow();
  });
  it('real season does not fast-forward through future seasons with game speed', () => {
    const w = fresh();
    setCalendarMode(w, 'real', now);
    advance(w, 30 * DAY);
    expect(w.living.calendar.season).toBe('秋');
    expect(w.living.calendar.date).toBe('2026-10-19');
    syncRealCalendar(w, new Date(2026, 11, 1, 10).getTime());
    expect(w.living.calendar.season).toBe('冬');
  });
  it('life questions return actual collections, friends and confirmed shared activities', () => {
    const w = fresh();
    expect(lifeReply(w, '最近有什么作品？')).toContain('还没有');
    expect(lifeReply(w, '回顾我们的共同经历')).toContain('还没有确认');
    expect(lifeReply(w, '介绍一下这座城市')).toContain(sceneNames.park);
    expect(lifeReply(w, '建议你多阅读')).toContain('阅读');
    expect(w.flags.suggestion).toBe('read');
  });
});

import { resolveDecision } from '../src/engine/SimulationEngine';
import { catchUp } from '../src/engine/SimulationClock';
describe('cross-system regressions', () => {
  it('30-minute absence advances real independent activities and preserves the expanded world on reload', () => {
    const w = fresh();
    startShared(w, '学习', 25, now);
    giveGift(w, 'gift-6-0');
    const t = w.time;
    const r = catchUp(w, now + 30 * MINUTE);
    expect(r.realElapsed).toBe(30 * MINUTE);
    expect(w.time - t).toBe(2 * HOUR);
    expect(w.playerActivities[0].independent?.reduce((sum, a) => sum + a.minutes, 0)).toBe(120);
    returnShared(w, now + 30 * MINUTE);
    scheduleInteraction(w, now + 30 * MINUTE);
    expect(w.living.interactions.length).toBeGreaterThan(0);
    const reload = validateWorld(JSON.parse(JSON.stringify(w)));
    expect(reload).toEqual(w);
    expect(catchUp(reload, now + 30 * MINUTE).gameElapsed).toBe(0);
  });
  it('does not infer the player birthday from someone else’s birthday', () => {
    const w = fresh();
    rememberPlayer(w, '我朋友的生日是10月23日', now);
    expect(linkedOpportunity(w, new Date(2026, 9, 23, 10).getTime())).toBeUndefined();
    rememberPlayer(w, '我的生日是10月23日', now);
    expect(linkedOpportunity(w, new Date(2026, 9, 23, 10).getTime())?.kind).toBe('生日');
  });
  it('honors existing NPC partnerships when an old romance decision is answered', () => {
    const w = fresh(),
      n = w.npcs[1];
    n.relation.willing = true;
    w.living.npcBonds.push({
      a: n.id,
      b: 'npc-2',
      warmth: 90,
      conflict: 0,
      status: '恋人',
      since: w.time,
    });
    w.decisions.push({
      id: 'test-romance',
      title: '关系',
      text: '考虑关系',
      kind: 'romance',
      npcId: n.id,
      created: w.time,
    });
    resolveDecision(w, 'test-romance', 'yes');
    expect(n.relation.type).not.toBe('恋人');
    expect(validateWorld(w)).toEqual(w);
  });
  it('suppresses all opportunities when disabled, and clock rollback cannot reset the daily budget', () => {
    const w = fresh();
    w.living.notifications.enabled = false;
    scheduleInteraction(w, now);
    expect(w.living.interactions).toHaveLength(0);
    w.living.notifications.enabled = true;
    scheduleInteraction(w, now + DAY);
    const count = w.living.notificationCount;
    scheduleInteraction(w, now);
    expect(w.living.notificationCount).toBe(count);
    expect(w.living.interactions).toHaveLength(1);
  });
  it('story continuation waits for a real visit, and paused stories resume or end explicitly', () => {
    const w = fresh();
    w.living.arcs.push({
      id: 'arc-0',
      stage: 1,
      status: 'active',
      started: w.time,
      due: w.time,
      deadline: w.time + 30 * DAY,
      origin: w.events[0].id,
      lastEvent: w.events[0].id,
      npcId: 'npc-0',
    });
    arcsTick(w);
    expect(w.living.arcs[0].stage).toBe(1);
    w.activity.scene = 'street';
    arcsTick(w);
    expect(w.living.arcs[0].stage).toBe(2);
    controlArc(w, 'arc-0', 'pause');
    w.time += 5 * DAY;
    arcsTick(w);
    expect(w.living.arcs[0].stage).toBe(2);
    controlArc(w, 'arc-0', 'resume');
    expect(w.living.arcs[0].status).toBe('active');
    controlArc(w, 'arc-0', 'end');
    expect(w.living.arcs[0].status).toBe('ended');
  });
  it('produces all four creation media through real completed practice', () => {
    for (const [interest, kind] of [
      ['绘画', '绘画'],
      ['写作', '写作'],
      ['摄影', '摄影'],
      ['音乐', '音乐'],
    ] as const) {
      const w = fresh();
      w.character.interest = interest;
      for (let i = 0; i < 8; i++) creationTick(w, interest === '摄影' ? 'walk' : 'create');
      expect(w.living.creations[0].kind).toBe(kind);
      expect(w.living.creations[0].completed).toBeDefined();
    }
  });
});

describe('long-term persistence boundaries', () => {
  it('runs six months, including multi-month arcs, within every persisted collection bound', () => {
    const w = fresh();
    w.settings.advice = 'autonomous';
    giveGift(w, 'gift-6-0');
    for (let i = 0; i < 6; i++) {
      advance(w, 30 * DAY);
      validateWorld(w);
    }
    expect(w.diaries).toHaveLength(180);
    expect(w.living.causes.length).toBeLessThanOrEqual(600);
    expect(w.living.news.length).toBeLessThanOrEqual(100);
    expect(w.living.creations.length).toBeLessThanOrEqual(60);
    expect(w.living.arcs.some((a) => a.status === 'complete' || a.status === 'missed')).toBe(true);
  }, 10000);
  it('does not create night-shift or rainy-day habits without their factual conditions', () => {
    const w = fresh();
    for (let i = 0; i < 20; i++) {
      practiceHabits(w, 'wash');
      w.time += DAY;
    }
    expect(w.living.habits.some((h) => h.id === 'habit-11')).toBe(false);
  });
  it('can greet an explicitly shared birthday on the same day, once per year date', () => {
    const w = fresh();
    rememberPlayer(w, '我的生日是10月19日', now);
    const opportunity = linkedOpportunity(w, now)!;
    expect(opportunity.kind).toBe('生日');
    w.living.topicAsked[opportunity.source] = now;
    expect(linkedOpportunity(w, now + HOUR)).toBeUndefined();
  });
});

it('continues creating after the gallery reaches capacity and keeps recent full works', () => {
  const w = fresh();
  for (let i = 0; i < 8; i++) creationTick(w, 'create');
  const first = w.living.creations[0];
  for (let i = 0; i < 500; i++) creationTick(w, 'create');
  expect(w.living.creations.length).toBe(60);
  expect(w.living.creations.some((c) => c.id === first.id)).toBe(false);
  expect(w.living.stats.definitions['creation-complete']).toBeGreaterThan(60);
  expect(w.memories.some((m) => m.source === first.eventId)).toBe(true);
  expect(validateWorld(w)).toEqual(w);
});

import { practiceInterests } from '../src/engine/GiftEngine';
it('develops interests through autonomous repeated activity even without receiving a gift', () => {
  const w = fresh();
  for (let i = 0; i < 101; i++) practiceInterests(w, 'walk');
  expect(w.living.interests['运动']).toBeGreaterThan(12);
  expect(w.living.gifts).toHaveLength(0);
  expect(w.events.some((e) => e.definition === 'interest-运动')).toBe(true);
});

it('schedules a consented birthday before ordinary topics, inside the total notification cap', () => {
  const w = fresh();
  rememberPlayer(w, '我在准备考试', now - 4 * DAY);
  rememberPlayer(w, '我的生日是10月19日', now);
  w.living.notifications.ordinaryLimit = 0;
  scheduleInteraction(w, now);
  expect(w.living.interactions[0].kind).toBe('生日');
  expect(w.living.ordinaryCount).toBe(0);
  expect(w.living.notificationCount).toBe(1);
});
