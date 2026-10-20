import { maybeNPCGift } from './ExchangeEngine';
import { npcHasOtherPartner } from './HouseholdEngine';
import { destinations } from '../content/places';
import { destinationOpen } from './ExplorationEngine';
import { npcLifeTick } from './NPCLifeEngine';
import { openScene } from './TownNewsEngine';
import {
  type World,
  type NPC,
  clamp,
  dayKey,
  hour,
  random,
  record,
  DAY,
  sceneNames,
} from './model';
import { rememberEvent } from './MemoryEngine';
export function npcTick(w: World) {
  npcLifeTick(w);
  const h = hour(w.time),
    day = dayKey(w.time),
    weekend = [0, 6].includes(new Date(w.time).getUTCDay());
  for (const [i, n] of w.npcs.entries()) {
    if (n.job === '便利店店员' && (h >= 22 || h < 6)) n.scene = 'shop';
    else if (h < 7 || h >= 23) n.scene = 'apartment';
    else if (h >= 9 && h < 17 && !weekend && n.job !== '无业者')
      n.scene =
        n.job === '咖啡师'
          ? 'cafe'
          : n.job === '学生'
            ? 'library'
            : n.job === '便利店店员'
              ? 'shop'
              : 'office';
    else
      n.scene = (['park', 'cafe', 'library', 'street', 'apartment'] as const)[
        (Math.floor(h / 2) + i + Math.floor(w.time / DAY)) % 5
      ];
    if (
      h >= 7 &&
      h < 23 &&
      (weekend || h < 9 || h >= 17 || n.job === '无业者') &&
      !(n.job === '便利店店员' && h >= 22)
    ) {
      const places = destinations.filter((d) => destinationOpen(w, d));
      const choice = Math.floor(h / 2) + i + Math.floor(w.time / DAY);
      const favorite = places.find((d) => d.interests.includes(n.interest));
      if (places.length && choice % 3 !== 0)
        n.scene = (favorite || places[choice % places.length]).scene;
    }
    if (w.living.calendar.season === '冬' && n.scene === 'park') n.scene = 'cafe';
    const gathering = w.living.news.find((x) => x.effect === 'gathering' && x.expires > w.time);
    if (gathering && h >= 17 && h < 19 && i % 3 === 0) {
      const d = destinations.find((d) => d.scene === gathering.scene);
      if (!d || destinationOpen(w, d)) n.scene = gathering.scene as typeof n.scene;
    }
    n.scene = openScene(w, n.scene);
    n.plan =
      n.scene === 'apartment'
        ? '在家休息'
        : n.scene === 'office'
          ? '处理自己的工作'
          : n.scene === 'library'
            ? '阅读和学习'
            : `在${sceneNames[n.scene]}度过自己的时间`;
    if (w.flags[`npc-day-${n.id}`] !== day) {
      w.flags[`npc-day-${n.id}`] = day;
      if (random(w) < 0.16) {
        const life = [
          '尝试了一道新菜',
          '为自己的房间换了窗帘',
          '开始学习一项新技能',
          '计划下个月搬家',
          '给家人打了一通电话',
          '帮助照看朋友的小猫',
        ][Math.floor(random(w) * 6)];
        n.memories.push(`${day}：${life}`);
        n.memories = n.memories.slice(-12);
      }
    }
  }
}
export function encounter(w: World, n?: NPC) {
  const available = w.npcs.filter((x) => x.scene === w.activity.scene);
  n ??= available[Math.floor(random(w) * available.length)];
  if (!n) return;
  const r = n.relation,
    first = r.familiarity === 0;
  r.familiarity = clamp(r.familiarity + 4);
  const compatible = 100 - Math.abs(n.traits.openness - w.character.traits.openness);
  const nice = random(w) < 0.6 + compatible / 500;
  r.affection = clamp(r.affection + (nice ? 3 : -2));
  r.trust = clamp(r.trust + (nice ? 2 : -1));
  r.conflict = clamp(r.conflict + (nice ? -2 : 4));
  r.intimacy = clamp(r.intimacy + (nice ? 1 : 0));
  if (!['恋人', '前任', '家人'].includes(r.type))
    r.type = r.familiarity > 60 && r.trust > 50 ? '好友' : r.familiarity > 24 ? '朋友' : '认识的人';
  const e = record(
    w,
    first ? `认识了${n.name}` : nice ? `和${n.name}聊了聊` : `与${n.name}的小分歧`,
    first
      ? `在${w.activity.scene === 'cafe' ? '咖啡馆' : '街区'}认识了${n.name}，对方是一位${n.job}，喜欢${n.interest}。`
      : nice
        ? `和${n.name}聊起了${n.interest}，相处得很自在。`
        : `和${n.name}意见不同，决定留一点空间，过后再谈。`,
    '社交',
    first,
    'encounter',
    n.id,
  );
  if (nice && !first) maybeNPCGift(w, n);
  if (first || r.familiarity % 16 < 4) rememberEvent(w, e, first ? 70 : 45);
  if (r.familiarity > 40 && r.affection > 60 && nice) r.dates++;
  if (
    w.character.age >= 18 &&
    n.age >= 18 &&
    !npcHasOtherPartner(w, n.id) &&
    r.dates >= 3 &&
    r.trust > 45 &&
    r.intimacy > 20 &&
    n.traits.romance > 45 &&
    w.character.traits.romance > 45 &&
    !w.npcs.some((x) => x.relation.type === '恋人') &&
    !w.living.npcBonds.some((b) => b.status === '恋人' && (b.a === n.id || b.b === n.id)) &&
    !['恋人', '前任'].includes(r.type) &&
    !w.decisions.some((d) => d.npcId === n!.id) &&
    !w.flags[`romance-${n.id}`]
  ) {
    w.flags[`romance-${n.id}`] = true;
    w.decisions.push({
      id: `romance-${n.id}`,
      kind: 'romance',
      npcId: n.id,
      title: `和${n.name}更近一点？`,
      text: `几次愉快的相处后，${w.character.name}想问问对方的心意。亲密关系仍需要双方愿意。`,
      created: w.time,
    });
  }
  if (
    r.type === '恋人' &&
    r.conflict > 70 &&
    !w.decisions.some((d) => d.id === `conflict-${n!.id}`)
  )
    w.decisions.push({
      id: `conflict-${n.id}`,
      kind: 'romance',
      npcId: n.id,
      title: '这段关系需要谈谈',
      text: `与${n.name}累积了一些分歧。可以主动沟通，也可以尊重彼此，结束这段关系。`,
      created: w.time,
    });
}
