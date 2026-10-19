import { reconcileWallets, syncWallet } from './WalletEngine';
import { createWorld, defaultCharacter } from '../content/people';
import {
  personalSchema,
  type World,
  type Character,
  type Traits,
  traitSchema,
  type Activity,
  type Scene,
  DAY,
  MINUTE,
  clamp,
  dayKey,
  record,
  activityNames,
  uid,
} from './model';
import { rememberEvent } from './MemoryEngine';

export const lifeStage = (age: number) =>
  age < 13 ? '儿童' : age < 18 ? '青少年' : age < 65 ? '成年' : '老年';
export const lifeRole = (c: Character) =>
  c.age < 18 ? '在校学生' : c.age >= 65 ? '退休生活' : c.job;
const sharedLiving = [
  'npcLives',
  'npcBonds',
  'news',
  'town',
  'calendar',
  'notifications',
  'interactionDay',
  'ordinaryCount',
  'notificationCount',
  'lastInteraction',
] as const;
const personalKeys = Object.keys(personalSchema.shape) as (keyof Personal)[];
type Personal = NonNullable<World['household']['members'][number]['state']>;
function capture(w: World): Personal {
  return {
    ...Object.fromEntries(personalKeys.map((k) => [k, w[k]])),
    living: Object.fromEntries(
      Object.entries(w.living).filter(([k]) => !(sharedLiving as readonly string[]).includes(k)),
    ),
  } as Personal;
}
export function npcHasOtherPartner(w: World, npcId: string) {
  return w.household.members.some(
    (m) => m.id !== w.household.active && m.relations[npcId]?.type === '恋人',
  );
}
export function initHousehold(w: World) {
  if (!w.household.members.length)
    w.household.members.push({
      id: 'resident-0',
      relations: {},
      queue: [],
      commanded: false,
      interrupted: false,
      birthday: w.time,
    });
  if (!w.household.wallets) reconcileWallets(w);
}
export function resident(w: World, id: string) {
  return id === w.household.active ? w : w.household.members.find((m) => m.id === id)?.state;
}
export function selectResident(w: World, id: string) {
  initHousehold(w);
  if (id === w.household.active) return;
  const next = w.household.members.find((m) => m.id === id);
  if (!next?.state) throw new Error('找不到这位家庭成员');
  const current = w.household.members.find((m) => m.id === w.household.active)!;
  syncWallet(w);
  current.state = capture(w);
  current.relations = Object.fromEntries(w.npcs.map((n) => [n.id, n.relation]));
  const shared = Object.fromEntries(sharedLiving.map((k) => [k, w.living[k]]));
  Object.assign(w, next.state);
  Object.assign(w.living, shared);
  for (const n of w.npcs)
    n.relation = next.relations[n.id] || {
      familiarity: 0,
      affection: 50,
      trust: 15,
      intimacy: 0,
      conflict: 0,
      type: '陌生人',
      dates: 0,
      willing: true,
    };
  next.state = undefined;
  w.household.active = id;
  w.money = w.household.wallets!.find((a) => a.members.includes(id))!.balance;
}
export function validBond(
  a: Character,
  b: Character,
  type: World['household']['bonds'][number]['type'],
) {
  if (type === '伴侣' || type === '夫妻') return a.age >= 18 && b.age >= 18;
  if (type === '亲子') return a.age - b.age >= 18;
  if (type === '祖孙') return a.age - b.age >= 36;
  return true;
}
export function setBond(
  w: World,
  a: string,
  b: string,
  type: World['household']['bonds'][number]['type'],
) {
  const x = resident(w, a),
    y = resident(w, b);
  if (!x || !y || a === b || !validBond(x.character, y.character, type))
    throw new Error('关系与年龄不符；亲子、祖孙请先选择长辈');
  if (
    type === '夫妻' &&
    w.household.bonds.some(
      (r) =>
        r.type === '夫妻' &&
        (r.a === a || r.b === a || r.a === b || r.b === b) &&
        !([r.a, r.b].includes(a) && [r.a, r.b].includes(b)),
    )
  )
    throw new Error('请先结束已有夫妻关系');
  const old = w.household.bonds.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  if (old) {
    old.a = a;
    old.b = b;
    old.type = type;
  } else w.household.bonds.push({ a, b, type, warmth: 55, conflict: 0, lastDay: '' });
  reconcileWallets(w);
}
export function addResident(
  w: World,
  name: string,
  age: number,
  type: World['household']['bonds'][number]['type'],
  savings = age >= 18 ? 1800 : 0,
) {
  initHousehold(w);
  if (!Number.isFinite(savings) || savings < 0 || savings > 1000000)
    throw new Error('初始存款应为 0–1000000');
  if (
    w.household.members.length >= 6 ||
    !name.trim() ||
    name.trim().length > 20 ||
    !Number.isInteger(age) ||
    age < 6 ||
    age > 100
  )
    throw new Error('家庭最多 6 人，年龄范围 6–100 岁');
  if (
    type === '夫妻' &&
    w.household.bonds.some(
      (b) => b.type === '夫妻' && (b.a === w.household.active || b.b === w.household.active),
    )
  )
    throw new Error('请先结束已有夫妻关系');
  const c = structuredClone(defaultCharacter);
  c.name = name.trim();
  c.housing = w.character.housing;
  c.age = age;
  c.job = age < 18 ? '学生' : age >= 65 ? '无业者' : '办公室职员';
  c.goal = age < 18 ? '学会一件新本领' : age >= 65 ? '记录生活里的美好' : '把自己的日子过好';
  c.education = age < 13 ? '小学' : age < 18 ? '中学' : '大学';
  c.outfit = ['#6f9b86', '#d5a55c', '#718db2', '#b085aa', '#d28777'][
    w.household.members.length - 1
  ];
  if (!validBond(w.character, c, type))
    throw new Error('关系与年龄不符；新增亲子或祖孙关系时，当前人物应为长辈');
  const fresh = createWorld(c, w.createdReal, w.seed);
  fresh.time = w.time;
  fresh.activity = { kind: 'rest', start: w.time, end: w.time + 30 * MINUTE, scene: 'apartment' };
  fresh.events = [];
  fresh.living.causes = [];
  fresh.living.stats.categories = {};
  fresh.living.stats.definitions = {};
  fresh.living.stats.important = 0;
  fresh.flags = { lastShop: w.time, lastGarden: w.time };
  const id = uid(w, 'resident');
  w.household.members.push({
    id,
    state: capture(fresh),
    relations: {},
    queue: [],
    commanded: false,
    interrupted: false,
    birthday: w.time,
  });
  syncWallet(w);
  w.household.wallets!.push({ members: [id], balance: Math.round(savings * 100) / 100 });
  setBond(w, w.household.active, id, type);
  record(
    w,
    '家里多了一位成员',
    `${c.name}加入了家庭，与${w.character.name}的关系是${type}。`,
    '家庭',
    true,
    'family-arrival',
  );
  return id;
}
export function canCommand(c: Character, kind: Activity) {
  return kind !== 'work' || (c.age >= 18 && c.age < 65 && !['学生', '无业者'].includes(c.job));
}
export function commandResident(w: World, id: string, kind: Activity, scene: Scene, minutes = 30) {
  initHousehold(w);
  const member = w.household.members.find((m) => m.id === id),
    p = resident(w, id);
  if (
    !member ||
    !p ||
    !canCommand(p.character, kind) ||
    member.queue.length >= 5 ||
    !Number.isInteger(minutes) ||
    minutes < 15 ||
    minutes > 180
  )
    throw new Error('无法安排这项行动，或队列已满');
  member.queue.push({ kind, scene, minutes });
  // Interrupt only autonomous work. The interrupted activity receives no completion rewards.
  if (!member.commanded) {
    p.activity.end = w.time;
    member.interrupted = true;
  }
}
export function startCommand(w: World) {
  const m = w.household.members.find((m) => m.id === w.household.active);
  if (!m) return false;
  m.commanded = false;
  if (w.needs.energy < 12 || w.needs.hunger > 90) return false;
  while (m.queue.length) {
    const cmd = m.queue.shift()!;
    if (!canCommand(w.character, cmd.kind)) continue;
    w.activity = {
      kind: cmd.kind,
      scene: cmd.scene,
      start: w.time,
      end: w.time + cmd.minutes * MINUTE,
    };
    m.commanded = true;
    record(
      w,
      '安排了一段时间',
      `${w.character.name}按你的安排开始${activityNames[cmd.kind]}。`,
      '家庭指令',
    );
    return true;
  }
  return false;
}
export function cancelCommands(w: World, id: string) {
  const m = w.household.members.find((m) => m.id === id),
    p = resident(w, id);
  if (!m || !p) return;
  m.queue = [];
  m.commanded = false;
  m.interrupted = true;
  p.activity.end = w.time;
}
export function familyTick(w: World) {
  const selected = w.household.active;
  for (const m of w.household.members) {
    selectResident(w, m.id);
    while (w.time - m.birthday >= 365 * DAY) {
      m.birthday += 365 * DAY;
      w.character.age = Math.min(100, w.character.age + 1);
      if (w.character.age === 18 || w.character.age === 65) w.character.job = '无业者';
      const e = record(
        w,
        '又长大了一岁',
        `${w.character.name}迎来 ${w.character.age} 岁，进入${lifeStage(w.character.age)}的日子。`,
        '家庭',
        true,
        'family-birthday',
      );
      rememberEvent(w, e, 85);
    }
  }
  selectResident(w, selected);
  reconcileWallets(w);
  for (const b of w.household.bonds) {
    const a = resident(w, b.a)!,
      c = resident(w, b.b)!;
    if (
      b.lastDay === dayKey(w.time) ||
      a.activity.scene !== c.activity.scene ||
      a.activity.kind !== c.activity.kind ||
      !['eat', 'socialize', 'read', 'walk'].includes(a.activity.kind)
    )
      continue;
    // Count actual overlapping time, not merely two queued commands.
    if (
      Math.min(a.activity.end, c.activity.end) - Math.max(a.activity.start, c.activity.start) <
        15 * MINUTE ||
      w.time < Math.max(a.activity.start, c.activity.start) + 15 * MINUTE
    )
      continue;
    b.lastDay = dayKey(w.time);
    b.warmth = clamp(b.warmth + 2);
    b.conflict = clamp(b.conflict - 1);
    const text = `${a.character.name}和${c.character.name}一起${activityNames[a.activity.kind]}，聊起今天的小事。`;
    for (const id of [b.a, b.b]) {
      selectResident(w, id);
      w.needs.social = clamp(w.needs.social - 10);
      w.needs.mood = clamp(w.needs.mood + 3);
      const e = record(w, '一起度过的片刻', text, '家庭', true, 'family-moment');
      rememberEvent(w, e, 65);
    }
    selectResident(w, selected);
  }
}

export function editPersonality(w: World, traits: Traits) {
  const parsed = traitSchema.parse(traits);
  for (const key of Object.keys(parsed) as (keyof Traits)[]) {
    const delta = parsed[key] - w.character.traits[key];
    if (delta)
      w.evolution.push({
        time: w.time,
        trait: key,
        delta,
        reason: '玩家调整人物性格',
        source: 'character-editor',
      });
  }
  w.character.traits = parsed;
  w.evolution = w.evolution.slice(-100);
}
