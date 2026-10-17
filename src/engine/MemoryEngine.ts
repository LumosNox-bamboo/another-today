import { type World, type Memory, type LifeEvent, uid } from './model';
export function rememberEvent(w: World, e: LifeEvent, importance = 55) {
  if (w.memories.some((m) => m.source === e.id)) return;
  w.memories.push({
    id: uid(w, 'memory'),
    subject: e.npcId ? 'relationship' : 'character',
    timestamp: e.time,
    content: e.text,
    source: e.id,
    relatedCharacters: e.npcId ? [e.npcId] : [],
    scene: e.scene,
    emotion: w.needs.mood >= 60 ? '温暖' : '思索',
    importance,
    tags: [e.category, e.title],
    privacy: 'local',
  });
  trim(w);
}
function trim(w: World) {
  if (w.memories.length > 350) {
    const player = w.memories.filter((m) => m.subject === 'player');
    const own = w.memories
      .filter((m) => m.subject !== 'player')
      .sort((a, b) => b.importance - a.importance || b.timestamp - a.timestamp)
      .slice(0, 350 - player.length);
    w.memories = [...player, ...own].sort((a, b) => a.timestamp - b.timestamp);
  }
}
export function rememberPlayer(w: World, text: string, realNow: number) {
  const clean = text.trim().slice(0, 2000);
  if (!clean || /不要记|别记住|别保存|不保存/.test(clean)) return false;
  if (w.memories.some((m) => m.subject === 'player' && m.content === clean)) return true;
  if (w.memories.filter((m) => m.subject === 'player').length >= 150) return false;
  w.memories.push({
    id: uid(w, 'player-memory'),
    subject: 'player',
    timestamp: realNow,
    content: clean,
    source: 'explicit-consent',
    relatedCharacters: [],
    emotion: '玩家原话',
    importance: 80,
    tags: ['玩家确认'],
    privacy: 'private',
  });
  trim(w);
  return true;
}
export function forget(w: World, id: string) {
  w.memories = w.memories.filter((m) => m.id !== id);
}
export function retrieve(w: World, query: string, subject?: Memory['subject']) {
  const keys = query
    .toLowerCase()
    .split(/[\s，。！？、]+/)
    .filter(Boolean);
  return w.memories
    .filter(
      (m) =>
        (!subject || m.subject === subject) &&
        keys.some((k) => m.content.toLowerCase().includes(k)),
    )
    .sort((a, b) => b.importance - a.importance || b.timestamp - a.timestamp)
    .slice(0, 5);
}
