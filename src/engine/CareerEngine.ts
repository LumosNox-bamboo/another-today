import { careerTracks, majors, type CareerTrack } from '../content/careers';
import {
  type World,
  type Character,
  type Activity,
  activityNames,
  DAY,
  MINUTE,
  hour,
  dayKey,
  random,
  clamp,
  record,
  jobs,
} from './model';
import { rememberEvent } from './MemoryEngine';
import { linkCause } from './EventCausalityGraph';
export const careerMilestones = [1200, 6000, 18000, 48000];
const levels = [1, 2, 4, 7, 10];
export function careerTrack(c: Pick<Character, 'age' | 'job' | 'major'>): CareerTrack {
  const id =
    c.age >= 65
      ? 'retired'
      : c.age < 13
        ? 'school-primary'
        : c.age < 18
          ? 'school-secondary'
          : undefined;
  return (
    id
      ? careerTracks.find((t) => t.id === id)
      : c.job === '学生'
        ? careerTracks.find((t) => t.name === `${c.major || '通识探索'}学生`)
        : careerTracks.find((t) => t.job === c.job)
  )!;
}
export function careerOnDuty(c: Pick<Character, 'age' | 'job' | 'major'>, time: number) {
  const t = careerTrack(c),
    h = hour(time);
  // A cross-midnight shift belongs to the date on which it started, including rest days.
  const shiftDay = new Date(
    time - (t.hours[0] > t.hours[1] && h < t.hours[1] ? DAY : 0),
  ).getUTCDay();
  if (t.daysOff.includes(shiftDay)) return false;
  return t.hours[0] < t.hours[1]
    ? h >= t.hours[0] && h < t.hours[1]
    : h >= t.hours[0] || h < t.hours[1];
}
export function careerProgress(w: World) {
  const t = careerTrack(w.character);
  w.career ??= { tracks: [] };
  let p = w.career.tracks.find((p) => p.id === t.id);
  if (!p) {
    p = {
      id: t.id,
      minutes: 0,
      stage: 0,
      baselineLevel: w.character.careerLevel,
      skills: [0, 0, 0],
      counts: {},
      recent: [],
      focus: w.character.traits.discipline >= w.character.traits.extraversion ? 0 : 1,
    };
    w.career.tracks.push(p);
  }
  return p;
}
export function careerActivityLabel(w: Pick<World, 'activity'>) {
  const marker = w.activity.career;
  return (
    (marker &&
      careerTracks.find((t) => t.id === marker.track)?.duties.find((d) => d.id === marker.duty)
        ?.title) ||
    activityNames[w.activity.kind]
  );
}
export function availableCareerDuties(t: CareerTrack, time: number) {
  const h = hour(time);
  return t.duties.filter((d) => !d.hours || (h >= d.hours[0] && h < d.hours[1]));
}
export function bindCareerActivity(w: World) {
  const t = careerTrack(w.character),
    a = w.activity;
  if (a.kind !== t.activity || a.scene !== t.scene) return;
  const p = careerProgress(w);
  // Prefer less-practised tasks; do not immediately repeat the same task.
  const available = availableCareerDuties(t, w.time);
  const fresh = available.filter((d) => !p.recent.slice(-2).includes(d.id));
  const choices = fresh.length ? fresh : available;
  const weight = (d: (typeof t.duties)[number]) =>
    (d.skill === (p.focus === 0 ? 0 : 2) ? 1.5 : 1) / (1 + (p.counts[d.id] || 0) * 0.2);
  let pick = random(w) * choices.reduce((s, d) => s + weight(d), 0);
  const d = choices.find((d) => (pick -= weight(d)) <= 0) || choices[0];
  a.career = { track: t.id, duty: d.id };
}
export function completeCareerActivity(w: World) {
  const a = w.activity,
    marker = a.career,
    t = careerTrack(w.character);
  if (
    !marker ||
    marker.track !== t.id ||
    a.kind !== t.activity ||
    a.scene !== t.scene ||
    w.time < a.end
  )
    return;
  const d = t.duties.find((d) => d.id === marker.duty);
  if (!d || a.end - a.start < 15 * MINUTE) return;
  const p = careerProgress(w);
  if (p.lastEnd !== undefined && p.lastEnd >= a.end) return;
  p.lastEnd = a.end;
  const minutes = Math.min(180, (a.end - a.start) / MINUTE);
  p.minutes += minutes;
  const fluent =
    random(w) <
    Math.min(
      0.9,
      0.5 + p.skills[d.skill] / 250 + w.character.traits.discipline / 400 - w.needs.stress / 1000,
    );
  p.skills[d.skill] = clamp(p.skills[d.skill] + (minutes / 90) * (fluent ? 1.2 : 0.7));
  p.counts[d.id] = (p.counts[d.id] || 0) + 1;
  p.recent = [...p.recent, d.id].slice(-3);
  w.needs.stress = clamp(w.needs.stress + (fluent ? -1 : 2));
  const date = dayKey(w.time),
    key = `career-day-${date}`;
  if (Number(w.flags[key] || 0) < 3) {
    w.flags[key] = Number(w.flags[key] || 0) + 1;
    const peer =
      w.character.age >= 18 && d.skill === 2 && random(w) < 0.3
        ? w.npcs.find((n) => n.scene === a.scene && n.job === w.character.job && n.age >= 18)
        : undefined;
    if (peer) {
      peer.relation.familiarity = clamp(peer.relation.familiarity + 2);
      peer.relation.trust = clamp(peer.relation.trust + 1);
      if (t.activity === 'work' && ['陌生人', '认识的人'].includes(peer.relation.type))
        peer.relation.type = '同事';
    }
    const e = record(
      w,
      `${t.name} · ${d.title}`,
      `${d.process}。${fluent ? d.success : d.setback}。${peer ? `间隙和同在这里的${peer.name}聊了聊各自的进度。` : ''}`,
      t.activity === 'work' ? '职业日常' : '学习与生活',
      false,
      d.id,
      peer?.id,
      p.lastEvent,
    );
    p.lastEvent = e.id;
  }
  if (p.stage < 4 && p.minutes >= careerMilestones[p.stage] && Object.keys(p.counts).length >= 3) {
    const stage = p.stage++;
    if (t.activity === 'work')
      w.character.careerLevel = Math.max(w.character.careerLevel, levels[p.stage]);
    const e = record(
      w,
      `${t.name}：${t.stages[stage]}`,
      `在实际完成 ${Math.round(p.minutes)} 个游戏分钟的练习后，${w.character.name}积累了${t.stages[stage]}的阶段经验，正在沿「${t.directions[p.focus]}」方向继续尝试。${t.job === '学生' ? '这是一份学习成果记录，不等于毕业或获得执业资格。' : ''}`,
      '职业与学业成长',
      true,
      `career-milestone-${t.id}-${p.stage}`,
      undefined,
      p.lastEvent,
    );
    rememberEvent(w, e, 80);
    linkCause(w, e, p.lastEvent ? [p.lastEvent] : [], '持续完成的职业或课程实践');
    p.lastEvent = e.id;
  }
}
export function setCareerDirection(w: World, focus: 0 | 1) {
  if (focus !== 0 && focus !== 1) throw new Error('发展方向无效');
  careerProgress(w).focus = focus;
}
export function setOccupation(w: World, job: Character['job'], major?: Character['major']) {
  if (
    !jobs.includes(job) ||
    (major !== undefined && !(majors as readonly string[]).includes(major))
  )
    throw new Error('职业或专业不存在');
  if ((w.character.age < 18 && job !== '学生') || (w.character.age >= 65 && job !== '无业者'))
    throw new Error('请保留符合年龄的学习或退休生活');
  const old = careerTrack(w.character);
  careerProgress(w);
  if (
    w.character.job === job &&
    (job !== '学生' || (w.character.major || '通识探索') === (major || '通识探索'))
  )
    return;
  w.character.job = job;
  if (job === '学生') w.character.major = major || '通识探索';
  const next = careerTrack(w.character),
    saved = w.career!.tracks.find((p) => p.id === next.id);
  w.character.careerLevel = saved ? Math.max(saved.baselineLevel, levels[saved.stage]) : 1;
  w.activity = { kind: 'rest', scene: 'apartment', start: w.time, end: w.time + 15 * MINUTE };
  const member = w.household.members.find((m) => m.id === w.household.active);
  if (member) {
    member.queue = member.queue.filter((q) => q.kind !== 'work' && q.kind !== 'study');
    member.commanded = false;
    member.interrupted = false;
  }
  const e = record(
    w,
    '职业与学习方向调整',
    `从「${old.name}」转向「${next.name}」。旧阶段经历仍然保留，新方向从实际实践开始。`,
    '人生选择',
    true,
    'career-change',
  );
  rememberEvent(w, e, 80);
}
export function careerBias(w: World, scores: Record<Activity, number>) {
  const t = careerTrack(w.character);
  if (careerOnDuty(w.character, w.time))
    scores[t.activity] +=
      t.activity === 'work' ? 15 : w.character.job === '学生' || w.character.age < 18 ? 135 : 55;
}
