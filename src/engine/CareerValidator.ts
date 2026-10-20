import { careerTracks, majors, type CareerTrack } from '../content/careers';
import { type World, jobs, activityNames, sceneNames } from './model';
import { careerMilestones } from './CareerEngine';
export function validateCareerContent(tracks: CareerTrack[] = careerTracks) {
  const errors: string[] = [];
  const allIds = tracks.flatMap((t) => [t.id, ...t.duties.map((d) => d.id)]);
  if (new Set(allIds).size !== allIds.length) errors.push('职业任务 ID 重复');
  for (const job of jobs)
    if (!tracks.some((t) => t.job === job)) errors.push(`职业缺少路线：${job}`);
  for (const major of majors)
    if (!tracks.some((t) => t.name === `${major}学生`)) errors.push(`专业缺少路线：${major}`);
  for (const t of tracks) {
    if (
      !jobs.includes(t.job) ||
      !(t.scene in sceneNames) ||
      !(t.activity in activityNames) ||
      t.hours.some((h) => !Number.isFinite(h) || h < 0 || h > 24) ||
      t.hours[0] === t.hours[1] ||
      t.daysOff.length >= 7 ||
      t.daysOff.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    )
      errors.push(`${t.id}:职业日程无效`);
    if (
      t.stages.length !== 4 ||
      t.skills.length !== 3 ||
      t.directions.length !== 2 ||
      t.duties.length < 4
    )
      errors.push(`${t.id}:缺少成长内容`);
    if (
      t.duties.some(
        (d) =>
          ![d.title, d.process, d.success, d.setback].every(Boolean) ||
          !Number.isInteger(d.skill) ||
          d.skill < 0 ||
          d.skill > 2,
      )
    )
      errors.push(`${t.id}:任务或结果无效`);
    if (
      t.duties.every((d) => d.hours) ||
      t.duties.some(
        (d) => d.hours && (d.hours[0] < 0 || d.hours[1] > 24 || d.hours[0] >= d.hours[1]),
      )
    )
      errors.push(`${t.id}:任务时间不可达`);
    if (t.job === '学生' && t.activity !== 'study') errors.push(`${t.id}:学生任务不能结算职业收入`);
  }
  return errors;
}
export function validateCareerState(w: World) {
  const progress = w.career?.tracks || [];
  if (new Set(progress.map((p) => p.id)).size !== progress.length) throw new Error('职业路线重复');
  for (const p of progress) {
    const t = careerTracks.find((t) => t.id === p.id);
    if (
      !t ||
      Object.keys(p.counts).length > t.duties.length ||
      [...Object.keys(p.counts), ...p.recent].some((id) => !t.duties.some((d) => d.id === id)) ||
      (p.lastEnd !== undefined && p.lastEnd > w.time) ||
      (p.stage > 0 &&
        (p.minutes < careerMilestones[p.stage - 1] ||
          Object.values(p.counts).filter((n) => n > 0).length < 3))
    )
      throw new Error('职业进度或任务记录无效');
  }
  const a = w.activity,
    m = a.career;
  if (m) {
    const t = careerTracks.find((t) => t.id === m.track);
    if (
      !t ||
      !t.duties.some((d) => d.id === m.duty) ||
      t.activity !== a.kind ||
      t.scene !== a.scene
    )
      throw new Error('当前职业任务无效');
  }
}
