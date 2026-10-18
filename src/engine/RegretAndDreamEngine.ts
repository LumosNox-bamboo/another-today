import { type World, type Activity, DAY, random, record, uid, clamp } from './model';
import { rememberEvent } from './MemoryEngine';
import { linkCause } from './EventCausalityGraph';
const ideas: [string, Activity][] = [
  ['重新练习一首曲子', 'create'],
  ['读完一直想读的书', 'read'],
  ['走遍街区的小路', 'walk'],
  ['学会一项实用技能', 'study'],
  ['照顾一盆长大的植物', 'garden'],
];
export function changeDream(w: World, id: string, resume: boolean) {
  const d = w.living.dreams.find((d) => d.id === id);
  if (!d || d.status === 'fulfilled') return;
  d.status = resume ? 'active' : 'abandoned';
  d.changed = w.time;
  if (resume) d.attempts++;
  const e = record(
    w,
    resume ? '愿意再试一次' : '暂时放下一个愿望',
    `${d.title}。${resume ? '从小步骤重新开始。' : '这段经历仍然有意义，也可以以后再回来。'}`,
    '愿望遗憾',
    true,
    'dream-change',
    undefined,
    d.source,
  );
  rememberEvent(w, e, 85);
  linkCause(w, e, [d.source]);
  d.source = e.id;
}
export function dreamsTick(w: World, activity: Activity) {
  if (!w.living.dreams.length) {
    w.living.dreams.push({
      id: uid(w, 'wish'),
      title: w.character.goal,
      activity: 'create',
      progress: w.character.goalProgress,
      status: 'active',
      changed: w.time,
      source: w.events[0]?.id || 'arrival',
      attempts: 1,
    });
  }
  w.flags.primaryDreamId ??= w.living.dreams[0].id;
  for (const d of w.living.dreams) {
    if (d.status === 'active' && d.activity === activity) {
      d.progress =
        d.id === w.flags.primaryDreamId ? w.character.goalProgress : clamp(d.progress + 0.65);
      d.changed = w.time;
      if (d.progress >= 100) {
        d.status = 'fulfilled';
        const e = record(
          w,
          '慢慢实现的愿望',
          `经过持续练习，完成了「${d.title}」。`,
          '愿望遗憾',
          true,
          'wish-complete',
          undefined,
          d.source,
        );
        rememberEvent(w, e, 95);
        linkCause(w, e, [d.source]);
        d.source = e.id;
      }
    } else if (d.status === 'active' && w.time - d.changed > 21 * DAY) changeDream(w, d.id, false);
    else if (d.status === 'abandoned' && w.time - d.changed > 14 * DAY) {
      d.status = 'regret';
      d.changed = w.time;
      const e = record(
        w,
        '回看暂时放下的事',
        `想起「${d.title}」，也许以后可以换一种方式接近它。`,
        '愿望遗憾',
        true,
        'regret',
        undefined,
        d.source,
      );
      rememberEvent(w, e, 80);
      linkCause(w, e, [d.source]);
      d.source = e.id;
    } else if (
      d.status === 'regret' &&
      w.time - d.changed > 30 * DAY &&
      d.activity === activity &&
      random(w) < 0.1
    )
      changeDream(w, d.id, true);
  }
  if (
    w.living.dreams.length < 6 &&
    w.living.dreams.filter((d) => d.status === 'active').length < 2 &&
    random(w) < 0.002
  ) {
    const idea = ideas.find(
      ([title, a]) => a === activity && !w.living.dreams.some((d) => d.title === title),
    );
    if (idea) {
      const e = record(
        w,
        '生出一个小愿望',
        `在日常练习中，想试试：${idea[0]}。`,
        '愿望遗憾',
        true,
        'new-wish',
      );
      rememberEvent(w, e, 70);
      linkCause(w, e);
      w.living.dreams.push({
        id: uid(w, 'wish'),
        title: idea[0],
        activity: idea[1],
        progress: 0,
        status: 'active',
        changed: w.time,
        source: e.id,
        attempts: 1,
      });
    }
  }
}
