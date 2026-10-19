import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/content/people';
import {
  addTask,
  completeTask,
  removeTask,
  grantTaskReward,
  hasReward,
  useTaskItem,
} from '../src/engine/TaskEngine';
import { useFocusReward } from '../src/engine/FocusRewardEngine';
import { validateWorld } from '../src/engine/validation';
import { addResident, selectResident } from '../src/engine/HouseholdEngine';
import { gifts } from '../src/content/living';
import { focusRewards } from '../src/content/focusRewards';

describe('untimed real-life plans and reward inventory', () => {
  it('keeps a plan over reload and character switches, then awards once days later without a timer', () => {
    const w = createWorld();
    const t = addTask(w, '  整理房间  ', Date.now());
    const roommate = addResident(w, '青禾', 25, '室友', 200);
    selectResident(w, roommate);
    const loaded = validateWorld(JSON.parse(JSON.stringify(w)));
    expect(loaded.tasks![0].title).toBe('整理房间');
    expect(loaded.playerActivities).toEqual([]);
    expect(loaded.focusRewards).toBeUndefined();
    expect(completeTask(loaded, t.id, t.createdAt + 7 * 86400000)).toBeTruthy();
    const saved = validateWorld(JSON.parse(JSON.stringify(loaded)));
    const before = JSON.stringify(saved);
    expect(completeTask(saved, t.id, Date.now())).toBeUndefined();
    expect(JSON.stringify(saved)).toBe(before);
    expect(saved.focusRewards!.completed).toBe(1);
  });
  it('cancels without penalty or rewards and validates input', () => {
    const w = createWorld();
    const t = addTask(w, '散步', Date.now());
    const trust = w.companion.trust;
    removeTask(w, t.id);
    expect(w.tasks).toEqual([]);
    expect(w.companion.trust).toBe(trust);
    expect(w.taskRewards).toBeUndefined();
    expect(() => addTask(w, ' ', Date.now())).toThrow();
    expect(() => addTask(w, 'a'.repeat(121), Date.now())).toThrow();
  });
  it('draws useful randomized rewards, never duplicates owned clothing/furniture, preserves old unlocks', () => {
    const w = createWorld();
    w.focusRewards = { completed: 1, placed: [] };
    const drawn = Array.from({ length: 250 }, () => grantTaskReward(w));
    expect(new Set(drawn).size).toBe(10);
    expect(drawn).not.toContain('sage-shirt');
    for (const r of focusRewards.filter((r) => r.id !== 'sage-shirt'))
      expect(drawn.filter((id) => id === r.id)).toHaveLength(1);
    expect(hasReward(w, 'star-print')).toBe(true);
    useFocusReward(w, 'star-print');
    expect(validateWorld(w).focusRewards!.placed).toEqual(['star-print']);
  });
  it('redeems consumables only once and uses the selected wallet and character', () => {
    const w = createWorld();
    const roommate = addResident(w, '青禾', 25, '室友', 200);
    w.taskRewards = {
      owned: [],
      bag: [
        { id: 'shopping-card', count: 1 },
        { id: 'picnic-snack', count: 1 },
        { id: 'gift-box', count: 2 },
      ],
    };
    selectResident(w, roommate);
    useTaskItem(w, 'shopping-card');
    expect(w.money).toBe(300);
    expect(() => useTaskItem(w, 'shopping-card')).toThrow();
    w.needs.hunger = 80;
    w.needs.energy = 50;
    useTaskItem(w, 'picnic-snack');
    expect(w.needs.hunger).toBe(55);
    expect(w.needs.energy).toBe(60);
    useTaskItem(w, 'gift-box', gifts[0].id);
    expect(w.living.gifts[0].definition).toBe(gifts[0].id);
    expect(() => useTaskItem(w, 'gift-box', gifts[0].id)).toThrow();
    expect(w.taskRewards.bag[2].count).toBe(1);
    selectResident(w, 'resident-0');
    expect(w.money).toBe(3000);
    expect(w.living.gifts).toHaveLength(0);
    expect(() => validateWorld(w)).not.toThrow();
  });
  it('bounds task history without losing rewards and rejects malformed imported rewards', () => {
    const w = createWorld();
    for (let i = 0; i < 120; i++) {
      const t = addTask(w, `计划 ${i}`, Date.now());
      completeTask(w, t.id, Date.now());
    }
    expect(w.tasks).toHaveLength(100);
    expect(w.focusRewards!.completed).toBe(120);
    for (let i = 0; i < 100; i++) addTask(w, `待办 ${i}`, Date.now());
    expect(() => addTask(w, '太多', Date.now())).toThrow();
    expect(() => validateWorld(w)).not.toThrow();
    w.taskRewards!.owned.push('unknown');
    expect(() => validateWorld(w)).toThrow();
  });
});
