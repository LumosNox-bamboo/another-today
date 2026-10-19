import { beforeAll, beforeEach, afterAll, expect, test } from 'vitest';
import { cloudDatabase, USER_A, DEVICE_A, DEVICE_B } from './helpers/cloud-db';
import { SyncController, freshMeta, worldHash, type CloudPort } from '../src/cloud/SyncController';
import { createWorld, defaultCharacter } from '../src/content/people';
import { catchUp } from '../src/engine/SimulationClock';
import type { World } from '../src/engine/model';
let db: Awaited<ReturnType<typeof cloudDatabase>>;
beforeAll(async () => {
  db = await cloudDatabase();
}, 30_000);
beforeEach(async () => {
  await db.db.exec('truncate public.at_worlds, public.at_versions, public.at_leases');
});
afterAll(async () => {
  await db.db.close();
});
function device(
  id = DEVICE_A,
  initial: World | null = createWorld(structuredClone(defaultCharacter), Date.now(), 91),
  api?: CloudPort,
  metadata = freshMeta(),
) {
  const state = {
    world: initial,
    paused: false,
    meta: metadata,
    backups: [] as World[],
    adoptions: 0,
    failBackup: false,
    failMeta: false,
  };
  const controller = new SyncController(
    api ?? db.port(USER_A, id),
    {
      world: () => state.world,
      checkpoint: async () => state.world,
      pause: (value) => {
        state.paused = value;
      },
      backup: async (world) => {
        if (state.failBackup) throw new Error('disk full');
        state.backups.push(world);
      },
      adopt: async (world, current) => {
        if (current()) {
          catchUp(world);
          state.world = world;
          state.adoptions++;
        }
      },
      meta: (value) => {
        if (state.failMeta) throw new Error('disk full');
        state.meta = structuredClone(value);
      },
    },
    metadata,
    () => {},
  );
  return { state, controller };
}
async function uploaded() {
  const a = device();
  await a.controller.connect();
  expect(a.controller.state.mode).toBe('choice');
  expect(await db.port(USER_A, DEVICE_A).read()).toBeNull();
  await a.controller.choose('local');
  return a;
}
test('does nothing before opt-in; a first upload needs an explicit world choice', async () => {
  const a = device();
  expect(a.state.meta.enabled).toBe(false);
  expect(await db.port(USER_A, DEVICE_A).read()).toBeNull();
  await a.controller.connect();
  expect(a.state.paused).toBe(true);
  expect(await db.port(USER_A, DEVICE_A).read()).toBeNull();
  await a.controller.choose('local');
  expect(a.state.meta.revision).toBe(1);
  expect(a.state.paused).toBe(false);
});
test('a fresh phone loads the same character without creating a throwaway world', async () => {
  const a = await uploaded();
  await a.controller.handoff();
  expect(a.state.paused).toBe(true);
  const b = device(DEVICE_B, null);
  await b.controller.connect();
  await b.controller.choose('cloud');
  expect(b.state.world?.character.name).toBe(a.state.world?.character.name);
  expect(b.controller.state.mode).toBe('ready');
  expect(b.state.adoptions).toBe(1);
});
test('two independently played worlds stay intact until an explicit conflict choice', async () => {
  const a = await uploaded();
  await a.controller.handoff();
  const b = device(DEVICE_B, null);
  await b.controller.connect();
  await b.controller.choose('cloud');
  b.state.world!.money = 777;
  await b.controller.connect();
  await b.controller.handoff();
  a.state.world!.money = 123;
  await a.controller.connect();
  expect(a.controller.state.mode).toBe('choice');
  expect(a.state.world!.money).toBe(123);
  expect((await db.port(USER_A, DEVICE_A).read())?.payload.money).toBe(777);
  await a.controller.choose('cloud');
  expect(a.state.backups.at(-1)?.money).toBe(123);
  expect(a.state.world!.money).toBe(777);
});
test('clean acknowledged local state automatically follows a newer cloud version', async () => {
  const a = await uploaded();
  await a.controller.handoff();
  const b = device(DEVICE_B, null);
  await b.controller.connect();
  await b.controller.choose('cloud');
  b.state.world!.money = 777;
  await b.controller.connect();
  await b.controller.handoff();
  await a.controller.connect();
  expect(a.controller.state.mode).toBe('ready');
  expect(a.state.world!.money).toBe(777);
});
test('an active device can only be replaced explicitly; old uploads are stopped', async () => {
  const a = await uploaded();
  const b = device(DEVICE_B, null);
  await b.controller.connect();
  await b.controller.choose('cloud');
  expect(b.controller.state.mode).toBe('locked');
  await b.controller.choose('cloud', true);
  expect(b.controller.state.mode).toBe('ready');
  a.state.world!.money = 12;
  await a.controller.connect();
  expect(['choice', 'locked']).toContain(a.controller.state.mode);
  expect((await db.port(USER_A, DEVICE_B).read())?.payload.money).not.toBe(12);
});
test('a cloud change while a conflict choice is open requires a fresh choice', async () => {
  const a = await uploaded();
  await a.controller.handoff();
  const b = device(DEVICE_B, null);
  await b.controller.connect();
  await a.controller.connect();
  a.state.world!.money = 888;
  await a.controller.connect();
  await a.controller.handoff();
  await b.controller.choose('cloud');
  expect(b.controller.state.mode).toBe('choice');
  expect(b.state.world).toBeNull();
  await b.controller.choose('cloud');
  expect(b.state.world?.money).toBe(888);
});
test('losing a network acknowledgement recovers the committed revision before uploading new work', async () => {
  const port = db.port(USER_A, DEVICE_A);
  let lose = true;
  const a = device(DEVICE_A, undefined, {
    ...port,
    async push(...args) {
      const result = await port.push(...args);
      if (lose) {
        lose = false;
        throw new Error('network');
      }
      return result;
    },
  });
  await a.controller.connect();
  await a.controller.choose('local');
  expect(a.controller.state.mode).toBe('offline');
  expect(a.state.paused).toBe(false);
  expect(a.state.meta.pending).toBeTruthy();
  expect((await port.read())?.revision).toBe(1);
  a.state.world!.money = 321;
  await a.controller.connect();
  expect(a.controller.state.mode).toBe('ready');
  expect(a.state.meta.revision).toBe(2);
  expect((await port.read())?.payload.money).toBe(321);
});
test('backup or local metadata failure never replaces the local world or silently acknowledges sync', async () => {
  const a = await uploaded();
  await a.controller.handoff();
  const b = device(DEVICE_B);
  b.state.world!.money = 23;
  b.state.failBackup = true;
  await b.controller.connect();
  await b.controller.choose('cloud');
  expect(b.state.adoptions).toBe(0);
  expect(b.state.world!.money).toBe(23);
  expect((await db.port(USER_A, DEVICE_B).read())?.revision).toBe(2);
  b.state.failBackup = false;
  b.state.failMeta = true;
  await b.controller.choose('local');
  expect(b.controller.state.mode).toBe('offline');
  expect((await db.port(USER_A, DEVICE_B).read())?.revision).toBe(2);
});
test('disconnect during a network request cancels later local adoption and uploads', async () => {
  const a = await uploaded();
  await a.controller.handoff();
  const port = db.port(USER_A, DEVICE_B);
  let unblock!: () => void;
  const gate = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  const b = device(DEVICE_B, null, {
    ...port,
    async read() {
      await gate;
      return port.read();
    },
  });
  const pending = b.controller.connect();
  b.controller.dispose();
  unblock();
  await pending;
  expect(b.state.adoptions).toBe(0);
  expect(b.state.paused).toBe(false);
  expect(b.state.world).toBeNull();
});
test('invalid remote content is rejected without changing a valid local save', async () => {
  const a = await uploaded();
  await a.controller.handoff();
  const port = db.port(USER_A, DEVICE_B),
    remote = await port.read();
  remote!.payload.simulatedUntil = remote!.payload.time + 10000;
  const b = device(DEVICE_B, undefined, { ...port, read: async () => remote });
  const before = structuredClone(b.state.world);
  await b.controller.connect();
  expect(b.controller.state.mode).toBe('offline');
  expect(b.state.world).toEqual(before);
});
test('deleting the cloud removes history and disables future automatic uploads', async () => {
  const a = await uploaded();
  await a.controller.remove();
  expect(a.state.meta.enabled).toBe(false);
  expect(a.state.world).toBeTruthy();
  expect(a.state.paused).toBe(false);
  expect(await db.port(USER_A, DEVICE_A).read()).toBeNull();
});
test('canonical hashes survive PostgreSQL JSON key ordering', async () => {
  const a = await uploaded();
  const remote = await db.port(USER_A, DEVICE_A).read();
  expect(await worldHash(remote!.payload)).toBe(await worldHash(a.state.world!));
});

