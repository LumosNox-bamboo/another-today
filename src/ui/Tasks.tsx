import { useState } from 'react';
import type { World } from '../engine/model';
import { addTask, completeTask, removeTask, rewardName } from '../engine/TaskEngine';
import { mutate, notify } from '../store';
export function Tasks({
  world: w,
  onTimer,
  onRewards,
}: {
  world: World;
  onTimer: () => void;
  onRewards: () => void;
}) {
  const [title, setTitle] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const pending = (w.tasks || []).filter((t) => !t.completedAt);
  const done = (w.tasks || [])
    .filter((t) => t.completedAt)
    .slice()
    .reverse();
  const active = w.playerActivities.some((a) => !a.returned);
  return (
    <div className="task-board">
      <p>先写下想做的事，什么时候完成都可以。无需计时，不设截止惩罚。</p>
      <div className="button-row">
        <button onClick={onTimer}>{active ? '查看番茄钟' : '番茄钟（可选）'}</button>
        <button onClick={onRewards}>打开我的奖励</button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            mutate((x) => addTask(x, title, Date.now()));
            setTitle('');
            setError('');
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label>
          我的计划
          <input
            aria-label="我的计划"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：整理衣柜、读完这一章、周末去散步"
          />
        </label>
        <button disabled={!title.trim()} type="submit">
          添加计划
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <h3>待完成 · {pending.length}</h3>
      {!pending.length && <p className="muted">还没有待办，写下一件小事吧。</p>}
      {pending.map((t) => (
        <article className="task-row" key={t.id}>
          <strong>{t.title}</strong>
          <small>{new Date(t.createdAt).toLocaleDateString()} 记下</small>
          {confirmId === t.id ? (
            <div>
              <p>确认这件现实任务已经完成？确认后会保存记录并发放一次随机奖励。</p>
              <div className="button-row">
                <button
                  onClick={() => {
                    mutate((x) => {
                      const r = completeTask(x, t.id, Date.now());
                      if (r)
                        notify(`完成了「${t.title}」 · 获得${rewardName(r)}，到「我的奖励」使用。`);
                    });
                    setConfirmId(null);
                  }}
                >
                  确认完成并领奖
                </button>
                <button onClick={() => setConfirmId(null)}>还没完成</button>
              </div>
            </div>
          ) : (
            <div className="button-row">
              <button onClick={() => setConfirmId(t.id)} aria-label={`完成：${t.title}`}>
                我完成了
              </button>
              <button
                onClick={() => mutate((x) => removeTask(x, t.id))}
                aria-label={`取消：${t.title}`}
              >
                取消计划
              </button>
            </div>
          )}
        </article>
      ))}
      <details>
        <summary>已完成 · 最近 {done.length} 项</summary>
        {done.map((t) => (
          <article className="task-row" key={t.id}>
            <strong>{t.title}</strong>
            <small>
              {new Date(t.completedAt!).toLocaleDateString()} 完成 · 获得{rewardName(t.reward!)}
            </small>
          </article>
        ))}
      </details>
    </div>
  );
}
