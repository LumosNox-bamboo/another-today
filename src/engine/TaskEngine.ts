import { type World, uid, random, transact, clamp } from './model';
import { focusRewards } from '../content/focusRewards';
import { gifts } from '../content/living';
import { giveGift } from './GiftEngine';

export const taskItems = [
  {
    id: 'gift-box',
    name: '心意礼盒',
    description: '选一件礼物送给当前人物，进入 TA 的收藏与记忆。',
  },
  { id: 'shopping-card', name: '100 元购物卡', description: '兑换为当前人物钱包里的 100 游戏元。' },
  {
    id: 'picnic-snack',
    name: '野餐点心',
    description: '给当前人物吃，减少 25 点饥饿并恢复 10 点精力。',
  },
] as const;
export function hasReward(w: World, id: string) {
  const r = focusRewards.find((r) => r.id === id);
  return !!r && ((w.focusRewards?.completed || 0) >= r.at || !!w.taskRewards?.owned.includes(id));
}
export function rewardName(id: string) {
  return [...focusRewards, ...taskItems].find((r) => r.id === id)?.name || id;
}
export function grantTaskReward(w: World) {
  w.taskRewards ??= { owned: [], bag: [] };
  const pool = [
    ...taskItems.map((r) => r.id),
    ...focusRewards.filter((r) => !hasReward(w, r.id)).map((r) => r.id),
  ];
  const id = pool[Math.floor(random(w) * pool.length)];
  if (focusRewards.some((r) => r.id === id)) w.taskRewards.owned.push(id);
  else {
    const item = w.taskRewards.bag.find((r) => r.id === id);
    if (item) item.count++;
    else w.taskRewards.bag.push({ id, count: 1 });
  }
  return id;
}
export function addTask(w: World, title: string, now: number) {
  title = title.trim();
  if (!title || title.length > 120) throw new Error('请填写 1–120 字的计划');
  if ((w.tasks || []).filter((t) => !t.completedAt).length >= 100)
    throw new Error('先整理现有的 100 个待办计划吧');
  w.tasks ??= [];
  const task = { id: uid(w, 'task'), title, createdAt: now };
  w.tasks.push(task);
  return task;
}
export function completeTask(w: World, id: string, now: number) {
  const t = w.tasks?.find((t) => t.id === id);
  if (!t || t.completedAt) return;
  w.focusRewards ??= { completed: 0, placed: [] };
  w.focusRewards.completed++;
  t.completedAt = Math.max(t.createdAt, now);
  t.reward = grantTaskReward(w);
  const recent = w.tasks!.filter((t) => t.completedAt).slice(-100);
  w.tasks = w.tasks!.filter((t) => !t.completedAt || recent.includes(t));
  return t.reward;
}
export function removeTask(w: World, id: string) {
  w.tasks = w.tasks?.filter((t) => t.id !== id || !!t.completedAt);
}
export function useTaskItem(w: World, id: string, giftId?: string) {
  const item = w.taskRewards?.bag.find((r) => r.id === id);
  if (!item || item.count < 1) throw new Error('没有这件道具了');
  if (id === 'gift-box') {
    if (!gifts.some((g) => g.id === giftId)) throw new Error('请先选择一件礼物');
    giveGift(w, giftId!);
  } else if (id === 'shopping-card') {
    if (w.money > 5999900) throw new Error('钱包已满，购物卡先为你保留');
    transact(w, 100, '任务奖励 · 购物卡兑换');
  } else if (id === 'picnic-snack') {
    w.needs.hunger = clamp(w.needs.hunger - 25);
    w.needs.energy = clamp(w.needs.energy + 10);
  } else throw new Error('不存在的道具');
  item.count--;
}
