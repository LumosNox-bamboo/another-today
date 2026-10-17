import { events, type Gate } from '../content/events';
import { type World, clamp, random, record, transact, hour, MINUTE } from './model';
import { rememberEvent } from './MemoryEngine';
import { maybeStartChain } from './EventChainEngine';
export function passesGate(w: World, gate: Gate) {
  switch (gate) {
    case 'employed':
      return !['学生', '无业者'].includes(w.character.job);
    case 'friend':
      return w.npcs.some((n) => n.scene === w.activity.scene && n.relation.familiarity > 0);
    case 'partner':
      return w.npcs.some((n) => n.scene === w.activity.scene && n.relation.type === '恋人');
    case 'student':
      return w.character.job === '学生';
    case 'night':
      return hour(w.time) >= 21 || hour(w.time) < 6;
    case 'rain':
      return Math.floor(w.time / 86400000) % 4 === 0;
    case 'plant':
      return w.items.some((i) => i.anchor === 'plant');
    case 'single':
      return !w.npcs.some((n) => n.relation.type === '恋人');
    case 'weekend':
      return [0, 6].includes(new Date(w.time).getUTCDay());
    default:
      return true;
  }
}
export function sampleEvent(w: World) {
  if (random(w) > 0.5) return;
  const list = events.filter(
    (e) =>
      e.triggerConditions.activities.includes(w.activity.kind) &&
      passesGate(w, e.triggerConditions.gate) &&
      (!w.cooldowns[e.eventId] || w.time >= w.cooldowns[e.eventId]),
  );
  if (!list.length) return;
  const d = list[Math.floor(random(w) * list.length)],
    npc =
      d.participants === 'npc'
        ? w.npcs.find(
            (n) =>
              n.scene === w.activity.scene &&
              (d.triggerConditions.gate === 'partner'
                ? n.relation.type === '恋人'
                : n.relation.familiarity > 0),
          )
        : undefined;
  const e = record(
    w,
    d.title,
    d.description.replaceAll('{npc}', npc?.name || '朋友'),
    d.category,
    false,
    d.eventId,
    npc?.id,
  );
  w.cooldowns[d.eventId] = w.time + d.cooldown * MINUTE;
  w.needs.mood = clamp(w.needs.mood + d.effects.mood);
  w.needs.stress = clamp(w.needs.stress + d.effects.stress);
  if (d.effects.money) transact(w, d.effects.money, d.title);
  if (d.rarity === 'uncommon') rememberEvent(w, e, 50);
  maybeStartChain(w);
}
