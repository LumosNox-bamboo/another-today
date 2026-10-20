import { type World, uid, dayKey, random, record } from './model';
import { focusRewards } from '../content/focusRewards';
import { hasReward } from './TaskEngine';
import { commandResident } from './HouseholdEngine';
import { rememberEvent } from './MemoryEngine';
export const exchangeItems = [
  ...focusRewards.map((r) => ({
    id: r.id,
    name: r.name,
    cost: r.kind === 'outfit' ? 30 : 40,
    kind: 'permanent' as const,
  })),
  { id: 'gift-box', name: '心意礼盒', cost: 20, kind: 'item' as const },
  { id: 'picnic-snack', name: '野餐点心', cost: 10, kind: 'item' as const },
  { id: 'walk-ticket', name: '慢游公园券', cost: 15, kind: 'action' as const },
  { id: 'create-ticket', name: '午后创作券', cost: 15, kind: 'action' as const },
];
export function points(w: World) {
  return (w.exchange ??= { balance: 0, ledger: [], tickets: [], lastGiftDay: '' });
}
export function creditPoints(w: World, amount: number, reason: string) {
  const x = points(w);
  x.balance += amount;
  x.ledger.push({ id: uid(w, 'points'), time: w.time, amount, reason });
  x.ledger = x.ledger.slice(-200);
}
export function redeem(w: World, id: string) {
  const r = exchangeItems.find((r) => r.id === id);
  if (!r) throw new Error('找不到这件兑换物品');
  if (r.kind === 'permanent' && hasReward(w, id)) throw new Error('已经拥有，无需重复兑换');
  if ((w.exchange?.balance || 0) < r.cost) throw new Error('积分还不够，慢慢积累就好');
  w.taskRewards ??= { owned: [], bag: [] };
  if (r.kind === 'permanent') w.taskRewards.owned.push(id);
  else {
    const bag = r.kind === 'action' ? points(w).tickets : w.taskRewards.bag;
    const item = bag.find((i) => i.id === id);
    if (item) item.count++;
    else bag.push({ id, count: 1 });
  }
  creditPoints(w, -r.cost, `兑换${r.name}`);
}
export function useActionTicket(w: World, id: string) {
  const ticket = w.exchange?.tickets.find((t) => t.id === id && t.count > 0);
  if (!ticket || !['walk-ticket', 'create-ticket'].includes(id)) throw new Error('没有这张行动券');
  commandResident(
    w,
    w.household.active,
    id === 'walk-ticket' ? 'walk' : 'create',
    id === 'walk-ticket' ? 'park' : 'apartment',
    60,
  );
  ticket.count--;
}
export function maybeNPCGift(w: World, n: World['npcs'][number]) {
  if (
    n.scene !== w.activity.scene ||
    n.relation.familiarity < 24 ||
    n.relation.trust < 25 ||
    w.exchange?.lastGiftDay === dayKey(w.time)
  )
    return;
  if (random(w) >= 0.12) return;
  points(w).lastGiftDay = dayKey(w.time);
  const name = ['手写明信片', '一小包茶叶', '压花书签'][Math.floor(random(w) * 3)];
  const e = record(
    w,
    `${n.name}送来${name}`,
    `${n.name}把${name}送给${w.character.name}，想把这份小心意也分享给你。`,
    '社交',
    true,
    'npc-gift',
    n.id,
  );
  rememberEvent(w, e, 75);
  w.npcGifts ??= [];
  w.npcGifts.push({
    id: uid(w, 'npc-gift'),
    npcId: n.id,
    residentId: w.household.active,
    name,
    time: w.time,
  });
  w.npcGifts = w.npcGifts.slice(-100);
  creditPoints(w, 5, `${n.name}的礼物：${name}`);
}
