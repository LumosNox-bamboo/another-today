import { resident, validBond } from './HouseholdEngine';
import { validateLiving } from './LivingValidator';
import { stateSchema, type World, STEP } from './model';
export function validateWorld(input: unknown): World {
  const w = stateSchema.parse(input);
  if (
    w.simulatedUntil > w.time ||
    w.time - w.simulatedUntil >= STEP ||
    w.activity.end < w.activity.start
  )
    throw new Error('存档中的时间数据无效');
  if (
    new Set(w.npcs.map((n) => n.id)).size !== w.npcs.length ||
    new Set(w.events.map((e) => e.id)).size !== w.events.length ||
    new Set(w.diaries.map((d) => d.date)).size !== w.diaries.length
  )
    throw new Error('存档包含重复记录');
  const generatedIds = [
    ...w.events,
    ...w.memories,
    ...w.ledger,
    ...w.playerActivities,
    ...w.decisions,
    ...w.living.interactions,
    ...w.living.gifts,
    ...w.living.news,
    ...w.living.creations,
    ...w.living.dreams,
  ].map((x) => x.id);
  for (const id of generatedIds) {
    const match = id.match(
      /^(?:event|memory|player-memory|money|focus|decision|interaction|gift-instance|news|creation|wish)-(\d+)$/,
    );
    if (match && Number(match[1]) > w.sequence) throw new Error('存档序号落后于已保存记录');
  }
  if (w.playerActivities.filter((a) => !a.returned).length > 1)
    throw new Error('存档有多个未结束的专注活动');
  const h = w.household;
  const ids = new Set(h.members.map((m) => m.id));
  const pairs = h.bonds.map((b) => [b.a, b.b].sort().join('/'));
  if (
    ids.size !== h.members.length ||
    (h.members.length ? !ids.has(h.active) : h.active !== 'resident-0') ||
    new Set(pairs).size !== pairs.length ||
    h.members.some(
      (m) =>
        (m.id === h.active) === !!m.state ||
        m.birthday > w.time ||
        Object.keys(m.relations).some((id) => !w.npcs.some((n) => n.id === id)),
    ) ||
    h.bonds.some(
      (b) =>
        !ids.has(b.a) ||
        !ids.has(b.b) ||
        b.a === b.b ||
        !validBond(resident(w, b.a)!.character, resident(w, b.b)!.character, b.type),
    )
  )
    throw new Error('家庭成员、关系或时间无效');
  for (const m of h.members)
    if (m.state) {
      // Reuse the full world's checks without recursively storing another household.
      validateWorld({
        ...w,
        ...m.state,
        living: { ...w.living, ...m.state.living },
        household: undefined,
        npcs: w.npcs.map((n) => ({
          ...n,
          relation: m.relations[n.id] || { ...n.relation, type: '陌生人' },
        })),
      });
    }
  for (const n of w.npcs) {
    const partners =
      (n.relation.type === '恋人' ? 1 : 0) +
      h.members.filter((m) => m.id !== h.active && m.relations[n.id]?.type === '恋人').length +
      w.living.npcBonds.filter((b) => b.status === '恋人' && (b.a === n.id || b.b === n.id)).length;
    if (partners > 1) throw new Error('居民关系存在重复伴侣');
  }
  if (w.playerActivities.some((a) => a.residentId && h.members.length && !ids.has(a.residentId)))
    throw new Error('共同活动指向不存在的家庭成员');
  validateLiving(w);
  return w;
}
