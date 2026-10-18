import { destinations, discoveries, type Destination } from '../content/places';
import { gifts } from '../content/living';
import { storyArcs } from '../content/storyArcs';
import {
  type World,
  type Activity,
  type Scene,
  DAY,
  MINUTE,
  hour,
  dayKey,
  random,
  record,
  clamp,
  sceneNames,
} from './model';
import { rememberEvent } from './MemoryEngine';
import { linkCause } from './EventCausalityGraph';

export function destinationOpen(w: World, d: Destination) {
  const h = hour(w.time);
  return (
    h >= d.hours[0] &&
    h < d.hours[1] &&
    (!d.weekend || [0, 6].includes(new Date(w.time).getUTCDay())) &&
    w.living.town.facilities[d.scene] !== 'repair'
  );
}

export function suggestDestination(w: World, scene: Scene) {
  if (!destinations.some((d) => d.scene === scene)) return;
  // A suggestion survives until the next weekend; it never interrupts basic needs or work.
  w.living.exploration.suggestion = { scene, until: w.time + 7 * DAY };
}

export function explorationBias(w: World, activity: Activity) {
  const s = w.living.exploration.suggestion;
  const d = destinations.find((d) => d.scene === s?.scene);
  return s && s.until > w.time && d && destinationOpen(w, d) && d.activities.includes(activity)
    ? 12
    : 0;
}

export function chooseDestination(w: World, activity: Activity, fallback: Scene): Scene {
  const list = destinations.filter((d) => d.activities.includes(activity) && destinationOpen(w, d));
  if (!list.length) return fallback;
  const weights = list.map((d) => {
    const visit = w.living.exploration.visits[d.scene];
    const suggestion = w.living.exploration.suggestion;
    const story = w.living.arcs.some(
      (a) =>
        a.status === 'active' &&
        a.due <= w.time &&
        storyArcs.find((s) => s.id === a.id)?.scene === d.scene,
    );
    const gift = w.living.gifts.some(
      (g) =>
        g.reaction !== '不合口味但珍惜' &&
        gifts.find((x) => x.id === g.definition)?.scene === d.scene,
    );
    const gathering = w.living.news.some(
      (n) => n.scene === d.scene && n.expires > w.time && n.effect !== 'repair',
    );
    return (
      (0.7 +
        w.character.traits[d.trait] / 65 +
        (d.interests.includes(w.character.interest) ? 1 : 0) +
        (gift ? 1.5 : 0) +
        (story ? 5 : 0) +
        (gathering ? 2 : 0) +
        (suggestion?.scene === d.scene && suggestion.until > w.time ? 12 : 0)) *
      (visit && dayKey(visit.last) === dayKey(w.time) ? 0.35 : 1)
    );
  });
  let pick = random(w) * (7 + weights.reduce((s, x) => s + x, 0));
  for (let i = 0; i < list.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return list[i].scene;
  }
  return fallback;
}

export function completeVisit(w: World) {
  const d = destinations.find((d) => d.scene === w.activity.scene);
  if (
    !d ||
    !d.activities.includes(w.activity.kind) ||
    w.time < w.activity.end ||
    w.activity.end - w.activity.start < 20 * MINUTE
  )
    return;
  const l = w.living.exploration;
  let v = l.visits[d.scene];
  if (!v) {
    const e = record(
      w,
      `第一次走到${sceneNames[d.scene]}`,
      `在${sceneNames[d.scene]}度过了一段自己的时间。${d.description}`,
      '街区探索',
      true,
      `visit-${d.scene}`,
    );
    rememberEvent(w, e, 80);
    const gift = w.living.gifts.find(
      (g) =>
        g.reaction !== '不合口味但珍惜' &&
        gifts.find((x) => x.id === g.definition)?.scene === d.scene,
    );
    linkCause(
      w,
      e,
      gift ? [gift.source] : [],
      gift ? '一份礼物增加了想来这里试试的念头' : '在自主活动中走到了新的地方',
    );
    v = l.visits[d.scene] = { first: w.time, last: w.time, days: 1, source: e.id };
  } else if (dayKey(v.last) !== dayKey(w.time)) {
    v.days++;
    v.last = w.time;
  }
  if (l.suggestion?.scene === d.scene) delete l.suggestion;
  if (
    l.discoveries.some(
      (x) =>
        dayKey(x.time) === dayKey(w.time) &&
        discoveries.find((a) => a.id === x.id)?.scene === d.scene,
    )
  )
    return;
  const found = discoveries.find(
    (x) =>
      x.scene === d.scene &&
      x.days <= v.days &&
      x.activities.includes(w.activity.kind) &&
      !l.discoveries.some((a) => a.id === x.id),
  );
  if (!found) return;
  const e = record(
    w,
    `见闻手册 · ${found.name}`,
    found.text,
    '街区探索',
    true,
    found.id,
    undefined,
    v.source,
  );
  rememberEvent(w, e, 75);
  linkCause(w, e, [v.source], `在这里实际度过了 ${v.days} 个不同的日子`);
  l.discoveries.push({ id: found.id, time: w.time, source: e.id });
  w.living.interests[found.interest] = clamp((w.living.interests[found.interest] || 0) + 2);
  w.needs.fun = clamp(w.needs.fun + 3);
}

export function displayDiscovery(w: World, id?: string) {
  if (id === undefined) delete w.living.exploration.display;
  else if (w.living.exploration.discoveries.some((d) => d.id === id))
    w.living.exploration.display = id;
}
