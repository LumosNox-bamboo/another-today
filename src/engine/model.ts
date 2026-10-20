import { z } from 'zod';
import { linkCause } from './EventCausalityGraph';
import { livingSchema } from './livingSchema';

export const traitNames = {
  extraversion: '外向程度',
  openness: '开放程度',
  discipline: '责任感',
  sensitivity: '情绪敏感度',
  kindness: '亲和程度',
  adventure: '冒险倾向',
  romance: '浪漫倾向',
  independence: '独立性',
  curiosity: '好奇心',
  creativity: '创造力',
} as const;
export const sceneNames = {
  apartment: '小小公寓',
  office: '梧桐办公室',
  cafe: '转角咖啡馆',
  park: '晚风公园',
  library: '月光图书馆',
  shop: '街角便利店',
  street: '梧桐街',
  night: '星夜天台',
  riverside: '芦苇河岸',
  greenhouse: '玻璃温室',
  workshop: '旧物工坊',
  market: '周末集市',
  theater: '纸灯小剧场',
  observatory: '山坡观测站',
} as const;
export const activityNames = {
  sleep: '睡觉',
  wash: '洗漱',
  eat: '做饭与吃饭',
  work: '工作',
  read: '阅读',
  create: '写作与画画',
  socialize: '和朋友聊天',
  walk: '散步',
  play: '玩电脑',
  garden: '照料植物',
  shop: '买些日用品',
  rest: '放空与休息',
  study: '学习',
  coffee: '喝一杯咖啡',
} as const;
export const jobs = [
  '学生',
  '办公室职员',
  '程序员',
  '咖啡师',
  '便利店店员',
  '自由职业者',
  '插画师',
  '作家',
  '教师',
  '无业者',
] as const;
const bounded = z.number().finite().min(0).max(100);
const time = z.number().finite().min(0).max(8640000000000000);
const short = z.string().max(200);
export const traitSchema = z.object({
  extraversion: bounded,
  openness: bounded,
  discipline: bounded,
  sensitivity: bounded,
  kindness: bounded,
  adventure: bounded,
  romance: bounded,
  independence: bounded,
  curiosity: bounded,
  creativity: bounded,
});
export type Traits = z.infer<typeof traitSchema>;
export type Trait = keyof Traits;
export const sceneSchema = z.enum([
  'apartment',
  'office',
  'cafe',
  'park',
  'library',
  'shop',
  'street',
  'night',
  'riverside',
  'greenhouse',
  'workshop',
  'market',
  'theater',
  'observatory',
]);
export type Scene = z.infer<typeof sceneSchema>;
export const activitySchema = z.enum([
  'sleep',
  'wash',
  'eat',
  'work',
  'read',
  'create',
  'socialize',
  'walk',
  'play',
  'garden',
  'shop',
  'rest',
  'study',
  'coffee',
]);
export type Activity = z.infer<typeof activitySchema>;
const relationshipSchema = z.object({
  familiarity: bounded,
  affection: bounded,
  trust: bounded,
  intimacy: bounded,
  conflict: bounded,
  type: z.enum([
    '陌生人',
    '认识的人',
    '朋友',
    '好友',
    '同事',
    '邻居',
    '恋人',
    '前任',
    '竞争者',
    '家人',
  ]),
  dates: z.number().int().min(0),
  willing: z.boolean(),
});
const eventSchema = z.object({
  id: short,
  definition: short,
  time,
  title: short,
  text: z.string().max(2000),
  category: short,
  scene: sceneSchema,
  important: z.boolean(),
  npcId: short.optional(),
  cause: short.optional(),
});
export type LifeEvent = z.infer<typeof eventSchema>;
const memorySchema = z.object({
  id: short,
  subject: z.enum(['character', 'player', 'relationship', 'item', 'place']),
  timestamp: time,
  content: z.string().max(2000),
  source: short,
  relatedCharacters: z.array(short).max(10),
  scene: sceneSchema.optional(),
  emotion: short,
  importance: bounded,
  tags: z.array(short).max(20),
  privacy: z.enum(['local', 'private']),
});
export type Memory = z.infer<typeof memorySchema>;
const diarySchema = z.object({
  date: short,
  title: short,
  body: z.string().max(16000),
  mood: short,
  eventIds: z.array(short).max(100),
  places: z.array(sceneSchema).max(8),
  people: z.array(short).max(30),
});
const baseStateSchema = z.object({
  version: z.literal(1),
  living: livingSchema.default({}),
  seed: z.number().int().min(1).max(4294967295),
  sequence: z.number().int().min(0),
  time,
  simulatedUntil: time,
  lastReal: time,
  createdReal: time,
  character: z.object({
    name: z.string().min(1).max(20),
    age: z.number().int().min(6).max(100),
    gender: short,
    job: z.enum(jobs),
    education: short,
    family: short,
    housing: short,
    interest: short,
    goal: short,
    goalProgress: bounded,
    hiddenWish: short,
    hair: short,
    outfit: short,
    skin: short,
    traits: traitSchema,
    skill: bounded,
    careerLevel: z.number().int().min(1).max(10),
  }),
  needs: z.object({
    energy: bounded,
    hunger: bounded,
    mood: bounded,
    stress: bounded,
    social: bounded,
    fun: bounded,
    health: bounded,
  }),
  money: z.number().finite().min(0).max(6000000),
  activity: z.object({ kind: activitySchema, start: time, end: time, scene: sceneSchema }),
  recentActivities: z.array(activitySchema).max(12),
  npcs: z
    .array(
      z.object({
        id: short,
        name: short,
        age: z.number(),
        job: z.enum(jobs),
        traits: traitSchema,
        interest: short,
        scene: sceneSchema,
        plan: short,
        memories: z.array(short).max(12),
        relation: relationshipSchema,
      }),
    )
    .min(15)
    .max(50),
  events: z.array(eventSchema).max(1600),
  memories: z.array(memorySchema).max(400),
  diaries: z.array(diarySchema).max(400),
  playerDiaries: z.array(z.object({ date: short, text: z.string().max(12000) })).max(400),
  cooldowns: z.record(z.number().finite()),
  flags: z.record(z.union([z.boolean(), z.number(), z.string()])),
  chains: z
    .array(
      z.object({
        id: short,
        stage: z.number().int(),
        due: time,
        origin: short,
        npcId: short.optional(),
        status: z.enum(['active', 'complete', 'declined']),
      }),
    )
    .max(30),
  decisions: z
    .array(
      z.object({
        id: short,
        title: short,
        text: z.string().max(2000),
        kind: z.enum(['career', 'romance', 'move', 'chain']),
        npcId: short.optional(),
        chainId: short.optional(),
        created: time,
      }),
    )
    .max(30),
  items: z
    .array(
      z.object({
        id: short,
        name: short,
        description: short,
        acquired: time,
        source: short,
        uses: z.number().int().min(0),
        anchor: z.enum(['bed', 'desk', 'shelf', 'plant', 'sofa', 'kitchen']),
      }),
    )
    .max(30),
  evolution: z
    .array(
      z.object({
        time,
        trait: z.enum(Object.keys(traitNames) as [Trait, ...Trait[]]),
        delta: z.number(),
        reason: short,
        source: short,
      }),
    )
    .max(100),
  playerActivities: z
    .array(
      z.object({
        id: short,
        residentId: short.optional(),
        label: short,
        start: time,
        expectedMinutes: z.number().min(1).max(1440),
        kind: z.enum(['学习', '阅读', '工作', '休息', '运动', '睡前回顾', '自定义事项']).optional(),
        expectedEnd: time.optional(),
        gameStart: time.optional(),
        gameEnd: time.optional(),
        independent: z
          .array(z.object({ kind: activitySchema, minutes: z.number().nonnegative() }))
          .max(14)
          .optional(),
        exchange: z.string().max(2000).optional(),
        returned: time.optional(),
        completed: z.boolean().optional(),
        rewardGranted: z.boolean().optional(),
        confirmedMinutes: z.number().min(0).max(1440).optional(),
        note: z.string().max(2000).optional(),
      }),
    )
    .max(100),
  companion: z.object({
    familiarity: bounded,
    trust: bounded,
    conversations: z.number().int(),
    sharedMinutes: z.number().min(0),
  }),
  settings: z.object({
    speed: z.union([z.literal(0), z.literal(1), z.literal(4), z.literal(12)]),
    offlineDays: z.union([z.literal(1), z.literal(7), z.literal(30)]),
    advice: z.enum(['autonomous', 'sometimes', 'important']),
    sound: z.boolean(),
    volume: z.number().min(0).max(1),
  }),
  ledger: z
    .array(
      z.object({
        id: short,
        time,
        amount: z.number().finite(),
        reason: short,
        payerId: short.optional(),
      }),
    )
    .max(600),
  lastSalaryDay: short,
  lastRentDay: short,
});
// The selected resident remains in the original fields for backwards compatibility.
export const personalSchema = baseStateSchema
  .pick({
    character: true,
    needs: true,
    activity: true,
    recentActivities: true,
    events: true,
    memories: true,
    diaries: true,
    cooldowns: true,
    flags: true,
    chains: true,
    decisions: true,
    evolution: true,
    companion: true,
    lastSalaryDay: true,
  })
  .extend({
    living: livingSchema.omit({
      npcLives: true,
      npcBonds: true,
      news: true,
      town: true,
      calendar: true,
      notifications: true,
      interactionDay: true,
      ordinaryCount: true,
      notificationCount: true,
      lastInteraction: true,
    }),
  });
