import { type World, HOUR, realDate, uid, sceneNames, activityNames } from './model';
import { linkedOpportunity } from './PlayerLinkedEventEngine';
export function scheduleInteraction(w: World, now: number) {
  const l = w.living,
    settings = l.notifications,
    date = realDate(now),
    h = new Date(now).getHours();
  // Real-day limits apply even during accelerated/offline simulation. Clock rollback cannot reset them.
  if (l.interactionDay && date < l.interactionDay) return;
  if (date !== l.interactionDay) {
    l.interactionDay = date;
    l.ordinaryCount = 0;
    l.notificationCount = 0;
  }
  if (
    !settings.enabled ||
    settings.dnd ||
    h < 8 ||
    h >= 22 ||
    w.playerActivities.some((a) => !a.returned) ||
    l.notificationCount >= settings.dailyLimit
  )
    return;
  const gap =
    ((w.character.traits.extraversion > 65 ? 3 : 5) +
      (w.companion.familiarity < 10 ? 1 : 0) +
      (w.needs.mood < 40 || w.needs.stress > 65 ? 1 : 0)) *
    HOUR;
  if (now - l.lastInteraction < gap) return;
  const seen = (source: string) => l.interactions.some((i) => i.source === source);
  const candidate = linkedOpportunity(w, now);
  const birthday = candidate?.kind === '生日' ? candidate : undefined;
  const recent = birthday
    ? undefined
    : w.events
        .filter(
          (e) =>
            e.important &&
            e.definition !== 'arrival' &&
            w.time - e.time <= 2 * 86400000 &&
            !seen(e.id),
        )
        .at(-1);
  if (
    !recent &&
    !birthday &&
    l.ordinaryCount >=
      Math.min(settings.ordinaryLimit, w.character.traits.extraversion < 30 ? 1 : 3)
  )
    return;
  const linked = birthday || (!recent && w.companion.familiarity >= 2 ? candidate : undefined);
  const fact = w.events.filter((e) => e.definition !== 'activity' && !seen(e.id)).at(-1);
  const advice = w.decisions.find((d) => !seen(d.id));
  const text = recent
    ? `有件事想与你分享：${recent.text}`
    : linked?.text ||
      (advice
        ? `有个想法还在考虑：${advice.text}。你有空时，可以在今天页面给我建议；我会继续自己的生活。`
        : fact
          ? `今天记下了一件小事：${fact.text}。有空时可以一起聊聊。`
          : `我现在在${sceneNames[w.activity.scene]}${activityNames[w.activity.kind]}。${w.needs.stress > 55 ? '打算留一点时间休息。' : '你有空时，欢迎来看看。'}`);
  const source = recent?.id || linked?.source || advice?.id || fact?.id || `hello-${date}`;
  if (seen(source) && !linked) return;
  l.interactions.push({
    id: uid(w, 'interaction'),
    time: now,
    kind: recent ? '重要分享' : linked?.kind || (advice ? '想听听建议' : '生活分享'),
    text,
    source,
    important: !!recent || !!birthday,
    read: false,
  });
  l.interactions = l.interactions.slice(-60);
  if (linked) l.topicAsked[linked.source] = now;
  l.lastInteraction = now;
  l.notificationCount++;
  if (!recent && !birthday) l.ordinaryCount++;
}
