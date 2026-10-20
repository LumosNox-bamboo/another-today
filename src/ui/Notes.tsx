import type { World } from '../engine/model';
import { mutate } from '../store';
export function Notes({ world: w }: { world: World }) {
  const notes = (w.notes || [])
    .filter((n) => n.residentId === w.household.active)
    .slice()
    .reverse();
  return (
    <section aria-label="人物纸条">
      <p>{w.character.name}留给你的纸条。不用回复，也不用每天来收。</p>
      {!notes.length && <p>信箱还空着。TA 会在白天偶尔留下纸条；专注和免打扰时不会打扰你。</p>}
      {notes.map((n) => (
        <article className="little-note" key={n.id}>
          <strong>{n.author}写给你</strong>
          <small>{new Date(n.time).toLocaleString()}</small>
          <p>{n.text}</p>
          <button
            disabled={n.read}
            onClick={() =>
              mutate((x) => {
                const note = x.notes?.find((v) => v.id === n.id);
                if (note) note.read = true;
              })
            }
          >
            {n.read ? '已读' : '读过了'}
          </button>
        </article>
      ))}
    </section>
  );
}
