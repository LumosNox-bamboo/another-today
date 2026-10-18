import { type World, type Activity, uid, random, record, clamp, sceneNames } from './model';
import { gifts } from '../content/living';
import { rememberEvent } from './MemoryEngine';
import { linkCause } from './EventCausalityGraph';
export function creationTick(w: World, activity: Activity) {
  if (activity !== 'create' && !(activity === 'walk' && w.character.interest === '摄影')) return;
  let c = w.living.creations.find((c) => !c.completed);
  if (!c) {
    // Keep recent full works; older completed works remain in memories and the life archive.
    if (w.living.creations.length >= 60) w.living.creations.shift();
    const kind =
      w.character.interest === '音乐' || (w.living.interests['音乐'] || 0) > 4
        ? '音乐'
        : w.character.interest === '摄影'
          ? '摄影'
          : w.character.job === '作家' || w.character.interest === '写作'
            ? '写作'
            : '绘画';
    const gift = w.living.gifts.find(
      (g) =>
        gifts.find((d) => d.id === g.definition)?.activity === 'create' &&
        g.reaction !== '不合口味但珍惜',
    );
    const source =
      gift?.source ||
      w.events.filter((e) => e.definition !== 'activity' && !e.npcId).at(-1)?.id ||
      '';
    c = {
      id: uid(w, 'creation'),
      kind,
      title: `${sceneNames[w.activity.scene]} · ${(w.living.stats.definitions['creation-complete'] || 0) + 1}`,
      started: w.time,
      progress: 0,
      seed: Math.floor(random(w) * 4294967295),
      content: `在${sceneNames[w.activity.scene]}开始的一件${kind}作品。`,
      source,
      eventId: '',
      exhibited: false,
    };
    w.living.creations.push(c);
  }
  c.progress = clamp(c.progress + 9 + w.character.traits.creativity / 15);
  if (c.progress >= 100 && !c.completed) {
    c.completed = w.time;
    const own = w.events
      .filter((e) => e.time >= c!.started && e.definition !== 'activity' && !e.npcId)
      .slice(-2);
    c.content =
      `${sceneNames[w.activity.scene]}的日子。\n${own.map((e) => e.text).join('\n')}\n${w.character.traits.sensitivity > 65 ? '我想留下那些很轻、却没有消失的感觉。' : '把观察整理好，下次可以从这里继续。'}`.slice(
        0,
        2000,
      );
    const e = record(
      w,
      `完成${c.kind}：${c.title}`,
      `把最近的观察整理成了「${c.title}」。作品已收进作品集。`,
      '创作成果',
      true,
      'creation-complete',
      undefined,
      c.source,
    );
    rememberEvent(w, e, 90);
    linkCause(w, e, c.source ? [c.source] : [], '累计多次真实创作活动');
    c.eventId = e.id;
  }
}
export function exhibitCreations(w: World) {
  const c = w.living.creations.find((c) => c.completed && !c.exhibited);
  const news = w.living.news.find(
    (n) =>
      n.expires > w.time &&
      n.effect === 'opportunity' &&
      n.activity === 'create' &&
      n.scene === w.activity.scene &&
      w.living.town.facilities[n.scene] !== 'repair',
  );
  if (!c || !news || w.activity.kind !== 'socialize') return;
  const n = w.npcs.find((n) => n.scene === w.activity.scene);
  if (!n) return;
  c.exhibited = true;
  n.relation.familiarity = clamp(n.relation.familiarity + 6);
  if (n.relation.type === '陌生人') n.relation.type = '认识的人';
  n.relation.trust = clamp(n.relation.trust + 2);
  const e = record(
    w,
    '作品与新的相遇',
    `借着「${news.title}」的机会，向${n.name}分享了「${c.title}」，听到了对方的看法。`,
    '创作成果',
    true,
    'creation-exhibition',
    n.id,
    c.eventId,
  );
  rememberEvent(w, e, 90);
  linkCause(w, e, [c.eventId, news.source], '已完成作品、正在进行的社区机会、实际相遇的居民');
}
export function giftCreation(w: World, id: string, npcId: string) {
  const c = w.living.creations.find((c) => c.id === id),
    n = w.npcs.find((n) => n.id === npcId);
  if (!c?.completed || c.giftedTo || !n || n.relation.familiarity === 0) return;
  c.giftedTo = n.id;
  const e = record(
    w,
    '把作品送给朋友',
    `将「${c.title}」送给了${n.name}，分享这段真实创作的经历。`,
    '创作成果',
    true,
    'creation-gift',
    n.id,
    c.eventId,
  );
  rememberEvent(w, e, 85);
  linkCause(w, e, [c.eventId]);
  n.memories.push(e.text);
  n.memories = n.memories.slice(-12);
  n.relation.trust = clamp(n.relation.trust + 2);
}
