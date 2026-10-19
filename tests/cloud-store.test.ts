import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWorld, defaultCharacter } from '../src/content/people';
import { catchUp } from '../src/engine/SimulationClock';
import { DAY, HOUR } from '../src/engine/model';
let original = createWorld(structuredClone(defaultCharacter), Date.now(), 41);
const save = vi.fn(async () => ({ ok: true, error: undefined as string | undefined }));
vi.mock('../src/persistence', () => ({
  load: async () => ({ world: structuredClone(original), error: null, recovered: false }),
  save,
}));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal('window', { addEventListener: vi.fn() });
  vi.stubGlobal('document', { addEventListener: vi.fn() });
  original = createWorld(structuredClone(defaultCharacter), Date.now() - HOUR, 41);
  save.mockResolvedValue({ ok: true, error: undefined });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
test('linked startup checks cloud before catchup and blocks writes while handing off', async () => {
  const store = await import('../src/store');
  await store.initialize(true);
  expect(store.getSnapshot().world!.lastReal).toBe(original.lastReal);
  vi.advanceTimersByTime(30_000);
  expect(store.getSnapshot().world!.time).toBe(original.time);
  store.mutate((w) => {
    w.money = 999999;
  });
  expect(store.getSnapshot().world!.money).toBe(original.money);
  store.pauseForCloud(false);
  vi.advanceTimersByTime(1000);
  expect(store.getSnapshot().world!.time).toBeGreaterThan(original.time);
});
test('adopting a cloud world preserves its lastReal and applies offline progression only once', async () => {
  const store = await import('../src/store');
  await store.initialize(true);
  const remote = createWorld(structuredClone(defaultCharacter), Date.now() - DAY, 77);
  const expected = structuredClone(remote);
  catchUp(expected);
  await store.adoptCloudWorld(remote, () => true);
  expect(store.getSnapshot().world!.time).toBe(expected.time);
  expect(store.getSnapshot().world!.money).toBe(expected.money);
  expect(store.getSnapshot().world!.diaries).toEqual(expected.diaries);
  const current = structuredClone(store.getSnapshot().world!);
  await store.adoptCloudWorld(current, () => true);
  expect(store.getSnapshot().world!.time).toBe(expected.time);
  expect(store.getSnapshot().world!.money).toBe(expected.money);
});
test('failed local persistence cannot replace the current world with a cloud world', async () => {
  const store = await import('../src/store');
  await store.initialize(true);
  const before = structuredClone(store.getSnapshot().world);
  save.mockResolvedValue({ ok: false, error: 'disk full' });
  await expect(
    store.adoptCloudWorld(
      createWorld(structuredClone(defaultCharacter), Date.now(), 77),
      () => true,
    ),
  ).rejects.toThrow('disk full');
  expect(store.getSnapshot().world).toEqual(before);
});
test('new worlds and imports invalidate the prior cloud link', async () => {
  const store = await import('../src/store');
  await store.initialize(true);
  const reset = vi.fn();
  store.onWorldReplacement(reset);
  await store.replaceWorld(createWorld(structuredClone(defaultCharacter), Date.now(), 77));
  expect(reset).toHaveBeenCalledOnce();
});

test('cancelling while a desktop save is in flight restores the existing local world', async () => {
  const store = await import('../src/store');
  await store.initialize(true);
  const before = structuredClone(store.getSnapshot().world);
  let finish!: (value: { ok: boolean; error: string | undefined }) => void;
  save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let active = true;
  const pending = store.adoptCloudWorld(
    createWorld(structuredClone(defaultCharacter), Date.now(), 77),
    () => active,
  );
  active = false;
  finish({ ok: true, error: undefined });
  await pending;
  expect(store.getSnapshot().world).toEqual(before);
  expect(save).toHaveBeenLastCalledWith(before);
});
