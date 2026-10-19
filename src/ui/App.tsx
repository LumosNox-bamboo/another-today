import { LivingWorld, LivingSettings, InteractionCard, CausalityView } from './LivingWorld';
import { InstallApp } from './InstallApp';
import { CloudSync } from './CloudSync';
import { lifePrompts } from '../engine/LifeInteractionEngine';
import { confirmShared } from '../engine/SharedActivityEngine';
import { useEffect, useState } from 'react';
import {
  Home,
  BookOpen,
  Users,
  Heart,
  Settings,
  Sparkles,
  MessageCircle,
  Clock,
  Maximize2,
  Minimize2,
  Leaf,
  Sun,
  Moon,
  CloudRain,
  ChevronRight,
  ArrowUpRight,
  Send,
  Pause,
  Play,
  Check,
  Download,
  Upload,
  Volume2,
  VolumeX,
  MapPin,
  Wallet,
  Flower2,
  NotebookPen,
  History,
  X,
  Trash2,
  Focus,
} from 'lucide-react';
import { useGame, mutate, persist, notify, dismissReport, compact, replaceWorld } from '../store';
import {
  type World,
  type Scene,
  type Trait,
  type LifeEvent,
  sceneNames,
  traitNames,
  activityNames,
  labels,
  dayKey,
  gameTime,
  hour,
  realDate,
  DAY,
  HOUR,
  MINUTE,
} from '../engine/model';
import { setSpeed, type CatchUpReport, catchUp } from '../engine/SimulationClock';
import { advance, resolveDecision } from '../engine/SimulationEngine';
import { reply, startFocus, returnFocus } from '../engine/ConversationEngine';
import { rememberPlayer, forget } from '../engine/MemoryEngine';
import { playerDraft } from '../engine/DiaryEngine';
import { validateWorld } from '../engine/validation';
import { exportSave } from '../persistence';
import { events, chains } from '../content/events';
import { PixelWorld } from './PixelWorld';
import { Modal, Meter, Tag, Empty, Avatar, CreateCharacter } from './components';
import { setAmbience } from './audio';
const nav = [
  ['life', '今天', Home],
  ['person', '人物', Flower2],
  ['relations', '关系', Users],
  ['diary', '双人日记', BookOpen],
  ['memory', '记忆', Heart],
  ['history', '人生档案', History],
  ['world', '世界', Leaf],
  ['settings', '设置', Settings],
] as const;
type Tab = (typeof nav)[number][0];
type ChatMessage = { role: 'player' | 'character'; text: string; remembered?: boolean };
const money = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
function dateLabel(t: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'UTC',
  }).format(t);
}
function Timeline({
  world,
  items,
  limit = 20,
}: {
  world: World;
  items: LifeEvent[];
  limit?: number;
}) {
  return (
    <div className="timeline">
      {items
        .slice(-limit)
        .reverse()
        .map((e) => (
          <article key={e.id}>
            <time>
              {gameTime(e.time)}
              <small>{dayKey(e.time).slice(5)}</small>
            </time>
            <i className={e.important ? 'important' : ''} />
            <div>
              <strong>{e.title}</strong>
              <p>{e.text}</p>
              {e.important && <Tag>{e.category}</Tag>}
              {e.cause && (
                <small className="cause">
                  最初源于：
                  {world.events.find((x) => x.id === e.cause)?.title ||
                    world.memories.find((m) => m.source === e.cause)?.content ||
                    '更早的一次相遇'}
                </small>
              )}
            </div>
          </article>
        ))}
    </div>
  );
}
export function App() {
  const s = useGame(),
    w = s.world;
  const [tab, setTab] = useState<Tab>('life'),
    [cloudOpen, setCloudOpen] = useState(false),
    [preview, setPreview] = useState<Scene | null>(null),
    [modal, setModal] = useState<'chat' | 'focus' | 'items' | 'new' | null>(null),
    [selectedAnchor, setSelectedAnchor] = useState(''),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [chatText, setChatText] = useState(''),
    [consent, setConsent] = useState(false),
    [filter, setFilter] = useState(false),
    [confirm, setConfirm] = useState<{ text: string; action: () => void } | null>(null),
    [showReturn, setShowReturn] = useState(true);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, s.compact]);
  useEffect(() => {
    setShowReturn(true);
  }, [w?.playerActivities.at(-1)?.id]);
  useEffect(() => {
    if (!w?.settings.sound) return;
    const resume = () => {
      void setAmbience(true, w.settings.volume);
    };
    window.addEventListener('pointerdown', resume, { once: true });
    return () => window.removeEventListener('pointerdown', resume);
  }, [w?.settings.sound]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirm) setConfirm(null);
        else if (modal) setModal(null);
        else if (s.report) dismissReport();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [modal, confirm, s.report]);
  function send(text = chatText) {
    if (!w || !text.trim()) return;
    let answer = '',
      saved = false;
    mutate((world) => {
      answer = reply(world, text);
      if (consent) saved = rememberPlayer(world, text, Date.now());
    });
    setMessages((m) =>
      [
        ...m,
        { role: 'player' as const, text, remembered: saved },
        { role: 'character' as const, text: answer },
      ].slice(-80),
    );
    setChatText('');
    setConsent(false);
  }
  async function importGame() {
    if (!window.desktop) {
      notify('网页版请在设置中选择 JSON 文件；桌面版支持带校验的导入。');
      return;
    }
    try {
      const r = await window.desktop.importSave();
      if (r?.error) notify(r.error);
      else if (r?.world) {
        const incoming = r.world;
        setConfirm({
          text: '导入将替换当前世界。建议先导出现在的存档。确认载入所选存档？',
          action: () => {
            void replaceWorld(incoming);
            setMessages([]);
            setPreview(null);
            notify('存档已导入。导入时不补算导出后的时间。');
          },
        });
      }
    } catch {
      notify('没有成功导入文件。');
    }
  }
  if (!s.loaded)
    return (
      <div className="loading">
        <Leaf />
        <h2>把今天慢慢打开…</h2>
      </div>
    );
  if (!w)
    return (
      <>
        <CreateCharacter />
        <button className="cloud-entry" onClick={() => setCloudOpen(true)}>
          跨设备存档 / 登录
        </button>
        {cloudOpen && (
          <Modal title="跨设备存档" onClose={() => setCloudOpen(false)}>
            <CloudSync />
          </Modal>
        )}
        {s.error && (
          <div className="recovery">
            <strong>{s.error}</strong>
            <button onClick={importGame}>导入备份</button>
            <p>选择“开始另一个今天”会创建新世界。损坏的原文件请先自行备份。</p>
          </div>
        )}
        {confirm && (
          <Modal title="确认操作" onClose={() => setConfirm(null)}>
            <p>{confirm.text}</p>
            <button
              className="primary"
              onClick={() => {
                confirm.action();
                setConfirm(null);
              }}
            >
              确认
            </button>
          </Modal>
        )}
      </>
    );
  const scene = preview || w.activity.scene,
    isNight = hour(w.time) >= 19 || hour(w.time) < 6,
    focus = w.playerActivities.find((a) => !a.returned),
    focusDue = focus && Date.now() - focus.start >= focus.expectedMinutes * MINUTE;
  const openChat = () => {
    setModal('chat');
  };
  const openFocus = () => setModal('focus');
  const changeSpeed = (speed: World['settings']['speed']) =>
    mutate((x) => {
      setSpeed(x, speed);
    });
  const sceneClick = (anchor: string) => {
    setSelectedAnchor(anchor);
    setModal('items');
  };
  return (
    <div className={`app ${s.compact ? 'compact' : ''}`}>
      {cloudOpen && (
        <Modal title="跨设备存档" onClose={() => setCloudOpen(false)}>
          <CloudSync />
        </Modal>
      )}
      {!s.compact && (
        <aside className="sidebar">
          <button className="brand" onClick={() => setTab('life')}>
            <span className="brand-mark">
              <Home size={25} />
              <i />
            </span>
            <span>
              另一个今天<small>ANOTHER TODAY</small>
            </span>
          </button>
          <div className="sidebar-caption">一段属于 TA 的小小生活</div>
          <nav>
            {nav.map(([id, label, Icon]) => (
              <button
                aria-label={label}
                key={id}
                className={tab === id ? 'active' : ''}
                onClick={() => setTab(id)}
              >
                <Icon size={19} />
                <span>{label}</span>
                {id === 'life' && w.decisions.length > 0 && <b>{w.decisions.length}</b>}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="tiny-plant">✳</div>
            <p>
              让日子慢一点，
              <br />
              让故事自然发生。
            </p>
            <small>
              <i className="status-dot" /> {window.desktop ? '本地离线世界' : '网页版'} · v0.3
            </small>
          </div>
        </aside>
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            梧桐街 <span>/</span> {nav.find((n) => n[0] === tab)?.[1]}
          </div>
          <div className="top-actions">
            <span
              className={`save-state ${s.error ? 'error' : ''}`}
              title={
                s.error ||
                `上次保存 ${s.savedAt ? new Date(s.savedAt).toLocaleTimeString() : '等待中'}`
              }
            >
              <i className="status-dot" />
              {s.error ? '保存异常' : s.saving ? '正在保存' : '已保存在本地'}
            </span>
            {window.desktop && (
              <button
                className="icon-button"
                title={s.compact ? '完整观察模式' : '桌面小窗 · 自动切换 1 倍'}
                aria-label={s.compact ? '完整观察模式' : '桌面小窗'}
                onClick={() => void compact(!s.compact)}
              >
                {s.compact ? <Maximize2 size={17} /> : <Minimize2 size={17} />}
              </button>
            )}
            <button
              className="icon-button"
              aria-label="环境音"
              title={w.settings.sound ? '关闭环境音' : '开启环境音'}
              onClick={() => {
                const next = !w.settings.sound;
                void setAmbience(next, w.settings.volume);
                mutate((x) => {
                  x.settings.sound = next;
                });
              }}
            >
              {w.settings.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
          </div>
        </header>
        {(s.notice || s.error) && (
          <div className={`notice ${s.error ? 'warning' : ''}`}>
            <span>{s.error || s.notice}</span>
            <button
              className="icon-button"
              aria-label="关闭提示"
              onClick={() => (s.error ? void persist() : notify(''))}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {focusDue && showReturn && (
          <div className="focus-notice">
            <Leaf size={16} />
            <span>预计的专注时间到了。实际做了什么，等你有空再告诉我。</span>
            <button onClick={openFocus}>我回来了</button>
            <button
              className="icon-button"
              aria-label="稍后提醒"
              onClick={() => setShowReturn(false)}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <main>
          {s.cloudPaused && (
            <div className="notice" role="status">
              云存档正在交接，本机生活已暂时停下。
              <button onClick={() => setTab('settings')}>处理云存档</button>
            </div>
          )}
          {tab === 'world' && !s.compact && <LivingWorld world={w} />}
          {tab === 'life' && !s.compact && (
            <InteractionCard
              world={w}
              onChat={(text) => {
                setModal('chat');
                if (text) setMessages((m) => [...m, { role: 'character', text }]);
              }}
            />
          )}
          {(tab === 'life' || s.compact) && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">LIFE, AT ITS OWN PACE</div>
                  <h1>
                    {isNight ? '夜色正温柔' : '又是一个小小的今天'}
                    <span className="heading-dot">✳</span>
                  </h1>
                  <p>
                    你在过你的今天，{w.character.name}也在过{w.character.name}的今天。
                  </p>
                </div>
                <button className="quiet-button" onClick={openFocus}>
                  <Focus size={16} />
                  {focus ? '正在一起专注' : '一起专注'}
                  <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="life-grid">
                <section className="world-card">
                  <div className="world-toolbar">
                    <div className="location">
                      <span className="location-icon">
                        <MapPin size={17} />
                      </span>
                      <div>
                        <strong>{sceneNames[scene]}</strong>
                        <small>
                          {preview && preview !== w.activity.scene
                            ? '正在浏览 · 小人不在这里'
                            : scene === 'apartment'
                              ? w.character.housing + ' · 梧桐街 07 号'
                              : '按自己的节奏，走过这座小镇'}
                        </small>
                      </div>
                    </div>
                    <div className="weather">
                      {isNight ? (
                        <Moon size={18} />
                      ) : Math.floor(w.time / DAY) % 4 === 0 ? (
                        <CloudRain size={18} />
                      ) : (
                        <Sun size={18} />
                      )}
                      <span>
                        {gameTime(w.time)}
                        <small>{dateLabel(w.time)}</small>
                      </span>
                    </div>
                  </div>
                  <div className="scene-view">
                    <PixelWorld world={w} scene={scene} onObject={sceneClick} />
                    <div className="scene-caption">
                      <i className="status-dot" />
                      {w.character.name}正在{activityNames[w.activity.kind]}
                    </div>
                    <span className="scene-corner">梧桐街 · {isNight ? '夜' : '日'}</span>
                  </div>
                  <div className="scene-footer">
                    <div className="scene-tabs">
                      <button
                        className={!preview ? 'selected' : ''}
                        onClick={() => setPreview(null)}
                      >
                        跟随 TA
                      </button>
                      {(Object.entries(sceneNames) as [Scene, string][]).map(([id, name]) => (
                        <button
                          key={id}
                          className={preview === id ? 'selected' : ''}
                          onClick={() => setPreview(id)}
                        >
                          {name
                            .replace('梧桐', '')
                            .replace('转角', '')
                            .replace('晚风', '')
                            .replace('月光', '')
                            .replace('街角', '')
                            .replace('小小', '')
                            .replace('星夜', '')}
                        </button>
                      ))}
                    </div>
                    <div className="time-controls">
                      <span>
                        <Clock size={13} />
                        {w.settings.speed === 0
                          ? '世界已暂停'
                          : w.settings.speed === 1
                            ? '现实同步陪伴'
                            : '人生观察加速'}
                      </span>
                      <div>
                        {([0, 1, 4, 12] as const).map((speed) => (
                          <button
                            key={speed}
                            title={speed === 0 ? '暂停' : `${speed} 倍速`}
                            aria-label={speed === 0 ? '暂停' : `${speed} 倍速`}
                            className={w.settings.speed === speed ? 'selected' : ''}
                            onClick={() => changeSpeed(speed)}
                          >
                            {speed === 0 ? <Pause size={12} /> : <>{speed}×</>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
                <aside className="right-column">
                  <section className="character-card">
                    <div className="card-kicker">
                      此刻的 TA <Leaf size={15} />
                    </div>
                    <div className="character-title">
                      <Avatar world={w} />
                      <div>
                        <h2>
                          {w.character.name}
                          <span>●</span>
                        </h2>
                        <p>
                          {w.character.age} 岁 · {w.character.job}
                        </p>
                      </div>
                      <button
                        className="icon-button"
                        aria-label="查看人物"
                        onClick={() => setTab('person')}
                      >
                        <ArrowUpRight size={19} />
                      </button>
                    </div>
                    <div className="tags">
                      {labels(w.character.traits)
                        .slice(0, 3)
                        .map((l) => (
                          <Tag key={l}>{l}</Tag>
                        ))}
                    </div>
                    <div className="needs">
                      <Meter label="心情" value={w.needs.mood} color="#d0ad71" />
                      <Meter label="精力" value={w.needs.energy} color="#8c9d7e" />
                      <Meter label="饱腹" value={100 - w.needs.hunger} color="#b98f74" />
                    </div>
                    <div className="wallet">
                      <span>
                        <Wallet size={15} /> 一点小积蓄
                      </span>
                      <strong>¥ {money(w.money)}</strong>
                    </div>
                    <div className="small-goal">
                      <Sparkles size={15} />
                      <p>
                        <small>心里藏着的小愿望</small>
                        {w.character.goal}
                      </p>
                    </div>
                  </section>
                  <section className="chat-invite">
                    <div className="chat-bubble">
                      <span>“</span>
                      {w.events.filter((e) => e.definition !== 'activity').at(-1)?.text ||
                        '今天也按自己的节奏生活。'}
                    </div>
                    <button onClick={openChat}>
                      <MessageCircle size={16} />和{w.character.name}聊聊天
                      <ArrowUpRight size={15} />
                    </button>
                  </section>
                </aside>
              </div>
              {!s.compact && (
                <div className="below-grid">
                  <section className="card today-card">
                    <header className="section-heading">
                      <div>
                        <span className="eyebrow">LITTLE MOMENTS</span>
                        <h2>
                          今天的小事{' '}
                          <span>
                            {w.events.filter((e) => dayKey(e.time) === dayKey(w.time)).length}
                          </span>
                        </h2>
                      </div>
                      <button className="text-button" onClick={() => setTab('history')}>
                        翻看全部 <ChevronRight size={14} />
                      </button>
                    </header>
                    <Timeline
                      world={w}
                      items={w.events.filter((e) => dayKey(e.time) === dayKey(w.time))}
                      limit={4}
                    />
                  </section>
                  <section className="card together-card">
                    <span className="eyebrow">TWO LIVES, ONE DAY</span>
                    <h2>我们的今天</h2>
                    <div className="two-stems">
                      <div>
                        <span>你</span>
                        <i />
                        <p>{focus ? `计划${focus.label}` : '今天，想留下什么？'}</p>
                      </div>
                      <div>
                        <span>{w.character.name}</span>
                        <i />
                        <p>{activityNames[w.activity.kind]}</p>
                      </div>
                    </div>
                    <p className="muted">不同的日子，也有交汇的片刻。</p>
                    <button className="quiet-button" onClick={() => setTab('diary')}>
                      打开双人日记 <BookOpen size={15} />
                    </button>
                  </section>
                </div>
              )}
              {w.decisions.length > 0 && !s.compact && (
                <section className="card decisions">
                  <h2>有件小事，想听听你</h2>
                  <p className="muted">不着急回答。等你想好时，生活也一直继续。</p>
                  {w.decisions.map((d) => (
                    <article key={d.id}>
                      <div>
                        <strong>{d.title}</strong>
                        <p>{d.text}</p>
                      </div>
                      <div className="button-row">
                        <button
                          className="primary"
                          onClick={() => mutate((x) => resolveDecision(x, d.id, 'yes'))}
                        >
                          鼓励尝试
                        </button>
                        <button onClick={() => mutate((x) => resolveDecision(x, d.id, 'no'))}>
                          {d.id.startsWith('conflict') ? '平静告别' : '先慢一点'}
                        </button>
                        <button onClick={() => mutate((x) => resolveDecision(x, d.id, 'self'))}>
                          由 TA 决定
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
              )}
              {s.compact && (
                <div className="compact-actions">
                  <button onClick={openChat}>
                    <MessageCircle size={16} /> 聊聊
                  </button>
                  <button onClick={openFocus}>
                    <Focus size={16} /> 专注
                  </button>
                  {w.decisions.length > 0 && (
                    <button
                      onClick={() => {
                        void compact(false);
                        setTab('life');
                      }}
                    >
                      待商量 {w.decisions.length}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {tab === 'person' && !s.compact && (
            <>
              <PageTitle
                eyebrow="A PERSON, ALWAYS BECOMING"
                title={`${w.character.name}的人物小笺`}
                text="起点不是终点，性格会在日常里慢慢改变。"
              />
              <div className="profile-grid">
                <section className="card">
                  <div className="profile-heading">
                    <Avatar world={w} size="large" />
                    <div>
                      <h2>{w.character.name}</h2>
                      <p>
                        {w.character.age} 岁 · {w.character.gender} · {w.character.job}
                      </p>
                      <div className="tags">
                        {labels(w.character.traits).map((l) => (
                          <Tag key={l}>{l}</Tag>
                        ))}
                      </div>
                    </div>
                  </div>
                  <dl className="facts">
                    <dt>教育背景</dt>
                    <dd>{w.character.education}</dd>
                    <dt>家庭背景</dt>
                    <dd>{w.character.family}</dd>
                    <dt>居所</dt>
                    <dd>{w.character.housing}</dd>
                    <dt>兴趣</dt>
                    <dd>{w.character.interest}</dd>
                    <dt>职业阶段</dt>
                    <dd>
                      第 {w.character.careerLevel} 阶段 · 技能 {w.character.skill.toFixed(1)}
                    </dd>
                  </dl>
                  <h3>慢慢靠近的愿望</h3>
                  <p>{w.character.goal}</p>
                  <Meter
                    label={
                      w.character.goalProgress < 33
                        ? '阶段一 · 养成习惯'
                        : w.character.goalProgress < 66
                          ? '阶段二 · 积累作品'
                          : '阶段三 · 完成自己的计划'
                    }
                    value={w.character.goalProgress}
                  />
                  <div className="soft-note">藏在心里：{w.character.hiddenWish}</div>
                  <h3>完整状态</h3>
                  <div className="trait-grid">
                    {Object.entries({
                      energy: '精力',
                      hunger: '饥饿',
                      mood: '心情',
                      stress: '压力',
                      social: '社交需求',
                      fun: '娱乐满足',
                      health: '健康',
                    }).map(([k, l]) => (
                      <Meter key={k} label={l} value={w.needs[k as keyof World['needs']]} />
                    ))}
                  </div>
                </section>
                <section className="card">
                  <h2>性格的十个侧面</h2>
                  <div className="trait-grid personality">
                    {Object.entries(traitNames).map(([k, label]) => (
                      <Meter key={k} label={label} value={w.character.traits[k as Trait]} />
                    ))}
                  </div>
                  <h3>最近的改变</h3>
                  {w.evolution.length ? (
                    w.evolution
                      .slice(-6)
                      .reverse()
                      .map((e, i) => (
                        <div className="evolution" key={i}>
                          <span>{dayKey(e.time)}</span>
                          <p>
                            {e.reason}
                            <small>
                              {traitNames[e.trait]} +{e.delta.toFixed(2)}
                            </small>
                          </p>
                        </div>
                      ))
                  ) : (
                    <Empty>改变还在酝酿。让生活先发生一点点。</Empty>
                  )}
                </section>
              </div>
            </>
          )}
          {tab === 'relations' && !s.compact && (
            <>
              <PageTitle
                eyebrow="PEOPLE ALONG THE WAY"
                title="梧桐街上的人们"
                text="每个人都有自己的计划，有些故事会与你的故事相遇。"
              />
              <div className="relation-grid">
                {w.npcs.map((n, i) => (
                  <section key={n.id} className="card npc-card">
                    <div className="npc-heading">
                      <span className={`npc-avatar n${i % 4}`}>{n.name.slice(0, 1)}</span>
                      <div>
                        <h3>{n.name}</h3>
                        <p>
                          {n.age} 岁 · {n.job} · {n.interest}
                        </p>
                      </div>
                      <Tag>{n.relation.type}</Tag>
                    </div>
                    <p className="npc-location">
                      <MapPin size={13} />
                      {sceneNames[n.scene]} · {n.plan}
                    </p>
                    <div className="relation-meters">
                      {Object.entries({
                        familiarity: '熟悉',
                        affection: '好感',
                        trust: '信任',
                        intimacy: '亲密',
                        conflict: '分歧',
                      }).map(([k, label]) => (
                        <Meter
                          key={k}
                          label={label}
                          value={n.relation[k as 'familiarity']}
                          color={k === 'conflict' ? '#bc8e77' : '#93a184'}
                        />
                      ))}
                    </div>
                    <p className="npc-story">{n.memories.at(-1) || '还没有听到 TA 最近的故事。'}</p>
                  </section>
                ))}
              </div>
              <section className="card companion">
                <h2>你和{w.character.name}</h2>
                <p>相处不以签到衡量。每一次自愿的分享，都是新的认识。</p>
                <div className="trait-grid">
                  <Meter label="熟悉感" value={w.companion.familiarity} />
                  <Meter label="信任感" value={w.companion.trust} />
                </div>
                <p className="muted">
                  交流 {w.companion.conversations} 次 · 已授权的共同记忆{' '}
                  {w.memories.filter((m) => m.subject === 'player').length} 条
                </p>
              </section>
            </>
          )}
          {tab === 'diary' && !s.compact && <DiaryView world={w} />}
          {tab === 'memory' && !s.compact && (
            <>
              <PageTitle
                eyebrow="THINGS WORTH KEEPING"
                title="记忆的小抽屉"
                text="小人的生活由事件留下痕迹。关于你的记忆，只来自你明确授权的分享。"
              />
              <div className="profile-grid">
                {(['player', 'character'] as const).map((subject) => (
                  <section className="card" key={subject}>
                    <h2>{subject === 'player' ? '你让 TA 记住的事' : 'TA 自己的回忆'}</h2>
                    {w.memories.filter((m) =>
                      subject === 'player' ? m.subject === 'player' : m.subject !== 'player',
                    ).length === 0 ? (
                      <Empty>
                        {subject === 'player'
                          ? '还没有保存你的私人信息。聊天时可以主动选择“允许记住这条分享”。'
                          : '属于今天的记忆，正在慢慢积累。'}
                      </Empty>
                    ) : (
                      w.memories
                        .filter((m) =>
                          subject === 'player' ? m.subject === 'player' : m.subject !== 'player',
                        )
                        .slice()
                        .reverse()
                        .map((m) => (
                          <article className="memory" key={m.id}>
                            <div>
                              <small>
                                {subject === 'player'
                                  ? new Date(m.timestamp).toLocaleDateString()
                                  : dayKey(m.timestamp)}{' '}
                                · {m.emotion}
                              </small>
                              <p>{m.content}</p>
                              <div className="tags">
                                {m.tags.slice(0, 2).map((t) => (
                                  <Tag key={t}>{t}</Tag>
                                ))}
                              </div>
                            </div>
                            <button
                              className="icon-button"
                              aria-label={`删除记忆 ${m.content.slice(0, 15)}`}
                              onClick={() =>
                                setConfirm({
                                  text: '删除这条长期记忆？已手动保存的玩家日记独立保留，如有引用请在日记中修改。',
                                  action: () => mutate((x) => forget(x, m.id)),
                                })
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </article>
                        ))
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
          {tab === 'history' && !s.compact && (
            <>
              <PageTitle
                eyebrow="A LIFE IN LITTLE CHAPTERS"
                title="人生的慢慢长卷"
                text="不是每一天都有转折，但每一个片刻都是真实发生过的。"
              />
              <CausalityView world={w} />
              <div className="history-layout">
                <section className="card">
                  <header className="section-heading">
                    <h2>生活时间线</h2>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={filter}
                        onChange={(e) => setFilter(e.target.checked)}
                      />
                      只看重要事件
                    </label>
                  </header>
                  <p className="muted">
                    显示最近 {filter ? '重要事件' : '生活事件'}，最多 100 条。每日整理保存在日记中。
                  </p>
                  <Timeline
                    world={w}
                    items={w.events.filter((e) => !filter || e.important)}
                    limit={100}
                  />
                </section>
                <aside>
                  <section className="card">
                    <h2>正在展开的故事</h2>
                    {w.chains.length ? (
                      w.chains.map((c) => (
                        <div className="chain" key={c.id}>
                          <strong>{chains.find((d) => d.id === c.id)?.title}</strong>
                          <small>
                            {c.status === 'active'
                              ? `第 ${c.stage} / 4 个片刻 · ${w.decisions.some((d) => d.chainId === c.id) ? '等你聊聊' : `下一步不早于 ${dayKey(c.due)}`}`
                              : c.status === 'complete'
                                ? '新的开始'
                                : '按照自己的节奏结束'}
                          </small>
                        </div>
                      ))
                    ) : (
                      <Empty>一些故事，最初只是一次普通的出门。</Empty>
                    )}
                  </section>
                  <section className="card">
                    <h2>收支小本</h2>
                    <div className="ledger-total">¥ {money(w.money)}</div>
                    {w.ledger
                      .slice(-15)
                      .reverse()
                      .map((l) => (
                        <div className="ledger" key={l.id}>
                          <div>
                            {l.reason}
                            <small>
                              {dayKey(l.time)} {gameTime(l.time)}
                            </small>
                          </div>
                          <b className={l.amount >= 0 ? 'income' : ''}>
                            {l.amount >= 0 ? '+' : ''}
                            {money(l.amount)}
                          </b>
                        </div>
                      ))}
                  </section>
                </aside>
              </div>
            </>
          )}
          {tab === 'settings' && !s.compact && (
            <SettingsView
              world={w}
              importGame={importGame}
              newGame={() =>
                setConfirm({
                  text: '重新开始会替换当前世界。请先导出存档留作备份。确认进入角色创建？',
                  action: () => setModal('new'),
                })
              }
            />
          )}
          {!s.compact && (
            <footer className="page-footer">
              <Leaf size={13} />
              <span>今天不必完美，也值得被记住。</span>
              <span>
                游戏世界 {dayKey(w.time)} · 现实 {realDate(Date.now())}
              </span>
            </footer>
          )}
        </main>
      </div>
      {modal === 'chat' && (
        <Modal title={`和${w.character.name}聊聊天`} onClose={() => setModal(null)}>
          <div className="chat-meta">
            <Avatar world={w} />
            <div>
              <strong>{w.character.name}</strong>
              <p>离线对话 · 依据真实模拟事件与已授权记忆</p>
            </div>
          </div>
          <div
            className="messages"
            ref={(el) => {
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            <div className="message character">
              你回来啦。我正在{activityNames[w.activity.kind]}，今天也有自己的小小进度。你想聊什么？
            </div>
            {messages.map((m, i) => (
              <div className={`message ${m.role}`} key={i}>
                {m.text}
                {m.remembered && (
                  <small>
                    <Check size={12} />
                    已按你的授权保存记忆
                  </small>
                )}
              </div>
            ))}
          </div>
          <div className="quick-prompts">
            {['你今天做了什么？', '你记得我什么？', '今天有点累', ...lifePrompts].map((text) => (
              <button key={text} onClick={() => send(text)}>
                {text}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <div className="chat-input">
              <textarea
                aria-label="聊天内容"
                placeholder="把今天的一小段，告诉 TA…"
                maxLength={2000}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                className="primary"
                type="submit"
                aria-label="发送"
                disabled={!chatText.trim()}
              >
                <Send size={18} />
              </button>
            </div>
            <label className="check consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              允许记住这条分享（可随时删除）
            </label>
          </form>
          <small className="muted">
            未授权的聊天不写入存档。离线规则对话理解有限；它不会推断你未说明的经历。
          </small>
        </Modal>
      )}
      {modal === 'focus' && <FocusModal world={w} onClose={() => setModal(null)} />}
      {modal === 'items' && (
        <Modal title="物件也有自己的记忆" onClose={() => setModal(null)}>
          {w.items.filter((i) => i.anchor === selectedAnchor).length ? (
            w.items
              .filter((i) => i.anchor === selectedAnchor)
              .map((i) => (
                <article className="item-memory" key={i.id}>
                  <Flower2 size={28} />
                  <h3>{i.name}</h3>
                  <p>{i.description}</p>
                  <small>
                    {dayKey(i.acquired)} 来到这里 · 使用 {i.uses} 次
                  </small>
                  <p className="muted">
                    来源：{w.events.find((e) => e.id === i.source)?.title || i.source}
                  </p>
                </article>
              ))
          ) : (
            <Empty>
              {selectedAnchor === 'bed'
                ? '一张可以好好休息的床。今晚也会在这里睡个好觉。'
                : selectedAnchor === 'kitchen'
                  ? '熟悉的厨房。普通的饭菜，照顾普通的一天。'
                  : '一张适合放空、阅读的沙发。'}
            </Empty>
          )}
        </Modal>
      )}
      {modal === 'new' && (
        <div className="new-game-overlay">
          <CreateCharacter
            onCancel={() => {
              setModal(null);
              setMessages([]);
              setPreview(null);
              setTab('life');
            }}
          />
        </div>
      )}
      {s.report && (
        <Welcome
          world={w}
          report={s.report}
          onClose={dismissReport}
          onChat={() => {
            dismissReport();
            openChat();
          }}
        />
      )}
      {confirm && (
        <Modal title="确认一下" onClose={() => setConfirm(null)}>
          <p>{confirm.text}</p>
          <div className="button-row end">
            <button onClick={() => setConfirm(null)}>取消</button>
            <button
              className="primary"
              onClick={() => {
                confirm.action();
                setConfirm(null);
              }}
            >
              确认
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function PageTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
function Welcome({
  world: w,
  report: r,
  onClose,
  onChat,
}: {
  world: World;
  report: CatchUpReport;
  onClose: () => void;
  onChat: () => void;
}) {
  const [detail, setDetail] = useState(false),
    [important, setImportant] = useState(false);
  const list = w.events.filter((e) => r.events.includes(e.id) && (!important || e.important));
  return (
    <Modal title={r.crossedNight ? '昨夜与今晨' : '你不在的这段时间'} onClose={onClose} wide>
      <div className="welcome-intro">
        <Avatar world={w} size="large" />
        <div>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>你回来啦，今天也有自己的故事。</h2>
          <p>
            现实经过 {Math.round(r.realElapsed / MINUTE)} 分钟 · 游戏推进{' '}
            {(r.gameElapsed / HOUR).toFixed(1)} 小时
          </p>
        </div>
      </div>
      <p className="soft-note">
        {r.events.length
          ? list
              .filter((e) => e.definition !== 'activity')
              .slice(-3)
              .map((e) => e.text)
              .join(' ') || '按平常的节奏吃饭、休息，照顾好自己。'
          : '这段时间很平静，生活按自己的节奏继续。'}
        {r.skipped > 0 &&
          ` 离线补算上限之外的 ${(r.skipped / DAY).toFixed(1)} 个游戏日视作休整，没有推进游戏日期，也未产生收入或事件。`}
      </p>
      <div className="return-stats">
        {[
          ['心情', `${r.moodDelta >= 0 ? '+' : ''}${r.moodDelta.toFixed(0)}`],
          ['积蓄', `${r.moneyDelta >= 0 ? '+' : ''}¥${money(r.moneyDelta)}`],
          ['新记忆', r.newMemories],
          ['关系熟悉度', `+${r.relationshipDelta}`],
          ['新物品', r.newItems],
        ].map(([label, v]) => (
          <div key={label}>
            <strong>{v}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <div className="button-row">
        <button onClick={() => setDetail(!detail)}>
          {detail ? '收起时间线' : '查看详细时间线'}
        </button>
        <button
          onClick={() => {
            setImportant(!important);
            setDetail(true);
          }}
        >
          {important ? '显示所有小事' : '只看重要事件'}
        </button>
      </div>
      {detail && (
        <div className="return-timeline">
          <Timeline world={w} items={list} limit={100} />
          <small className="muted">最多展示最近 100 条。更早的每天，已经整理进小人的日记。</small>
        </div>
      )}
      <div className="button-row end">
        <button onClick={onClose}>继续观察</button>
        <button className="primary" onClick={onChat}>
          聊聊这段时间 <MessageCircle size={15} />
        </button>
      </div>
    </Modal>
  );
}
function FocusModal({ world: w, onClose }: { world: World; onClose: () => void }) {
  const [label, setLabel] = useState('学习'),
    [custom, setCustom] = useState(''),
    [minutes, setMinutes] = useState(25),
    [actual, setActual] = useState(''),
    [note, setNote] = useState('');
  const active = w.playerActivities.find((a) => !a.returned),
    last = w.playerActivities.at(-1);
  return (
    <Modal title="一起专注，各自生活" onClose={onClose}>
      {active ? (
        <>
          <div className="focus-clock">
            {Math.max(0, Math.floor((Date.now() - active.start) / MINUTE))}
            <small>分钟后，仍在这里</small>
          </div>
          <p className="center">
            原计划{active.label} {active.expectedMinutes} 分钟。实际完成情况由你回来后确认。
          </p>
          <div className="soft-note">
            {w.character.name}正在{activityNames[w.activity.kind]}。你专注的时候，TA
            也有自己的安排。
          </div>
          <button
            className="primary full-button"
            onClick={() => mutate((x) => returnFocus(x, Date.now()))}
          >
            我回来了
          </button>
        </>
      ) : last?.returned && last.confirmedMinutes === undefined ? (
        <>
          <p>
            原计划{last.label} {last.expectedMinutes}分钟，
            {Math.round((last.returned - last.start) / MINUTE)}分钟后返回游戏。
            <b>这不等于实际活动时长。</b>
          </p>
          <label>
            实际进行了多少分钟？（由你确认）
            <input
              aria-label="实际活动分钟"
              type="number"
              min="0"
              max="1440"
              placeholder="例如 20"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </label>
          <label>
            实际做了什么？
            <textarea
              maxLength={2000}
              placeholder="只记录你愿意告诉 TA 的部分"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="button-row end">
            <button onClick={onClose}>暂不确认</button>
            <button
              className="primary"
              disabled={
                actual === '' ||
                !Number.isFinite(Number(actual)) ||
                Number(actual) < 0 ||
                Number(actual) > 1440
              }
              onClick={() => {
                mutate((x) => {
                  confirmShared(x, last.id, Number(actual), note);
                });
                onClose();
              }}
            >
              确认保存
            </button>
            <button
              onClick={() => {
                mutate((x) => {
                  x.playerActivities = x.playerActivities.filter((a) => a.id !== last.id);
                });
              }}
            >
              删除这次计划
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">不用打卡，不扣分。你回来时，再交换今天的小小进度。</p>
          <div className="form-grid">
            <label>
              准备做什么
              <select value={label} onChange={(e) => setLabel(e.target.value)}>
                {['学习', '工作', '阅读', '运动', '休息', '睡前回顾', '自定义事项'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              预计时间（分钟）
              <input
                aria-label="预计分钟"
                type="number"
                min="1"
                max="1440"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
          </div>
          <div>
            {label === '自定义事项' && (
              <label>
                事项名称
                <input
                  maxLength={100}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="例如：练习钢琴"
                />
              </label>
            )}
          </div>
          <div className="quick-prompts">
            {[15, 25, 30, 45, 60].map((m) => (
              <button key={m} onClick={() => setMinutes(m)}>
                {m} 分钟
              </button>
            ))}
          </div>
          <button
            className="primary full-button"
            disabled={!Number.isFinite(minutes) || minutes < 1 || minutes > 1440}
            onClick={() => {
              mutate((x) =>
                startFocus(
                  x,
                  label === '自定义事项' ? custom.trim() || '自定义事项' : label,
                  minutes,
                  Date.now(),
                ),
              );
            }}
          >
            开始一起专注 <Leaf size={15} />
          </button>
        </>
      )}
    </Modal>
  );
}
function DiaryView({ world: w }: { world: World }) {
  const [playerDate, setPlayerDate] = useState(realDate(Date.now())),
    [gameDate, setGameDate] = useState(dayKey(w.time)),
    [draft, setDraft] = useState(
      w.playerDiaries.find((d) => d.date === realDate(Date.now()))?.text || '',
    ),
    [editing, setEditing] = useState(false);
  const saved = w.playerDiaries.find((d) => d.date === playerDate),
    diary = w.diaries.find((d) => d.date === gameDate);
  const dayEvents = w.events.filter((e) => dayKey(e.time) === gameDate);
  const setDate = (v: string) => {
    setPlayerDate(v);
    setDraft(w.playerDiaries.find((d) => d.date === v)?.text || '');
    setEditing(false);
  };
  return (
    <>
      <PageTitle
        eyebrow="TWO LIVES, ONE DAY"
        title="我们的今天"
        text="虽然过着不同的生活，今天也有属于我们的共同片刻。"
      />
      <div className="diary-grid">
        <section className="diary-page">
          <header>
            <span className="diary-person">
              你<span>现实中的一天</span>
            </span>
            <input
              aria-label="玩家日记日期"
              type="date"
              value={playerDate}
              onChange={(e) => setDate(e.target.value)}
            />
          </header>
          <div className="diary-line" />
          <h2>{playerDate.slice(5).replace('-', '月')}日 · 我的小小记录</h2>
          <p className="diary-intro">只写下你真实提供的片刻。</p>
          {editing ? (
            <textarea
              className="diary-editor"
              aria-label="玩家日记正文"
              maxLength={12000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="今天发生了什么？从一件小事写起…"
            />
          ) : saved?.text ? (
            <p className="diary-prose">{saved.text}</p>
          ) : (
            <Empty>这页还是空白。可以自己写，也可以把已确认的分享整理成草稿。</Empty>
          )}
          <div className="button-row">
            {editing ? (
              <>
                <button
                  className="primary"
                  onClick={() => {
                    mutate((x) => {
                      x.playerDiaries = x.playerDiaries.filter((d) => d.date !== playerDate);
                      x.playerDiaries.push({ date: playerDate, text: draft });
                      x.playerDiaries = x.playerDiaries.slice(-400);
                    });
                    setEditing(false);
                    notify('玩家日记已保存。');
                  }}
                >
                  保存这一页
                </button>
                <button
                  onClick={() => {
                    setDraft(saved?.text || '');
                    setEditing(false);
                  }}
                >
                  取消编辑
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setDraft(saved?.text || '');
                  setEditing(true);
                }}
              >
                <NotebookPen size={15} />
                自己写几句
              </button>
            )}
            <button
              onClick={() => {
                const text = playerDraft(w, playerDate);
                if (!text) {
                  notify('这一天没有已授权的分享或活动记录，不会自动补写经历。');
                  return;
                }
                setDraft(draft ? `${draft}\n\n${text}` : text);
                setEditing(true);
              }}
            >
              整理已确认记录
            </button>
          </div>
          <div className="player-activity-list">
            {w.playerActivities
              .filter((a) => realDate(a.start) === playerDate)
              .map((a) => (
                <article key={a.id}>
                  <Clock size={14} />
                  <div>
                    <strong>{a.label}</strong>
                    <p>
                      计划 {a.expectedMinutes} 分钟 ·{' '}
                      {a.confirmedMinutes !== undefined
                        ? `确认实际 ${a.confirmedMinutes} 分钟`
                        : a.returned
                          ? '已返回，实际时长未确认'
                          : '完成情况待确认'}
                    </p>
                    {a.note && <p>{a.note}</p>}
                  </div>
                </article>
              ))}
          </div>
        </section>
        <section className="diary-page character-diary">
          <header>
            <span className="diary-person">
              {w.character.name}
              <span>游戏世界的一天</span>
            </span>
            <select
              aria-label="小人日记日期"
              value={gameDate}
              onChange={(e) => setGameDate(e.target.value)}
            >
              {[...new Set([dayKey(w.time), ...w.diaries.map((d) => d.date)])]
                .sort()
                .reverse()
                .map((d) => (
                  <option key={d}>{d}</option>
                ))}
            </select>
          </header>
          <div className="diary-line" />
          <h2>{diary?.title || `${gameDate.slice(5).replace('-', '月')}日 · 还在继续的今天`}</h2>
          <p className="diary-intro">
            {diary
              ? `心情：${diary.mood} · 基于 ${diary.eventIds.length} 条实际事件`
              : '每日结束时自动整理，每个游戏日只有一篇正式日记。'}
          </p>
          {diary ? (
            <p className="diary-prose">{diary.body}</p>
          ) : (
            <Timeline world={w} items={dayEvents} limit={8} />
          )}
          <div className="diary-signature">
            慢慢来，今天也很好。
            <br />
            <span>— {w.character.name}</span>
          </div>
        </section>
      </div>
      <p className="diary-footnote">
        现实日期与游戏日期独立；加速模式下，一个现实日可能对应多个游戏日。
      </p>
    </>
  );
}
function SettingsView({
  world: w,
  importGame,
  newGame,
}: {
  world: World;
  importGame: () => void;
  newGame: () => void;
}) {
  const [paths, setPaths] = useState('浏览器 localStorage（与桌面存档分开）');
  useEffect(() => {
    void window.desktop?.paths().then((p) => setPaths(p.data));
  }, []);
  return (
    <>
      <PageTitle
        eyebrow="MAKE YOURSELF AT HOME"
        title="按自己的节奏"
        text="没有必须完成的任务，也没有必须赶上的今天。"
      />
      <div className="settings-grid">
        <CloudSync />
        <InstallApp />
        <LivingSettings world={w} />
        <section className="card">
          <h2>时间与自主生活</h2>
          <label>
            游戏时间倍率
            <select
              value={w.settings.speed}
              onChange={(e) =>
                mutate((x) => {
                  setSpeed(x, Number(e.target.value) as World['settings']['speed']);
                })
              }
            >
              <option value={0}>暂停（关闭后也不推进）</option>
              <option value={1}>1× 现实同步陪伴</option>
              <option value={4}>4× 人生观察加速</option>
              <option value={12}>12× 人生观察加速</option>
            </select>
          </label>
          <label>
            最多补算的游戏时间
            <select
              value={w.settings.offlineDays}
              onChange={(e) =>
                mutate((x) => {
                  x.settings.offlineDays = Number(e.target.value) as 1 | 7 | 30;
                })
              }
            >
              <option value={1}>1 个游戏日</option>
              <option value={7}>7 个游戏日（推荐）</option>
              <option value={30}>30 个游戏日</option>
            </select>
          </label>
          <p className="muted">
            全部按固定步长计算，长段经历整理为逐日日记。超过上限的离线时段视作休整，不产生额外收入或重大变化。
          </p>
          <label>
            建议参与方式
            <select
              value={w.settings.advice}
              onChange={(e) =>
                mutate((x) => {
                  x.settings.advice = e.target.value as World['settings']['advice'];
                })
              }
            >
              <option value="autonomous">自主生活 · 小故事由 TA 选择</option>
              <option value="sometimes">偶尔征求建议</option>
              <option value="important">重要事情询问</option>
            </select>
          </label>
          <p className="muted">换工作、搬家和确认亲密关系始终等待你确认；不会因等待而停止世界。</p>
          <div className="setting-row">
            <div>
              <strong>想多看一段生活？</strong>
              <p>立刻推进 6 个游戏小时，可多次使用。</p>
            </div>
            <button
              onClick={() =>
                mutate((x) => {
                  catchUp(x);
                  advance(x, 6 * HOUR);
                })
              }
            >
              <Play size={14} /> 快进 6 小时
            </button>
          </div>
        </section>
        <section className="card">
          <h2>存档与声音</h2>
          <p className="muted">
            每 15
            秒自动保存，重要操作立即保存。未启用云同步时，网页版进度只保存在当前浏览器。可导出存档备份或转移进度。桌面版使用校验、原子写入与上一版备份。
          </p>
          <div className="button-row">
            <button onClick={() => void persist()}>
              <Check size={15} />
              现在保存
            </button>
            <button
              onClick={() =>
                void exportSave(w)
                  .then((done) => {
                    if (done) notify('存档已导出。文件包含你授权保存的私人记录，请妥善保管。');
                  })
                  .catch(() => notify('导出失败，请检查保存位置。'))
              }
            >
              <Download size={15} />
              导出存档
            </button>
            {window.desktop && (
              <button onClick={importGame}>
                <Upload size={15} />
                导入存档
              </button>
            )}
          </div>
          {!window.desktop && (
            <label>
              导入浏览器 JSON 存档
              <input
                type="file"
                accept=".json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 16 * 1024 * 1024) throw new Error();
                    const incoming = validateWorld(JSON.parse(await file.text()));
                    if (window.confirm('导入将替换当前世界，建议先导出备份。继续？'))
                      await replaceWorld(incoming);
                  } catch {
                    notify('文件无效，当前世界没有被替换。');
                  }
                }}
              />
            </label>
          )}
          <p className="storage-path">{paths}</p>
          <div className="setting-row">
            <div>
              <strong>轻柔的环境和弦</strong>
              <p>程序化音效，不使用外部音频素材。</p>
            </div>
            <button
              onClick={() => {
                const next = !w.settings.sound;
                void setAmbience(next, w.settings.volume);
                mutate((x) => {
                  x.settings.sound = next;
                });
              }}
            >
              {w.settings.sound ? '关闭' : '开启'}
            </button>
          </div>
          <label>
            音量
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={w.settings.volume}
              onChange={(e) => {
                const volume = Number(e.target.value);
                mutate((x) => {
                  x.settings.volume = volume;
                });
                void setAmbience(w.settings.sound, volume);
              }}
            />
          </label>
          <div className="setting-row">
            <div>
              <strong>开始另一个故事</strong>
              <p>会替换当前世界，请先导出留念。</p>
            </div>
            <button className="danger-button" onClick={newGame}>
              重新开始
            </button>
          </div>
        </section>
        <section className="card full">
          <h2>关于这个版本</h2>
          <p>Another Today 0.2 · 持续变化的像素生活模拟。</p>
          <div className="tags">
            <Tag>{events.length} 个结构化日常事件</Tag>
            <Tag>{chains.length} 条分支故事链</Tag>
            <Tag>{w.npcs.length} 位独立居民</Tag>
            <Tag>14 个微缩场景</Tag>
          </div>
          <p className="muted">
            当前使用离线规则对话，不提供在线语言模型连接。公寓内包含卧室、客厅与厨房；外貌支持发色、衣服和肤色。教育与家庭用于人物背景，尚未扩展为专属剧情。完整功能与限制详见项目
            README。
          </p>
        </section>
      </div>
    </>
  );
}
