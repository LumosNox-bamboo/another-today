import { describe, it, expect } from 'vitest';
import { createWorld, defaultCharacter } from '../src/content/people';
import { advance, chooseActivity, isWorking } from '../src/engine/SimulationEngine';
import {
  addResident,
  selectResident,
  resident,
  commandResident,
  cancelCommands,
  setBond,
  initHousehold,
  lifeStage,
} from '../src/engine/HouseholdEngine';
import { validateWorld } from '../src/engine/validation';
import { DAY, HOUR, MINUTE } from '../src/engine/model';
import { catchUp } from '../src/engine/SimulationClock';
const fresh = () => createWorld(structuredClone(defaultCharacter), Date.UTC(2026, 9, 19, 8), 12345);
describe('one household in one persistent world', () => {
  it('loads old version 1 saves without changing their history or identity', () => {
    const w = fresh();
    const old = JSON.parse(JSON.stringify(w));
    delete old.household;
    const loaded = validateWorld(old);
    expect(loaded.character).toEqual(w.character);
    expect(loaded.events).toEqual(w.events);
    expect(loaded.household.members).toEqual([]);
    expect(loaded.version).toBe(1);
  });
  it('switches full personal histories and NPC relations without copying town or money', () => {
    const w = fresh();
    w.npcs[0].relation.trust = 80;
    const id = addResident(w, '小禾', 8, '室友');
    const originalEvents = structuredClone(w.events);
    const npcs = w.npcs,
      town = w.living.town;
    selectResident(w, id);
    expect(w.character.name).toBe('小禾');
    expect(w.events).toHaveLength(0);
    expect(w.npcs[0].relation.trust).toBe(15);
    w.money -= 10;
    w.needs.energy = 49;
    selectResident(w, 'resident-0');
    expect(w.character.name).toBe('小满');
    expect(w.events).toEqual(originalEvents);
    expect(w.npcs).toBe(npcs);
    expect(w.living.town).toBe(town);
    expect(w.npcs[0].relation.trust).toBe(80);
    expect(w.money).toBe(2990);
    const reloaded = validateWorld(JSON.parse(JSON.stringify(w)));
    selectResident(reloaded, id);
    expect(reloaded.needs.energy).toBe(49);
  });
  it('advances everyone while away, with one clock, diary per resident, and one rent charge', () => {
    const w = fresh();
    const id = addResident(w, '阿禾', 12, '室友');
    w.settings.speed = 1;
    const before = w.time;
    catchUp(w, w.lastReal + DAY);
    expect(w.time).toBe(before + DAY);
    expect(w.ledger.filter((e) => e.reason === '每日住房与公共开支')).toHaveLength(1);
    expect(w.diaries).toHaveLength(1);
    expect(resident(w, id)!.diaries).toHaveLength(1);
    expect(resident(w, id)!.events.length).toBeGreaterThan(5);
    expect(w.living.npcLives).toHaveLength(18);
    expect(() => validateWorld(w)).not.toThrow();
  });
  it('simulates the same household identically regardless of the selected person', () => {
    const a = fresh();
    const id = addResident(a, '阿禾', 12, '室友');
    const b = structuredClone(a);
    selectResident(b, id);
    advance(a, 2 * DAY);
    advance(b, 2 * DAY);
    selectResident(b, 'resident-0');
    expect(b).toEqual(a);
  });
  it('executes and cancels real commands without rewarding interrupted work', () => {
    const w = fresh();
    initHousehold(w);
    w.activity = {
      kind: 'work',
      scene: 'office',
      start: w.time - 180 * MINUTE,
      end: w.time + HOUR,
    };
    const skill = w.character.skill;
    commandResident(w, 'resident-0', 'read', 'apartment');
    advance(w, 5 * MINUTE);
    expect(w.activity.kind).toBe('read');
    expect(w.character.skill).toBe(skill);
    expect(w.ledger.some((e) => e.reason === '当日职业收入')).toBe(false);
    commandResident(w, 'resident-0', 'garden', 'apartment');
    advance(w, 30 * MINUTE);
    expect(w.activity.kind).toBe('garden');
    expect(w.character.skill).toBeGreaterThan(skill);
    cancelCommands(w, 'resident-0');
    advance(w, 5 * MINUTE);
    expect(w.household.members[0].commanded).toBe(false);
    expect(w.household.members[0].queue).toEqual([]);
  });
  it('defers instructions when a resident urgently needs food, without discarding them', () => {
    const w = fresh();
    commandResident(w, 'resident-0', 'create', 'apartment');
    w.needs.hunger = 99;
    advance(w, 5 * MINUTE);
    expect(w.activity.kind).toBe('eat');
    expect(w.household.members[0].queue).toHaveLength(1);
    advance(w, 30 * MINUTE);
    expect(w.activity.kind).toBe('create');
  });
  it('forms shared memories only after actual overlapping family time', () => {
    const w = fresh();
    const id = addResident(w, '小禾', 6, '亲子');
    commandResident(w, 'resident-0', 'eat', 'apartment');
    commandResident(w, id, 'eat', 'apartment');
    advance(w, 5 * MINUTE);
    expect(w.household.bonds[0].warmth).toBe(55);
    advance(w, 15 * MINUTE);
    expect(w.household.bonds[0].warmth).toBe(57);
    for (const person of [w, resident(w, id)!]) {
      expect(person.memories.some((m) => m.content.includes('小满和小禾'))).toBe(true);
    }
    expect(() => validateWorld(w)).not.toThrow();
  });
  it('has age-specific school, sleep and retirement routines with no minor employment', () => {
    const child = fresh();
    child.character.age = 9;
    child.time = Date.UTC(2026, 9, 19, 10);
    child.needs.hunger = 20;
    chooseActivity(child);
    expect(child.activity.kind).toBe('study');
    expect(isWorking(child)).toBe(false);
    expect(() => commandResident(child, 'resident-0', 'work', 'office')).toThrow();
    child.time = Date.UTC(2026, 9, 19, 21);
    chooseActivity(child);
    expect(child.activity.kind).toBe('sleep');
    const elder = fresh();
    elder.character.age = 70;
    expect(isWorking(elder)).toBe(false);
    expect(lifeStage(16)).toBe('青少年');
    expect(lifeStage(70)).toBe('老年');
  });
  it('rejects inconsistent household imports and invalid relationships', () => {
    const w = fresh();
    const id = addResident(w, '小禾', 10, '室友');
    expect(() => setBond(w, 'resident-0', id, '伴侣')).toThrow();
    expect(() => setBond(w, id, 'resident-0', '亲子')).toThrow();
    const bad = structuredClone(w);
    bad.household.active = 'missing';
    expect(() => validateWorld(bad)).toThrow();
    w.household.members[1].state!.activity.end = 0;
    expect(() => validateWorld(w)).toThrow();
  });
  it('keeps six residents valid through 30 days and respects the household cap', () => {
    const w = fresh();
    for (const [name, age] of [
      ['小禾', 8],
      ['青', 16],
      ['安', 35],
      ['林', 67],
      ['晚', 80],
    ] as const)
      addResident(w, name, age, '室友');
    expect(() => addResident(w, '满员', 20, '室友')).toThrow();
    advance(w, 30 * DAY);
    expect(() => validateWorld(w)).not.toThrow();
    for (const m of w.household.members) {
      const p = resident(w, m.id)!;
      expect(p.diaries.length).toBe(30);
      expect(p.events.length).toBeGreaterThan(20);
      if (p.character.age < 18)
        expect(p.decisions.some((d) => d.kind === 'romance' || d.kind === 'career')).toBe(false);
    }
  });
});

