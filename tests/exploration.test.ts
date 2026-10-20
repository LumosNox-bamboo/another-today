import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/content/people';
import { destinations, discoveries } from '../src/content/places';
import { outskirtsEvents } from '../src/content/outskirtsEvents';
import { outskirtsStories } from '../src/content/outskirtsStories';
import { outskirtsGifts } from '../src/content/outskirtsGifts';
import { events } from '../src/content/events';
import { storyArcs } from '../src/content/storyArcs';
import { gifts, newsTemplates } from '../src/content/living';
import { DAY, MINUTE, HOUR, type World, type Scene, type Activity } from '../src/engine/model';
import { validateWorld } from '../src/engine/validation';
import { validateContent } from '../src/engine/ContentValidator';
import {
  destinationOpen,
  chooseDestination,
  completeVisit,
  suggestDestination,
  displayDiscovery,
} from '../src/engine/ExplorationEngine';
import { chooseActivity, advance } from '../src/engine/SimulationEngine';
import { eligibleEvent, sampleEvent } from '../src/engine/EventEngine';
import { npcTick } from '../src/engine/NPCSimulationEngine';
import { giveGift } from '../src/engine/GiftEngine';
import { traceCauses } from '../src/engine/EventCausalityGraph';
import { maybeStartArc } from '../src/engine/StoryArcEngine';

