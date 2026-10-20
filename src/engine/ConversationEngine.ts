import { dialogue } from '../content/dialogue';
import { lifeReply } from './LifeInteractionEngine';
import { type World, gameTime, activityNames, clamp } from './model';
export function reply(w: World, input: string): string {
  const s = input.trim(),
    c = w.character,
    t = c.traits;
  w.companion.conversations++;
  w.companion.familiarity = clamp(w.companion.familiarity + 0.5);
  w.companion.trust = clamp(w.companion.trust + 0.2);
  // Use the existing conversation counter, not the world's simulation RNG.
  const say = (lines: readonly string[], offset = 0) =>
    lines[(w.companion.conversations + offset) % lines.length];
  const intro = t.extraversion < 35 ? '嗯，我在。' : say(dialogue.greeting);
  if (/不要记|别记住|别保存/.test(s))
    return '好，这条消息不会写入长期记忆。聊天窗口的内容只在本次打开时保留；以前授权的记忆可以在「记忆」中逐条删除。';
  const contextual = lifeReply(w, s);
  if (contextual) return contextual;
  if (/你.*(今天|做了|干了|最近)|发生|经历/.test(s)) {
    const es = w.events.filter((e) => e.definition !== 'activity').slice(-3);
    return es.length
      ? `${intro} ${es.map((e) => `${gameTime(e.time)}，${e.text}`).join(' ')} 我现在在${activityNames[w.activity.kind]}。`
      : `${intro} 我现在在${activityNames[w.activity.kind]}，暂时没有特别的事情。`;
  }
  if (/记得|记住|了解我/.test(s)) {
    const memories = w.memories.filter((m) => m.subject === 'player').slice(-3);
    return memories.length
      ? `你明确让我保留的内容是：${memories.map((m) => `“${m.content}”`).join('；')}。如果有变化，可以在记忆里删掉。`
      : '我还没有保存关于你的长期记忆。你愿意时，可以选择把某条分享保存下来。';
  }
  if (/没通过|没有通过|未通过|失败|没完成|没有完成|没学会/.test(s)) return say(dialogue.failure);
  if (/难过|累|焦虑|烦|失落|压力|不开心/.test(s))
    return say(dialogue.tired, t.sensitivity > 65 ? 2 : 0);
  if (/开心|成功|完成|通过|学会|终于/.test(s))
    return say(dialogue.happy, t.extraversion > 60 ? 1 : 0);
  if (/建议|应该|工作|辞职/.test(s)) return say(dialogue.advice);
  if (/晚安|睡觉去了/.test(s)) return say(dialogue.goodnight);
  if (/谢谢|多谢/.test(s)) return say(dialogue.thanks);
  if (/你好|早安|回来/.test(s))
    return `${intro} 我正在${activityNames[w.activity.kind]}。${say([
      '你想说说自己的今天，还是听听我的小事？',
      '不用急着找话题，待一会儿也很好。',
      '要不要看看我最近记下的见闻？',
    ])}`;
  if (/学|读书|阅读/.test(s))
    return '听到你的学习计划了。需要的话，可以打开「任务与计划」记录待办或使用番茄钟；回来后，再由你确认实际做了什么。';
  return say(dialogue.listening);
}
export { startShared as startFocus, returnShared as returnFocus } from './SharedActivityEngine';