export const householdSchema = z
  .object({
    wallets: z
      .array(
        z.object({
          members: z.array(short).min(1).max(6),
          balance: z.number().finite().min(0).max(6000000),
        }),
      )
      .max(6)
      .optional(),
    financeMigration: short.optional(),
    active: short.default('resident-0'),
    members: z
      .array(
        z.object({
          id: short,
          state: personalSchema.optional(),
          relations: z.record(relationshipSchema).default({}),
          queue: z
            .array(
              z.object({
                kind: activitySchema,
                scene: sceneSchema,
                minutes: z.number().int().min(15).max(180),
              }),
            )
            .max(5)
            .default([]),
          commanded: z.boolean().default(false),
          interrupted: z.boolean().default(false),
          birthday: time,
        }),
      )
      .max(6)
      .default([]),
    bonds: z
      .array(
        z.object({
          a: short,
          b: short,
          type: z.enum(['室友', '伴侣', '夫妻', '手足', '亲子', '祖孙']),
          warmth: bounded,
          conflict: bounded,
          lastDay: short,
        }),
      )
      .max(15)
      .default([]),
  })
  .default({});
export const stateSchema = baseStateSchema.extend({
  household: householdSchema,
  exchange: z
    .object({
      balance: z.number().int().min(0),
      ledger: z
        .array(z.object({ id: short, time, amount: z.number().int(), reason: short }))
        .max(200),
      tickets: z
        .array(
          z.object({
            id: z.enum(['walk-ticket', 'create-ticket']),
            count: z.number().int().min(0),
          }),
        )
        .max(2),
      lastGiftDay: short,
    })
    .optional(),
  npcGifts: z
    .array(z.object({ id: short, npcId: short, residentId: short, name: short, time }))
    .max(100)
    .optional(),
  notes: z
    .array(
      z.object({
        id: short,
        residentId: short,
        author: short,
        time,
        text: z.string().max(4000),
        source: short.optional(),
        read: z.boolean(),
      }),
    )
    .max(100)
    .optional(),
  tasks: z
    .array(
      z.object({
        id: short,
        title: z.string().min(1).max(120),
        createdAt: time,
        completedAt: time.optional(),
        reward: short.optional(),
      }),
    )
    .max(200)
    .optional(),
  taskRewards: z
    .object({
      owned: z.array(short).max(8),
      bag: z.array(z.object({ id: short, count: z.number().int().min(0) })).max(3),
    })
    .optional(),
  focusRewards: z
    .object({ completed: z.number().int().min(0), placed: z.array(short).max(4) })
    .optional(),
});
export type World = z.infer<typeof stateSchema>;
export type Character = World['character'];
export type NPC = World['npcs'][number];
export type Decision = World['decisions'][number];
export const MINUTE = 60000,
  HOUR = 60 * MINUTE,
  DAY = 24 * HOUR,
  STEP = 5 * MINUTE;