test('hands off household wallets, focus rewards, private histories and queued commands together', async () => {
  const { addResident, commandResident, selectResident } =
    await import('../src/engine/HouseholdEngine');
  const w = createWorld();
  w.settings.speed = 0;
  const { startShared, returnShared, confirmShared } =
    await import('../src/engine/SharedActivityEngine');
  const { useFocusReward } = await import('../src/engine/FocusRewardEngine');
  startShared(w, '学习', 25, Date.now() - 25 * 60000);
  returnShared(w, Date.now());
  confirmShared(w, w.playerActivities[0].id, 25, '完成', true);
  useFocusReward(w, 'sage-shirt');
  addResident(w, '室友', 24, '室友', 800);
  const id = addResident(w, '小禾', 6, '亲子');
  commandResident(w, id, 'read', 'apartment');
  selectResident(w, id);
  const { addTask, completeTask } = await import('../src/engine/TaskEngine');
  const task = addTask(w, '收拾房间', Date.now());
  completeTask(w, task.id, Date.now());
  addTask(w, '下周读完这本书', Date.now());
  const a = device(DEVICE_A, w);
  await a.controller.connect();
  await a.controller.choose('local');
  await a.controller.handoff();
  const b = device(DEVICE_B, null);
  await b.controller.connect();
  await b.controller.choose('cloud');
  expect(b.controller.state.mode).toBe('ready');
  expect(b.state.world!.tasks).toEqual(a.state.world!.tasks);
  expect(b.state.world!.taskRewards).toEqual(a.state.world!.taskRewards);
  expect(b.state.world!.household).toEqual(a.state.world!.household);
  expect(b.state.world!.focusRewards).toEqual({ completed: 2, placed: [] });
  expect(b.state.world!.household.wallets).toHaveLength(2);
  expect(b.state.world!.character.name).toBe('小禾');
  selectResident(b.state.world!, 'resident-0');
  expect(b.state.world!.character.name).toBe('小满');
  expect(b.state.world!.character.outfit).toBe('#7f9d85');
  expect(b.state.world!.events.some((e) => e.definition === 'family-arrival')).toBe(true);
});
