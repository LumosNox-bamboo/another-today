import { describe, it, expect } from 'vitest';
import { createWorld, defaultCharacter } from '../src/content/people';
import {
  addResident,
  initHousehold,
  selectResident,
  setBond,
  editPersonality,
} from '../src/engine/HouseholdEngine';
import { chargeRent, walletMembers } from '../src/engine/WalletEngine';
import { startShared, returnShared, confirmShared } from '../src/engine/SharedActivityEngine';
import { focusRemaining, clockText, useFocusReward } from '../src/engine/FocusRewardEngine';
import { advance } from '../src/engine/SimulationEngine';
import { validateWorld } from '../src/engine/validation';
import { MINUTE, DAY, transact } from '../src/engine/model';
const fresh = () => createWorld(structuredClone(defaultCharacter), Date.UTC(2026, 9, 19, 8));
const total = (w: ReturnType<typeof fresh>) =>
  w.household.wallets!.reduce((n, a) => n + a.balance, 0);
describe('separate savings and core families', () => {
  it('keeps roommates and unmarried partners independent, including purchases and earnings', () => {
    const w = fresh(),
      id = addResident(w, '阿青', 24, '伴侣', 500);
    transact(w, 200, '收入');
    selectResident(w, id);
    expect(w.money).toBe(500);
    transact(w, -20, '买书');
    selectResident(w, 'resident-0');
    expect(w.money).toBe(3200);
    expect(total(w)).toBe(3680);
    expect(() => validateWorld(w)).not.toThrow();
  });
  it('shares spouses and their minor child, but not adult children or grandparents', () => {
    const w = fresh();
    w.character.age = 50;
    const spouse = addResident(w, '伴侣', 48, '夫妻', 1000);
    const minor = addResident(w, '孩子', 10, '亲子', 0);
    const adult = addResident(w, '大孩子', 25, '亲子', 800);
    expect(walletMembers(w)).toEqual(['resident-0', spouse, minor]);
    expect(w.money).toBe(4000);
    selectResident(w, minor);
    transact(w, -8, '午饭');
    selectResident(w, spouse);
    expect(w.money).toBe(3992);
    selectResident(w, adult);
    expect(w.money).toBe(800);
  });
  it('does not merge unmarried parents through a shared child', () => {
    const w = fresh();
    w.character.age = 40;
    const other = addResident(w, '另一位家长', 40, '室友', 500);
    const child = addResident(w, '孩子', 12, '亲子');
    setBond(w, other, child, '亲子');
    expect(w.household.wallets).toHaveLength(2);
    selectResident(w, other);
    expect(walletMembers(w)).toEqual([other]);
  });
  it('migrates old shared money once, preserving cents and the selected person', () => {
    const w = fresh();
    addResident(w, '甲', 20, '室友');
    const b = addResident(w, '乙', 21, '室友');
    selectResident(w, b);
    delete w.household.wallets;
    w.money = 100.01;
    initHousehold(w);
    expect(total(w)).toBeCloseTo(100.01);
    const copy = structuredClone(w.household.wallets);
    initHousehold(w);
    expect(w.household.wallets).toEqual(copy);
    expect(w.household.active).toBe(b);
    expect(w.household.financeMigration).toBeTruthy();
    expect(validateWorld(JSON.parse(JSON.stringify(w))).household.wallets).toEqual(copy);
  });
  it('splits and rejoins couples without creating or losing savings', () => {
    const w = fresh(),
      id = addResident(w, '阿青', 25, '夫妻', 1000.01);
    const before = total(w);
    setBond(w, 'resident-0', id, '室友');
    expect(w.household.wallets).toHaveLength(2);
    expect(total(w)).toBeCloseTo(before);
    setBond(w, 'resident-0', id, '夫妻');
    expect(w.money).toBeCloseTo(before);
    expect(() => addResident(w, '第三人', 30, '夫妻')).toThrow();
    expect(w.household.members).toHaveLength(2);
  });
  it('separates a child on their eighteenth birthday without losing money', () => {
    const w = fresh();
    w.character.age = 40;
    const id = addResident(w, '孩子', 17, '亲子');
    w.household.members.find((m) => m.id === id)!.birthday = w.time - 365 * DAY + 5 * MINUTE;
    advance(w, 5 * MINUTE);
    expect(w.household.wallets).toHaveLength(2);
    expect(total(w)).toBe(3000);
    expect(() => validateWorld(w)).not.toThrow();
  });
  it('charges one apartment bill across independent wallets once', () => {
    const w = fresh();
    addResident(w, '室友', 24, '室友', 1000);
    chargeRent(w, selectResident);
    chargeRent(w, selectResident);
    expect(w.ledger.filter((l) => l.reason === '每日住房与公共开支').map((l) => l.amount)).toEqual([
      -15, -15,
    ]);
    expect(total(w)).toBe(3970);
  });
  it('persists edited traits without altering history or other residents', () => {
    const w = fresh(),
      id = addResident(w, '室友', 24, '室友');
    const events = structuredClone(w.events),
      skill = w.character.skill;
    editPersonality(w, { ...w.character.traits, extraversion: 99, discipline: 5 });
    expect(w.events).toEqual(events);
    expect(w.character.skill).toBe(skill);
    expect(w.evolution).toHaveLength(2);
    selectResident(w, id);
    expect(w.character.traits.extraversion).toBe(defaultCharacter.traits.extraversion);
    const loaded = validateWorld(w);
    selectResident(loaded, 'resident-0');
    expect(loaded.character.traits.extraversion).toBe(99);
  });
});
describe('wall-clock focus and earned items', () => {
  it('counts down independently of paused or accelerated world time and survives reload', () => {
    const w = fresh();
    startShared(w, '收拾房间', 25, w.lastReal);
    const a = w.playerActivities[0];
    advance(w, DAY);
    expect(clockText(focusRemaining(a, a.start + MINUTE))).toBe('24:00');
    expect(focusRemaining(a, a.start - MINUTE)).toBe(1500);
    const loaded = validateWorld(w);
    expect(focusRemaining(loaded.playerActivities[0], a.start + 30 * MINUTE)).toBe(0);
    expect(w.focusRewards).toBeUndefined();
  });
  it('requires explicit completion and a real minute; confirmation and reload cannot double reward', () => {
    const w = fresh();
    startShared(w, '学习', 25, w.lastReal);
    returnShared(w, w.lastReal + 25 * MINUTE);
    const id = w.playerActivities[0].id;
    confirmShared(w, id, 25, '读完一章', true);
    expect(w.focusRewards?.completed).toBe(1);
    const loaded = validateWorld(JSON.parse(JSON.stringify(w)));
    confirmShared(loaded, id, 25, '重复', true);
    expect(loaded.focusRewards?.completed).toBe(1);
    useFocusReward(loaded, 'sage-shirt');
    expect(loaded.character.outfit).toBe('#7f9d85');
    expect(() => useFocusReward(loaded, 'sunny-rug')).toThrow();
  });
  it('gives no reward for elapsed time alone, incomplete work or immediate clicks', () => {
    for (const [elapsed, done] of [
      [0, true],
      [25, false],
    ] as const) {
      const w = fresh();
      startShared(w, '自定义任务', 25, w.lastReal);
      returnShared(w, w.lastReal + elapsed * MINUTE);
      confirmShared(w, w.playerActivities[0].id, 25, '', done);
      expect(w.focusRewards).toBeUndefined();
      expect(w.companion.trust).toBe(20);
    }
  });
  it('keeps unlocked furniture usable after old activity history is pruned', () => {
    const w = fresh();
    for (let i = 0; i < 101; i++) {
      const now = w.lastReal + i * 2 * MINUTE;
      startShared(w, '练字', 1, now);
      returnShared(w, now + MINUTE);
      confirmShared(w, w.playerActivities.at(-1)!.id, 1, '完成', true);
    }
    expect(w.playerActivities).toHaveLength(100);
    expect(w.focusRewards!.completed).toBe(101);
    useFocusReward(w, 'sunny-rug');
    expect(validateWorld(w).focusRewards!.placed).toEqual(['sunny-rug']);
    useFocusReward(w, 'sunny-rug');
    expect(w.focusRewards!.placed).toEqual([]);
  });
});

