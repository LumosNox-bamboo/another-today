import { editAppearance, editPersonality, resident } from '../src/engine/HouseholdEngine';
import { useFocusReward } from '../src/engine/FocusRewardEngine';
import { it, expect } from 'vitest';
import { createWorld } from '../src/content/people';
import { addResident, selectResident, commandResident } from '../src/engine/HouseholdEngine';
import { addTask, completeTask, useTaskItem } from '../src/engine/TaskEngine';
import { startShared, returnShared, confirmShared } from '../src/engine/SharedActivityEngine';
import { creditPoints, redeem, useActionTicket, maybeNPCGift } from '../src/engine/ExchangeEngine';
import { scheduleNote } from '../src/engine/NoteEngine';
import { validateWorld } from '../src/engine/validation';
import { HOUR, MINUTE } from '../src/engine/model';

it('awards points once per confirmed task/focus and preserves them across resident switches and saves', () => {
  const w = createWorld();
  const t = addTask(w, '收拾房间', Date.now());
  completeTask(w, t.id, Date.now());
  completeTask(w, t.id, Date.now());
  expect(w.exchange!.balance).toBe(10);
  startShared(w, '学习', 25, Date.now() - 25 * MINUTE);
  returnShared(w, Date.now());
  confirmShared(w, w.playerActivities[0].id, 25, '完成', true);
  confirmShared(w, w.playerActivities[0].id, 25, '完成', true);
  expect(w.exchange!.balance).toBe(20);
  const id = addResident(w, '青禾', 25, '室友', 100);
  selectResident(w, id);
  expect(validateWorld(w).exchange!.balance).toBe(20);
  expect(w.money).toBe(100);
});
it('redeems permanent goods and real action tickets atomically with insufficient funds and full queues', () => {
  const w = createWorld();
  expect(() => redeem(w, 'star-print')).toThrow();
  expect(w.exchange).toBeUndefined();
  creditPoints(w, 100, '测试来源');
  redeem(w, 'star-print');
  expect(w.exchange!.balance).toBe(60);
  expect(w.taskRewards!.owned).toContain('star-print');
  expect(() => redeem(w, 'star-print')).toThrow();
  expect(w.exchange!.balance).toBe(60);
  redeem(w, 'walk-ticket');
  for (let i = 0; i < 5; i++) commandResident(w, 'resident-0', 'read', 'apartment', 30);
  expect(() => useActionTicket(w, 'walk-ticket')).toThrow();
  expect(w.exchange!.tickets[0].count).toBe(1);
  w.household.members[0].queue = [];
  useActionTicket(w, 'walk-ticket');
  expect(w.exchange!.tickets[0].count).toBe(0);
  expect(w.household.members[0].queue[0]).toEqual({ kind: 'walk', scene: 'park', minutes: 60 });
  expect(() => validateWorld(w)).not.toThrow();
});
it('receives gifts only from known colocated NPCs and awards at most once per world day', () => {
  const w = createWorld(),
    n = w.npcs[0];
  n.scene = w.activity.scene;
  for (let i = 0; i < 100; i++) maybeNPCGift(w, n);
  expect(w.npcGifts).toBeUndefined();
  n.relation.familiarity = 60;
  n.relation.trust = 60;
  for (let i = 0; i < 200; i++) maybeNPCGift(w, n);
  expect(w.npcGifts).toHaveLength(1);
  expect(w.exchange!.balance).toBe(5);
  expect(w.memories.some((m) => m.content.includes(n.name))).toBe(true);
  expect(validateWorld(w).npcGifts).toEqual(w.npcGifts);
});
it('keeps signed factual notes separate, bounded, and suppressed during focus and DND', () => {
  const w = createWorld();
  const now = new Date(2026, 9, 20, 10).getTime();
  const id = addResident(w, '青禾', 25, '室友');
  selectResident(w, id);
  w.living.notifications.enabled = true;
  w.living.notifications.dailyLimit = 5;
  scheduleNote(w, now);
  expect(w.notes).toHaveLength(1);
  expect(w.notes![0].author).toBe('青禾');
  expect(w.notes![0].residentId).toBe(id);
  for (let i = 0; i < 10; i++) scheduleNote(w, now);
  expect(w.notes).toHaveLength(1);
  w.living.notifications.dnd = true;
  scheduleNote(w, now + 4 * HOUR);
  expect(w.notes).toHaveLength(1);
  w.living.notifications.dnd = false;
  startShared(w, '阅读', 25, now);
  scheduleNote(w, now + 4 * HOUR);
  expect(w.notes).toHaveLength(1);
  returnShared(w, now + 4 * HOUR);
  scheduleNote(w, now + 4 * HOUR);
  expect(w.notes).toHaveLength(2);
  scheduleNote(w, now + 8 * HOUR);
  expect(w.notes).toHaveLength(2);
  selectResident(w, 'resident-0');
  expect(validateWorld(w).notes![0].residentId).toBe(id);
});

