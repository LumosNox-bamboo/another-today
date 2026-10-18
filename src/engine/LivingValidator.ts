import type { World } from './model';
import { activityNames, sceneNames } from './model';
import { gifts, habits, secrets, newsTemplates } from '../content/living';
import { storyArcs } from '../content/storyArcs';
import { chains } from '../content/events';
export function validateLiving(w: World) {
  const l = w.living;
  const fail = () => {
    throw new Error('扩展世界包含无效引用、重复记录或不一致状态');
  };
  const check = (items: { id: string }[], catalog: { id: string }[]) => {
    if (
      new Set(items.map((x) => x.id)).size !== items.length ||
      items.some((x) => !catalog.some((d) => d.id === x.id))
    )
      fail();
  };
  check(l.habits, habits);
  check(l.secrets, secrets);
  check(l.arcs, storyArcs);
  check(l.npcLives, w.npcs);
  check(w.chains, chains);
  for (const array of [l.gifts, l.news, l.creations, l.dreams, l.interactions, l.causes])
    if (new Set(array.map((x) => x.id)).size !== array.length) fail();
  if (
    l.gifts.some((g) => !gifts.some((d) => d.id === g.definition)) ||
    new Set(l.gifts.map((g) => g.definition)).size !== l.gifts.length
  )
    fail();
  if (
    l.news.some(
      (n) =>
        !newsTemplates.some((d) => d.id === n.definition) ||
        !(n.scene in sceneNames) ||
        !(n.activity in activityNames) ||
        n.expires < n.time,
    )
  )
    fail();
  const npc = (id: string) => w.npcs.some((n) => n.id === id);
  if (
    l.arcs.some((a) => !npc(a.npcId) || a.deadline < a.started || a.due < a.started) ||
    l.secrets.some((s) => s.expires < s.started)
  )
    fail();
  if (
    l.dreams.some((d) => !(d.activity in activityNames)) ||
    l.creations.some(
      (c) =>
        (c.giftedTo && !npc(c.giftedTo)) ||
        (c.completed !== undefined && (c.completed < c.started || c.progress !== 100)),
    )
  )
    fail();
  const pairs = l.npcBonds.map((b) => [b.a, b.b].sort().join('/'));
  if (
    new Set(pairs).size !== pairs.length ||
    l.npcBonds.some((b) => !npc(b.a) || !npc(b.b) || b.a === b.b)
  )
    fail();
  for (const n of w.npcs)
    if (
      l.npcBonds.filter((b) => b.status === '恋人' && (b.a === n.id || b.b === n.id)).length +
        (n.relation.type === '恋人' ? 1 : 0) >
      1
    )
      fail();
  for (const a of w.playerActivities)
    if (
      (a.returned !== undefined && a.returned < a.start) ||
      (a.expectedEnd !== undefined && a.expectedEnd < a.start) ||
      (a.gameEnd !== undefined && a.gameStart !== undefined && a.gameEnd < a.gameStart)
    )
      fail();
  if (l.calendar.date && !/^\d{4}-\d{2}-\d{2}$/.test(l.calendar.date)) fail();
  const visiting = new Set<string>(),
    done = new Set<string>(),
    nodes = new Map(l.causes.map((c) => [c.id, c]));
  const visit = (id: string) => {
    if (visiting.has(id)) fail();
    if (done.has(id)) return;
    visiting.add(id);
    nodes.get(id)?.parents.forEach(visit);
    visiting.delete(id);
    done.add(id);
  };
  l.causes.forEach((c) => visit(c.id));
}
