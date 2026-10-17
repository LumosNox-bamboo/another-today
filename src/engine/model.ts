import { z } from 'zod';

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
export const stateSchema = z.object({
  version: z.literal(1),
  seed: z.number().int().min(1).max(4294967295),
  sequence: z.number().int().min(0),
  time,
  simulatedUntil: time,
  lastReal: time,
  createdReal: time,
  character: z.object({
    name: z.string().min(1).max(20),
    age: z.number().int().min(18).max(90),
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
  money: z.number().finite().min(0).max(1000000),
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
        label: short,
        start: time,
        expectedMinutes: z.number().min(1).max(1440),
        returned: time.optional(),
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
    .array(z.object({ id: short, time, amount: z.number().finite(), reason: short }))
    .max(600),
  lastSalaryDay: short,
  lastRentDay: short,
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
  if (w.events.length > 1500) w.events.splice(0, w.events.length - 1500);
  return e;
}
export function transact(w: World, amount: number, reason: string) {
  const before = w.money;
  w.money = clamp(w.money + amount, 0, 1000000);
  w.ledger.push({ id: uid(w, 'money'), time: w.time, amount: w.money - before, reason });
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
