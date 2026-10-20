import { creditPoints } from './ExchangeEngine';
import { grantTaskReward } from './TaskEngine';
import { resident, commandResident } from './HouseholdEngine';
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
  if (!a) return;
  const invitation = a.invitations?.find((i) => i.residentId === w.household.active);
  if (invitation) {
    const entry = invitation.independent.find((e) => e.kind === kind);
    if (entry) entry.minutes += minutes;
    else invitation.independent.push({ kind, minutes });
  }
  if ((a.residentId || 'resident-0') !== w.household.active) return;
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
    creditPoints(w, 10, `完成专注：${a.label.slice(0, 80)}`);
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

export const sharedActions = [
  { kind: 'study', name: '一起学习' },
  { kind: 'read', name: '一起阅读' },
  { kind: 'work', name: '一起工作' },
  { kind: 'rest', name: '一起休息' },
  { kind: 'walk', name: '一起运动' },
] as const;
export function inviteShared(w: World, id: string, kind: Activity) {
  const a = w.playerActivities.find((a) => !a.returned);
  if (!a) throw new Error('请先开始一次专注');
  if (!sharedActions.some((x) => x.kind === kind)) throw new Error('不支持这项共同活动');
  if (a.invitations?.some((i) => i.residentId === id)) throw new Error('这次已经邀请过 TA');
  const minutes = Math.max(15, Math.min(180, Math.round(a.expectedMinutes)));
  commandResident(
    w,
    id,
    kind,
    kind === 'walk' ? 'park' : kind === 'work' ? 'office' : 'apartment',
    minutes,
  );
  a.invitations ??= [];
  a.invitations.push({ residentId: id, kind, minutes, independent: [] });
}