// Game calendar is a floating local calendar represented in UTC; OS timezone changes do not rewrite history.
export const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
export const hour = (t: number) => new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60;
export const gameTime = (t: number) => new Date(t).toISOString().slice(11, 16);
export const realDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
export function random(w: World) {
  let x = w.seed;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  w.seed = x >>> 0;
  return w.seed / 4294967296;
}
export const uid = (w: World, prefix: string) => `${prefix}-${++w.sequence}`;
export function record(
  w: World,
  title: string,
  text: string,
  category = '日常',
  important = false,
  definition = 'activity',
  npcId?: string,
  cause?: string,
): LifeEvent {
  const e = {
    id: uid(w, 'event'),
    definition,
    time: w.time,
    title,
    text,
    category,
    scene: w.activity.scene,
    important,
    npcId,
    cause,
  };
  w.events.push(e);
  w.living.stats.categories[category] = (w.living.stats.categories[category] || 0) + 1;
  w.living.stats.definitions[definition] = (w.living.stats.definitions[definition] || 0) + 1;
  if (important) {
    w.living.stats.important++;
    linkCause(w, e, cause ? [cause] : []);
  }
  if (w.events.length > 1500) w.events.splice(0, w.events.length - 1500);
  return e;
}
export function transact(w: World, amount: number, reason: string) {
  const before = w.money;
  w.money = clamp(w.money + amount, 0, 6000000);
  w.ledger.push({
    id: uid(w, 'money'),
    time: w.time,
    amount: w.money - before,
    reason,
    payerId: w.household.active,
  });
  const wallet = w.household.wallets?.find((a) => a.members.includes(w.household.active));
  if (wallet) wallet.balance = w.money;
  w.ledger = w.ledger.slice(-600);
}
export function labels(t: Traits) {
  return [
    t.extraversion < 40 ? '喜欢独处' : t.extraversion > 65 ? '外向' : '慢热',
    t.discipline > 65 ? '自律' : t.creativity > 65 ? '有创造力' : '随性',
    t.sensitivity > 65 ? '敏感细腻' : t.kindness > 65 ? '温柔' : '冷静',
    t.curiosity > 65 ? '好奇' : '务实',
  ];
}
