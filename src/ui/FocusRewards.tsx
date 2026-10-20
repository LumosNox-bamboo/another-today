import { Exchange } from './Exchange';
import { useState } from 'react';
import { focusRewards } from '../content/focusRewards';
import { gifts } from '../content/living';
import { useFocusReward } from '../engine/FocusRewardEngine';
import { hasReward, taskItems, useTaskItem } from '../engine/TaskEngine';
import type { World } from '../engine/model';
import { mutate, notify } from '../store';
export function FocusRewards({ world: w }: { world: World }) {
  const total = w.focusRewards?.completed || 0;
  const [giftId, setGiftId] = useState('');
  const available = gifts.filter((g) => !w.living.gifts.some((x) => x.definition === g.id));
  return (
    <div className="focus-rewards">
      <Exchange world={w} />
      <p>
        已完成 {total} 个任务。计划完成或番茄钟任务确认后，都会获得一次随机奖励。累计解锁也会保留。
      </p>
      <h3>礼物与道具</h3>
      <p className="muted">使用对象：{w.character.name}。购物卡兑换到 TA 所属的钱包。</p>
      <div className="reward-grid">
        {taskItems.map((r) => {
          const count = w.taskRewards?.bag.find((x) => x.id === r.id)?.count || 0;
          return (
            <article className="task-row" key={r.id}>
              <strong>
                {r.name} × {count}
              </strong>
              <p>{r.description}</p>
              {r.id === 'gift-box' && (
                <label>
                  礼盒里的礼物
                  <select
                    aria-label="礼盒里的礼物"
                    value={giftId}
                    onChange={(e) => setGiftId(e.target.value)}
                  >
                    <option value="">请选择礼物</option>
                    {available.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                disabled={
                  !count || (r.id === 'gift-box' && !available.some((g) => g.id === giftId))
                }
                onClick={() => {
                  try {
                    mutate((x) => useTaskItem(x, r.id, giftId));
                    notify(`已使用${r.name}`);
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                使用{r.name}
              </button>
            </article>
          );
        })}
      </div>
      <h3>衣柜与家具</h3>
      <p className="muted">随机获得或累计解锁后都能使用。衣服给当前人物穿，家具放在共同住处。</p>
      <div className="reward-grid">
        {focusRewards.map((r) => {
          const unlocked = hasReward(w, r.id),
            used =
              r.kind === 'outfit'
                ? w.character.outfit === r.color
                : w.focusRewards?.placed.includes(r.id);
          return (
            <button
              key={r.id}
              disabled={!unlocked}
              aria-label={`${used ? '已使用' : '使用'}${r.name}`}
              aria-pressed={!!used}
              onClick={() => mutate((x) => useFocusReward(x, r.id))}
            >
              <span style={{ background: r.color }}>{r.kind === 'outfit' ? '衣' : '家'}</span>
              <strong>{r.name}</strong>
              <small>
                {unlocked
                  ? used
                    ? r.kind === 'furniture'
                      ? '已摆放 · 点击收起'
                      : '正在穿着'
                    : '已获得 · 点击使用'
                  : `随机奖励或完成 ${r.at} 个任务解锁`}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
