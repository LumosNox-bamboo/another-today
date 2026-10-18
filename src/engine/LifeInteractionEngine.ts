import { type World, type Activity, activityNames, sceneNames, clamp, HOUR, record } from './model';
import { discoveries } from '../content/places';
import { gifts } from '../content/living';
import { revealSecret } from './SecretEngine';
export const lifePrompts = [
  '你的新朋友呢？',
  '给我看看收藏',
  '最近有什么作品？',
  '最近有什么烦恼？',
  '愿意说说心事吗？',
  '讲讲过去的记忆',
  '介绍一下这座城市',
  '最近去了哪里？',
  '讲讲散步见闻',
  '回顾我们的共同经历',
  '建议你多阅读',
  '你可以按自己的节奏来',
];
export function lifeReply(w: World, s: string): string | undefined {
  if (/新朋友|你的朋友/.test(s)) {
    const n = w.npcs
      .filter((n) => n.relation.familiarity > 0)
      .sort((a, b) => b.relation.familiarity - a.relation.familiarity)
      .slice(0, 3);
    return n.length
      ? `我认识了${n.map((n) => `${n.name}，是一位${n.job}，喜欢${n.interest}`).join('；')}。`
      : '还在慢慢认识街区的人，没有新的朋友可介绍。';
  }
  if (/最近去了哪里|去过哪里|散步见闻/.test(s)) {
    const entries = Object.entries(w.living.exploration.visits)
      .sort((a, b) => b[1].last - a[1].last)
      .slice(0, 3);
    const latest = w.living.exploration.discoveries.at(-1);
    const d = discoveries.find((d) => d.id === latest?.id);
    return entries.length
      ? `最近去过${entries.map(([scene]) => sceneNames[scene as keyof typeof sceneNames]).join('、')}。${d ? `我在见闻手册里留下了「${d.name}」：${d.text}` : '还在慢慢熟悉这些地方。'}`
      : '还没有亲自去过街区外的新地方。等有空，我想慢慢走一走。';
  }
  if (/收藏|礼物/.test(s)) {
    const recent = w.living.exploration.discoveries
      .slice(-2)
      .map((d) => discoveries.find((x) => x.id === d.id)?.name);
    if (recent.length)
      return `这几次出门，我在见闻手册留下了${recent.join('、')}。它们各有真正到访的日期，可以在世界里的“散步与见闻”看看。`;
    return w.living.gifts.length
      ? `我留着这些心意：${w.living.gifts
          .slice(-3)
          .map((g) => `${gifts.find((d) => d.id === g.definition)?.name}（${g.reaction}）`)
          .join('、')}。`
      : `现在最熟悉的是${w.items
          .slice(0, 3)
          .map((i) => i.name)
          .join('、')}。`;
  }
  if (/作品|画了什么/.test(s)) {
    const c = w.living.creations.filter((c) => c.completed).at(-1);
    return c
      ? `最近完成了${c.kind}「${c.title}」。可以在世界里的作品集看看。`
      : '还没有完成的作品，想先按自己的节奏练习。';
  }
  if (/你的烦恼|你.*烦恼|最近有什么烦恼/.test(s))
    return w.needs.stress > 45
      ? `最近压力是 ${Math.round(w.needs.stress)}，想在${activityNames[w.activity.kind]}之后留一点休息时间。`
      : w.decisions.length
        ? `正在考虑：${w.decisions[0].text}。有空可以在今天页面给我一点建议。`
        : '这会儿没有特别想说的烦恼，正在照顾自己的日常。';
  if (/心事|秘密/.test(s)) return revealSecret(w);
  if (/过去的记忆|以前的事/.test(s)) {
    const m = w.memories.filter((m) => m.subject !== 'player').slice(-5)[0];
    return m ? `我还记得：${m.content}` : '刚来到这里，还在积累自己的记忆。';
  }
  if (/城市|街区介绍/.test(s))
    return `这里是梧桐街，有${Object.values(sceneNames).join('、')}。现在是${w.living.calendar.season}天。${w.living.news.at(-1)?.text || '街区的安排会慢慢更新。'}`;
  if (/共同经历|我们的回忆/.test(s)) {
    const a = w.playerActivities.filter((a) => a.confirmedMinutes !== undefined).at(-1);
    const m = w.memories.filter((m) => m.subject === 'player').at(-1);
    return [
      a
        ? `你确认过一次${a.label}，实际 ${a.confirmedMinutes} 分钟。`
        : '还没有确认过的共同活动记录。',
      m ? `你还明确让我记住：“${m.content}”。` : '没有额外保存你的生活信息。',
    ].join('');
  }
  const suggestion: [RegExp, Activity][] = [
    [/建议你.*(读|阅读)/, 'read'],
    [/建议你.*(休息|慢)/, 'rest'],
    [/建议你.*(创作|画)/, 'create'],
    [/建议你.*(散步|运动)/, 'walk'],
  ];
  const match = suggestion.find(([re]) => re.test(s));
  if (match) {
    w.flags.suggestion = match[1];
    w.flags.suggestionUntil = w.time + 3 * HOUR;
    record(
      w,
      '收到一条生活建议',
      `你建议可以多${activityNames[match[1]]}。会在照顾基本需求之后，考虑自己的安排。`,
      '玩家互动',
      false,
      'player-advice',
    );
    return `我会把${activityNames[match[1]]}放进考虑里，也看看自己的精力和安排。`;
  }
  if (/你可以按自己的节奏|我支持你|你不用着急/.test(s)) {
    const key = 'support-day',
      date = Math.floor(w.time / (24 * HOUR));
    if (w.flags[key] !== date) {
      w.flags[key] = date;
      w.needs.stress = clamp(w.needs.stress - 3);
    }
    return '谢谢你愿意给我一点空间。我会按自己的节奏继续，也照顾好自己。';
  }
}
