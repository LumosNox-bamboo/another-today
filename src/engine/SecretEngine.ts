import { secrets } from '../content/living';
import { type World, type Activity, DAY, random, record, clamp } from './model';
import { rememberEvent } from './MemoryEngine';
import { linkCause } from './EventCausalityGraph';
export function secretBias(w: World, activity: Activity) {
  return w.living.secrets.some(
    (s) =>
      ['hidden', 'shared'].includes(s.status) &&
      secrets.find((d) => d.id === s.id)?.activity === activity,
  )
    ? 9
    : 0;
}
export function secretsTick(w: World, activity: Activity) {
  for (const s of w.living.secrets) {
    const d = secrets.find((d) => d.id === s.id)!;
    if (!['hidden', 'shared'].includes(s.status)) continue;
    if (w.time > s.expires) {
      s.status = 'expired';
      continue;
    }
    if (d.activity === activity) s.progress = clamp(s.progress + 4);
    if (s.status === 'hidden' && s.progress >= 30 && w.companion.trust >= 35) revealSecret(w, s.id);
    if (s.progress >= 100) {
      s.status = 'resolved';
      const e = record(w, d.title, d.end, '隐藏秘密', true, `${s.id}-end`, undefined, s.source);
      rememberEvent(w, e, 85);
      linkCause(w, e, [s.source], '持续独立练习之后完成');
    }
  }
  if (
    w.living.secrets.filter((s) => ['hidden', 'shared'].includes(s.status)).length >= 2 ||
    random(w) > 0.025
  )
    return;
  const candidates = secrets.filter(
    (d) =>
      d.activity === activity &&
      w.character.traits[d.trait] >= 45 &&
      !w.living.secrets.some((s) => s.id === d.id),
  );
  const d = candidates[Math.floor(random(w) * candidates.length)];
  if (!d) return;
  w.living.secrets.push({
    id: d.id,
    started: w.time,
    expires: w.time + d.days * DAY,
    progress: 0,
    status: 'hidden',
    source: w.events.at(-1)?.id || 'arrival',
  });
}
export function revealSecret(w: World, id?: string) {
  const s = w.living.secrets.find((s) => s.status === 'hidden' && (!id || s.id === id));
  if (!s) return '暂时没有想补充的心事。';
  if (w.companion.trust < 35 || s.progress < 20)
    return '有一点还没想清楚的事，等准备好了再告诉你。';
  const d = secrets.find((d) => d.id === s.id)!;
  s.status = 'shared';
  s.revealed = w.time;
  const e = record(
    w,
    `愿意分享的心事：${d.title}`,
    d.reveal,
    '隐藏秘密',
    true,
    `${s.id}-reveal`,
    undefined,
    s.source,
  );
  rememberEvent(w, e, 80);
  linkCause(w, e, [s.source], '准备好并且有足够信任之后主动分享');
  s.source = e.id;
  return d.reveal;
}
