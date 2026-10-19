import { scheduleInteraction } from './engine/InteractionScheduler';
import { useSyncExternalStore } from 'react';
import { type World } from './engine/model';
import { catchUp, type CatchUpReport, shouldWelcome } from './engine/SimulationClock';
import * as persistence from './persistence';
import { createWorld, defaultCharacter } from './content/people';
export type Snapshot = {
  world: World | null;
  loaded: boolean;
  error: string | null;
  saving: boolean;
  savedAt: number;
  report: CatchUpReport | null;
  notice: string;
  compact: boolean;
  cloudPaused: boolean;
};
let state: Snapshot = {
  world: null,
  loaded: false,
  error: null,
  saving: false,
  savedAt: 0,
  report: null,
  notice: '',
  compact: false,
  cloudPaused: false,
};
const listeners = new Set<() => void>();
function publish() {
  state = { ...state };
  listeners.forEach((f) => f());
}
export const getSnapshot = () => state;
export const useGame = () =>
  useSyncExternalStore((callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }, getSnapshot);
let saving = false,
  again = false;
export async function persist() {
  if (!state.world) return;
  if (saving) {
    again = true;
    return;
  }
  saving = true;
  state.saving = true;
  publish();
  try {
    const result = await persistence.save(structuredClone(state.world));
    state.error = result.ok ? null : result.error || '保存失败';
    if (result.ok) state.savedAt = Date.now();
  } catch {
    state.error = '保存失败，请检查存储空间并导出备份。';
  } finally {
    saving = false;
    state.saving = false;
    publish();
    if (again) {
      again = false;
      void persist();
    }
  }
}
export function mutate(fn: (w: World) => void, autosave = true) {
  if (!state.world) return;
  if (state.cloudPaused) {
    notify('正在处理云存档交接，请到设置中接续，或断开同步后继续本机生活。');
    return;
  }
  fn(state.world);
  publish();
  if (autosave) void persist();
}
export function notify(notice: string) {
  state.notice = notice;
  publish();
  if (notice)
    setTimeout(() => {
      if (state.notice === notice) {
        state.notice = '';
        publish();
      }
    }, 6500);
}
export function dismissReport() {
  state.report = null;
  publish();
}
export async function replaceWorld(world: World) {
  adoptionRevision++;
  worldReplacement();
  state.world = world;
  state.world.lastReal = Date.now();
  state.report = null;
  state.error = null;
  publish();
  await persist();
}
let worldReplacement = () => {};
let adoptionRevision = 0;
export function onWorldReplacement(callback: () => void) {
  worldReplacement = callback;
}
export function pauseForCloud(value: boolean) {
  state.cloudPaused = value;
  publish();
}
export async function adoptCloudWorld(world: World, current: () => boolean) {
  if (!current()) return;
  const revision = ++adoptionRevision;
  const r = catchUp(world);
  scheduleInteraction(world, Date.now());
  const result = await persistence.save(world);
  if (!result.ok) throw new Error(result.error || '本地保存失败');
  if (!current()) {
    // An IPC disk write may finish after cancellation. Restore the still-current world,
    // unless a newer import/adoption already owns the persistence queue.
    if (revision === adoptionRevision && state.world) await persistence.save(state.world);
    return;
  }
  state.world = world;
  state.report = shouldWelcome(r) ? r : null;
  state.error = null;
  state.savedAt = Date.now();
  publish();
}
export async function begin(c = structuredClone(defaultCharacter)) {
  await replaceWorld(createWorld(c, Date.now(), crypto.getRandomValues(new Uint32Array(1))[0]));
}
export async function initialize(holdForCloud = false) {
  if (state.loaded) return;
  state.cloudPaused = holdForCloud;
  try {
    const result = await persistence.load();
    state.world = result.world;
    state.error = result.error;
    if (state.world && !state.cloudPaused) {
      const r = catchUp(state.world);
      scheduleInteraction(state.world, Date.now());
      if (shouldWelcome(r)) state.report = r;
      if (r.clockReversed)
        state.notice = '检测到系统时间回拨；将在时钟追上后继续推进，避免重复结算。';
      if (result.recovered) state.notice = '已从备份恢复游戏。最近一次保存之后的进度可能丢失。';
    }
  } catch {
    state.error = '读取存档失败，原数据未被覆盖。';
  }
  state.loaded = true;
  publish();
  if (state.world) await persist();
  let ticks = 0;
  setInterval(() => {
    if (!state.world || state.cloudPaused) return;
    const r = catchUp(state.world);
    scheduleInteraction(state.world, Date.now());
    if (shouldWelcome(r)) {
      state.report = r;
      void persist();
    }
    ticks++;
    if (ticks % 15 === 0) void persist();
    publish();
  }, 1000);
  window.desktop?.onClose(() => {
    if (state.world && !state.cloudPaused) catchUp(state.world);
    void persist();
  });
  window.addEventListener('beforeunload', () => {
    if (state.world) void persistence.save(state.world);
  });
  document.addEventListener('visibilitychange', () => {
    if (state.world && !state.cloudPaused) {
      const r = catchUp(state.world);
      scheduleInteraction(state.world, Date.now());
      if (shouldWelcome(r)) state.report = r;
      publish();
      void persist();
    }
  });
}
export async function compact(value: boolean) {
  if (window.desktop) {
    state.compact = await window.desktop.compact(value);
    if (value && state.world && !state.cloudPaused) {
      catchUp(state.world);
      state.world.settings.speed = 1;
      await persist();
    }
    publish();
  } else notify('桌面小窗需要使用 Electron 桌面版。当前为网页版。');
}
