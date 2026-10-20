import { habits } from '../content/living';
import { type World, dayKey, sceneNames, realDate } from './model';
export function closeDay(w: World, date: string) {
  if (w.diaries.some((d) => d.date === date)) return;
  const es = w.events.filter((e) => dayKey(e.time) === date);
  const practice = es
    .filter((e) => e.category === '职业日常' || e.category === '学习与生活')
    .slice(-2);
  const selected = [
    ...practice,
    ...es.filter((e) => e.important),
    ...es.filter((e) => !e.important),
  ]
    .filter((e, i, a) => a.findIndex((x) => x.title === e.title) === i)
    .slice(0, 8)
    .sort((a, b) => a.time - b.time);
  const tone =
    w.character.traits.sensitivity > 70
      ? '我想把这些小事慢慢记住。'
      : w.character.traits.discipline > 70
        ? '一点一点，今天也有了自己的进度。'
        : '平凡的一天，也有值得收藏的小事。';
  const body = selected.length
    ? selected.map((e) => e.text).join('\n\n')
    : `今天按自己的节奏生活，吃饭、休息，照顾好自己。`;
  w.diaries.push({
    date,
    title: `${w.character.name}的${date.slice(5).replace('-', '月')}日`,
    body: `${body}\n\n${w.living.habits
      .filter((h) => h.formed && dayKey(h.last) === date)
      .slice(0, 2)
      .map((h) => habits.find((d) => d.id === h.id)?.diary)
      .join(' ')}\n${tone}\n还想继续努力：${w.character.goal}。`,
    mood: w.needs.mood >= 65 ? '晴朗' : w.needs.mood >= 40 ? '平静' : '需要休息',
    eventIds: selected.map((e) => e.id),
    places: [...new Set(selected.map((e) => e.scene))],
    people: [...new Set(selected.flatMap((e) => (e.npcId ? [e.npcId] : [])))],
  });
  w.diaries = w.diaries.slice(-400);
}
export function playerDraft(w: World, date: string) {
  const memories = w.memories
    .filter((m) => m.subject === 'player' && realDate(m.timestamp) === date)
    .map((m) => `我曾分享：“${m.content}”`);
  const acts = w.playerActivities
    .filter((a) => realDate(a.start) === date)
    .map((a) =>
      a.confirmedMinutes !== undefined
        ? `我确认进行了${a.label}，实际${a.confirmedMinutes}分钟。${a.note || ''}`
        : a.returned
          ? `原计划${a.label}${a.expectedMinutes}分钟，${Math.round((a.returned - a.start) / 60000)}分钟后返回游戏；实际活动时长未确认。`
          : `计划${a.label}${a.expectedMinutes}分钟，完成情况尚未确认。`,
    );
  return [...memories, ...acts].join('\n\n');
}
export function diaryPlaces(w: World, date: string) {
  return (
    w.diaries
      .find((d) => d.date === date)
      ?.places.map((p) => sceneNames[p])
      .join(' · ') || ''
  );
}
