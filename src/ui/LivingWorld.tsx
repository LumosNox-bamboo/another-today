import { useState } from 'react';
import { type World, dayKey, activityNames } from '../engine/model';
import { gifts, habits, secrets } from '../content/living';
import { storyArcs } from '../content/storyArcs';
import { mutate, notify } from '../store';
import { giveGift } from '../engine/GiftEngine';
import { giftCreation } from '../engine/CreationEngine';
import { chooseArc, controlArc } from '../engine/StoryArcEngine';
import { changeDream } from '../engine/RegretAndDreamEngine';
import { setCalendarMode } from '../engine/SeasonEngine';
import { traceCauses } from '../engine/EventCausalityGraph';
import { Modal, Empty } from './components';

export function InteractionCard({
  world: w,
  onChat,
}: {
  world: World;
  onChat: (text?: string) => void;
}) {
  const l = w.living,
    message = l.interactions.filter((i) => !i.read).at(-1);
  const quiet =
    l.notifications.dnd || !l.notifications.enabled || w.playerActivities.some((a) => !a.returned);
  if (!message || quiet) return null;
  return (
    <section className="card interaction-card" aria-label="小人的主动分享">
      <div className="eyebrow">A MOMENT TO SHARE · {message.kind}</div>
      <p>{message.text}</p>
      <div className="button-row">
        <button
          onClick={() => {
            mutate((x) => {
              const i = x.living.interactions.find((i) => i.id === message.id);
              if (i) i.read = true;
            });
            onChat(message.text);
          }}
        >
          听 TA 说说
        </button>
        <button
          className="quiet-button"
          onClick={() =>
            mutate((x) => {
              const i = x.living.interactions.find((i) => i.id === message.id);
              if (i) i.read = true;
            })
          }
        >
          稍后再聊
        </button>
      </div>
      <small className="muted">不用回应，TA 也会继续自己的生活。</small>
    </section>
  );
}
export function LivingSettings({ world: w }: { world: World }) {
  const n = w.living.notifications;
  return (
    <section className="card full">
      <h2>交流与季节</h2>
      <p className="muted">
        普通交流每天最多 1–3
        次；重要分享也计入每日总上限。专注和免打扰期间保持安静。不回应不会扣好感。
      </p>
      <div className="form-grid">
        <label className="check">
          <input
            type="checkbox"
            checked={n.enabled}
            onChange={(e) =>
              mutate((x) => {
                x.living.notifications.enabled = e.target.checked;
              })
            }
          />
          允许主动交流
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={n.dnd}
            onChange={(e) =>
              mutate((x) => {
                x.living.notifications.dnd = e.target.checked;
              })
            }
          />
          免打扰模式
        </label>
        <label>
          每日普通交流上限
          <select
            value={n.ordinaryLimit}
            onChange={(e) =>
              mutate((x) => {
                x.living.notifications.ordinaryLimit = +e.target.value;
              })
            }
          >
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                {i} 次
              </option>
            ))}
          </select>
        </label>
        <label>
          每日全部提示上限
          <select
            value={n.dailyLimit}
            onChange={(e) =>
              mutate((x) => {
                x.living.notifications.dailyLimit = +e.target.value;
              })
            }
          >
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <option key={i} value={i}>
                {i} 次
              </option>
            ))}
          </select>
        </label>
        <label>
          季节日历
          <select
            value={w.living.calendar.mode}
            onChange={(e) =>
              mutate((x) => setCalendarMode(x, e.target.value as 'world' | 'real', Date.now()))
            }
          >
            <option value="world">独立世界日历 · 随游戏时间推进</option>
            <option value="real">现实同步日历 · 季节跟随现实日期</option>
          </select>
        </label>
      </div>
      <p className="muted">
        切换只改变季节参照，不重写已经发生的生活。交流提醒使用现实日期，世界记录保留游戏日期。
      </p>
    </section>
  );
}
export function CausalityView({ world: w }: { world: World }) {
  const [selected, setSelected] = useState('');
  const nodes = traceCauses(w, selected);
  return (
    <section className="card">
      <h2>一件事，怎样走到这里</h2>
      <p className="muted">选择真实发生的重要片刻，回看它的起因和留下的记忆。</p>
      <label>
        回溯事件
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">选择一个片刻</option>
          {w.living.causes
            .slice(-100)
            .reverse()
            .map((c) => (
              <option key={c.id} value={c.id}>
                {dayKey(c.time)} · {c.title}
              </option>
            ))}
        </select>
      </label>
      {nodes.map((c) => (
        <article className="living-entry" key={c.id}>
          <small>{dayKey(c.time)}</small>
          <h3>{c.title}</h3>
          <p>{c.results}</p>
          <small>
            起因：{c.reason}
            {c.memories.length > 0 ? ' · 已留下长期记忆' : ''}
          </small>
        </article>
      ))}
    </section>
  );
}
function Artwork({ creation: c }: { creation: World['living']['creations'][number] }) {
  const colors = ['#e9e4d2', '#abc3b1', '#6c827b', '#b89173', '#e5c895', '#788ca1'];
  return (
    <svg
      className="generated-art"
      viewBox="0 0 160 100"
      role="img"
      aria-label={`${c.kind}作品 ${c.title}`}
    >
      <rect width="160" height="100" fill={colors[0]} />
      {Array.from({ length: 160 }, (_, i) => {
        const x = i % 16,
          y = Math.floor(i / 16),
          v = ((c.seed ^ (i * 2654435761)) >>> 0) % 6;
        return (
          <rect
            key={i}
            x={x * 10}
            y={y * 10}
            width="10"
            height="10"
            fill={colors[y < 3 ? 1 : v]}
            opacity={y < 3 ? 0.45 : 1}
          />
        );
      })}
    </svg>
  );
}
async function playCreation(seed: number) {
  const audio = new AudioContext();
  await audio.resume();
  for (let i = 0; i < 8; i++) {
    const osc = audio.createOscillator(),
      gain = audio.createGain(),
      start = audio.currentTime + i * 0.35;
    osc.type = 'sine';
    osc.frequency.value = [261.63, 293.66, 329.63, 392, 440][((seed >>> (i * 3)) & 7) % 5];
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.05, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(start);
    osc.stop(start + 0.32);
  }
  setTimeout(() => void audio.close(), 3300);
}
export function LivingWorld({ world: w }: { world: World }) {
  const [tab, setTab] = useState('街区近况'),
    [gift, setGift] = useState(gifts[0].id),
    [work, setWork] = useState<string | null>(null),
    [recipient, setRecipient] = useState('npc-0');
  const d = gifts.find((g) => g.id === gift)!,
    c = w.living.creations.find((c) => c.id === work);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE WORLD KEEPS LIVING</div>
          <h1>街区还在慢慢变化</h1>
          <p>
            {w.living.calendar.season} · {w.living.calendar.date || dayKey(w.time)} ·
            每个人都有自己的日子。
          </p>
        </div>
      </div>
      <div className="living-tabs" role="tablist" aria-label="世界内容">
        {['街区近况', '礼物与作品', '长线故事', '习惯与愿望'].map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === '街区近况' && (
        <div className="living-grid">
          <section className="card">
            <h2>小镇公告</h2>
            {w.living.news.length ? (
              w.living.news
                .slice(-12)
                .reverse()
                .map((n) => (
                  <article className="living-entry" key={n.id}>
                    <small>
                      {dayKey(n.time)} · {n.expires > w.time ? '正在进行' : '已结束'}
                    </small>
                    <h3>{n.title}</h3>
                    <p>{n.text}</p>
                  </article>
                ))
            ) : (
              <Empty>街区还在迎接新的一天，公告会随世界推进更新。</Empty>
            )}
          </section>
          <section className="card">
            <h2>居民各自的生活</h2>
            {w.living.npcLives.map((l) => {
              const n = w.npcs.find((n) => n.id === l.id)!;
              return (
                <details className="living-entry" key={l.id}>
                  <summary>
                    {n.name} · {n.job} · {l.home}
                  </summary>
                  <p>
                    {n.plan}。喜欢{n.interest}，正在{l.project}。
                  </p>
                  {n.memories.slice(-3).map((m, i) => (
                    <p key={i}>{m}</p>
                  ))}
                  {w.living.npcBonds
                    .filter((b) => b.a === n.id || b.b === n.id)
                    .map((b) => (
                      <p key={`${b.a}-${b.b}`}>
                        与{w.npcs.find((x) => x.id === (b.a === n.id ? b.b : b.a))?.name}：
                        {b.status}
                        {b.conflict > 35 ? '，最近有些分歧' : ''}
                      </p>
                    ))}
                </details>
              );
            })}
          </section>
          <section className="card">
            <h2>留给你的话</h2>
            {w.living.interactions.length ? (
              w.living.interactions
                .slice(-8)
                .reverse()
                .map((i) => (
                  <article className="living-entry" key={i.id}>
                    <small>
                      {new Date(i.time).toLocaleDateString()} · {i.kind}
                    </small>
                    <p>{i.text}</p>
                  </article>
                ))
            ) : (
              <Empty>有适合分享的事情时，TA 会在不打扰你的时候提起。</Empty>
            )}
          </section>
          <section className="card">
            <h2>一起做过的事</h2>
            {w.playerActivities.length ? (
              w.playerActivities
                .slice(-6)
                .reverse()
                .map((a) => (
                  <article className="living-entry" key={a.id}>
                    <h3>
                      {a.label} ·{' '}
                      {a.confirmedMinutes === undefined ? '尚未确认' : `${a.confirmedMinutes} 分钟`}
                    </h3>
                    <p>{a.exchange || '等你愿意时，再说说实际做了什么。'}</p>
                    {a.independent?.length ? (
                      <small>
                        TA 的独立活动：
                        {a.independent
                          .map((i) => `${activityNames[i.kind]} ${i.minutes} 分钟`)
                          .join('、')}
                        （游戏时间）
                      </small>
                    ) : null}
                  </article>
                ))
            ) : (
              <Empty>在“今天”选择“一起专注”，可以学习、休息或一起迎接一天结束。</Empty>
            )}
          </section>
        </div>
      )}
      {tab === '礼物与作品' && (
        <div className="living-grid">
          <section className="card">
            <h2>送一份小小心意</h2>
            <p className="muted">
              不需要连续送礼。TA 会有自己的喜好，也可能珍惜一件暂时用不上的物品。
            </p>
            <label>
              挑选礼物
              <select value={gift} onChange={(e) => setGift(e.target.value)}>
                {gifts.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.category} · {g.name}
                  </option>
                ))}
              </select>
            </label>
            <p>
              {d.name}可能带来{d.interest}方面的新尝试，是否喜欢取决于 TA 自己。
            </p>
            <button
              disabled={
                w.living.gifts.some((g) => g.definition === gift) || w.living.gifts.length >= 60
              }
              onClick={() =>
                mutate((x) => {
                  giveGift(x, gift);
                  notify(`已送出${d.name}。`);
                })
              }
            >
              送给 TA
            </button>
            <h3>已经收到的礼物</h3>
            {w.living.gifts.map((g) => {
              const def = gifts.find((d) => d.id === g.definition)!;
              return (
                <article className="living-entry" key={g.id}>
                  <strong>{def.name}</strong>
                  <p>
                    {g.reaction} · 使用了 {g.uses} 次
                    {def.category === '植物' ? ` · 生长 ${Math.round(g.growth)}%` : ''}
                  </p>
                  <small>
                    {dayKey(g.acquired)} 来自{g.giver}
                    {g.followedUp ? ' · 已有后续故事' : ''}
                  </small>
                </article>
              );
            })}
          </section>
          <section className="card">
            <h2>作品集</h2>
            <p className="muted">保留最近 60 件作品，较早作品的经历仍可能留在人生档案和记忆里。</p>
            {w.living.creations.length ? (
              w.living.creations
                .slice()
                .reverse()
                .map((c) => (
                  <article className="living-entry" key={c.id}>
                    <h3>{c.title}</h3>
                    <p>
                      {c.kind} ·{' '}
                      {c.completed ? '已经完成' : `慢慢创作中 ${Math.round(c.progress)}%`}
                      {c.exhibited ? ' · 曾向居民展示' : ''}
                    </p>
                    {c.completed && (
                      <>
                        <Artwork creation={c} />
                        <button onClick={() => setWork(c.id)}>查看作品</button>
                      </>
                    )}
                  </article>
                ))
            ) : (
              <Empty>作品需要几次实际创作才能完成。礼物、兴趣和性格会影响 TA 是否愿意动笔。</Empty>
            )}
          </section>
        </div>
      )}
      {tab === '长线故事' && (
        <div className="living-grid">
          {w.living.arcs.length ? (
            w.living.arcs.map((a) => {
              const d = storyArcs.find((d) => d.id === a.id)!;
              const status = {
                active: '正在展开',
                paused: '暂时停一停',
                complete: '已留下结局',
                missed: '错过了时机',
                ended: '提前结束',
              }[a.status];
              return (
                <section className="card" key={a.id}>
                  <div className="eyebrow">
                    {status} · {dayKey(a.started)} 开始
                  </div>
                  <h2>{d.title}</h2>
                  <p>
                    {a.ending
                      ? a.ending === 'bold'
                        ? d.bold
                        : d.quiet
                      : d.nodes[Math.min(a.stage - 1, 2)]}
                  </p>
                  <small>相关的人：{w.npcs.find((n) => n.id === a.npcId)?.name}</small>
                  {a.status === 'active' && (
                    <>
                      <p className="muted">
                        下一步不早于 {dayKey(a.due)}。你不回应时，TA 会在合适的时间自己决定。
                      </p>
                      {a.stage === 3 && (
                        <>
                          <p>{d.branch}</p>
                          <div className="button-row">
                            <button onClick={() => mutate((x) => chooseArc(x, a.id, 'bold'))}>
                              建议试一试
                            </button>
                            <button onClick={() => mutate((x) => chooseArc(x, a.id, 'quiet'))}>
                              建议慢慢来
                            </button>
                          </div>
                          {a.choice && <p>已记下你的建议。</p>}
                        </>
                      )}
                      <button onClick={() => mutate((x) => controlArc(x, a.id, 'pause'))}>
                        暂停这段故事
                      </button>
                    </>
                  )}
                  {a.status === 'paused' && (
                    <button onClick={() => mutate((x) => controlArc(x, a.id, 'resume'))}>
                      继续这段故事
                    </button>
                  )}
                  {['active', 'paused'].includes(a.status) && (
                    <button
                      className="quiet-button"
                      onClick={() => mutate((x) => controlArc(x, a.id, 'end'))}
                    >
                      让它在这里结束
                    </button>
                  )}
                </section>
              );
            })
          ) : (
            <section className="card">
              <Empty>
                一条长故事，常常从一次普通的出门开始。最多同时展开三条新旧剧情，不必刻意寻找。
              </Empty>
            </section>
          )}
          <CausalityView world={w} />
        </div>
      )}
      {tab === '习惯与愿望' && (
        <div className="living-grid">
          <section className="card">
            <h2>渐渐形成的习惯</h2>
            {Object.keys(w.living.interests).length > 0 && (
              <p className="muted">
                正在培养的兴趣：
                {Object.entries(w.living.interests)
                  .map(([name, value]) => `${name} ${Math.round(value)}`)
                  .join(' · ')}
              </p>
            )}
            {w.living.habits.some((h) => h.formed) ? (
              w.living.habits
                .filter((h) => h.formed)
                .sort((a, b) => b.strength - a.strength)
                .slice(0, 8)
                .map((h) => (
                  <article className="living-entry" key={h.id}>
                    <strong>{habits.find((d) => d.id === h.id)?.name}</strong>
                    <p>
                      {h.formed ? '已经形成' : '仍在尝试'} · 稳定程度 {Math.round(h.strength)} ·
                      练习过 {h.repetitions} 天
                    </p>
                  </article>
                ))
            ) : (
              <Empty>习惯来自不同日子的重复，不会因为点一次按钮就形成。</Empty>
            )}
            <details>
              <summary>查看全部尝试（{w.living.habits.length}）</summary>
              {w.living.habits.map((h) => (
                <p key={h.id}>
                  {habits.find((d) => d.id === h.id)?.name} · {h.formed ? '已形成' : '尝试中'} ·{' '}
                  {Math.round(h.strength)}
                </p>
              ))}
            </details>
            <details>
              <summary>习惯演变记录</summary>
              {w.living.habitHistory
                .slice(-15)
                .reverse()
                .map((h, i) => (
                  <p key={i}>
                    {dayKey(h.time)} · {habits.find((d) => d.id === h.id)?.name} · {h.change}
                  </p>
                ))}
            </details>
          </section>
          <section className="card">
            <h2>愿望与回望</h2>
            {w.living.dreams.map((d) => (
              <article className="living-entry" key={d.id}>
                <h3>{d.title}</h3>
                <p>
                  {
                    {
                      active: '正在尝试',
                      abandoned: '暂时放下',
                      fulfilled: '已经实现',
                      regret: '偶尔还会想起',
                    }[d.status]
                  }{' '}
                  · {Math.round(d.progress)}%
                </p>
                {d.status !== 'fulfilled' && (
                  <button
                    onClick={() => mutate((x) => changeDream(x, d.id, d.status !== 'active'))}
                  >
                    {d.status === 'active' ? '建议暂时放下' : '鼓励重新试试'}
                  </button>
                )}
              </article>
            ))}
            <h2>愿意分享的心事</h2>
            {w.living.secrets
              .filter((s) => s.revealed)
              .map((s) => (
                <article className="living-entry" key={s.id}>
                  <h3>{secrets.find((d) => d.id === s.id)?.title}</h3>
                  <p>
                    {
                      secrets.find((d) => d.id === s.id)?.[
                        s.status === 'resolved' ? 'end' : 'reveal'
                      ]
                    }
                  </p>
                </article>
              ))}
            <p className="muted">
              有些心事需要时间，准备好后 TA 才会说起。可以在聊天里温和地问问。
            </p>
          </section>
        </div>
      )}
      {c?.completed && (
        <Modal title={c.title} onClose={() => setWork(null)}>
          <Artwork creation={c} />
          <p className="work-text">{c.content}</p>
          <small>
            {dayKey(c.completed)} · {c.kind}
          </small>
          {c.kind === '音乐' && (
            <button
              onClick={() =>
                void playCreation(c.seed).catch(() =>
                  notify('当前浏览器暂时无法播放，请稍后再试。'),
                )
              }
            >
              听听这段旋律
            </button>
          )}
          <label>
            送给认识的居民
            <select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              {w.npcs
                .filter((n) => n.relation.familiarity > 0)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            disabled={!!c.giftedTo}
            onClick={() => mutate((x) => giftCreation(x, c.id, recipient))}
          >
            {c.giftedTo ? '已经送给朋友' : '把作品送给朋友'}
          </button>
        </Modal>
      )}
    </>
  );
}
