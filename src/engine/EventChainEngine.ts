import { chains } from '../content/events';
import { type World, DAY, random, record, clamp, uid } from './model';
import { rememberEvent } from './MemoryEngine';
export function advanceChains(w: World) {
  for (const c of w.chains) {
    if (c.status !== 'active' || w.time < c.due) continue;
    const d = chains.find((x) => x.id === c.id)!;
    if (c.stage < 3) {
      const e = record(
        w,
        d.title,
        d.nodes[c.stage],
        '连锁剧情',
        true,
        `chain-${c.id}-${c.stage}`,
        c.npcId,
        c.origin,
      );
      rememberEvent(w, e, 75);
      c.stage++;
      c.due = w.time + d.delayDays * DAY;
    } else if (!w.decisions.some((x) => x.chainId === c.id)) {
      if (
        w.settings.advice === 'autonomous' ||
        (w.settings.advice === 'sometimes' && random(w) < 0.5)
      ) {
        resolveChain(w, c.id, w.character.traits[d.trait] + random(w) * 35 > 65);
      } else
        w.decisions.push({
          id: uid(w, 'decision'),
          title: d.title,
          text: '这件小事走到了一个岔路口。鼓励迈出一步，还是按自己的节奏慢慢来？',
          kind: 'chain',
          chainId: c.id,
          created: w.time,
        });
    }
  }
}
export function maybeStartChain(w: World) {
  if (w.chains.filter((c) => c.status === 'active').length >= 3 || random(w) > 0.1) return;
  const d = chains.find(
    (d) =>
      d.scene === w.activity.scene &&
      (d.id !== 'umbrella' || Math.floor(w.time / DAY) % 4 === 0) &&
      !w.chains.some((c) => c.id === d.id),
  );
  if (!d) return;
  const e = record(w, d.title, d.nodes[0], '连锁剧情', true, `chain-${d.id}-0`);
  rememberEvent(w, e, 75);
  w.chains.push({
    id: d.id,
    stage: 1,
    due: w.time + d.delayDays * DAY,
    origin: e.id,
    status: 'active',
  });
}
export function resolveChain(w: World, id: string, encourage: boolean) {
  const c = w.chains.find((c) => c.id === id),
    d = chains.find((d) => d.id === id);
  if (!c || !d || c.status !== 'active') return;
  const positive = encourage && w.character.traits[d.trait] + random(w) * 50 > 45;
  const e = record(
    w,
    `${d.title} · ${positive ? '新的开始' : '自己的节奏'}`,
    positive ? d.positive : d.quiet,
    '连锁剧情',
    true,
    `chain-${id}-end`,
    c.npcId,
    c.origin,
  );
  rememberEvent(w, e, 90);
  c.status = positive ? 'complete' : 'declined';
  w.character.goalProgress = clamp(w.character.goalProgress + (positive ? 5 : 2));
  if (d.reward === 'skill') w.character.skill = clamp(w.character.skill + 3);
  if (d.reward === 'friend') {
    const n = w.npcs.find((n) => n.relation.familiarity > 0) || w.npcs[0];
    n.relation.familiarity = clamp(n.relation.familiarity + 8);
    n.relation.trust = clamp(n.relation.trust + 5);
  }
  if (d.reward === 'item' && w.items.length < 30)
    w.items.push({
      id: `keepsake-${id}`,
      name: d.id === 'seed' ? '交换来的小盆栽' : '修好的旧物',
      description: e.text.slice(0, 200),
      acquired: w.time,
      source: e.id,
      uses: 0,
      anchor: d.id === 'seed' ? 'plant' : 'shelf',
    });
  w.decisions = w.decisions.filter((d) => d.chainId !== id);
}