const fresh = (seed = 2356) => createWorld(undefined, new Date(2026, 9, 19, 8).getTime(), seed);
function at(w: World, date: string) {
  w.time = w.simulatedUntil = Date.parse(date);
}
function visit(w: World, scene: Scene, activity: Activity) {
  w.activity = { kind: activity, scene, start: w.time - 30 * MINUTE, end: w.time };
  completeVisit(w);
}
describe('outskirts: actual places, time and exploration', () => {
  it('adds unique authored content without changing legacy IDs', () => {
    expect(events.filter((e) => !e.eventId.startsWith('daily-'))).toHaveLength(340);
    expect(outskirtsEvents).toHaveLength(120);
    expect(gifts).toHaveLength(60);
    expect(storyArcs).toHaveLength(25);
    expect(newsTemplates).toHaveLength(68);
    expect(destinations).toHaveLength(6);
    expect(discoveries).toHaveLength(24);
    expect(validateContent()).toEqual([]);
    expect(events[0].eventId).toBe('event-1');
    expect(gifts[0].id).toBe('gift-0-0');
    expect(storyArcs[14].id).toBe('arc-14');
  });
  it('migrates both original and 0.2 saves with their original progress intact', () => {
    const w: any = fresh();
    giveGift(w, 'gift-6-0');
    delete w.living.exploration;
    delete w.living.eventHistory;
    const v = validateWorld(w);
    expect(v.living.exploration).toEqual({ visits: {}, discoveries: [] });
    expect(v.living.eventHistory).toEqual({});
    expect(v.living.gifts).toEqual(w.living.gifts);
    expect(v.character).toEqual(w.character);
    expect(validateWorld(v)).toEqual(v);
  });
  it('obeys market weekends, boundary hours and real maintenance', () => {
    const w = fresh(),
      market = destinations.find((d) => d.scene === 'market')!;
    at(w, '2026-10-19T12:00:00Z');
    expect(destinationOpen(w, market)).toBe(false);
    at(w, '2026-10-24T08:00:00Z');
    expect(destinationOpen(w, market)).toBe(true);
    at(w, '2026-10-24T18:00:00Z');
    expect(destinationOpen(w, market)).toBe(false);
    at(w, '2026-10-24T12:00:00Z');
    w.living.town.facilities.market = 'repair';
    expect(destinationOpen(w, market)).toBe(false);
    for (let i = 0; i < 100; i++) expect(chooseDestination(w, 'shop', 'shop')).toBe('shop');
  });
  it('suggestions neither teleport nor interrupt sleep, hunger or work', () => {
    const w = fresh(),
      original = structuredClone(w.activity);
    suggestDestination(w, 'market');
    expect(w.activity).toEqual(original);
    expect(w.living.exploration.visits).toEqual({});
    at(w, '2026-10-19T23:00:00Z');
    chooseActivity(w);
    expect(w.activity.kind).toBe('sleep');
    expect(w.activity.scene).toBe('apartment');
    at(w, '2026-10-19T12:00:00Z');
    w.needs.hunger = 99;
    chooseActivity(w);
    expect(w.activity.kind).toBe('eat');
    expect(w.activity.scene).toBe('apartment');
    for (let i = 0; i < 50; i++) expect(chooseDestination(w, 'work', 'office')).toBe('office');
  });
  it('a suggestion increases relevant visits while retaining independent choice', () => {
    let baseline = 0,
      suggested = 0;
    for (let seed = 1000; seed < 1400; seed++) {
      const a = fresh(seed),
        b = fresh(seed);
      at(a, '2026-10-24T12:00:00Z');
      at(b, '2026-10-24T12:00:00Z');
      suggestDestination(b, 'market');
      if (chooseDestination(a, 'walk', 'park') === 'market') baseline++;
      if (chooseDestination(b, 'walk', 'park') === 'market') suggested++;
    }
    expect(suggested).toBeGreaterThan(baseline);
    expect(suggested).toBeLessThan(400);
  });
  it('does not award visits for previews, unfinished or very short activities', () => {
    const w = fresh();
    w.activity = { kind: 'walk', scene: 'riverside', start: w.time, end: w.time + 30 * MINUTE };
    completeVisit(w);
    expect(w.living.exploration.visits).toEqual({});
    w.activity = { kind: 'walk', scene: 'riverside', start: w.time - 5 * MINUTE, end: w.time };
    completeVisit(w);
    expect(w.living.exploration.discoveries).toHaveLength(0);
    visit(w, 'riverside', 'walk');
    expect(w.living.exploration.visits.riverside.days).toBe(1);
    expect(w.living.exploration.discoveries).toHaveLength(1);
    completeVisit(w);
    expect(w.living.exploration.visits.riverside.days).toBe(1);
    expect(w.living.exploration.discoveries).toHaveLength(1);
  });
  it.each(destinations.map((d) => [d.scene]))(
    'all four discoveries at %s are reachable on separate actual days',
    (scene) => {
      const w = fresh();
      const targets = discoveries.filter((d) => d.scene === scene);
      for (let day = 0; day < 16; day++) {
        for (const d of targets) visit(w, scene as Scene, d.activities[0]);
        w.time += DAY;
        w.simulatedUntil = w.time;
      }
      expect(w.living.exploration.discoveries.map((d) => d.id).sort()).toEqual(
        targets.map((d) => d.id).sort(),
      );
      expect(new Set(w.living.exploration.discoveries.map((d) => d.time)).size).toBe(4);
      displayDiscovery(w, targets[3].id);
      expect(validateWorld(JSON.parse(JSON.stringify(w))).living.exploration).toEqual(
        w.living.exploration,
      );
    },
  );
  it('remembers gift → first actual visit → discovery, and only displays owned keepsakes', () => {
    const w = fresh();
    w.character.traits.curiosity = 90;
    const gift = giveGift(w, 'gift-out-sky-guide');
    visit(w, 'observatory', 'study');
    const discovered = w.living.exploration.discoveries[0];
    expect(traceCauses(w, discovered.source).map((n) => n.id)).toContain(gift.source);
    displayDiscovery(w, 'not-owned');
    expect(w.living.exploration.display).toBeUndefined();
    displayDiscovery(w, discovered.id);
    expect(w.living.exploration.display).toBe(discovered.id);
    displayDiscovery(w);
    expect(w.living.exploration.display).toBeUndefined();
  });
  it('NPCs use new places in free time but stay out of closed destinations', () => {
    const w = fresh();
    const visited = new Set<string>();
    for (let day = 19; day < 26; day++)
      for (let h = 0; h < 24; h++) {
        at(w, `2026-10-${day}T${String(h).padStart(2, '0')}:00:00Z`);
        npcTick(w);
        for (const n of w.npcs) {
          const d = destinations.find((d) => d.scene === n.scene);
          if (d) {
            expect(destinationOpen(w, d), `${n.name} at ${d.scene}`).toBe(true);
            visited.add(d.scene);
          }
        }
      }
    expect(visited.size).toBe(6);
  });
  it('runs unattended and resumes the same world with real new content', () => {
    const w = fresh();
    advance(w, 14 * DAY);
    expect(Object.keys(w.living.exploration.visits).length).toBeGreaterThanOrEqual(4);
    expect(w.living.exploration.discoveries.length).toBeGreaterThanOrEqual(4);
    const saved = validateWorld(JSON.parse(JSON.stringify(w))),
      resumed = structuredClone(w);
    advance(saved, 3 * DAY);
    advance(resumed, 3 * DAY);
    expect(saved).toEqual(resumed);
    expect(validateWorld(saved)).toEqual(saved);
  });
  it('rejects impossible collection references and chronology', () => {
    const w = fresh();
    visit(w, 'riverside', 'walk');
    w.living.exploration.display = 'not-owned';
    expect(() => validateWorld(w)).toThrow();
    delete w.living.exploration.display;
    w.living.exploration.visits.riverside.last = w.time + DAY;
    expect(() => validateWorld(w)).toThrow();
  });
});
describe('later chapters need real causes', () => {
  it.each(outskirtsEvents.filter((e) => e.requiresEvent).map((e) => [e.eventId]))(
    '%s waits for its actual first chapter and persists the cause',
    (id) => {
      const w = fresh();
      const later = events.find((e) => e.eventId === id)!,
        earlier = events.find((e) => e.eventId === later.requiresEvent!.id)!;
      at(w, '2026-10-24T12:00:00Z');
      w.activity = {
        kind: later.triggerConditions.activities[0],
        scene: later.scenes![0],
        start: w.time - 30 * MINUTE,
        end: w.time,
      };
      expect(eligibleEvent(w, later)).toBeFalsy();
      for (const e of events) w.cooldowns[e.eventId] = Number.MAX_SAFE_INTEGER;
      delete w.cooldowns[earlier.eventId];
      w.activity.kind = earlier.triggerConditions.activities[0];
      for (let i = 0; i < 80 && !w.living.eventHistory[earlier.eventId]; i++) sampleEvent(w);
      const first = w.living.eventHistory[earlier.eventId];
      expect(first).toBeDefined();
      w.activity.kind = later.triggerConditions.activities[0];
      delete w.cooldowns[later.eventId];
      expect(eligibleEvent(w, later)).toBeFalsy();
      // Seven days later is also a weekend for the market chapters.
      w.time += 7 * DAY;
      w.simulatedUntil = w.time;
      const restored = validateWorld(JSON.parse(JSON.stringify(w)));
      expect(eligibleEvent(restored, later)).toBeTruthy();
      for (let i = 0; i < 80 && !restored.living.eventHistory[later.eventId]; i++)
        sampleEvent(restored);
      const next = restored.living.eventHistory[later.eventId];
      expect(traceCauses(restored, next.source).map((n) => n.id)).toContain(first.source);
      expect(eligibleEvent(restored, later)).toBeFalsy();
    },
  );
  it('new story openings require repeat visits and never create every arc at once', () => {
    const w = fresh();
    const d = outskirtsStories[0];
    at(w, '2026-10-24T12:00:00Z');
    w.activity = { kind: d.activity, scene: d.scene, start: w.time - HOUR, end: w.time };
    w.npcs[0].scene = d.scene;
    for (let i = 0; i < 100; i++) maybeStartArc(w);
    expect(w.living.arcs).toHaveLength(0);
    w.living.exploration.visits[d.scene] = {
      days: 2,
      first: w.time - DAY,
      last: w.time,
      source: w.events[0].id,
    };
    for (let i = 0; i < 100; i++) maybeStartArc(w);
    expect(w.living.arcs.map((a) => a.id)).toContain(d.id);
    expect(w.living.arcs.length).toBeLessThanOrEqual(2);
  });
  it('all new gifts have an actual activity, destination and unique follow-up', () => {
    expect(new Set(outskirtsGifts.map((g) => g.followUp)).size).toBe(30);
    for (const d of outskirtsGifts) {
      const w = fresh();
      giveGift(w, d.id);
      expect(destinations.some((p) => p.scene === d.scene) || d.scene === 'library').toBe(true);
      expect(validateWorld(w).living.gifts[0].definition).toBe(d.id);
    }
  });
});

