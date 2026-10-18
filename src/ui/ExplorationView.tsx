import { useState } from 'react';
import { destinations, discoveries } from '../content/places';
import { type World, type Scene, dayKey, sceneNames, activityNames } from '../engine/model';
import { destinationOpen, suggestDestination, displayDiscovery } from '../engine/ExplorationEngine';
import { mutate, notify } from '../store';
import { PixelWorld } from './PixelWorld';
import { Empty, Modal } from './components';

function PlaceSketch({ scene, color }: { scene: Scene; color: string }) {
  return (
    <svg
      className="place-sketch"
      viewBox="0 0 240 100"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect width="240" height="100" fill="#efe9db" />
      <rect y="68" width="240" height="32" fill="#dcd9bf" />
      {scene === 'riverside' ? (
        <>
          <rect y="49" width="240" height="30" fill={color} />
          <path d="M20 59h25m23 12h33m45-12h43m17 11h23" stroke="#d4e5de" strokeWidth="2" />
          <path
            d="M47 48h143m-126 0v24m46-24v24m46-24v24m26-24v24M48 37h140"
            stroke="#a2957b"
            strokeWidth="7"
          />
        </>
      ) : scene === 'greenhouse' ? (
        <>
          <path d="M43 44L120 16 197 44v39H43z" fill={color} />
          <path d="M50 46h140v30H50z" fill="#cfe0c4" />
          <path d="M120 20v58m-44-40v40m88-40v40M47 48h147" stroke="#7d9c80" strokeWidth="4" />
          {[65, 100, 135, 170].map((x) => (
            <g key={x}>
              <rect x={x} y="66" width="10" height="15" fill="#be9774" />
              <path d={`M${x + 5} 66v-15m0 6h-8m8-4h9`} stroke="#658c6d" strokeWidth="5" />
            </g>
          ))}
        </>
      ) : scene === 'workshop' ? (
        <>
          <rect x="52" y="30" width="136" height="49" fill={color} />
          <rect x="46" y="24" width="148" height="9" fill="#8f765e" />
          <rect x="67" y="41" width="32" height="25" fill="#d9e1c6" />
          <rect x="140" y="43" width="25" height="36" fill="#8b8d76" />
          <rect x="99" y="67" width="36" height="7" fill="#e8d4ae" />
        </>
      ) : scene === 'market' ? (
        <>
          {[25, 90, 155].map((x) => (
            <g key={x}>
              <rect x={x} y="35" width="58" height="18" fill={color} />
              <path d={`M${x + 12} 35v18m20-18v18m20-18v18`} stroke="#f7e9c9" strokeWidth="8" />
              <rect x={x + 4} y="68" width="50" height="13" fill="#b69975" />
              <path d={`M${x + 5} 52v16m46-16v16`} stroke="#967b5f" strokeWidth="3" />
            </g>
          ))}
        </>
      ) : scene === 'theater' ? (
        <>
          <rect x="53" y="25" width="135" height="52" fill="#656c70" />
          <rect x="77" y="37" width="86" height="32" fill="#e5d4ae" />
          <path
            d="M60 29v45m17-45v35m95-35v35m10-35v45M53 27h135"
            stroke={color}
            strokeWidth="13"
          />
          <path d="M60 83h20m18 0h20m18 0h20m18 0h20" stroke="#ac9193" strokeWidth="9" />
        </>
      ) : (
        <>
          <rect x="48" y="48" width="76" height="34" fill="#bfccbd" />
          <path d="M52 48V36h12V25h44v11h12v12z" fill={color} />
          <path d="M85 25v23" stroke="#738897" strokeWidth="4" />
          <path d="M172 62v23m-15 0h31m-29-37l28 18" stroke="#929f9f" strokeWidth="5" />
          <path d="M153 43l23 15" stroke={color} strokeWidth="12" />
          <path d="M202 21v8m-4-4h8" stroke="#bba973" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
export function ExplorationView({ world: w }: { world: World }) {
  const [preview, setPreview] = useState<Scene | null>(null);
  const pending = w.living.exploration.suggestion;
  const found = w.living.exploration.discoveries;
  const selected = destinations.find((d) => d.scene === preview);
  return (
    <>
      <section className="card exploration-intro">
        <div>
          <div className="eyebrow">A LITTLE FURTHER FROM HOME</div>
          <h2>走远一点，也可以慢慢来</h2>
          <p>
            沿着熟悉的街道，小世界又多了六处去处。TA
            会根据兴趣、作息和正在发生的事情自己出门。你也可以留一句建议，等 TA 有空再去。
          </p>
        </div>
        <div className="exploration-count">
          <strong>
            {Object.keys(w.living.exploration.visits).length}
            <span> / 6</span>
          </strong>
          <small>实际到访过的地方</small>
        </div>
        {pending && pending.until > w.time && (
          <div className="outing-note">
            <span>
              留给 TA 的建议：有空去{sceneNames[pending.scene as Scene]}看看。最迟保留到{' '}
              {dayKey(pending.until)}。
            </span>
            <button
              className="quiet-button"
              onClick={() =>
                mutate((x) => {
                  delete x.living.exploration.suggestion;
                })
              }
            >
              收回建议
            </button>
          </div>
        )}
      </section>
      <div className="destination-grid">
        {destinations.map((d) => {
          const visit = w.living.exploration.visits[d.scene],
            open = destinationOpen(w, d);
          return (
            <article className="card destination-card" key={d.scene}>
              <PlaceSketch scene={d.scene} color={d.color} />
              <div className="destination-body">
                <div className="eyebrow">{d.subtitle}</div>
                <h3>{sceneNames[d.scene]}</h3>
                <p>{d.description}</p>
                <div className="place-hours">
                  <span className={open ? 'place-open' : ''}>
                    {open
                      ? '现在开放'
                      : w.living.town.facilities[d.scene] === 'repair'
                        ? '维护中'
                        : '现在休息'}
                  </span>{' '}
                  · {d.weekend ? '周末 ' : '每日 '}
                  {d.hours[0]}:00–{d.hours[1]}:00
                </div>
                <small>
                  {visit
                    ? `在 ${visit.days} 个日子来过 · 最近 ${dayKey(visit.last)}`
                    : '还没亲自来过，先看看也好。'}
                </small>
                <div className="button-row">
                  <button onClick={() => setPreview(d.scene)}>看看{sceneNames[d.scene]}</button>
                  <button
                    className="quiet-button"
                    disabled={pending?.scene === d.scene && pending.until > w.time}
                    onClick={() =>
                      mutate((x) => {
                        suggestDestination(x, d.scene);
                        notify(`已经记下：有空去${sceneNames[d.scene]}看看。`);
                      })
                    }
                  >
                    {pending?.scene === d.scene && pending.until > w.time
                      ? '已留下建议'
                      : '建议有空去看看'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <section className="card field-journal">
        <div className="eyebrow">LITTLE THINGS, REAL DAYS</div>
        <h2>
          见闻手册{' '}
          <span className="muted">
            {found.length} / {discoveries.length}
          </span>
        </h2>
        <p className="muted">
          有些是观察，有些是亲手做的小东西。只有真正到访并完成相关活动，才会留下一页。一天慢慢记一点就够了。
        </p>
        {found.length ? (
          <div className="discovery-grid">
            {found
              .slice()
              .reverse()
              .map((entry) => {
                const d = discoveries.find((d) => d.id === entry.id)!;
                return (
                  <article className="discovery-card" key={entry.id}>
                    <small>
                      {d.kind} · {sceneNames[d.scene]} · {dayKey(entry.time)}
                    </small>
                    <h3>{d.name}</h3>
                    <p>{d.text}</p>
                    <button
                      className="quiet-button"
                      onClick={() =>
                        mutate((x) =>
                          displayDiscovery(
                            x,
                            x.living.exploration.display === entry.id ? undefined : entry.id,
                          ),
                        )
                      }
                    >
                      {w.living.exploration.display === entry.id
                        ? '收起公寓里的展示'
                        : '展示在公寓里'}
                    </button>
                  </article>
                );
              })}
          </div>
        ) : (
          <Empty>还没有新的见闻。让 TA 照常生活，第一次出门的记录会留在这里。</Empty>
        )}
      </section>
      {selected && (
        <Modal title={sceneNames[selected.scene]} onClose={() => setPreview(null)}>
          <PixelWorld world={w} scene={selected.scene} />
          <p className="place-hours">
            {destinationOpen(w, selected)
              ? '现在开放'
              : w.living.town.facilities[selected.scene] === 'repair'
                ? '维护中，晚些时候再来'
                : '现在休息，开放时 TA 可以自己来看看'}{' '}
            · {selected.weekend ? '周末 ' : '每日 '}
            {selected.hours[0]}:00–{selected.hours[1]}:00
          </p>
          <p>
            {w.activity.scene === selected.scene
              ? `${w.character.name}正在这里${activityNames[w.activity.kind]}。`
              : '现在只是看看这里，TA 仍在按自己的节奏生活。'}
          </p>
          <p>{selected.description}</p>
          <button
            onClick={() =>
              mutate((x) => {
                suggestDestination(x, selected.scene);
                notify('已经留下建议，不会打断 TA 当前的活动。');
              })
            }
          >
            建议下次来这里
          </button>
        </Modal>
      )}
    </>
  );
}
