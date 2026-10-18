import { habits } from '../content/living';
import { type World, type Activity, hour, dayKey, DAY, clamp, record, random } from './model';
import { rememberEvent } from './MemoryEngine';
const contextGate = (w: World, d: (typeof habits)[number]) => {
  if (d.id === 'habit-2')
    return [0, 6].includes(new Date(w.time).getUTCDay()) && w.activity.scene === 'library';
  if (d.id === 'habit-11') return w.character.job === '便利店店员';
  if (d.id === 'habit-19')
    return w.character.interest === '音乐' || (w.living.interests['音乐'] || 0) > 4;
  if (d.id === 'habit-30')
    return w.npcs.some((n) => n.scene === w.activity.scene && n.job === w.character.job);
  if (d.id === 'habit-33') return Math.floor(w.time / DAY) % 4 === 0;
  return true;
};
const eligible = (w: World, d: (typeof habits)[number]) =>
  contextGate(w, d) &&
  hour(w.time) >= d.from &&
  hour(w.time) < d.until &&
  (d.context === 'any' ||
    (d.context === 'plant' &&
      (w.items.some((i) => i.anchor === 'plant') || w.living.gifts.some((g) => g.growth > 0))) ||
    (d.context === 'friend' &&
      w.npcs.some((n) => n.relation.familiarity > 0 && n.scene === w.activity.scene)) ||
    (d.context === 'creative' && w.character.traits.creativity >= 40));
export function habitBias(w: World, activity: Activity) {
  return Math.min(
    15,
    w.living.habits.reduce((sum, h) => {
      const d = habits.find((d) => d.id === h.id)!;
      return sum + (h.formed && d.activity === activity && eligible(w, d) ? h.strength / 14 : 0);
    }, 0),
  );
}
export function practiceHabits(w: World, activity: Activity) {
  const candidates = habits.filter((d) => d.activity === activity && eligible(w, d));
  // One contextual habit per completed activity; repetition across days is required.
  let pick = random(w) * candidates.reduce((sum, d) => sum + 20 + w.character.traits[d.trait], 0);
  const d = candidates.find((d) => (pick -= 20 + w.character.traits[d.trait]) <= 0);
  if (!d) return;
  let h = w.living.habits.find((h) => h.id === d.id);
  if (!h) {
    h = {
      id: d.id,
      strength: 0,
      repetitions: 0,
      last: 0,
      formed: false,
      lastDecayDay: dayKey(w.time),
    };
    w.living.habits.push(h);
  }
  if (dayKey(h.last) === dayKey(w.time)) return;
  h.last = w.time;
  h.repetitions++;
  h.strength = clamp(h.strength + 8 + w.character.traits[d.trait] / 20);
  if (!h.formed && h.repetitions >= 3 && h.strength >= 32) {
    h.formed = true;
    const e = record(w, `养成习惯：${d.name}`, d.diary, '习惯成长', true, d.id);
    rememberEvent(w, e, 65);
    w.living.habitHistory.push({ id: d.id, time: w.time, change: '形成', source: e.id });
  } else if (h.formed && h.repetitions % 5 === 0)
    w.living.habitHistory.push({
      id: d.id,
      time: w.time,
      change: '强化',
      source: w.events.at(-1)?.id || 'practice',
    });
  w.living.habitHistory = w.living.habitHistory.slice(-150);
}
export function decayHabits(w: World) {
  for (const h of w.living.habits) {
    if (h.lastDecayDay === dayKey(w.time)) continue;
    h.lastDecayDay = dayKey(w.time);
    if (w.time - h.last < 4 * DAY) continue;
    h.strength = clamp(h.strength - 4);
    if (h.formed && h.strength < 18) {
      h.formed = false;
      w.living.habitHistory.push({
        id: h.id,
        time: w.time,
        change: '弱化，留待重新练习',
        source: '生活节奏改变',
      });
    }
  }
  w.living.habitHistory = w.living.habitHistory.slice(-150);
}
