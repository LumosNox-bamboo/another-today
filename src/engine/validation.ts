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
  ].map((x) => x.id);
  for (const id of generatedIds) {
    const match = id.match(/^(?:event|memory|player-memory|money|focus|decision)-(\d+)$/);
    if (match && Number(match[1]) > w.sequence) throw new Error('存档序号落后于已保存记录');
  }
  if (w.playerActivities.filter((a) => !a.returned).length > 1)
    throw new Error('存档有多个未结束的专注活动');
  return w;
}
