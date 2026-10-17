import { type World, type Trait, clamp, dayKey, record } from './model';
export function evolve(w: World, trait: Trait, reason: string, source: string) {
  const key = `evolved-${trait}-${dayKey(w.time)}`;
  if (w.flags[key]) return;
  const before = w.character.traits[trait];
  w.character.traits[trait] = clamp(before + 0.18);
  const delta = w.character.traits[trait] - before;
  if (!delta) return;
  w.flags[key] = true;
  w.evolution.push({ time: w.time, trait, delta, reason, source });
  w.evolution = w.evolution.slice(-100);
  if (w.evolution.filter((e) => e.trait === trait).length % 10 === 0)
    record(w, '一点点的改变', reason, '成长', true, 'evolution');
}
