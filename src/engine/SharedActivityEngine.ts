import { grantTaskReward } from './TaskEngine';
import { resident } from './HouseholdEngine';
import { type World, type Activity, MINUTE, uid, activityNames } from './model';
import { sharedKinds } from './livingSchema';
export function startShared(w: World, label: string, minutes: number, now: number) {
  if (w.playerActivities.some((a) => !a.returned)) throw new Error('已有进行中的活动');
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) throw new Error('预计时长无效');
  const kind = sharedKinds.find((k) => k === label) || '自定义事项';
  w.playerActivities.push({
    id: uid(w, 'focus'),
    residentId: w.household.active,
    label: label.trim().slice(0, 200) || kind,
    kind,
    start: now,
    expectedMinutes: minutes,
    expectedEnd: now + minutes * MINUTE,
    gameStart: w.time,
    independent: [],
  });
  w.playerActivities = w.playerActivities.slice(-100);
}
export function trackShared(w: World, kind: Activity, minutes: number) {
  const a = w.playerActivities.find((a) => !a.returned);
  if (!a || (a.residentId || 'resident-0') !== w.household.active) return;
  a.independent ??= [];
  const entry = a.independent.find((e) => e.kind === kind);
  if (entry) entry.minutes += minutes;
  else a.independent.push({ kind, minutes });
}
export function returnShared(w: World, now: number) {
  const a = w.playerActivities.find((a) => !a.returned);
  if (a) {
    a.returned = Math.max(a.start, now);
    a.gameEnd = w.time;
  }
}
export function confirmShared(
  w: World,
  id: string,
  minutes: number,
  note: string,
  completed = false,
) {
  const a = w.playerActivities.find((a) => a.id === id);
  if (!a?.returned || a.confirmedMinutes !== undefined) return;
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) throw new Error('实际时长无效');
  a.confirmedMinutes = minutes;
  a.completed = completed;
  // Self-confirmed task completion, with at least one actual wall-clock minute.
  // Timer expiry alone never asserts anything about the player's real life.
  if (completed && minutes >= 1 && a.returned - a.start >= MINUTE) {
    w.focusRewards ??= { completed: 0, placed: [] };
    w.focusRewards.completed++;
    grantTaskReward(w);
    a.rewardGranted = true;
  }
  a.note = note.trim().slice(0, 2000);
  const p = resident(w, a.residentId || 'resident-0');
  if (p) p.companion.sharedMinutes += minutes;
  const own = a.independent
    ?.map((x) => `${activityNames[x.kind]} ${x.minutes} 个游戏分钟`)
    .join('、');
  a.exchange = `你确认这次${a.label}进行了 ${minutes} 分钟。${own ? `我这边记录了：${own}。` : '这段时间没有新的模拟活动记录。'}各自的节奏都可以。`;
}
