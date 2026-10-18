import { z } from 'zod';
const id = z.string().max(200);
const text = z.string().max(2000);
const time = z.number().finite().min(0);
const score = z.number().finite().min(0).max(100);
export const sharedKinds = [
  '学习',
  '阅读',
  '工作',
  '休息',
  '运动',
  '睡前回顾',
  '自定义事项',
] as const;
export const livingSchema = z.object({
  revision: z.literal(1).default(1),
  notifications: z
    .object({
      enabled: z.boolean(),
      dnd: z.boolean(),
      ordinaryLimit: z.number().int().min(0).max(3),
      dailyLimit: z.number().int().min(0).max(6),
    })
    .default({ enabled: true, dnd: false, ordinaryLimit: 2, dailyLimit: 4 }),
  interactionDay: id.default(''),
  ordinaryCount: z.number().int().nonnegative().default(0),
  notificationCount: z.number().int().nonnegative().default(0),
  lastInteraction: time.default(0),
  interactions: z
    .array(
      z.object({ id, time, kind: id, text, source: id, important: z.boolean(), read: z.boolean() }),
    )
    .max(60)
    .default([]),
  topicAsked: z.record(time).default({}),
  gifts: z
    .array(
      z.object({
        id,
        definition: id,
        acquired: time,
        source: id,
        giver: id,
        memory: id,
        reaction: z.enum(['喜欢', '不合口味但珍惜', '想试试看']),
        uses: z.number().int().nonnegative(),
        growth: score,
        followedUp: z.boolean(),
      }),
    )
    .max(60)
    .default([]),
  interests: z.record(score).default({}),
  habits: z
    .array(
      z.object({
        id,
        strength: score,
        repetitions: z.number().int().nonnegative(),
        last: time,
        formed: z.boolean(),
        lastDecayDay: id,
      }),
    )
    .max(50)
    .default([]),
  habitHistory: z
    .array(z.object({ id, time, change: id, source: id }))
    .max(150)
    .default([]),
  secrets: z
    .array(
      z.object({
        id,
        started: time,
        expires: time,
        progress: score,
        status: z.enum(['hidden', 'shared', 'resolved', 'expired']),
        source: id,
        revealed: time.optional(),
      }),
    )
    .max(30)
    .default([]),
  npcLives: z
    .array(
      z.object({
        id,
        tier: z.enum(['core', 'regular', 'background']),
        home: id,
        project: id,
        progress: score,
        lastDay: id,
        changes: z.number().int().nonnegative(),
      }),
    )
    .max(50)
    .default([]),
  npcBonds: z
    .array(
      z.object({
        a: id,
        b: id,
        warmth: score,
        conflict: score,
        status: z.enum(['认识', '朋友', '恋人', '前任']),
        since: time,
      }),
    )
    .max(200)
    .default([]),
  news: z
    .array(
      z.object({
        id,
        definition: id,
        time,
        expires: time,
        title: id,
        text,
        scene: id,
        activity: id,
        source: id,
        effect: z.enum(['gathering', 'repair', 'opportunity', 'season', 'npc']),
      }),
    )
    .max(100)
    .default([]),
  town: z
    .object({
      lastDay: id,
      facilities: z.record(z.enum(['open', 'repair'])),
      opened: z.array(id).max(50),
    })
    .default({ lastDay: '', facilities: {}, opened: [] }),
  calendar: z
    .object({
      mode: z.enum(['world', 'real']),
      realAnchor: time,
      gameAnchor: time,
      season: z.enum(['春', '夏', '秋', '冬']),
      date: id,
      claimed: z.array(id).max(160),
    })
    .default({ mode: 'world', realAnchor: 0, gameAnchor: 0, season: '春', date: '', claimed: [] }),
  arcs: z
    .array(
      z.object({
        id,
        stage: z.number().int().min(0).max(4),
        status: z.enum(['active', 'paused', 'complete', 'missed', 'ended']),
        started: time,
        due: time,
        deadline: time,
        origin: id,
        lastEvent: id,
        npcId: id,
        choice: z.enum(['bold', 'quiet']).optional(),
        ending: id.optional(),
      }),
    )
    .max(30)
    .default([]),
  dreams: z
    .array(
      z.object({
        id,
        title: id,
        activity: id,
        progress: score,
        status: z.enum(['active', 'abandoned', 'fulfilled', 'regret']),
        changed: time,
        source: id,
        attempts: z.number().int().nonnegative(),
      }),
    )
    .max(30)
    .default([]),
  creations: z
    .array(
      z.object({
        id,
        kind: z.enum(['绘画', '写作', '摄影', '音乐']),
        title: id,
        started: time,
        completed: time.optional(),
        progress: score,
        seed: z.number().int().nonnegative(),
        content: text,
        source: id,
        eventId: id,
        giftedTo: id.optional(),
        exhibited: z.boolean(),
      }),
    )
    .max(60)
    .default([]),
  causes: z
    .array(
      z.object({
        id,
        time,
        title: id,
        reason: text,
        participants: z.array(id).max(10),
        results: text,
        parents: z.array(id).max(8),
        memories: z.array(id).max(10),
      }),
    )
    .max(600)
    .default([]),
  stats: z
    .object({
      activities: z.record(z.number().nonnegative()),
      categories: z.record(z.number().nonnegative()),
      definitions: z.record(z.number().nonnegative()),
      npcChanges: z.number().int().nonnegative(),
      careerChanges: z.number().int().nonnegative(),
      important: z.number().int().nonnegative(),
    })
    .default({
      activities: {},
      categories: {},
      definitions: {},
      npcChanges: 0,
      careerChanges: 0,
      important: 0,
    }),
});
export const createLiving = () => livingSchema.parse({});
