import { careerActivityLabel } from '../engine/CareerEngine';
import { useRealClock } from './RealClock';
import { clockText, focusRemaining } from '../engine/FocusRewardEngine';
import { Household } from './Household';
import { lifeRole } from '../engine/HouseholdEngine';
import { useEffect, useState } from 'react';
import {
  Map,
  Gift,
  MessageCircle,
  BookOpen,
  Focus,
  Pause,
  Compass,
  Home,
  Coffee,
  TreePine,
  Telescope,
  Sprout,
  Wrench,
  ShoppingBasket,
  Theater,
  Building2,
  LibraryBig,
  Store,
  Footprints,
  Sparkles,
  ChevronRight,
  Moon,
} from 'lucide-react';
import { type World, type Scene, sceneNames, gameTime, hour, dayKey } from '../engine/model';
import { setSpeed } from '../engine/SimulationClock';
import { resolveDecision } from '../engine/SimulationEngine';
import { suggestDestination, destinationOpen } from '../engine/ExplorationEngine';
import { destinations } from '../content/places';
import { mutate, notify } from '../store';
import { PixelWorld, anchors } from './PixelWorld';
import { Avatar, Modal, Meter } from './components';
import { InteractionCard, LivingWorld } from './LivingWorld';

const rooms: Record<keyof typeof anchors, string> = {
  bed: '床边',
  desk: '书桌',
  shelf: '书架',
  plant: '绿植',
  sofa: '沙发',
  kitchen: '厨房',
};
const mapIcons = {
  apartment: Home,
  cafe: Coffee,
  park: TreePine,
  observatory: Telescope,
  greenhouse: Sprout,
  workshop: Wrench,
  market: ShoppingBasket,
  theater: Theater,
  office: Building2,
  library: LibraryBig,
  shop: Store,
  street: Footprints,
  riverside: TreePine,
  night: Moon,
};
const mapPlaces: [Scene, number, number][] = [
  ['observatory', 79, 12],
  ['greenhouse', 48, 14],
  ['riverside', 17, 13],
  ['park', 27, 36],
  ['library', 57, 37],
  ['workshop', 83, 36],
  ['apartment', 15, 60],
  ['street', 40, 58],
  ['cafe', 65, 59],
  ['office', 86, 59],
  ['shop', 16, 83],
  ['market', 40, 84],
  ['theater', 65, 83],
  ['night', 87, 83],
];

