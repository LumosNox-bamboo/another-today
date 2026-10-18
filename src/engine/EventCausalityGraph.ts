import { type World, type LifeEvent } from './model';
export function linkCause(w: World, e: LifeEvent, parents: string[] = [], reason = e.text) {
  // Keep an actual event snapshot when a previously ordinary event becomes an important cause.
  for (const parent of parents) {
    if (parent === e.id || w.living.causes.some((c) => c.id === parent)) continue;
    const source = w.events.find((x) => x.id === parent);
    if (source) linkCause(w, source, [], source.text);
  }
  const existing = w.living.causes.find((c) => c.id === e.id);
  if (existing) {
    existing.parents = [
      ...new Set([...existing.parents, ...parents.filter((p) => p !== e.id)]),
    ].slice(0, 8);
    existing.reason = reason;
    existing.memories = w.memories.filter((m) => m.source === e.id).map((m) => m.id);
    return existing;
  }
  const node = {
    id: e.id,
    time: e.time,
    title: e.title,
    reason,
    participants: e.npcId ? [e.npcId] : [],
    results: e.text,
    parents: parents.filter((p) => p !== e.id).slice(0, 8),
    memories: w.memories.filter((m) => m.source === e.id).map((m) => m.id),
  };
  w.living.causes.push(node);
  // Preserve roots for active gifts/arcs/works; prune oldest unreferenced leaves first.
  if (w.living.causes.length > 600) {
    const protectedIds = new Set([
      ...w.living.causes.flatMap((c) => c.parents),
      ...w.living.gifts.map((g) => g.source),
      ...w.living.arcs.flatMap((a) => [a.origin, a.lastEvent]),
      ...w.living.creations.map((c) => c.eventId),
    ]);
    const index = w.living.causes.findIndex((c) => !protectedIds.has(c.id));
    w.living.causes.splice(index < 0 ? 0 : index, 1);
  }
  return node;
}
export function traceCauses(w: World, id: string) {
  const found = new Set<string>();
  const visit = (key: string) => {
    if (found.has(key) || found.size >= 100) return;
    const c = w.living.causes.find((c) => c.id === key);
    if (!c) return;
    found.add(key);
    c.parents.forEach(visit);
  };
  visit(id);
  return w.living.causes.filter((c) => found.has(c.id)).sort((a, b) => a.time - b.time);
}