describe('household boundary cases', () => {
  it('tracks shared focus against its original resident after selection changes', async () => {
    const { startShared, returnShared, confirmShared } =
      await import('../src/engine/SharedActivityEngine');
    const w = fresh();
    const child = addResident(w, '小禾', 6, '亲子');
    commandResident(w, 'resident-0', 'read', 'apartment', 60);
    commandResident(w, child, 'play', 'apartment', 60);
    advance(w, 5 * MINUTE);
    startShared(w, '阅读', 30, w.lastReal);
    selectResident(w, child);
    advance(w, 30 * MINUTE);
    const activity = w.playerActivities[0];
    expect(activity.independent).toEqual([{ kind: 'read', minutes: 30 }]);
    returnShared(w, w.lastReal + 30 * MINUTE);
    confirmShared(w, activity.id, 30, '读了书');
    expect(w.companion.sharedMinutes).toBe(0);
    expect(resident(w, 'resident-0')!.companion.sharedMinutes).toBe(30);
  });
  it('celebrates a birthday once and retires a resident at 65', () => {
    const w = fresh();
    w.character.age = 64;
    initHousehold(w);
    w.household.members[0].birthday = w.time - 365 * DAY + 5 * MINUTE;
    advance(w, 10 * MINUTE);
    expect(w.character.age).toBe(65);
    expect(isWorking(w)).toBe(false);
    expect(w.events.filter((e) => e.definition === 'family-birthday')).toHaveLength(1);
    expect(() => validateWorld(w)).not.toThrow();
  });
  it('keeps gifts and interests attached to their recipient', async () => {
    const { giveGift } = await import('../src/engine/GiftEngine');
    const w = fresh();
    const id = addResident(w, '小禾', 6, '亲子');
    giveGift(w, 'gift-6-0');
    const gifts = structuredClone(w.living.gifts);
    selectResident(w, id);
    expect(w.living.gifts).toHaveLength(0);
    advance(w, DAY);
    selectResident(w, 'resident-0');
    expect(w.living.gifts[0].id).toBe(gifts[0].id);
    expect(() => validateWorld(w)).not.toThrow();
  });
  it('rejects a sixth queued instruction and preserves the first five', () => {
    const w = fresh();
    for (let i = 0; i < 5; i++) commandResident(w, 'resident-0', 'read', 'apartment');
    expect(() => commandResident(w, 'resident-0', 'play', 'apartment')).toThrow();
    expect(w.household.members[0].queue).toHaveLength(5);
  });
});
