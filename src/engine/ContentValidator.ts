import { destinations, discoveries } from '../content/places';
import { events, chains, type EventDefinition } from '../content/events';
import { gifts, habits, secrets, newsTemplates } from '../content/living';
import { storyArcs } from '../content/storyArcs';
import { activityNames, sceneNames, traitNames } from './model';
const gates = [
  'any',
  'employed',
  'friend',
  'partner',
  'student',
  'night',
  'rain',
  'plant',
  'single',
  'weekend',
];
export function validateContent(definitions: EventDefinition[] = events) {
  const errors: string[] = [];
  function unique(label: string, ids: string[]) {
    if (new Set(ids).size !== ids.length) errors.push(`${label}: ID 重复`);
  }
  unique(
    'events',
    definitions.map((e) => e.eventId),
  );
  unique(
    'gifts',
    gifts.map((d) => d.id),
  );
  unique(
    'habits',
    habits.map((d) => d.id),
  );
  unique(
    'secrets',
    secrets.map((d) => d.id),
  );
  unique(
    'news',
    newsTemplates.map((d) => d.id),
  );
  unique(
    'stories',
    storyArcs.map((d) => d.id),
  );
  unique(
    'chains',
    chains.map((d) => d.id),
  );
  unique(
    'destinations',
    destinations.map((d) => d.scene),
  );
  unique(
    'discoveries',
    discoveries.map((d) => d.id),
  );
  for (const d of destinations) {
    if (
      !(d.scene in sceneNames) ||
      !d.activities.length ||
      d.activities.some((a) => !(a in activityNames)) ||
      !(d.trait in traitNames) ||
      d.hours[0] < 0 ||
      d.hours[1] > 24 ||
      d.hours[0] >= d.hours[1]
    )
      errors.push(`${d.scene}: 地点开放条件无效`);
  }
  for (const d of discoveries) {
    const place = destinations.find((p) => p.scene === d.scene);
    if (
      !place ||
      !d.activities.length ||
      d.activities.some((a) => !place.activities.includes(a)) ||
      !Number.isInteger(d.days) ||
      d.days < 1
    )
      errors.push(`${d.id}: 见闻不可达`);
  }
  const ids = new Set(definitions.map((e) => e.eventId));
  for (const e of definitions) {
    const fail = (s: string) => errors.push(`${e.eventId}: ${s}`);
    if (!e.title || !e.description || !e.category) fail('缺少文案或类别');
    if (
      !e.triggerConditions.activities.length ||
      e.triggerConditions.activities.some((a) => !(a in activityNames))
    )
      fail('活动条件非法');
    if (!gates.includes(e.triggerConditions.gate)) fail('职业、关系或人物条件非法');
    if (e.scenes && (!e.scenes.length || e.scenes.some((s) => !(s in sceneNames))))
      fail('地点不存在');
    if (
      e.requiredState &&
      !['gift', 'habit', 'npc-change', 'news', 'creation'].includes(e.requiredState)
    )
      fail('世界状态条件非法');
    if (e.season && !['春', '夏', '秋', '冬'].includes(e.season)) fail('季节非法');
    if (!Number.isFinite(e.weight) || e.weight <= 0 || e.weight > 100) fail('权重无效');
    if (!Number.isFinite(e.cooldown) || e.cooldown < 60 || e.cooldown > 365 * 1440)
      fail('冷却不合理');
    if (!['self', 'npc'].includes(e.participants)) fail('参与人物非法');
    if (e.participants === 'npc' && !['friend', 'partner'].includes(e.triggerConditions.gate))
      fail('NPC 事件缺少同场关系约束');
    if (
      Object.entries(e.effects).some(
        ([k, v]) =>
          !['mood', 'stress', 'money'].includes(k) ||
          !Number.isFinite(v) ||
          Math.abs(v) > (k === 'money' ? 10000 : 100),
      )
    )
      fail('效果非法');
    if (
      e.branch &&
      (!(e.branch.trait in traitNames) ||
        e.branch.threshold < 0 ||
        e.branch.threshold > 100 ||
        !Number.isFinite(e.branch.mood) ||
        Math.abs(e.branch.mood) > 100)
    )
      fail('分支条件非法');
    if (
      e.requiresEvent &&
      (!ids.has(e.requiresEvent.id) ||
        !Number.isFinite(e.requiresEvent.days) ||
        e.requiresEvent.days < 1 ||
        e.requiresEvent.days > 60 ||
        !definitions
          .find((d) => d.eventId === e.requiresEvent?.id)
          ?.followUpEvents.includes(e.eventId))
    )
      fail('前因或时间间隔无效');
    if (e.followUpEvents.some((id) => !ids.has(id))) fail('后续事件不存在');
    if (e.playerChoiceRequired) fail('普通模板必须由独立剧情系统承接选择');
  }
  const visiting = new Set<string>(),
    done = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) {
      errors.push(`${id}: 后续事件存在非法循环`);
      return;
    }
    if (done.has(id)) return;
    visiting.add(id);
    definitions.find((e) => e.eventId === id)?.followUpEvents.forEach(visit);
    visiting.delete(id);
    done.add(id);
  }
  definitions.forEach((e) => visit(e.eventId));
  for (const d of [...gifts, ...habits, ...secrets, ...newsTemplates, ...storyArcs]) {
    if (!(d.activity in activityNames)) errors.push(`${d.id}: 活动不存在`);
    if ('scene' in d && d.scene && !(d.scene in sceneNames)) errors.push(`${d.id}: 地点不存在`);
    if ('trait' in d && !(d.trait in traitNames)) errors.push(`${d.id}: 人格条件不存在`);
  }
  for (const d of storyArcs)
    if (d.nodes.length < 3 || d.bold === d.quiet || d.delay < 1 || d.delay > 60)
      errors.push(`${d.id}: 剧情状态或时间跨度无效`);
  return errors;
}
