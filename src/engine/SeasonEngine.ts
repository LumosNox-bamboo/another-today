import { type World, type Activity, DAY, realDate, dayKey, record } from './model';
export function seasonAt(date: string): World['living']['calendar']['season'] {
  const m = Number(date.slice(5, 7));
  return m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬';
}
export function seasonTick(w: World) {
  const c = w.living.calendar;
  const date = c.mode === 'world' ? dayKey(w.time) : dayKey(c.realAnchor);
  if (c.date === date) return;
  c.date = date;
  c.season = seasonAt(date);
  const key = `${date.slice(0, 4)}-${c.season}`;
  if (!c.claimed.includes(key)) {
    c.claimed.push(key);
    c.claimed = c.claimed.slice(-160);
    record(
      w,
      `${c.season}天的街区`,
      `街区进入${c.season}季，出行和照料植物的节奏也跟着改变。`,
      '季节节庆',
      true,
      `season-${key}`,
    );
  }
  const festival: Record<string, string> = {
    '01-01': '新年',
    '03-21': '春日播种节',
    '06-21': '夏至晚风会',
    '09-22': '秋日收获会',
    '12-21': '冬夜灯会',
  };
  const title = festival[date.slice(5)],
    festivalKey = `festival-${date}`;
  if (title && !c.claimed.includes(festivalKey)) {
    c.claimed.push(festivalKey);
    c.claimed = c.claimed.slice(-160);
    record(w, title, `社区迎来${title}，居民可以按自己的安排参与。`, '季节节庆', true, festivalKey);
  }
}
export function setCalendarMode(w: World, mode: 'world' | 'real', now: number) {
  const c = w.living.calendar;
  c.mode = mode;
  c.realAnchor = Date.parse(`${realDate(now)}T00:00:00Z`);
  c.gameAnchor = Math.floor(w.time / DAY) * DAY;
  c.date = '';
  seasonTick(w);
}
// Real mode synchronizes the environmental calendar at catch-up boundaries, without rewriting world history.
export function syncRealCalendar(w: World, now: number) {
  if (w.living.calendar.mode === 'real') {
    const c = w.living.calendar;
    c.realAnchor = Date.parse(`${realDate(now)}T00:00:00Z`);
    c.gameAnchor = Math.floor(w.time / DAY) * DAY;
    c.date = '';
    seasonTick(w);
  }
}
export function seasonBias(w: World, a: Activity) {
  const s = w.living.calendar.season;
  return s === '春' && a === 'garden'
    ? 9
    : s === '夏' && a === 'rest'
      ? 6
      : s === '秋' && a === 'walk'
        ? 9
        : s === '冬' && a === 'read'
          ? 10
          : 0;
}