export function GameStage({
  world: w,
  onChat,
  onFocus,
  onRewards,
  onObject,
  onDiary,
  onPerson,
  onResidentPage,
  compact = false,
}: {
  world: World;
  onChat: (text?: string) => void;
  onFocus: () => void;
  onRewards: () => void;
  onObject: (anchor: string) => void;
  onDiary: () => void;
  onPerson: () => void;
  onResidentPage: (page: 'person' | 'memory' | 'history') => void;
  compact?: boolean;
}) {
  const now = useRealClock();
  const [preview, setPreview] = useState<Scene | null>(null);
  const [panel, setPanel] = useState<'map' | 'gifts' | 'moments' | 'household' | null>(null);
  const [inspect, setInspect] = useState(false);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const scene = preview || w.activity.scene;
  const away = scene !== w.activity.scene;
  const night = hour(w.time) >= 19 || hour(w.time) < 6;
  const recent = w.events.filter((e) => e.definition !== 'activity').at(-1);
  const destination = destinations.find((d) => d.scene === scene);
  const focus = w.playerActivities.find((a) => !a.returned);
  const hasShare =
    w.living.notifications.enabled &&
    !w.living.notifications.dnd &&
    !focus &&
    w.living.interactions.some((i) => !i.read);
  const activeStories = w.living.arcs.filter((a) => a.status === 'active').length;
  const residents = w.npcs.filter((n) => n.scene === scene);
  return (
    <section className={`game-stage ${night ? 'evening' : ''}`} aria-label="小镇生活">
      <header className="game-hud">
        <button className="resident-badge" onClick={onPerson} aria-label="查看人物">
          <Avatar world={w} />
          <span>
            <strong>{w.character.name}</strong>
            <small>
              {lifeRole(w.character)} · {careerActivityLabel(w)}
            </small>
          </span>
        </button>
        <div className="game-calendar">
          <span>
            现实时间 ·{' '}
            {new Date(now).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
          </span>
          <strong aria-label="现实时间">
            {new Date(now).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </strong>
          <small>{night ? '夜色正温柔' : '又是一个小小的今天'}</small>
          <small>
            游戏 · 第{' '}
            {Math.max(
              1,
              Math.floor(
                (w.time -
                  Date.UTC(
                    new Date(w.createdReal).getFullYear(),
                    new Date(w.createdReal).getMonth(),
                    new Date(w.createdReal).getDate(),
                  )) /
                  86400000,
              ) + 1,
            )}{' '}
            天 · {w.living.calendar.season} · {gameTime(w.time)}
          </small>
        </div>
        <div className="game-needs">
          <Meter label="心情" value={w.needs.mood} color="#e6b45f" />
          <Meter label="精力" value={w.needs.energy} color="#8dbca1" />
          <Meter label="饱腹" value={100 - w.needs.hunger} color="#d99270" />
        </div>
      </header>

      <div className="stage-location">
        <button
          className="follow-button"
          onClick={() => {
            setPreview(null);
            setPanel('household');
          }}
        >
          家庭与行动
        </button>
        <span>
          <i className="status-dot" /> {sceneNames[scene]}{' '}
          <small>{away ? '正在浏览 · TA 不在这里' : 'TA 的此刻'}</small>
        </span>
        <button
          className="follow-button"
          onClick={() => setPreview(null)}
          aria-pressed={preview === null}
        >
          <Compass size={14} /> 跟随 TA
        </button>
      </div>
      <div className="stage-landscape">
        <div className="scene-view stage-surface" data-scene={scene}>
          <PixelWorld world={w} scene={scene} onObject={onObject} />
          {scene === 'apartment' &&
            inspect &&
            Object.entries(anchors).map(([id, p]) => (
              <button
                className="room-hotspot"
                key={id}
                style={{ left: `${(p.x / 480) * 100}%`, top: `${(p.y / 310) * 100}%` }}
                aria-label={`查看${rooms[id as keyof typeof rooms]}`}
                onClick={() => onObject(id)}
              >
                <Sparkles size={13} />
                <span>{rooms[id as keyof typeof rooms]}</span>
              </button>
            ))}
          <div className="stage-scene-label">
            <span>梧桐街</span>
            <small>ANOTHER TODAY</small>
          </div>
        </div>
      </div>
      <div className="stage-context">
        <span>
          {away
            ? `${w.character.name}正在${sceneNames[w.activity.scene]}${careerActivityLabel(w)}`
            : `${w.character.name}正在${careerActivityLabel(w)}`}
        </span>
        {scene === 'apartment' ? (
          <button onClick={() => setInspect(!inspect)} aria-pressed={inspect}>
            {inspect ? '收起物品标记' : '看看屋里的东西'} <Sparkles size={13} />
          </button>
        ) : (
          <small>
            {residents.length
              ? `${residents
                  .slice(0, 3)
                  .map((n) => n.name)
                  .join('、')}也在这里`
              : '此刻这里很安静'}
          </small>
        )}
        {destination && (
          <button
            onClick={() => {
              mutate((x) => suggestDestination(x, scene));
              notify('已经记下这个去处。TA 会在有空时考虑，不会打断当前生活。');
            }}
          >
            {w.living.exploration.suggestion?.scene === scene ? '已记下这个去处' : '建议有空去看看'}
          </button>
        )}
      </div>

      <div className="stage-controls">
        <div className="time-controls">
          <span>
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
                aria-label={speed === 0 ? '暂停' : `${speed} 倍速`}
                aria-pressed={w.settings.speed === speed}
                className={w.settings.speed === speed ? 'selected' : ''}
                onClick={() => mutate((x) => setSpeed(x, speed))}
              >
                {speed === 0 ? <Pause size={13} /> : `${speed}×`}
              </button>
            ))}
          </div>
        </div>
        <div className="stage-tools">
          {!compact && (
            <button onClick={() => setPanel('map')}>
              <Map size={19} />
              <span>小镇地图</span>
            </button>
          )}
          <button onClick={() => onChat()} aria-label={`和${w.character.name}聊聊天`}>
            <MessageCircle size={19} />
            <span>聊聊天</span>
          </button>
          {!compact && (
            <button onClick={() => setPanel('gifts')}>
              <Gift size={19} />
              <span>送份礼物</span>
            </button>
          )}
          <button onClick={onFocus} aria-label="任务与计划">
            <Focus size={19} />
            <span>{focus ? `专注 ${clockText(focusRemaining(focus, now))}` : '任务与计划'}</span>
          </button>
          <button onClick={onRewards}>
            <Sparkles size={19} />
            <span>我的奖励</span>
          </button>
          {!compact && (
            <button onClick={onDiary}>
              <BookOpen size={19} />
              <span>写日记</span>
            </button>
          )}
        </div>
      </div>
      {!compact && (
        <button className="moment-ribbon" onClick={() => setPanel('moments')}>
          <span className="moment-seal">小镇来信</span>
          <span>
            <strong>{recent?.title || '日子刚刚开始'}</strong>
            <small>{recent?.text || '看看小屋，认识邻居，让故事慢慢发生。'}</small>
          </span>
          <span className="moment-count">
            {w.decisions.length
              ? `${w.decisions.length} 件待商量`
              : hasShare
                ? 'TA 有话想说'
                : `${activeStories} 段故事进行中`}
            <ChevronRight size={16} />
          </span>
        </button>
      )}
      {panel === 'household' && (
        <Modal title="我们的家" wide onClose={() => setPanel(null)}>
          <Household
            world={w}
            onView={(page) => {
              setPanel(null);
              onResidentPage(page);
            }}
          />
        </Modal>
      )}
      {compact && w.decisions.length > 0 && (
        <button onClick={() => setPanel('moments')}>待商量 {w.decisions.length}</button>
      )}

      {panel === 'map' && (
        <Modal title="梧桐街 · 小镇地图" wide onClose={() => setPanel(null)}>
          <p className="map-note">
            翻看不同地方，TA 仍按自己的计划生活。<span>● TA 的位置</span>
          </p>
          <div className="town-map" aria-label="小镇地点">
            <svg viewBox="0 0 600 420" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 88 Q160 0 250 68 T600 40" className="map-river" />
              <path
                d="M80 140 L530 140 M80 245 L540 245 M80 350 L540 350 M90 125 L90 370 M245 125 L245 370 M395 125 L395 370 M520 125 L520 370"
                className="map-roads"
              />
            </svg>
            <span className="map-compass">
              N<br />↑
            </span>
            {mapPlaces.map(([id, x, y]) => {
              const d = destinations.find((d) => d.scene === id);
              const PlaceIcon = mapIcons[id];
              return (
                <button
                  key={id}
                  className={`map-place ${w.activity.scene === id ? 'is-here' : ''}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  onClick={() => {
                    setPreview(id);
                    setPanel(null);
                  }}
                  aria-label={`看看${sceneNames[id]}`}
                >
                  <span className={`map-building building-${id}`}>
                    <PlaceIcon size={19} />
                  </span>
                  <strong>{sceneNames[id]}</strong>
                  <small>
                    {w.activity.scene === id
                      ? `${w.character.name}在这里`
                      : d
                        ? destinationOpen(w, d)
                          ? '开放中'
                          : '休息中'
                        : ''}
                  </small>
                </button>
              );
            })}
          </div>
          <button
            className="full-button"
            onClick={() => {
              setPreview(null);
              setPanel(null);
            }}
          >
            回到 TA 身边
          </button>
        </Modal>
      )}
      {panel === 'gifts' && (
        <Modal title="一份小心意" wide onClose={() => setPanel(null)}>
          <div className="gift-drawer">
            <LivingWorld world={w} initialTab="礼物与作品" />
          </div>
        </Modal>
      )}
      {panel === 'moments' && (
        <Modal title="小镇来信与最近经历" wide onClose={() => setPanel(null)}>
          <InteractionCard
            world={w}
            onChat={(text) => {
              setPanel(null);
              onChat(text);
            }}
          />
          {w.decisions.map((d) => (
            <article className="living-entry" key={d.id}>
              <h3>{d.title}</h3>
              <p>{d.text}</p>
              <div className="button-row">
                <button onClick={() => mutate((x) => resolveDecision(x, d.id, 'yes'))}>
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
          {w.events
            .slice(-16)
            .reverse()
            .map((e) => (
              <article className="living-entry" key={e.id}>
                <small>
                  {dayKey(e.time)} · {gameTime(e.time)}
                </small>
                <h3>{e.title}</h3>
                <p>{e.text}</p>
              </article>
            ))}
        </Modal>
      )}
    </section>
  );
}
