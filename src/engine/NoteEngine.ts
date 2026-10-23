import { resident } from './HouseholdEngine';
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
  // Oldest sender first: inactive members also get turns within the shared notification budget.
  const candidates = [
    w.household.active,
    ...w.household.members.map((m) => m.id).filter((id) => id !== w.household.active),
  ];
  const lastSent = (id: string) =>
    w.notes!.filter((n) => n.residentId === id).at(-1)?.time ?? -Infinity;
  candidates.sort((a, b) => lastSent(a) - lastSent(b));
  const senderId = candidates[0];
  const sender = resident(w, senderId);
  if (!sender) return;
  const traits = sender.character.traits;
  const styles = [
    {
      weight: traits.discipline,
      text: '我喜欢把事情一件件做完。不过今天没做完的，也可以留给明天。',
    },
    { weight: traits.extraversion, text: '嘿，给你递张小纸条！突然想跟你打个招呼，有空再聊呀。' },
    {
      weight: 100 - traits.extraversion,
      text: '有些话写下来比说出来容易。安静地给你留一句：今天也好。',
    },
    {
      weight: traits.curiosity,
      text: '我总忍不住想问为什么。你最近有没有遇到一件想弄明白的小事？',
    },
    {
      weight: traits.romance,
      text: '要是今天有一个颜色，我想慢慢挑。也给你的今天留一点好看的空白。',
    },
    {
      weight: traits.independence,
      text: '我先按自己的节奏过今天。你也照你的来，不必为了陪我打乱计划。',
    },
    {
      weight: traits.creativity,
      text: '想在纸条边上画点什么，又觉得留白也不错。这算不算一幅极简作品？',
    },
  ];
  let pick = random(w) * styles.reduce((sum, style) => sum + style.weight, 0);
  const voice = styles.find((style) => (pick -= style.weight) < 0)?.text || gentle[0];
  const recent = sender.events
    .filter((e) => !w.notes!.some((n) => n.source === e.id) && w.time - e.time < 2 * 86400000)
    .at(-1);
  const roll = random(w);
  const text =
    recent && roll < 0.5
      ? `想把这件小事写给你：${recent.text} ${voice}`
      : roll < 0.75
        ? `我这会儿在${sceneNames[sender.activity.scene]}${activityNames[sender.activity.kind]}。${sender.needs.energy < 30 ? '有些累了，接下来想休息一下。' : voice}`
        : voice;
  w.notes.push({
    id: uid(w, 'note'),
    residentId: senderId,
    author: sender.character.name,
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
