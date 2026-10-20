import { careerTrack } from './CareerEngine';
import { events, type Gate, type EventDefinition } from '../content/events';
import { type World, clamp, random, record, transact, hour, MINUTE, DAY } from './model';
import { linkCause } from './EventCausalityGraph';
import { rememberEvent } from './MemoryEngine';
import { maybeStartChain } from './EventChainEngine';
export function passesGate(w: World, gate: Gate) {
  switch (gate) {
    case 'employed':
      return (
        w.character.age >= 18 &&
        w.character.age < 65 &&
        !['学生', '无业者'].includes(w.character.job)
      );
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
    (!e.careerTrack || careerTrack(w.character).id === e.careerTrack) &&
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
    (!e.requiresEvent ||
      (w.living.eventHistory[e.requiresEvent.id] &&
        w.time - w.living.eventHistory[e.requiresEvent.id].time >= e.requiresEvent.days * DAY)) &&
    (!w.cooldowns[e.eventId] || w.time >= w.cooldowns[e.eventId])
  );
}
export function eventWeight(w: World, d: EventDefinition) {
  const trait = d.affinity || d.branch?.trait;
  const preference = trait ? 0.7 + w.character.traits[trait] / 125 : 1;
  return (d.weight * preference) / (1 + (w.living.stats.definitions[d.eventId] || 0) * 0.3);
}
export function eventOutcome(w: World, d: EventDefinition) {
  if (!d.outcomes?.length) return undefined;
  const weights = d.outcomes.map((o) => {
    const trait = w.character.traits[o.trait] / 100;
    return 0.35 + 2.5 * (o.high ? trait : 1 - trait) ** 2;
  });
  let pick = random(w) * weights.reduce((sum, n) => sum + n, 0);
  return d.outcomes.find((_, i) => (pick -= weights[i]) <= 0) || d.outcomes[d.outcomes.length - 1];
}
export function sampleEvent(w: World) {
  if (random(w) > 0.38) return;
  const eligible = events.filter((e) => eligibleEvent(w, e));
  if (!eligible.length) return;
  // A place's own stories should be heard among the general everyday templates.
  const local = eligible.filter((e) => e.scenes?.includes(w.activity.scene));
  const list = local.length && random(w) < 0.7 ? local : eligible;
  const weight = (d: EventDefinition) => eventWeight(w, d);
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
  const outcome = eventOutcome(w, d);
  // A trait changes the odds; even strongly patterned people can react differently.
  const branch =
    d.branch &&
    random(w) <
      clamp(50 + (w.character.traits[d.branch.trait] - d.branch.threshold) * 0.6, 15, 85) / 100
      ? d.branch
      : undefined;
  const e = record(
    w,
    d.title,
    [d.description, outcome?.text, branch?.text]
      .filter(Boolean)
      .join(' ')
      .replaceAll('{npc}', npc?.name || '朋友'),
    d.category,
    false,
    d.eventId,
    npc?.id,
    d.requiresEvent ? w.living.eventHistory[d.requiresEvent.id]?.source : undefined,
  );
  w.living.eventHistory[d.eventId] = { time: w.time, source: e.id };
  if (d.followUpEvents.length || d.requiresEvent)
    linkCause(
      w,
      e,
      e.cause ? [e.cause] : [],
      d.requiresEvent ? '从前一次实际发生的经历继续' : '一件留下后续线索的小事',
    );
  w.cooldowns[d.eventId] =
    d.repeatPolicy === 'once' ? Number.MAX_SAFE_INTEGER : w.time + d.cooldown * MINUTE;
  w.needs.mood = clamp(w.needs.mood + d.effects.mood + (outcome?.mood || 0) + (branch?.mood || 0));
  w.needs.stress = clamp(w.needs.stress + d.effects.stress + (outcome?.stress || 0));
  if (d.effects.money) transact(w, d.effects.money, d.title);
  if (d.rarity === 'uncommon') rememberEvent(w, e, 50);
  maybeStartChain(w);
}
