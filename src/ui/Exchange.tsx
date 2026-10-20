import { useState } from 'react';
import type { World } from '../engine/model';
import { exchangeItems, redeem, useActionTicket } from '../engine/ExchangeEngine';
import { hasReward } from '../engine/TaskEngine';
import { mutate, notify } from '../store';
export function Exchange({ world: w }: { world: World }) {
  const [category, setCategory] = useState('all');
  const run = (fn: (w: World) => void) => {
    try {
      mutate(fn);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <section aria-label="积分兑换">
      <h3>积分兑换 · {w.exchange?.balance || 0} 分</h3>
      <p>完成计划或专注 +10 分，收到 NPC 礼物 +5 分。积分属于玩家，各人物共用；不影响各自存款。</p>
      <p>礼物兑换后直接送给{w.character.name}，进入 TA 的收藏与记忆；其他物品兑换后在下方使用。</p>
      <label>
        挑选商品
        <select
          aria-label="兑换分类"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">全部</option>
          <option value="permanent">衣服与家具</option>
          <option value="gift">送给人物的礼物</option>
          <option value="item">实用道具</option>
          <option value="action">特殊行动券</option>
        </select>
      </label>
      <div className="reward-grid">
        {exchangeItems
          .filter((r) => category === 'all' || r.kind === category)
          .map((r) => (
            <button
              key={r.id}
              disabled={
                (w.exchange?.balance || 0) < r.cost ||
                (r.kind === 'permanent' && hasReward(w, r.id)) ||
                (r.kind === 'gift' && w.living.gifts.some((g) => g.definition === r.id))
              }
              onClick={() =>
                run((x) => {
                  redeem(x, r.id);
                  notify(
                    r.kind === 'gift'
                      ? `${x.character.name}收到了${r.name}`
                      : `已兑换${r.name}，可在奖励中使用。`,
                  );
                })
              }
              aria-label={`兑换${r.name}`}
            >
              <strong>{r.name}</strong>
              <small>
                {r.kind === 'gift' && w.living.gifts.some((g) => g.definition === r.id)
                  ? 'TA 已收藏'
                  : r.kind === 'permanent' && hasReward(w, r.id)
                    ? '已拥有'
                    : `${r.cost} 积分`}
              </small>
            </button>
          ))}
      </div>
      <h3>特殊行动券</h3>
      <p>
        为当前人物安排 60
        个游戏分钟的活动：慢游、创作、阅读、园艺、自习或休息。世界暂停时等待，行动队列满时不消耗券。
      </p>
      {(w.exchange?.tickets || [])
        .filter((t) => t.count > 0)
        .map((t) => (
          <button key={t.id} onClick={() => run((x) => useActionTicket(x, t.id))}>
            使用{exchangeItems.find((r) => r.id === t.id)!.name} × {t.count}
          </button>
        ))}
      <details>
        <summary>积分记录与 NPC 礼物</summary>
        {(w.exchange?.ledger || [])
          .slice()
          .reverse()
          .slice(0, 30)
          .map((l) => (
            <p key={l.id}>
              {l.reason} · {l.amount > 0 ? '+' : ''}
              {l.amount} 分
            </p>
          ))}
        {(w.npcGifts || [])
          .slice()
          .reverse()
          .map((g) => (
            <p key={g.id}>
              {w.npcs.find((n) => n.id === g.npcId)?.name}送来的{g.name}
            </p>
          ))}
      </details>
    </section>
  );
}
