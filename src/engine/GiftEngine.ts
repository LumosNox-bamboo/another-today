import { gifts } from '../content/living';
import { type World, type Activity, clamp, uid, record, DAY } from './model';
import { rememberEvent } from './MemoryEngine';
import { linkCause } from './EventCausalityGraph';
export function giveGift(w: World, id: string) {
  const d = gifts.find((g) => g.id === id);
  if (!d) throw new Error('礼物不存在');
  if (w.living.gifts.length >= 60) throw new Error('收藏已满，先陪伴现有物品吧');
  if (w.living.gifts.some((g) => g.definition === id)) throw new Error('已经收藏了这份礼物');
  const affinity = w.character.traits[d.trait];
  const reaction =
    w.character.interest === d.interest || affinity >= 65
      ? '喜欢'
      : affinity < 35
        ? '不合口味但珍惜'
        : '想试试看';
  const e = record(
    w,
    `收到${d.name}`,
    `你送来了${d.name}。${w.character.name}${reaction === '喜欢' ? '很喜欢，想找时间用一用。' : reaction === '想试试看' ? '还不太熟悉，愿意慢慢尝试。' : '暂时用不太上，但愿意保留这份心意。'}`,
    '礼物收藏',
    true,
    d.id,
  );
  rememberEvent(w, e, 85);
  linkCause(w, e, [], '玩家主动送出的礼物');
  const g = {
    id: uid(w, 'gift-instance'),
    definition: d.id,
    acquired: w.time,
    source: e.id,
    giver: '玩家',
    memory: w.memories.find((m) => m.source === e.id)!.id,
    reaction,
    uses: 0,
    growth: 0,
    followedUp: false,
  } as World['living']['gifts'][number];
  w.living.gifts.push(g);
  w.living.interests[d.interest] = clamp(
    (w.living.interests[d.interest] || 0) + (reaction === '喜欢' ? 5 : 1),
  );
  return g;
}
export function giftBias(w: World, activity: Activity) {
  const items = w.living.gifts.reduce((sum, g) => {
    const d = gifts.find((d) => d.id === g.definition)!;
    return (
      sum +
      (d.activity === activity
        ? g.reaction === '喜欢'
          ? 5
          : g.reaction === '想试试看'
            ? 3
            : 0
        : 0)
    );
  }, 0);
  const practiced = Object.entries(w.living.interests).reduce(
    (sum, [interest, value]) =>
      sum +
      (gifts.some((g) => g.interest === interest && g.activity === activity) ? value * 0.08 : 0),
    0,
  );
  return Math.min(20, items + practiced);
}
export function useGifts(w: World, activity: Activity) {
  for (const g of w.living.gifts) {
    const d = gifts.find((d) => d.id === g.definition)!;
    if (d.activity !== activity || g.reaction === '不合口味但珍惜') continue;
    g.uses++;
    w.living.interests[d.interest] = clamp((w.living.interests[d.interest] || 0) + 0.35);
    if (d.category === '植物')
      g.growth = clamp(g.growth + (w.living.calendar.season === '冬' ? 1 : 3));
    if (g.uses >= 4 && w.time - g.acquired >= DAY && !g.followedUp) {
      g.followedUp = true;
      const e = record(
        w,
        `${d.name}的后来`,
        d.followUp,
        '礼物收藏',
        true,
        `${d.id}-follow`,
        undefined,
        g.source,
      );
      rememberEvent(w, e, 80);
      linkCause(w, e, [g.source], '反复使用礼物之后出现的变化');
    }
  }
}

export function practiceInterests(w: World, activity: Activity) {
  const interest =
    activity === 'read'
      ? '阅读'
      : activity === 'garden'
        ? '园艺'
        : activity === 'walk'
          ? '运动'
          : activity === 'study'
            ? '学习'
            : activity === 'create'
              ? w.character.interest === '音乐'
                ? '音乐'
                : w.character.job === '作家' || w.character.interest === '写作'
                  ? '写作'
                  : '绘画'
              : undefined;
  if (!interest) return;
  const before = w.living.interests[interest] || 0;
  w.living.interests[interest] = clamp(before + 0.12);
  if (before < 12 && w.living.interests[interest] >= 12) {
    const gift = w.living.gifts.find(
      (g) => gifts.find((d) => d.id === g.definition)?.interest === interest,
    );
    const e = record(
      w,
      `越来越愿意${interest}`,
      `在反复尝试之后，${interest}逐渐成为生活里愿意继续的一部分。`,
      '兴趣爱好',
      true,
      `interest-${interest}`,
      undefined,
      gift?.source,
    );
    rememberEvent(w, e, 75);
    linkCause(w, e, gift ? [gift.source] : [], '来自持续完成的活动，而非一次点击');
  }
}
