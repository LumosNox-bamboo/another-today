import { events, type Gate, type EventDefinition } from '../content/events';
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
export function eligibleEvent(w: World, e: EventDefinition) {
  return (
    e.triggerConditions.activities.includes(w.activity.kind) &&
    passesGate(w, e.triggerConditions.gate) &&
    (!e.scenes || e.scenes.includes(w.activity.scene)) &&
    (!e.season || e.season === w.living.calendar.season) &&
    (!e.requiredState ||
      (e.requiredState === 'gift'
        ? w.living.gifts.length > 0
        : e.requiredState === 'habit'
          ? w.living.habits.some((h) => h.formed)
          : e.requiredState === 'npc-change'
            ? w.living.stats.npcChanges > 0
            : e.requiredState === 'news'
              ? w.living.news.some((n) => n.expires > w.time)
              : w.living.creations.some((c) => c.completed))) &&
    (!w.cooldowns[e.eventId] || w.time >= w.cooldowns[e.eventId])
  );
}
export function sampleEvent(w: World) {
  if (random(w) > 0.38) return;
  const list = events.filter((e) => eligibleEvent(w, e));
  if (!list.length) return;
  const weight = (d: EventDefinition) =>
    d.weight / (1 + (w.living.stats.definitions[d.eventId] || 0) * 0.3);
  let pick = random(w) * list.reduce((sum, d) => sum + weight(d), 0);
  const d = list.find((d) => (pick -= weight(d)) <= 0) || list[list.length - 1],
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
    d.description.replaceAll('{npc}', npc?.name || '朋友') +
      (d.branch && w.character.traits[d.branch.trait] >= d.branch.threshold ? d.branch.text : ''),
    d.category,
    false,
    d.eventId,
    npc?.id,
  );
  w.cooldowns[d.eventId] =
    d.repeatPolicy === 'once' ? Number.MAX_SAFE_INTEGER : w.time + d.cooldown * MINUTE;
  w.needs.mood = clamp(
    w.needs.mood +
      d.effects.mood +
      (d.branch && w.character.traits[d.branch.trait] >= d.branch.threshold ? d.branch.mood : 0),
  );
  w.needs.stress = clamp(w.needs.stress + d.effects.stress);
  if (d.effects.money) transact(w, d.effects.money, d.title);
  if (d.rarity === 'uncommon') rememberEvent(w, e, 50);
  maybeStartChain(w);
}
