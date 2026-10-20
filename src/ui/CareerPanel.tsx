import { useState } from 'react';
import { type World, type Character, jobs } from '../engine/model';
import { careerTracks, majors } from '../content/careers';
import {
  careerTrack,
  careerMilestones,
  setOccupation,
  setCareerDirection,
} from '../engine/CareerEngine';
import { mutate, notify } from '../store';
import { Meter } from './components';
export function CareerPanel({ world: w }: { world: World }) {
  const t = careerTrack(w.character),
    p = w.career?.tracks.find((p) => p.id === t.id);
  const [job, setJob] = useState(w.character.job),
    [major, setMajor] = useState(w.character.major || '通识探索');
  const run = (fn: (w: World) => void) => {
    try {
      mutate(fn);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <section className="card career-panel" aria-label="职业与学业路线">
      <h2>
        {t.name} · {w.character.name}
      </h2>
      <p>
        {t.activity === 'work' ? '职业实践' : '学习与生活'}安排：{t.hours[0]}:00–{t.hours[1]}:00，
        {t.daysOff
          .map((d) => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d])
          .join('、')}
        休息。吃饭、睡觉等急需仍优先。
      </p>
      <p>
        实际完成 {Math.round(p?.minutes || 0)} 个游戏分钟 · 当前成果：
        {p?.stage ? t.stages[p.stage - 1] : '刚刚起步'}
      </p>
      <ol className="career-stages">
        {t.stages.map((name, i) => (
          <li key={name} className={(p?.stage || 0) > i ? 'achieved' : ''}>
            {name} · {careerMilestones[i] / 60} 游戏小时{(p?.stage || 0) > i ? ' ✓' : ''}
          </li>
        ))}
      </ol>
      <p className="muted">
        阶段需要完成至少三种不同任务。工作中断不计入成果；学习阶段不等于毕业、录用或执业资格。
      </p>
      <div className="trait-grid">
        {t.skills.map((name, i) => (
          <Meter key={name} label={name} value={p?.skills[i] || 0} />
        ))}
      </div>
      <label>
        发展方向
        <select
          aria-label="发展方向"
          value={
            p?.focus ?? (w.character.traits.discipline >= w.character.traits.extraversion ? 0 : 1)
          }
          onChange={(e) => run((x) => setCareerDirection(x, Number(e.target.value) as 0 | 1))}
        >
          {t.directions.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">选择会改变相关任务的出现权重，人物仍会练习其他能力。</p>
      <details>
        <summary>这条路线的日常内容</summary>
        {t.duties.map((d) => (
          <article key={d.id}>
            <strong>{d.title}</strong>
            <p>{d.process}。</p>
            <small>
              已实践 {p?.counts[d.id] || 0} 次 · {t.skills[d.skill]}
            </small>
          </article>
        ))}
      </details>
      <details>
        <summary>调整职业或专业</summary>
        <p>
          只调整{w.character.name}
          。会停止当前活动并撤下待执行的工作、学习安排，其他生活行动保留；旧路线的经历与进度仍可回看。
        </p>
        <label>
          人物职业
          <select
            aria-label="人物职业"
            value={job}
            onChange={(e) => setJob(e.target.value as Character['job'])}
          >
            {jobs
              .filter((j) =>
                w.character.age < 18 ? j === '学生' : w.character.age >= 65 ? j === '无业者' : true,
              )
              .map((j) => (
                <option key={j}>{j}</option>
              ))}
          </select>
        </label>
        {job === '学生' && w.character.age >= 18 && (
          <label>
            人物专业
            <select
              aria-label="人物专业"
              value={major}
              onChange={(e) => setMajor(e.target.value as typeof major)}
            >
              {majors.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        )}
        <button
          onClick={() =>
            run((x) => {
              setOccupation(x, job, major);
              notify('职业与专业已保存');
            })
          }
        >
          保存职业与专业
        </button>
      </details>
      {!!w.career?.tracks.filter((s) => s.id !== t.id).length && (
        <details>
          <summary>过去的路线</summary>
          {w.career.tracks
            .filter((s) => s.id !== t.id)
            .map((s) => (
              <p key={s.id}>
                {careerTracks.find((t) => t.id === s.id)?.name} · {Math.round(s.minutes)} 分钟 ·{' '}
                {s.stage} 项阶段成果
              </p>
            ))}
        </details>
      )}
    </section>
  );
}