describe('resident profiles, memories and wallet ownership', () => {
  it('records the newcomer arrival in their own memory without sharing private memories', () => {
    const w = fresh();
    const id = addResident(w, '青禾', 25, '室友', 500);
    const hostMemory = w.memories.find((m) => m.content.includes('青禾加入了家庭'))!;
    expect(hostMemory).toBeTruthy();
    selectResident(w, id);
    expect(w.memories.some((m) => m.content.includes('青禾搬进'))).toBe(true);
    expect(w.memories.some((m) => m.id === hostMemory.id)).toBe(false);
    const loaded = validateWorld(JSON.parse(JSON.stringify(w)));
    expect(loaded.character.name).toBe('青禾');
    expect(loaded.memories.some((m) => m.content.includes('青禾搬进'))).toBe(true);
    selectResident(loaded, 'resident-0');
    expect(loaded.memories.some((m) => m.id === hostMemory.id)).toBe(true);
    expect(loaded.memories.some((m) => m.content.includes('青禾搬进'))).toBe(false);
  });
  it('keeps equal legacy balances independent after spending, income, save and reload', () => {
    const w = fresh();
    const id = addResident(w, '青禾', 25, '室友', 0);
    delete w.household.wallets;
    w.money = 4000;
    initHousehold(w);
    expect(w.money).toBe(2000);
    transact(w, -150, '原人物消费');
    selectResident(w, id);
    expect(w.money).toBe(2000);
    transact(w, 300, '室友收入');
    const loaded = validateWorld(JSON.parse(JSON.stringify(w)));
    expect(loaded.money).toBe(2300);
    selectResident(loaded, 'resident-0');
    expect(loaded.money).toBe(1850);
    expect(loaded.household.wallets).toHaveLength(2);
    expect(loaded.ledger.find((l) => l.reason === '室友收入')!.payerId).toBe(id);
    expect(loaded.ledger.find((l) => l.reason === '原人物消费')!.payerId).toBe('resident-0');
  });
});

