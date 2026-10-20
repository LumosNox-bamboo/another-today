import { type World, uid, random, HOUR, realDate, sceneNames, activityNames } from './model';
const gentle = [
  '不必把每一分钟都填满，留一点空白也很好。',
  '今天的小纸条没有待办，只有一句：记得伸个懒腰。',
  '如果这会儿有点累，就把下一步缩小一点。',
  '有些日子适合往前走，有些日子适合坐一会儿。',
  '这张纸很小，装不下整个世界，倒是刚好放得下一声你好。',
  '给今天留一个不需要表现很好的角落吧。',
  '我把句号画成了小太阳。看，连标点也能休个假。',
  '不用回复这张纸条，去过你的今天就好。',
];
export function scheduleNote(w: World, now: number) {
  const s = w.living.notifications;
  if (!s.enabled || s.dnd || w.playerActivities.some((a) => !a.returned)) return;
  const last = w.notes?.at(-1);
  if (last && (now - last.time < 4 * HOUR || now < last.time)) return;
  if (
    (w.notes || []).filter((n) => realDate(n.time) === realDate(now)).length >=
    Math.min(2, s.dailyLimit)
  )
    return;
  if (w.living.notificationCount >= s.dailyLimit && w.living.interactionDay === realDate(now))
    return;
  const h = new Date(now).getHours();
  if (h < 8 || h >= 22) return;
  w.notes ??= [];
  const recent = w.events
    .filter((e) => !w.notes!.some((n) => n.source === e.id) && w.time - e.time < 2 * 86400000)
    .at(-1);
  const roll = random(w);
  const text =
    recent && roll < 0.5
      ? `想把这件小事写给你：${recent.text}`
      : roll < 0.75
        ? `我这会儿在${sceneNames[w.activity.scene]}${activityNames[w.activity.kind]}。${w.needs.energy < 30 ? '有些累了，接下来想休息一下。' : '先给你留一张纸条，再接着过今天。'}`
        : gentle[Math.floor(random(w) * gentle.length)];
  w.notes.push({
    id: uid(w, 'note'),
    residentId: w.household.active,
    author: w.character.name,
    time: now,
    text,
    source: recent && roll < 0.5 ? recent.id : undefined,
    read: false,
  });
  w.notes = w.notes.slice(-100);
  if (w.living.interactionDay !== realDate(now)) {
    w.living.interactionDay = realDate(now);
    w.living.notificationCount = 0;
    w.living.ordinaryCount = 0;
  }
  w.living.notificationCount++;
}
