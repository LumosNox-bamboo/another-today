import { storyArcs } from '../content/storyArcs';
import { type World, DAY, random, record, clamp, sceneNames, activityNames } from './model';
import { rememberEvent } from './MemoryEngine';
import { linkCause } from './EventCausalityGraph';
export function maybeStartArc(w: World) {
  if (
    w.living.arcs.filter((a) => a.status === 'active' || a.status === 'paused').length >= 2 ||
    w.living.arcs.filter((a) => a.status === 'active' || a.status === 'paused').length +
      w.chains.filter((c) => c.status === 'active').length >=
      3 ||
    w.time - Number(w.flags.lastArcStart || 0) < 3 * DAY ||
    random(w) > 0.08
  )
    return;
  const list = storyArcs.filter(
    (d) =>
      d.scene === w.activity.scene &&
      (!d.minVisits || (w.living.exploration.visits[d.scene]?.days || 0) >= d.minVisits) &&
      d.activity === w.activity.kind &&
      !w.living.arcs.some((a) => a.id === d.id) &&
      (d.gate !== 'rain' || Math.floor(w.time / DAY) % 4 === 0) &&
      (d.gate !== 'work' || !['学生', '无业者'].includes(w.character.job)) &&
      (d.gate !== 'creation' || w.living.creations.some((c) => c.completed)) &&
      (d.id !== 'arc-7' || new Date(w.time).getUTCDay() === 5) &&
      (d.id !== 'arc-12' || new Date(w.time).getUTCHours() >= 21),
  );
  const d = list[Math.floor(random(w) * list.length)];
  if (!d) return;
  const npc = w.npcs
    .filter((n) => n.relation.familiarity > 0 && (d.scene === 'apartment' || n.scene === d.scene))
    .sort((a, b) => b.relation.familiarity - a.relation.familiarity)[0];
  if (!npc) return;
  const e = record(w, d.title, d.nodes[0], '长线剧情', true, `${d.id}-0`, npc.id);
  rememberEvent(w, e, 80);
  linkCause(w, e, [], `在${sceneNames[w.activity.scene]}${activityNames[w.activity.kind]}时发生`);
  w.living.arcs.push({
    id: d.id,
    stage: 1,
    status: 'active',
    started: w.time,
    due: w.time + d.delay * DAY,
    deadline: w.time + (d.delay * 4 + 14) * DAY,
    origin: e.id,
    lastEvent: e.id,
    npcId: npc.id,
  });
  w.flags.lastArcStart = w.time;
}
export function chooseArc(w: World, id: string, choice: 'bold' | 'quiet') {
  const a = w.living.arcs.find((a) => a.id === id);
  if (a?.status === 'active' && a.stage === 3) a.choice = choice;
}
export function controlArc(w: World, id: string, action: 'pause' | 'resume' | 'end') {
  const a = w.living.arcs.find((a) => a.id === id);
  if (!a || !['active', 'paused'].includes(a.status)) return;
  if (action === 'pause') {
    a.status = 'paused';
    return;
  }
  if (action === 'resume') {
    a.status = 'active';
    a.due = w.time + DAY;
    a.deadline = Math.max(a.deadline, w.time + 30 * DAY);
    return;
  }
  a.status = 'ended';
  const e = record(
    w,
    '为这段故事留一个停顿',
    `决定提前结束「${storyArcs.find((d) => d.id === id)!.title}」，把精力留给现在的生活。`,
    '长线剧情',
    true,
    `${id}-ended`,
    a.npcId,
    a.lastEvent,
  );
  rememberEvent(w, e, 70);
  linkCause(w, e, [a.lastEvent]);
  a.lastEvent = e.id;
}
export function arcsTick(w: World) {
  for (const a of w.living.arcs) {
    if (!['active', 'paused'].includes(a.status)) continue;
    const d = storyArcs.find((d) => d.id === a.id)!;
    if (w.time > a.deadline) {
      a.status = 'missed';
      const e = record(
        w,
        `${d.title} · 错过的时机`,
        '生活继续向前，这次没有赶上后续安排。留下经历，不责怪任何人。',
        '长线剧情',
        true,
        `${a.id}-missed`,
        a.npcId,
        a.lastEvent,
      );
      rememberEvent(w, e, 65);
      linkCause(w, e, [a.lastEvent]);
      continue;
    }
    if (
      a.status === 'paused' ||
      w.time < a.due ||
      w.activity.kind === 'sleep' ||
      w.activity.scene !== d.scene
    )
      continue;
    if (a.stage < 3) {
      const e = record(
        w,
        d.title,
        d.nodes[a.stage],
        '长线剧情',
        true,
        `${a.id}-${a.stage}`,
        a.npcId,
        a.lastEvent,
      );
      rememberEvent(w, e, 80);
      linkCause(w, e, [a.lastEvent]);
      a.lastEvent = e.id;
      a.stage++;
      a.due = w.time + (a.stage === 3 ? 2 : d.delay) * DAY;
      continue;
    }
    const bold =
      a.choice === 'bold' || (!a.choice && w.character.traits[d.trait] + random(w) * 30 > 75);
    const e = record(
      w,
      `${d.title} · ${bold ? '继续向前' : '另一种收获'}`,
      bold ? d.bold : d.quiet,
      '长线剧情',
      true,
      `${a.id}-end`,
      a.npcId,
      a.lastEvent,
    );
    rememberEvent(w, e, 95);
    linkCause(w, e, [a.lastEvent, a.origin]);
    a.status = 'complete';
    a.stage = 4;
    a.ending = bold ? 'bold' : 'quiet';
    a.lastEvent = e.id;
    const n = w.npcs.find((n) => n.id === a.npcId)!;
    n.relation.trust = clamp(n.relation.trust + (bold ? 5 : 2));
    n.relation.familiarity = clamp(n.relation.familiarity + 5);
    n.memories.push(`${d.title}：${e.text}`);
    n.memories = n.memories.slice(-12);
    if (d.consequence === 'skill') w.character.skill = clamp(w.character.skill + (bold ? 3 : 1));
    if (d.consequence === 'dream') w.character.goalProgress = clamp(w.character.goalProgress + 3);
    if (d.consequence === 'collection' && w.items.length < 30)
      w.items.push({
        id: `keepsake-${a.id}`,
        name: `${d.title}的纪念`,
        description: e.text.slice(0, 200),
        acquired: w.time,
        source: e.id,
        uses: 0,
        anchor: 'shelf',
      });
  }
}
