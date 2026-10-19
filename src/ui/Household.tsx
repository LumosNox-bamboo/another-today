import { useState } from 'react';
import { type World, type Activity, type Scene, activityNames, sceneNames } from '../engine/model';
import {
  addResident,
  cancelCommands,
  commandResident,
  lifeRole,
  lifeStage,
  resident,
  selectResident,
  setBond,
  canCommand,
} from '../engine/HouseholdEngine';
import { mutate } from '../store';
import { Avatar, Meter } from './components';

const actions: [Activity, Scene, string, string][] = [
  ['eat', 'apartment', '🍲', '做饭吃饭'],
  ['sleep', 'apartment', '🌙', '上床睡觉'],
  ['study', 'library', '✏️', '去学习'],
  ['work', 'office', '💼', '去工作'],
  ['read', 'apartment', '📖', '读一会书'],
  ['create', 'apartment', '🎨', '画画写作'],
  ['walk', 'park', '🌿', '去公园走走'],
  ['socialize', 'apartment', '💬', '在家聊天'],
  ['garden', 'apartment', '🪴', '照料植物'],
  ['play', 'apartment', '🎮', '玩一会儿'],
  ['wash', 'apartment', '🫧', '洗漱'],
  ['rest', 'apartment', '☕', '坐下来休息'],
];
const bondTypes = ['室友', '伴侣', '手足', '亲子', '祖孙'] as const;
export function Household({ world: w }: { world: World }) {
  const [name, setName] = useState(''),
    [age, setAge] = useState(10),
    [bond, setRelation] = useState<(typeof bondTypes)[number]>('室友'),
    [error, setError] = useState('');
  const members = w.household.members.length
    ? w.household.members
    : [{ id: 'resident-0', queue: [], commanded: false }];
  const active = members.find((m) => m.id === w.household.active)!;
  function perform(fn: (w: World) => void) {
    try {
      mutate(fn);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="household-panel">
      <p className="muted">
        一个家，各自的今天。点击头像切换人物；安排最多 5
        项行动，结束后恢复自主生活。精力或饱腹过低时会先照顾自己。
      </p>
      <div className="household-roster" aria-label="家庭成员">
        {members.map((m) => {
          const p = resident(w, m.id)!;
          return (
            <button
              key={m.id}
              aria-pressed={m.id === w.household.active}
              aria-label={`切换到${p.character.name}`}
              onClick={() => perform((x) => selectResident(x, m.id))}
            >
              <Avatar world={{ ...w, character: p.character }} />
              <strong>{p.character.name}</strong>
              <small>
                {p.character.age} 岁 · {lifeStage(p.character.age)}
              </small>
              <small>
                {sceneNames[p.activity.scene]} · {activityNames[p.activity.kind]}
              </small>
            </button>
          );
        })}
      </div>
      <div className="household-current">
        <div>
          <h3>{w.character.name}的安排</h3>
          <p>
            {lifeRole(w.character)} · 家庭共用 ¥{Math.round(w.money)}
          </p>
        </div>
        <Meter label="精力" value={w.needs.energy} />
        <Meter label="饱腹" value={100 - w.needs.hunger} />
      </div>
      <div className="household-actions">
        {actions
          .filter(([kind]) => canCommand(w.character, kind))
          .map(([kind, scene, icon, title]) => (
            <button
              key={kind}
              aria-label={title}
              disabled={active.queue.length >= 5}
              onClick={() =>
                perform((x) =>
                  commandResident(
                    x,
                    x.household.active,
                    kind,
                    kind === 'work'
                      ? x.character.job === '咖啡师'
                        ? 'cafe'
                        : x.character.job === '便利店店员'
                          ? 'shop'
                          : ['插画师', '作家', '自由职业者'].includes(x.character.job)
                            ? 'apartment'
                            : scene
                      : scene,
                    kind === 'sleep' ? 180 : kind === 'wash' ? 15 : 30,
                  ),
                )
              }
            >
              <span>{icon}</span>
              {title}
            </button>
          ))}
      </div>
      <div className="household-queue" aria-label="行动队列">
        <strong>
          {active.commanded ? `正在执行：${activityNames[w.activity.kind]}` : '自主生活中'}
        </strong>
        <ol>
          {active.queue.map((a, i) => (
            <li key={i}>
              {activityNames[a.kind]} · {sceneNames[a.scene]} · {a.minutes} 分钟
            </li>
          ))}
        </ol>
        <small>
          {w.settings.speed === 0
            ? '世界已暂停，恢复时间后执行安排。'
            : '下一个模拟步开始执行；切换人物不会停止其他人的行动。'}
        </small>
        {(active.commanded || active.queue.length > 0) && (
          <button onClick={() => perform((x) => cancelCommands(x, x.household.active))}>
            取消安排，恢复自主生活
          </button>
        )}
      </div>
      <h3>家里的关系</h3>
      <p className="muted">
        亲子、祖孙按「长辈 → 晚辈」设定。一起度过真实时间后，关系和回忆会慢慢变化。
      </p>
      {members
        .filter((m) => m.id !== w.household.active)
        .map((m) => {
          const p = resident(w, m.id)!;
          const b = w.household.bonds.find(
            (b) => [b.a, b.b].includes(m.id) && [b.a, b.b].includes(w.household.active),
          );
          return (
            <div className="household-relation" key={m.id}>
              <span>
                {w.character.name} ↔ {p.character.name}
                <small>{b ? `${b.type} · 亲近 ${Math.round(b.warmth)}` : '尚未设定关系'}</small>
              </span>
              <select
                aria-label={`与${p.character.name}的关系`}
                value={b?.type || ''}
                onChange={(e) =>
                  perform((x) =>
                    setBond(
                      x,
                      x.household.active,
                      m.id,
                      e.target.value as (typeof bondTypes)[number],
                    ),
                  )
                }
              >
                <option value="" disabled>
                  选择关系
                </option>
                {bondTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <button
                disabled={active.queue.length > 0 || m.queue.length > 0}
                onClick={() =>
                  perform((x) => {
                    cancelCommands(x, x.household.active);
                    cancelCommands(x, m.id);
                    commandResident(x, x.household.active, 'eat', 'apartment', 30);
                    commandResident(x, m.id, 'eat', 'apartment', 30);
                  })
                }
              >
                一起吃饭
              </button>
            </div>
          );
        })}
      {members.length < 6 && (
        <form
          className="household-add"
          onSubmit={(e) => {
            e.preventDefault();
            perform((x) => {
              addResident(x, name, age, bond);
              setName('');
            });
          }}
        >
          <h3>
            添加家庭成员 <small>{members.length} / 6</small>
          </h3>
          <label>
            成员名字
            <input value={name} maxLength={20} required onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            成员年龄
            <input
              type="number"
              min={6}
              max={100}
              required
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
            />
          </label>
          <label>
            与当前人物的关系
            <select
              value={bond}
              onChange={(e) => setRelation(e.target.value as (typeof bondTypes)[number])}
            >
              {bondTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <button type="submit">加入这个家</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