import { advanceChains } from '../src/engine/EventChainEngine';
it('ordinary old stories no longer occupy every story slot forever while the player is away', () => {
  const w = fresh();
  w.settings.advice = 'important';
  w.chains.push({
    id: 'umbrella',
    stage: 3,
    due: w.time,
    origin: w.events[0].id,
    status: 'active',
  });
  advanceChains(w);
  const decision = w.decisions.find((d) => d.chainId === 'umbrella')!;
  expect(decision).toBeDefined();
  w.decisions.push({
    id: 'career-wait',
    kind: 'career',
    title: '职业选择',
    text: '等待玩家',
    created: w.time,
  });
  w.time += 3 * DAY;
  w.simulatedUntil = w.time;
  advanceChains(w);
  expect(w.chains[0].status).not.toBe('active');
  expect(w.decisions.some((d) => d.chainId === 'umbrella')).toBe(false);
  expect(w.decisions.some((d) => d.id === 'career-wait')).toBe(true);
});

import { lifeReply } from '../src/engine/LifeInteractionEngine';
it('talks about visited places and owned discoveries without inventing a journey', () => {
  const w = fresh();
  expect(lifeReply(w, '最近去了哪里？')).toContain('还没有亲自去过');
  suggestDestination(w, 'greenhouse');
  expect(lifeReply(w, '讲讲散步见闻')).not.toContain('玻璃温室');
  visit(w, 'riverside', 'walk');
  expect(lifeReply(w, '最近去了哪里？')).toContain('芦苇河岸');
  expect(lifeReply(w, '讲讲散步见闻')).not.toContain('玻璃温室');
  expect(lifeReply(w, '给我看看收藏')).toContain('手绘渡口路线');
});
