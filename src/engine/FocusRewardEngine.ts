import { focusRewards } from '../content/focusRewards';
import type { World } from './model';
export function useFocusReward(w: World, id: string) {
  const r = focusRewards.find((r) => r.id === id);
  if (!r || !w.focusRewards || w.focusRewards.completed < r.at) throw new Error('还未解锁这件奖励');
  if (r.kind === 'outfit') w.character.outfit = r.color;
  else {
    const placed = w.focusRewards.placed;
    w.focusRewards.placed = placed.includes(id) ? placed.filter((x) => x !== id) : [...placed, id];
  }
}
export function focusRemaining(a: World['playerActivities'][number], now: number) {
  return Math.max(
    0,
    Math.ceil(
      ((a.expectedEnd ?? a.start + a.expectedMinutes * 60000) - Math.max(now, a.start)) / 1000,
    ),
  );
}
export function clockText(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
