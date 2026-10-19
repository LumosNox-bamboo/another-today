import { focusRewards } from '../content/focusRewards';
import { useFocusReward } from '../engine/FocusRewardEngine';
import type { World } from '../engine/model';
import { mutate } from '../store';
export function FocusRewards({ world: w }: { world: World }) {
  const total = w.focusRewards?.completed || 0;
  return (
    <details className="focus-rewards">
      <summary>专注奖励 · 已完成 {total} 个任务</summary>
      <p className="muted">
        确认完成任务且实际经过至少 1 分钟，获得 1
        次完成记录。累计解锁，不扣分、不清零。衣服给当前人物穿，家具布置在共同住处。
      </p>
      <div className="reward-grid">
        {focusRewards.map((r) => {
          const unlocked = total >= r.at,
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
                    : '已解锁 · 点击使用'
                  : `完成 ${r.at} 个任务解锁`}
              </small>
            </button>
          );
        })}
      </div>
    </details>
  );
}
