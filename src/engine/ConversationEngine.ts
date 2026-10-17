import { type World, gameTime, activityNames, clamp, MINUTE, uid } from './model';
export function reply(w: World, input: string): string {
  const s = input.trim(),
    c = w.character,
    t = c.traits;
  w.companion.conversations++;
  w.companion.familiarity = clamp(w.companion.familiarity + 0.5);
  w.companion.trust = clamp(w.companion.trust + 0.2);
  const intro =
    t.extraversion > 65 ? '你来啦！' : t.extraversion < 35 ? '嗯，我在。' : '很高兴和你聊聊。';
  if (/不要记|别记住|别保存/.test(s))
    return '好，这条消息不会写入长期记忆。聊天窗口的内容只在本次打开时保留；以前授权的记忆可以在「记忆」中逐条删除。';
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
  if (/没通过|没有通过|未通过|失败|没完成|没有完成|没学会/.test(s))
    return '听起来这次不太顺利。你愿意的话，可以讲讲卡在哪里，也可以先休息一下。';
  if (/难过|累|焦虑|烦|失落|压力|不开心/.test(s))
    return t.sensitivity > 65
      ? '听起来这会儿不太轻松。你想说的话，我在这里听。也可以先休息，不必急着做什么。'
      : '听起来有些辛苦。先给自己留一点休息的时间吧。愿意的话，可以告诉我最困扰你的是什么。';
  if (/开心|成功|完成|通过|学会|终于/.test(s))
    return t.extraversion > 60
      ? '听起来是值得为自己高兴的一刻！你最想记住的是哪个瞬间？'
      : '听到你的分享很开心。这个过程里，哪一点让你最满意？';
  if (/建议|应该|工作|辞职/.test(s))
    return '我们可以一起想想你最在意什么，再把选择拆成小一点的步骤。关于你的具体情况，我只知道你愿意告诉我的部分。';
  if (/你好|早安|晚安|回来/.test(s))
    return `${intro} 我正在${activityNames[w.activity.kind]}。你可以说说自己的今天，也可以看看我刚发生的小事。`;
  if (/学|读书|阅读/.test(s))
    return '听到你的学习计划了。需要的话，可以打开「一起专注」记下预计时间；回来后，再由你确认实际做了什么。';
  return [
    `${intro} 我听到了你的分享。你愿意再讲讲其中的一点吗？`,
    `谢谢你把这些告诉我。我现在在${activityNames[w.activity.kind]}，我们可以慢慢聊。`,
    `我会认真听你说。今天哪一个片刻最想留下来？`,
  ][w.companion.conversations % 3];
}
export function startFocus(w: World, label: string, minutes: number, now: number) {
  if (w.playerActivities.some((a) => !a.returned)) throw new Error('已有进行中的活动');
  w.playerActivities.push({
    id: uid(w, 'focus'),
    label: label.trim().slice(0, 200) || '专注',
    start: now,
    expectedMinutes: Math.max(1, Math.min(1440, minutes)),
  });
  w.playerActivities = w.playerActivities.slice(-100);
  w.flags.suggestion = w.character.traits.creativity > 65 ? 'create' : 'read';
  w.flags.suggestionUntil = w.time + Math.min(minutes, 90) * MINUTE;
}
export function returnFocus(w: World, now: number) {
  const a = w.playerActivities.find((a) => !a.returned);
  if (a) a.returned = Math.max(a.start, now);
}
