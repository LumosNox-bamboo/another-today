import { npcHasOtherPartner } from './HouseholdEngine';
import { type World, DAY, dayKey, random, clamp, record, jobs } from './model';
import { publishNews } from './TownNewsEngine';
import { rememberEvent } from './MemoryEngine';
export function npcLifeTick(w: World) {
  const day = dayKey(w.time);
  for (const [i, n] of w.npcs.entries()) {
    let life = w.living.npcLives.find((l) => l.id === n.id);
    if (!life) {
      life = {
        id: n.id,
        tier: i < 6 ? 'core' : i < 14 ? 'regular' : 'background',
        home: '梧桐街',
        project: i % 2 ? '练习新作品' : '学习新技能',
        progress: 0,
        lastDay: '',
        changes: 0,
      };
      w.living.npcLives.push(life);
    }
    if (life.lastDay === day) continue;
    life.lastDay = day;
    life.progress = clamp(
      life.progress + (life.tier === 'core' ? 6 : life.tier === 'regular' ? 3 : 1),
    );
    const chance = life.tier === 'core' ? 0.18 : life.tier === 'regular' ? 0.08 : 0.035;
    if (life.progress < 100 && random(w) > chance) continue;
    const roll = random(w);
    let text = '',
      news = '';
    if (life.progress >= 100) {
      text = `${n.name}完成了${life.project}，开始准备下一项计划。`;
      life.progress = 0;
      life.project = life.project === '练习新作品' ? '学习新技能' : '练习新作品';
      news = 'news-45';
    } else if (roll < 0.18) {
      const choices = jobs.filter((j) => j !== n.job && j !== '学生');
      const old = n.job;
      n.job = choices[Math.floor(random(w) * choices.length)];
      text = `${n.name}从${old}转为${n.job}。`;
      news = 'news-47';
      w.living.stats.careerChanges++;
    } else if (roll < 0.36) {
      life.home = life.home === '梧桐街' ? '河岸小区' : '梧桐街';
      text = `${n.name}搬到了${life.home}，调整了自己的通勤。`;
      news = 'news-46';
    } else if (roll < 0.52) {
      const interests = ['阅读', '音乐', '绘画', '运动', '园艺', '摄影'];
      n.interest = interests.filter((x) => x !== n.interest)[Math.floor(random(w) * 5)];
      text = `${n.name}开始培养${n.interest}兴趣。`;
      news = 'news-48';
    } else {
      const other = w.npcs[(i + 1 + Math.floor(random(w) * (w.npcs.length - 1))) % w.npcs.length];
      const a = n.id < other.id ? n.id : other.id,
        b = n.id < other.id ? other.id : n.id;
      let bond = w.living.npcBonds.find((bnd) => bnd.a === a && bnd.b === b);
      if (!bond) {
        bond = { a, b, warmth: 40, conflict: 0, status: '认识', since: w.time };
        w.living.npcBonds.push(bond);
      }
      if (random(w) < 0.22) {
        bond.conflict = clamp(bond.conflict + 25);
        bond.warmth = clamp(bond.warmth - 10);
        text = `${n.name}和${other.name}出现分歧，暂时各自安排时间。`;
        if (bond.status === '恋人' && bond.conflict >= 45) {
          bond.status = '前任';
          text = `${n.name}和${other.name}结束了恋爱关系，保留各自的生活。`;
        }
      } else {
        bond.warmth = clamp(bond.warmth + 18);
        bond.conflict = clamp(bond.conflict - 12);
        if (bond.warmth >= 55 && bond.status !== '恋人') bond.status = '朋友';
        const taken = (id: string) =>
          w.living.npcBonds.some((b) => b.status === '恋人' && (b.a === id || b.b === id)) ||
          w.npcs.find((n) => n.id === id)?.relation.type === '恋人' ||
          npcHasOtherPartner(w, id);
        if (
          bond.warmth >= 75 &&
          n.traits.romance > 45 &&
          other.traits.romance > 45 &&
          !taken(a) &&
          !taken(b) &&
          w.time - bond.since > 7 * DAY
        )
          bond.status = '恋人';
        text = `${n.name}和${other.name}一起${n.interest === '阅读' ? '读书' : '散步'}，现在是${bond.status}。`;
        news = 'news-49';
      }
    }
    const e = record(w, `${n.name}的独立生活`, text, '居民生活', false, `npc-life-${n.id}`, n.id);
    n.memories.push(`${day}：${text}`);
    n.memories = n.memories.slice(-12);
    life.changes++;
    w.living.stats.npcChanges++;
    if (life.tier === 'core') rememberEvent(w, e, 55);
    if (news) publishNews(w, news, n.id, e.id);
  }
}
