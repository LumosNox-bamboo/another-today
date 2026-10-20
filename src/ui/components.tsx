import { majors } from '../content/careers';
import { ResidentSwitcher } from './ResidentSwitcher';
import { type ReactNode, useState } from 'react';
import { X, ChevronRight, Check } from 'lucide-react';
import { type Character, type World, traitNames, jobs, labels } from '../engine/model';
import { defaultCharacter, createWorld } from '../content/people';
import { PixelWorld } from './PixelWorld';
import { begin, mutate, useGame } from '../store';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const { world } = useGame();
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {world && !['确认操作', '确认一下', '跨设备存档'].includes(title) && (
          <ResidentSwitcher world={world} inModal />
        )}
        {children}
      </section>
    </div>
  );
}
export function Meter({
  label,
  value,
  color = '#8b9a79',
  suffix = '',
}: {
  label: string;
  value: number;
  color?: string;
  suffix?: string;
}) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <span>
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <div className="track">
        <i style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <span>✧</span>
      <p>{children}</p>
    </div>
  );
}
export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}
export function Avatar({ world, size = '' }: { world: Pick<World, 'character'>; size?: string }) {
  return (
    <div
      className={`avatar ${size}`}
      style={
        {
          '--hair': world.character.hair,
          '--outfit': world.character.outfit,
          '--skin': world.character.skin,
        } as React.CSSProperties
      }
    >
      <i className="pixel-hair" />
      <i className="pixel-face" />
      <i className="pixel-body" />
    </div>
  );
}
export function CreateCharacter({ onCancel }: { onCancel?: () => void }) {
  const [c, setC] = useState<Character>(structuredClone(defaultCharacter)),
    [step, setStep] = useState(0),
    [cash, setCash] = useState(3000),
    [busy, setBusy] = useState(false);
  const preview = createWorld(c, Date.UTC(2026, 9, 17, 8));
  const change = <K extends keyof Character>(k: K, v: Character[K]) => setC({ ...c, [k]: v });
  return (
    <div className="creation">
      <div className="creation-art">
        <div className="eyebrow">A LITTLE LIFE, BESIDE YOURS</div>
        <h1>
          另一个今天<span>Another Today</span>
        </h1>
        <p>
          你在过你的今天，
          <br />
          TA 也在过 TA 的今天。
        </p>
        <PixelWorld world={preview} scene="apartment" />
        <div className="creation-note">
          一间小屋，一个新的开始。
          <br />
          不必时刻陪伴，生活也会慢慢发生。
        </div>
      </div>
      <div className="creation-form">
        <div className="step-label">
          {String(step + 1).padStart(2, '0')} / 03 ·{' '}
          {['认识一个新朋友', '一点独特的性格', '从这里开始生活'][step]}
        </div>
        <h2>{['TA 是什么样的人？', '每个人，都有自己的节奏', '给今天一个起点'][step]}</h2>
        <p className="muted">这些是故事的起点。之后的日子，会慢慢改变 TA。</p>
        {step === 0 && (
          <div className="form-grid">
            <label>
              名字
              <input
                autoFocus
                maxLength={20}
                value={c.name}
                onChange={(e) => change('name', e.target.value)}
              />
            </label>
            <label>
              年龄
              <input
                type="number"
                min="6"
                max="100"
                value={c.age}
                onChange={(e) => change('age', Math.max(6, Math.min(100, Number(e.target.value))))}
              />
            </label>
            <label>
              性别
              <select value={c.gender} onChange={(e) => change('gender', e.target.value)}>
                {['不设定', '女性', '男性', '非二元'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              最初的职业
              <select
                value={c.job}
                onChange={(e) => change('job', e.target.value as Character['job'])}
              >
                {jobs.map((j) => (
                  <option key={j}>{j}</option>
                ))}
              </select>
            </label>
            {c.job === '学生' && c.age >= 18 && (
              <label>
                所学专业
                <select
                  aria-label="所学专业"
                  value={c.major || '通识探索'}
                  onChange={(e) => change('major', e.target.value as Character['major'])}
                >
                  {majors.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              教育背景
              <select value={c.education} onChange={(e) => change('education', e.target.value)}>
                {['大学', '高中', '职业教育', '自学者', '研究生'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              家庭背景
              <select value={c.family} onChange={(e) => change('family', e.target.value)}>
                {['普通而温暖的家庭', '从小独立生活', '热闹的大家庭', '安静的小家庭'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <div className="full appearance">
              <Avatar world={preview} size="large" />
              <div>
                {(
                  [
                    ['hair', '发色', ['#493631', '#9d704b', '#30343c', '#ba9168']],
                    ['outfit', '衣服', ['#c48362', '#81967b', '#7f9aab', '#b58b9d']],
                    ['skin', '肤色', ['#efbc94', '#d69a75', '#9f6d50', '#f4d4ba']],
                  ] as const
                ).map(([key, label, colors]) => (
                  <div className="swatch-row" key={key}>
                    <span>{label}</span>
                    {colors.map((color) => (
                      <button
                        key={color}
                        aria-label={`${label} ${color}`}
                        className={`swatch ${c[key] === color ? 'selected' : ''}`}
                        style={{ background: color }}
                        onClick={() => change(key, color)}
                      >
                        {c[key] === color && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {step === 1 && (
          <>
            <div className="trait-preset">
              {[
                ['温柔的创作者', { ...defaultCharacter.traits }],
                [
                  '好奇的探索者',
                  {
                    ...defaultCharacter.traits,
                    extraversion: 80,
                    adventure: 85,
                    openness: 90,
                    discipline: 40,
                  },
                ],
                [
                  '自律的观察者',
                  {
                    ...defaultCharacter.traits,
                    extraversion: 25,
                    discipline: 90,
                    sensitivity: 35,
                    independence: 85,
                  },
                ],
              ].map(([name, traits]) => (
                <button
                  key={String(name)}
                  onClick={() => change('traits', traits as Character['traits'])}
                >
                  {String(name)}
                </button>
              ))}
            </div>
            <div className="trait-grid">
              {Object.entries(traitNames).map(([key, label]) => (
                <label key={key}>
                  <span>
                    {label}
                    <b>{c.traits[key as keyof Character['traits']]}</b>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={c.traits[key as keyof Character['traits']]}
                    onChange={(e) =>
                      change('traits', { ...c.traits, [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="tags">
              {labels(c.traits).map((x) => (
                <Tag key={x}>{x}</Tag>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <div className="form-grid">
            <label className="full">
              人生目标
              <select value={c.goal} onChange={(e) => change('goal', e.target.value)}>
                {[
                  '出版一本属于自己的书',
                  '开一家温暖的咖啡馆',
                  '创作让自己满意的作品',
                  '积累一份安心的储蓄',
                  '认识世界，也认识自己',
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              兴趣
              <select value={c.interest} onChange={(e) => change('interest', e.target.value)}>
                {['阅读', '绘画', '音乐', '运动', '园艺', '烹饪'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              初始住房
              <select value={c.housing} onChange={(e) => change('housing', e.target.value)}>
                {['阳光公寓', '合租小屋', '带阳台的小屋'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              初始经济条件
              <select value={cash} onChange={(e) => setCash(Number(e.target.value))}>
                <option value={1200}>轻装出发 · ¥1,200</option>
                <option value={3000}>一点积蓄 · ¥3,000</option>
                <option value={8000}>宽裕一些 · ¥8,000</option>
              </select>
            </label>
            <label>
              心底的小愿望
              <input
                maxLength={120}
                value={c.hiddenWish}
                onChange={(e) => change('hiddenWish', e.target.value)}
              />
            </label>
            <div className="soft-note full">
              初始游戏时间为今天 08:00，默认以 4
              倍速度生活。关闭游戏后，下次打开会按保存的倍率补算。所有记录保存在这台电脑上。
            </div>
          </div>
        )}
        <div className="creation-actions">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)}>上一步</button>
          ) : onCancel ? (
            <button onClick={onCancel}>返回游戏</button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <button className="primary" disabled={!c.name.trim()} onClick={() => setStep(step + 1)}>
              继续认识 TA <ChevronRight size={16} />
            </button>
          ) : (
            <button
              className="primary"
              disabled={busy || !c.name.trim()}
              onClick={async () => {
                setBusy(true);
                await begin({ ...c, name: c.name.trim() });
                mutate((w) => {
                  w.money = cash;
                });
                onCancel?.();
              }}
            >
              开始另一个今天 <ChevronRight size={16} />
            </button>
          )}
        </div>
        <p className="privacy-line">无需账号 · 无需联网 · 没有签到，也没有缺席惩罚</p>
      </div>
    </div>
  );
}