describe('focus invitations are actual independent activities', () => {
  it('queues multiple invited residents, tracks actual activity separately and persists the session', async () => {
    const { inviteShared } = await import('../src/engine/SharedActivityEngine');
    const w = fresh();
    const id = addResident(w, '青禾', 25, '室友', 500);
    startShared(w, '学习', 25, w.lastReal);
    inviteShared(w, 'resident-0', 'study');
    inviteShared(w, id, 'read');
    expect(w.playerActivities[0].invitations).toHaveLength(2);
    expect(w.playerActivities[0].invitations![0].independent).toEqual([]);
    expect(() => inviteShared(w, id, 'read')).toThrow();
    expect(w.household.members.find((m) => m.id === id)!.queue).toHaveLength(1);
    advance(w, 10 * MINUTE);
    expect(w.playerActivities[0].invitations!.every((i) => i.independent.length > 0)).toBe(true);
    selectResident(w, id);
    const loaded = validateWorld(JSON.parse(JSON.stringify(w)));
    expect(loaded.playerActivities[0].residentId).toBe('resident-0');
    expect(loaded.playerActivities[0].invitations).toEqual(w.playerActivities[0].invitations);
    expect(loaded.focusRewards).toBeUndefined();
    returnShared(loaded, loaded.lastReal + 25 * MINUTE);
    expect(() => inviteShared(loaded, id, 'rest')).toThrow();
  });
  it('refuses an invalid age/job or full queue without creating a false invitation', async () => {
    const { inviteShared } = await import('../src/engine/SharedActivityEngine');
    const { commandResident } = await import('../src/engine/HouseholdEngine');
    const w = fresh();
    const child = addResident(w, '孩子', 8, '室友');
    startShared(w, '工作', 25, w.lastReal);
    expect(() => inviteShared(w, child, 'work')).toThrow();
    for (let i = 0; i < 5; i++) commandResident(w, child, 'read', 'apartment', 30);
    expect(() => inviteShared(w, child, 'study')).toThrow();
    expect(w.playerActivities[0].invitations).toBeUndefined();
  });
});