it('keeps appearance and personality edits private through selection and save restoration', () => {
  const w = createWorld();
  const original = structuredClone(w.character);
  const id = addResident(w, '青禾', 25, '室友');
  selectResident(w, id);
  editAppearance(w, { hair: '#123456', skin: '#abcdef', outfit: '#987654' });
  editPersonality(w, { ...w.character.traits, extraversion: 100 });
  const loaded = validateWorld(JSON.parse(JSON.stringify(w)));
  selectResident(loaded, 'resident-0');
  expect(loaded.character).toEqual(original);
  expect(resident(loaded, id)!.character.hair).toBe('#123456');
  expect(resident(loaded, id)!.character.traits.extraversion).toBe(100);
  expect(() =>
    editAppearance(loaded, { hair: 'invalid', skin: '#abcdef', outfit: '#987654' }),
  ).toThrow();
  expect(loaded.character).toEqual(original);
});
it('expanded rewards deliver gifts, clothes, furniture, consumables and queued activities without double spending', () => {
  const w = createWorld();
  creditPoints(w, 500, '测试');
  redeem(w, 'gift-1-0');
  expect(w.living.gifts.some((g) => g.definition === 'gift-1-0')).toBe(true);
  expect(w.memories.some((m) => m.content.includes('薄荷盆栽'))).toBe(true);
  const balance = w.exchange!.balance;
  expect(() => redeem(w, 'gift-1-0')).toThrow();
  expect(w.exchange!.balance).toBe(balance);
  redeem(w, 'lavender-shirt');
  useFocusReward(w, 'lavender-shirt');
  expect(w.character.outfit).toBe('#a395bf');
  redeem(w, 'fern-shelf');
  useFocusReward(w, 'fern-shelf');
  expect(w.focusRewards!.placed).toContain('fern-shelf');
  redeem(w, 'record-corner');
  useFocusReward(w, 'record-corner');
  for (const id of ['herbal-tea', 'fruit-basket', 'warm-pack']) {
    w.needs.stress = 80;
    w.needs.energy = 20;
    w.needs.hunger = 80;
    w.needs.health = 50;
    redeem(w, id);
    useTaskItem(w, id);
    expect(w.taskRewards!.bag.find((i) => i.id === id)!.count).toBe(0);
    expect(() => useTaskItem(w, id)).toThrow();
    if (id === 'herbal-tea') expect(w.needs.stress).toBe(65);
    if (id === 'fruit-basket') expect(w.needs.hunger).toBe(60);
    if (id === 'warm-pack') expect(w.needs.energy).toBe(40);
  }
  for (const id of ['read-ticket', 'garden-ticket', 'study-ticket', 'rest-ticket']) {
    redeem(w, id);
    useActionTicket(w, id);
  }
  expect(w.household.members[0].queue.map((q) => q.kind)).toEqual([
    'read',
    'garden',
    'study',
    'rest',
  ]);
  expect(validateWorld(JSON.parse(JSON.stringify(w))).focusRewards!.placed).toContain(
    'record-corner',
  );
});
