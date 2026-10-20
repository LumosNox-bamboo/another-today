import { careerActivityLabel } from '../engine/CareerEngine';
import { useState } from 'react';
import { type World, type Activity, activityNames, sceneNames } from '../engine/model';
import { inviteShared, sharedActions } from '../engine/SharedActivityEngine';
import { resident, canCommand } from '../engine/HouseholdEngine';
import { PixelWorld } from './PixelWorld';
import { mutate } from '../store';
export function FocusCompanion({ world: w }: { world: World }) {
  const [kind, setKind] = useState<Activity>('study');
  const [error, setError] = useState('');
  const active = w.playerActivities.find((a) => !a.returned);
  const invited = active?.invitations?.some((i) => i.residentId === w.household.active);
  return (
    <section className="focus-companion" aria-label="专注陪伴现场">
      <h3>
        {w.character.name}此刻在{sceneNames[w.activity.scene]}
        {careerActivityLabel(w)}
      </h3>
      <PixelWorld world={w} scene={w.activity.scene} />
      <p>
        {w.settings.speed === 0
          ? '游戏世界已暂停，人物会等待恢复；现实番茄钟继续计时。'
          : '画面随人物真实活动更新。你们不必使用相同的时间节奏。'}
      </p>
      <label>
        邀请一起做什么
        <select
          aria-label="共同活动"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as Activity);
            setError('');
          }}
        >
          {sharedActions.map((a) => (
            <option key={a.kind} value={a.kind} disabled={!canCommand(w.character, a.kind)}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={invited || !canCommand(w.character, kind)}
        onClick={() => {
          try {
            mutate((x) => inviteShared(x, x.household.active, kind));
            setError('');
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        {invited ? `已邀请${w.character.name}` : `邀请${w.character.name}一起`}
      </button>
      {error && <p role="alert">{error}</p>}
      <p className="muted">
        可以用上方「主控人物」切换，再邀请其他成员。邀请进入行动队列；饥饿或疲惫时 TA 会先照顾自己。
      </p>
      {(active?.invitations || []).map((i) => (
        <div key={i.residentId} className="soft-note">
          <strong>
            {resident(w, i.residentId)?.character.name} · {activityNames[i.kind]}安排 {i.minutes}{' '}
            个游戏分钟
          </strong>
          <p>
            {i.independent.length
              ? `实际经历：${i.independent.map((e) => `${activityNames[e.kind]} ${e.minutes} 分钟`).join('、')}`
              : '已加入安排，还没有新的模拟活动记录。'}
          </p>
        </div>
      ))}
    </section>
  );
}
