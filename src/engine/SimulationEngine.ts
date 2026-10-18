import { maybeStartArc, arcsTick } from './StoryArcEngine';
import { creationTick, exhibitCreations } from './CreationEngine';
import { dreamsTick } from './RegretAndDreamEngine';
import { giftBias, useGifts, practiceInterests } from './GiftEngine';
import { habitBias, practiceHabits, decayHabits } from './HabitEngine';
import { secretBias, secretsTick } from './SecretEngine';
import { seasonTick, seasonBias } from './SeasonEngine';
import { newsTick, townBias, openScene } from './TownNewsEngine';
import { trackShared } from './SharedActivityEngine';
import {
  type World,
  type Activity,
  type Scene,
  STEP,
  MINUTE,
  HOUR,
  DAY,
  hour,
  dayKey,
  clamp,
  random,
  record,
  transact,
  activityNames,
} from './model';
import { closeDay } from './DiaryEngine';
import { npcTick, encounter } from './NPCSimulationEngine';
import { sampleEvent } from './EventEngine';
import { advanceChains, resolveChain } from './EventChainEngine';
import { evolve } from './TraitEvolutionEngine';
import { rememberEvent } from './MemoryEngine';
export function isWorking(w: World) {
  const h = hour(w.time),
    job = w.character.job;
  if (job === '无业者') return false;
  if (job === '便利店店员') return h >= 22 || h < 6;
  if ([0, 6].includes(new Date(w.time).getUTCDay())) return false;
  return h >= 9 && h < 17;
}
function sleepHours(w: World) {
  const nightShift = w.character.job === '便利店店员';
  return nightShift
    ? { start: 8, end: 15 }
    : w.character.traits.discipline < 35
      ? { start: 1, end: 9 }
      : w.character.traits.discipline > 75
        ? { start: 22, end: 6 }
        : { start: 23, end: 7 };
}
export function chooseActivity(w: World) {
  const n = w.needs,
    t = w.character.traits,
    h = hour(w.time),
    sleep = sleepHours(w);
  const sleepTime =
    sleep.start < sleep.end ? h >= sleep.start && h < sleep.end : h >= sleep.start || h < sleep.end;
  const scores: Record<Activity, number> = {
    sleep: (100 - n.energy) * 1.1 + (sleepTime ? 160 : -40),
    wash: 15 + (h >= 7 && h < 8 ? 70 : 0),
    eat: n.hunger * 1.5,
    work: isWorking(w) ? 95 + t.discipline * 0.35 : -180,
    read: 30 + t.curiosity * 0.35 + (100 - n.fun) * 0.3,
    create: 25 + t.creativity * 0.45,
    study: 20 + t.discipline * 0.3 + t.curiosity * 0.2,
    socialize: n.social * 0.7 + t.extraversion * 0.5,
    walk: 25 + n.stress * 0.55 + t.adventure * 0.2,
    play: 20 + (100 - n.fun) * 0.8,
    garden: 20 + t.kindness * 0.25,
    shop: 10,
    rest: (100 - n.energy) * 0.65 + n.stress * 0.4,
    coffee: 15 + t.extraversion * 0.3,
  };
  if (n.energy < 12) scores.sleep += 180;
  if (n.hunger > 85) scores.eat += 200;
  if (w.character.interest === '阅读') scores.read += 20;
  if (w.character.interest === '绘画') scores.create += 20;
  if (w.character.interest === '运动') scores.walk += 20;
  if (w.character.interest === '音乐') scores.play += 12;
  if (w.character.goal.includes('书') || w.character.goal.includes('作品')) scores.create += 15;
  if (w.character.goal.includes('咖啡')) scores.coffee += 20;
  if (w.character.goal.includes('世界')) {
    scores.walk += 20;
    scores.socialize += 15;
  }
  if (w.character.goal.includes('储蓄')) {
    scores.work += 15;
    scores.shop -= 15;
    scores.coffee -= 10;
  }
  const washWindow = w.character.job === '便利店店员' ? h >= 15 && h < 18 : h >= 6 && h < 10;
  scores.wash = w.flags.lastWash === dayKey(w.time) ? -100 : washWindow ? 125 : 5;
  if (w.time - Number(w.flags.lastShop ?? w.time) > 2 * DAY && w.money > 30) scores.shop += 60;
  if (w.time - Number(w.flags.lastGarden ?? w.time) > DAY) scores.garden += 20;
  if (w.items.some((i) => i.anchor === 'shelf')) scores.read += 5;
  if (w.items.some((i) => i.anchor === 'plant')) scores.garden += 5;
  const recent = w.events.slice(-8);
  if (recent.some((e) => e.category === '工作职业' && e.title.includes('倦怠'))) scores.rest += 20;
  if (w.memories.some((m) => m.scene === 'cafe' && m.importance >= 70)) scores.coffee += 8;
  if (w.npcs.some((n) => n.scene === 'park' && n.relation.type === '朋友')) scores.walk += 7;
  if (Math.floor(w.time / DAY) % 4 === 0) {
    scores.walk -= 20;
    scores.read += 10;
  }
  if (w.flags.suggestion && Number(w.flags.suggestionUntil) > w.time)
    scores[w.flags.suggestion as Activity] += 40;
  for (const kind of Object.keys(scores) as Activity[])
    scores[kind] +=
      giftBias(w, kind) +
      habitBias(w, kind) +
      secretBias(w, kind) +
      seasonBias(w, kind) +
      townBias(w, kind);
  for (const kind of w.recentActivities.slice(-3)) scores[kind] -= 25;
  const kinds = (Object.keys(scores) as Activity[]).filter((k) => k !== 'work' || isWorking(w));
  // Softmax allows lower-scoring but reasonable activities; urgent needs remain deterministic.
  const peak = Math.max(...Object.values(scores)),
    weights = kinds.map((k) => Math.exp((scores[k] - peak) / 18));
  let pick = random(w) * weights.reduce((a, b) => a + b, 0),
    best: Activity = kinds[kinds.length - 1];
  for (let i = 0; i < kinds.length; i++) {
    pick -= weights[i];
    if (pick <= 0) {
      best = kinds[i];
      break;
    }
  }
  if (sleepTime || n.energy < 12) best = 'sleep';
  if (n.hunger > 90) best = 'eat';
  let duration: number = 30 + Math.floor(random(w) * 7) * 5;
  if (best === 'sleep') {
    let wake = Math.floor(w.time / DAY) * DAY + sleep.end * HOUR;
    if (wake <= w.time) wake += DAY;
    duration = sleepTime ? Math.min(9 * 60, (wake - w.time) / MINUTE) : 60;
  }
  if (best === 'wash') duration = 15;
  if (best === 'work') duration = 90;
  if (best === 'eat') duration = 30;
  let scene: Scene = 'apartment';
  if (best === 'work')
    scene =
      w.character.job === '咖啡师'
        ? 'cafe'
        : w.character.job === '便利店店员'
          ? 'shop'
          : ['自由职业者', '插画师', '作家'].includes(w.character.job)
            ? 'apartment'
            : w.character.job === '学生'
              ? 'library'
              : 'office';
  if (best === 'read' || best === 'study') scene = random(w) < 0.55 ? 'library' : 'apartment';
  if (best === 'create') scene = random(w) < 0.2 ? 'park' : 'apartment';
  if (best === 'walk') scene = random(w) < 0.7 ? 'park' : 'street';
  if (best === 'coffee' || best === 'socialize') scene = random(w) < 0.8 ? 'cafe' : 'park';
  if (best === 'shop') scene = 'shop';
  if (best === 'rest' && h >= 19 && h < 23 && random(w) < 0.35) scene = 'night';
  scene = openScene(w, scene);
  w.activity = { kind: best, start: w.time, end: w.time + duration * MINUTE, scene };
  record(
    w,
    `${activityNames[best]}的时间`,
    `${w.character.name}开始${activityNames[best]}。`,
    '日常',
    false,
    'activity',
  );
}
function completeActivity(w: World) {
  const a = w.activity;
  if (a.kind === 'wash') w.flags.lastWash = dayKey(w.time);
  if (a.kind === 'shop') w.flags.lastShop = w.time;
  if (a.kind === 'garden') w.flags.lastGarden = w.time;
  if (a.kind === 'eat') {
    w.needs.hunger = clamp(w.needs.hunger - 65);
    transact(w, -Math.min(w.money, 8), '一餐饭');
  }
  if (a.kind === 'coffee') transact(w, -Math.min(w.money, 12), '一杯咖啡');
  if (a.kind === 'shop') transact(w, -Math.min(w.money, 18), '生活用品');
  if (['socialize', 'coffee', 'walk'].includes(a.kind)) encounter(w);
  if (a.kind === 'garden') {
    w.needs.mood = clamp(w.needs.mood + 5);
    w.items.filter((i) => i.anchor === 'plant').forEach((i) => i.uses++);
  }
  if (['read', 'study', 'create', 'work'].includes(a.kind)) {
    w.character.skill = clamp(w.character.skill + 0.12);
    w.character.goalProgress = clamp(w.character.goalProgress + 0.08);
    w.items
      .filter((i) => i.anchor === (a.kind === 'read' ? 'shelf' : 'desk'))
      .forEach((i) => i.uses++);
  }
  if (a.kind === 'read' || a.kind === 'study')
    evolve(w, 'curiosity', '持续阅读和学习，让好奇心慢慢生长。', w.events.at(-1)?.id || 'practice');
  if (a.kind === 'socialize')
    evolve(
      w,
      'extraversion',
      '多次自在的交流，让表达越来越自然。',
      w.events.at(-1)?.id || 'practice',
    );
  if (a.kind === 'create')
    evolve(
      w,
      'creativity',
      '持续创作，开始更愿意尝试自己的想法。',
      w.events.at(-1)?.id || 'practice',
    );
  if (a.kind === 'work' && !['无业者', '学生'].includes(w.character.job)) {
    const date = dayKey(w.time - (w.character.job === '便利店店员' ? 6 * HOUR : 0));
    const key = `work-${date}`;
    w.flags[key] = Number(w.flags[key] || 0) + (a.end - a.start) / MINUTE;
    if (Number(w.flags[key]) >= 180 && w.lastSalaryDay !== date) {
      w.lastSalaryDay = date;
      const pay = 150 + w.character.careerLevel * 25;
      transact(w, pay, '当日职业收入');
      record(w, '收到今天的收入', `完成工作，收到 ¥${pay} 的收入。`, '经济', true, 'salary');
    }
    if (w.character.skill > w.character.careerLevel * 18 && w.character.careerLevel < 10) {
      w.character.careerLevel++;
      record(
        w,
        '职业成长',
        `持续练习后，职业水平提升到了第 ${w.character.careerLevel} 阶段。`,
        '职业',
        true,
        'promotion',
      );
    }
  }
  if (a.kind === 'sleep' && random(w) < 0.3) {
    record(
      w,
      '昨夜的梦',
      [
        '梦见一座会移动的小图书馆，醒来后还记得书的颜色。',
        '梦见沿着河边散步，路很长，心情很轻。',
        '梦里有一间明亮的厨房，醒来时有点想吃早餐。',
      ][Math.floor(random(w) * 3)],
      '梦境',
      false,
      'dream',
    );
  }
  w.living.stats.activities[a.kind] = (w.living.stats.activities[a.kind] || 0) + 1;
  practiceInterests(w, a.kind);
  useGifts(w, a.kind);
  practiceHabits(w, a.kind);
  secretsTick(w, a.kind);
  creationTick(w, a.kind);
  exhibitCreations(w);
  dreamsTick(w, a.kind);
  maybeStartArc(w);
  sampleEvent(w);
  w.recentActivities.push(a.kind);
  w.recentActivities = w.recentActivities.slice(-12);
  if (!w.flags.careerQuestion && w.character.skill >= 25 && w.character.job !== '学生') {
    w.flags.careerQuestion = true;
    w.decisions.push({
      id: 'career-first',
      kind: 'career',
      title: '想试试另一种工作',
      text: `${w.character.name}积累了一些经验，正在考虑转为自由职业者。这会改变工作地点和作息。`,
      created: w.time,
    });
  }
  if (!w.flags.housingQuestion && w.money >= 12000) {
    w.flags.housingQuestion = true;
    w.decisions.push({
      id: 'housing-first',
      kind: 'move',
      title: '想住进更明亮的房间',
      text: '考虑搬到带阳台的小屋，搬家支出 ¥3000。生活会继续，等你有空再商量。',
      created: w.time,
    });
  }
  if (w.character.goalProgress >= 100 && !w.flags.goalComplete) {
    w.flags.goalComplete = true;
    const e = record(
      w,
      '一个愿望实现了',
      `经过长久的积累，终于完成了：${w.character.goal}。接下来，也可以继续享受普通的日子。`,
      '人生',
      true,
      'goal-complete',
    );
    rememberEvent(w, e, 100);
  }
}
function tick(w: World) {
  const n = w.needs,
    a = w.activity.kind;
  trackShared(w, a, STEP / MINUTE);
  n.hunger = clamp(n.hunger + 0.55);
  n.social = clamp(n.social + 0.18);
  n.fun = clamp(n.fun - 0.2);
  n.energy = clamp(n.energy + (a === 'sleep' ? 1.25 : a === 'rest' ? 0.5 : -0.24));
  if (a === 'work') {
    n.stress = clamp(n.stress + 0.32);
    n.fun = clamp(n.fun - 0.15);
  } else n.stress = clamp(n.stress - (a === 'sleep' ? 0.5 : 0.18));
  if (['read', 'play', 'walk', 'create', 'garden'].includes(a)) {
    n.fun = clamp(n.fun + 0.7);
    n.mood = clamp(n.mood + 0.13);
  }
  if (['socialize', 'coffee'].includes(a)) n.social = clamp(n.social - 1.2);
  if (n.hunger > 90 || n.energy < 10) n.mood = clamp(n.mood - 0.2, 15);
  else n.mood = clamp(n.mood + (65 - n.mood) * 0.002, 15);
  n.health = clamp(n.health + (n.energy > 25 && n.hunger < 80 ? 0.025 : -0.02), 35);
  seasonTick(w);
  newsTick(w);
  decayHabits(w);
  npcTick(w);
  advanceChains(w);
  arcsTick(w);
  if (w.time >= w.activity.end) {
    completeActivity(w);
    chooseActivity(w);
  } else if ((n.hunger > 94 && a !== 'eat') || (n.energy < 5 && a !== 'sleep')) {
    chooseActivity(w);
  }
}
export function advance(w: World, deltaMs: number) {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new Error('Invalid simulation interval');
  const target = w.time + deltaMs;
  if (!Number.isSafeInteger(Math.floor(target)) || target > 8640000000000000)
    throw new Error('Invalid game date');
  while (w.simulatedUntil + STEP <= target) {
    const prevDay = dayKey(w.simulatedUntil);
    w.simulatedUntil += STEP;
    w.time = w.simulatedUntil;
    if (dayKey(w.time) !== prevDay) {
      closeDay(w, prevDay);
      const today = dayKey(w.time);
      if (w.lastRentDay !== today) {
        transact(
          w,
          -Math.min(w.money, w.character.housing === '合租小屋' ? 18 : 30),
          '每日住房与公共开支',
        );
        w.lastRentDay = today;
      }
      // Keep only recent day-based habit and payroll counters; long-term story flags are retained.
      for (const k of Object.keys(w.flags)) {
        const date = k.match(/\d{4}-\d{2}-\d{2}$/)?.[0];
        if (date && date < dayKey(w.time - 40 * DAY)) delete w.flags[k];
      }
    }
    tick(w);
  }
  w.time = target;
}
export function resolveDecision(w: World, id: string, choice: 'yes' | 'no' | 'self') {
  const d = w.decisions.find((d) => d.id === id);
  if (!d) return;
  const yes = choice === 'self' ? random(w) < w.character.traits.adventure / 100 : choice === 'yes';
  if (d.kind === 'chain') {
    resolveChain(w, d.chainId!, yes);
    return;
  }
  let text = '';
  if (d.kind === 'career') {
    if (yes) {
      w.character.job = '自由职业者';
      text = '认真考虑后，决定开始自由职业的生活。';
    } else text = '决定先保留现在的工作，等准备更充分再改变。';
  }
  if (d.kind === 'move') {
    if (yes && w.money >= 3000) {
      transact(w, -3000, '搬家');
      w.character.housing = '带阳台的小屋';
      text = '搬进带阳台的小屋，把旧物件也带了过来。';
    } else text = '决定继续住在熟悉的地方，把搬家的念头留给以后。';
  }
  if (d.kind === 'romance') {
    const n = w.npcs.find((n) => n.id === d.npcId);
    if (!n) return;
    if (n.relation.type === '恋人') {
      if (yes) {
        n.relation.conflict = clamp(n.relation.conflict - 35);
        text = `和${n.name}认真沟通，决定继续照顾这段关系。`;
      } else {
        n.relation.type = '前任';
        text = `与${n.name}平静地结束了恋爱关系，尊重各自的未来。`;
      }
    } else if (
      yes &&
      n.relation.willing &&
      !w.npcs.some((x) => x.relation.type === '恋人') &&
      !w.living.npcBonds.some((b) => b.status === '恋人' && (b.a === n.id || b.b === n.id))
    ) {
      n.relation.type = '恋人';
      text = `向${n.name}表达了心意，对方也愿意试着一起走一段。`;
    } else
      text = yes
        ? `${n.name}更愿意保持友谊。坦诚之后，也尊重这份选择。`
        : `决定与${n.name}继续保持舒服的朋友关系。`;
  }
  const e = record(w, d.title, text, '人生选择', true, d.id, d.npcId);
  rememberEvent(w, e, 90);
  w.decisions = w.decisions.filter((x) => x.id !== id);
}
