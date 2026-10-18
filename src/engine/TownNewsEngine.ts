import { destinations } from '../content/places';
import { newsTemplates } from '../content/living';
import { type World, type Scene, type Activity, DAY, dayKey, random, record, uid } from './model';
import { linkCause } from './EventCausalityGraph';
export function publishNews(w: World, id: string, npcId?: string, source?: string) {
  const d = newsTemplates.find((d) => d.id === id);
  if (!d) return;
  const npc = w.npcs.find((n) => n.id === npcId);
  if (
    d.effect === 'npc' &&
    (!npc || !source || !w.events.some((e) => e.id === source && e.npcId === npc.id))
  )
    return;
  if (w.living.news.some((n) => n.definition === id && w.time - n.time < 14 * DAY)) return;
  if (d.effect === 'repair') w.living.town.facilities[d.scene] = 'repair';
  if (d.effect === 'opportunity' && !w.living.town.opened.includes(id))
    w.living.town.opened.push(id);
  const text = d.text.replace('{npc}', npc?.name || '');
  const e = record(w, d.title, text, '社区新闻', false, id, npcId, source);
  linkCause(
    w,
    e,
    source ? [source] : [],
    d.effect === 'repair' ? '公共设施进入维护状态' : '实际启动的社区安排',
  );
  w.living.news.push({
    id: uid(w, 'news'),
    definition: id,
    time: w.time,
    expires: w.time + d.days * DAY,
    title: d.title,
    text,
    scene: d.scene,
    activity: d.activity,
    source: e.id,
    effect: d.effect,
  });
  w.living.news = w.living.news.slice(-100);
}
export function newsTick(w: World) {
  const t = w.living.town,
    day = dayKey(w.time);
  if (t.lastDay === day) return;
  t.lastDay = day;
  for (const scene of Object.keys(t.facilities))
    if (
      !w.living.news.some((n) => n.scene === scene && n.effect === 'repair' && n.expires > w.time)
    )
      t.facilities[scene] = 'open';
  const candidates = newsTemplates.filter(
    (d) =>
      d.effect !== 'npc' &&
      (!destinations.find((x) => x.scene === d.scene)?.weekend ||
        [0, 6].includes(new Date(w.time).getUTCDay())) &&
      (!['news-0', 'news-1', 'news-2', 'news-3'].includes(d.id) ||
        ['春', '夏', '秋', '冬'][Number(d.id.split('-')[1])] === w.living.calendar.season) &&
      !w.living.news.some((n) => n.definition === d.id && w.time - n.time < 14 * DAY),
  );
  if (candidates.length) publishNews(w, candidates[Math.floor(random(w) * candidates.length)].id);
}
export function townBias(w: World, a: Activity) {
  return Math.min(
    12,
    w.living.news.filter((n) => n.expires > w.time && n.activity === a && n.effect !== 'repair')
      .length * 6,
  );
}
export function openScene(w: World, scene: Scene): Scene {
  return w.living.town.facilities[scene] === 'repair'
    ? scene === 'apartment'
      ? 'street'
      : 'apartment'
    : scene;
}
