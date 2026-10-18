import { type World, DAY, realDate } from './model';
// Only retain references. Deleting the authorized memory immediately removes the topic.
export function linkedOpportunity(w: World, now: number) {
  let topic: { source: string; text: string; kind: string } | undefined;
  for (const m of w.memories.filter(
    (m) => m.subject === 'player' && m.source === 'explicit-consent',
  )) {
    const last = w.living.topicAsked[m.id] || m.timestamp;
    const birthday = m.content.match(
      /(?:我的|我)生日(?:是|在|：|:)?\s*(\d{1,2})[月/-](\d{1,2})日?/,
    );
    if (
      birthday &&
      (!w.living.topicAsked[m.id] || realDate(w.living.topicAsked[m.id]) !== realDate(now)) &&
      realDate(now).slice(5) === `${birthday[1].padStart(2, '0')}-${birthday[2].padStart(2, '0')}`
    )
      return {
        source: m.id,
        text: `你曾告诉我：“${m.content}”。如果今天仍是你希望庆祝的日子，生日快乐。`,
        kind: '生日',
      };
    if (!topic && now - last >= 3 * DAY && /考试|目标|计划|准备|读|音乐|学习/.test(m.content))
      topic = {
        source: m.id,
        text: `你之前说过：“${m.content}”。现在有想分享的新进展吗？不想聊也没关系。`,
        kind: '关心目标',
      };
  }
  return topic;
}
export function removeLinkedMemory(w: World, id: string) {
  delete w.living.topicAsked[id];
  w.living.interactions = w.living.interactions.filter((i) => i.source !== id);
}
