import { outskirtsGifts } from './outskirtsGifts';
import type { Activity, Scene, Trait } from '../engine/model';
export interface GiftDefinition {
  id: string;
  name: string;
  category: string;
  interest: string;
  activity: Activity;
  trait: Trait;
  followUp: string;
  scene?: Scene;
}
const giftRows = [
  [
    '书籍',
    '阅读',
    'read',
    'curiosity',
    '街区诗集|植物图鉴|旧版旅行记',
    '在赠书的页边发现新的阅读线索',
  ],
  ['植物', '园艺', 'garden', 'kindness', '薄荷盆栽|小柠檬树|耐阴蕨类', '照料的植物长出了新叶'],
  [
    '家具',
    '手工',
    'rest',
    'discipline',
    '窗边矮凳|可调台灯|二手小边桌',
    '重新安排了一个舒服的生活角落',
  ],
  [
    '装饰',
    '绘画',
    'create',
    'creativity',
    '蓝色风铃|云朵挂画|手工陶花瓶',
    '房间里的颜色带来了创作灵感',
  ],
  [
    '文具',
    '写作',
    'study',
    'discipline',
    '空白笔记本|软木书签|钢笔套装',
    '把一个零散念头记成了完整的一页',
  ],
  ['乐器', '音乐', 'create', 'openness', '拇指琴|口琴|小型木琴', '终于练出了一个连贯的乐句'],
  [
    '艺术用品',
    '绘画',
    'create',
    'creativity',
    '便携画具|水彩纸本|黏土套装',
    '试着用新的材料完成一张练习',
  ],
  [
    '收藏品',
    '收藏',
    'walk',
    'curiosity',
    '矿石标本|旧车票册|星空徽章',
    '找到可以与收藏放在一起的新故事',
  ],
  ['衣物', '运动', 'walk', 'adventure', '柔软围巾|轻便雨衣|步行布鞋', '穿着礼物走过了熟悉的街角'],
  [
    '纪念品',
    '回忆',
    'read',
    'romance',
    '城市明信片|小木船|手写祝福卡',
    '再次拿起礼物，想起收到它的那一天',
  ],
] as const;
export const gifts: GiftDefinition[] = giftRows.flatMap(
  ([category, interest, activity, trait, names, followUp], g) =>
    names.split('|').map((name, i) => ({
      id: `gift-${g}-${i}`,
      name,
      category,
      interest,
      activity,
      trait,
      followUp,
    })),
);
export interface HabitDefinition {
  id: string;
  name: string;
  activity: Activity;
  trait: Trait;
  from: number;
  until: number;
  context: 'any' | 'plant' | 'friend' | 'creative';
  diary: string;
}
export const habits: HabitDefinition[] = `
晨起读两页|read|discipline|6|10|any|早晨读过的几页，让一天有了起点。
睡前翻书|read|sensitivity|20|24|any|睡前留了一小段安静的阅读时间。
周末去图书馆|read|curiosity|10|18|any|又在书架之间找到了一段自己的时间。
做阅读摘录|read|discipline|0|24|any|把喜欢的句子留在笔记里。
对照不同的书|read|openness|0|24|any|试着从两个角度看同一个问题。
晨间拉伸|walk|discipline|6|10|any|走动之后，身体慢慢醒过来。
傍晚散步|walk|sensitivity|17|22|any|傍晚的路总能让心慢下来。
观察街角植物|walk|curiosity|8|18|plant|今天也看了看路边的叶子。
探索小巷|walk|adventure|10|20|any|绕了一点路，看见新的角落。
午后晒太阳|walk|openness|12|17|any|把一小段下午交给阳光。
早餐后收拾|wash|discipline|7|11|any|洗漱整理后，心里也清爽一些。
夜班后梳洗|wash|discipline|6|10|any|把工作后的疲惫留在水声里。
起床开窗|wash|openness|6|18|any|整理自己时，也让房间透了气。
给植物浇水|garden|kindness|6|20|plant|又照看了一次窗边的绿色。
检查土壤|garden|discipline|0|24|plant|没有急着添水，先看看泥土。
记录新芽|garden|curiosity|0|24|plant|植物的一点变化被记了下来。
给盆栽转向|garden|sensitivity|8|18|plant|给叶子换一个朝向阳光的角度。
午后速写|create|creativity|12|18|creative|手边的一小张练习，留住了下午。
夜间写片段|create|sensitivity|19|24|creative|夜里更容易听见自己的念头。
练习一个乐句|create|discipline|0|24|creative|重复练习，也会有微小的变化。
整理创作草稿|create|discipline|0|24|creative|不满意的草稿也先留着。
尝试新材料|create|openness|0|24|creative|允许自己做一次不熟练的尝试。
把观察画下来|create|curiosity|0|24|creative|今天看到的东西，成了画面的一部分。
向朋友问好|socialize|extraversion|8|22|friend|打个招呼，也能让日子有交点。
认真听完故事|socialize|kindness|0|24|friend|听别人把话说完，才发现更多细节。
分享有趣发现|socialize|curiosity|0|24|friend|把一个小发现讲给了熟悉的人。
午后咖啡|coffee|extraversion|12|17|any|用一杯咖啡给下午留了停顿。
慢慢喝热饮|coffee|sensitivity|8|22|any|这杯热饮没有急着喝完。
工作前列清单|work|discipline|8|12|any|先理清小步骤，再动手。
完成后检查|work|discipline|0|24|any|多检查一遍，发现一个可以改进的地方。
向同行请教|work|openness|0|24|any|工作里仍有值得学习的东西。
睡前放下屏幕|rest|discipline|20|24|any|让眼睛离开屏幕，安静一会儿。
忙碌后发呆|rest|independence|0|24|any|什么也不安排的片刻，也很必要。
听雨休息|rest|sensitivity|0|24|any|停下来，听见了房间以外的声音。
做简单晚饭|eat|kindness|17|21|any|普通的一顿饭，照顾好今天的自己。
按时吃早餐|eat|discipline|6|10|any|先吃一点东西，再开始忙碌。
尝试新口味|eat|adventure|0|24|any|今天的饭菜里有一点新鲜感。
温习昨天的内容|study|discipline|0|24|any|回看旧问题，理解比昨天清楚一点。
追问一个为什么|study|curiosity|0|24|any|一个疑问又引出了下一个问题。
留一段游戏时间|play|independence|18|24|any|给自己留一点纯粹好玩的时间。
`
  .trim()
  .split('\n')
  .map((row, i) => {
    const [name, activity, trait, from, until, context, diary] = row.split('|');
    return {
      id: `habit-${i}`,
      name,
      activity: activity as Activity,
      trait: trait as Trait,
      from: +from,
      until: +until,
      context: context as HabitDefinition['context'],
      diary,
    };
  });
export interface SecretDefinition {
  id: string;
  title: string;
  activity: Activity;
  trait: Trait;
  days: number;
  reveal: string;
  end: string;
}
export const secrets: SecretDefinition[] = `
悄悄练习的旋律|create|romance|28|最近在试着练一段旋律，还没准备好给别人听。|终于愿意把练过的旋律留下来。
未寄出的信|create|sensitivity|35|写了一封信，寄不寄出还需要想想。|决定把信留作那段心情的见证。
小小的摄影计划|walk|curiosity|21|想拍齐街道在不同光线里的样子。|完成了一组街道观察。
偷偷准备的盆栽|garden|kindness|18|在照顾一株想送给朋友的植物。|植物长稳了，也把祝福送了出去。
想尝试新职业|study|adventure|42|有时会查另一种职业的资料。|认真比较之后，给自己留下了新的学习方向。
旧地图的标记|walk|curiosity|30|旧地图上有个地方一直想去看看。|终于走到标记的地点，发现它已经变了。
不熟练的舞步|play|openness|21|偶尔会对着视频练习舞步。|不再那么在意自己是不是跳得好。
匿名的短篇|create|independence|40|正在写一个暂时不署名的短篇。|完成了自己的匿名短篇。
记忆中的味道|eat|sensitivity|18|想重新做出记忆里的一种味道。|尝试之后，接受味道与记忆可以不同。
收藏的一颗石头|walk|romance|14|有一颗普通石头，却记得捡到它的那一天。|给石头写下了来历。
想修复的旧物|study|discipline|30|正在学怎么修好一个旧物件。|修补留下痕迹，也让物件继续使用。
深夜的天文笔记|read|curiosity|35|最近在读星空的资料。|把观察整理成了一页星空笔记。
暂未说出的道歉|socialize|kindness|28|想找合适的时候认真说声抱歉。|终于把想说的话表达清楚。
未完成的画|create|creativity|45|有一张画改了很多次，还没完成。|决定给画留下一个不完美的结尾。
给未来的存款|work|discipline|60|正在为一个还没成形的计划留一点积蓄。|把模糊的计划拆成了可以做的步骤。
想换个生活节奏|rest|independence|30|最近在试着把生活安排得慢一点。|找到了能坚持的新节奏。
悄悄读的诗集|read|romance|24|有几首诗，读的时候总会停很久。|把喜欢的句子抄在了扉页。
担心失去的朋友|socialize|sensitivity|21|有点担心和熟悉的人慢慢走远。|主动问候之后，接受彼此也有自己的生活。
旧梦想的小练习|study|openness|50|重新试了试以前放下的技能。|发现重新开始不必从证明自己开始。
城市声音收藏|walk|creativity|32|想记住这座城市里容易忽略的声音。|整理出一段属于街区的声音印象。
`
  .trim()
  .split('\n')
  .map((row, i) => {
    const [title, activity, trait, days, reveal, end] = row.split('|');
    return {
      id: `secret-${i}`,
      title,
      activity: activity as Activity,
      trait: trait as Trait,
      days: +days,
      reveal,
      end,
    };
  });
export interface NewsDefinition {
  id: string;
  title: string;
  text: string;
  scene: Scene;
  activity: Activity;
  days: number;
  effect: 'gathering' | 'repair' | 'opportunity' | 'season' | 'npc';
}
export const newsTemplates: NewsDefinition[] = `
春季种子交换|公园开放了种子交换角，愿意照料植物的人可以参与。|park|garden|3|gathering
夏夜散步会|天台组织晚风散步，居民可以在傍晚一起走走。|night|walk|2|gathering
秋叶观察周|图书馆收集街区秋叶观察，欢迎带来自己的记录。|library|read|7|season
冬季热饮角|咖啡馆添了热饮角，供经过的人歇脚。|cafe|coffee|5|season
旧书交换日|图书馆设立旧书交换桌，阅读时可以发现新书。|library|read|3|gathering
邻里慢跑|公园开始轻量慢跑活动，没有速度要求。|park|walk|2|gathering
天台观星|天台安排夜间观星，带笔记也可以只来看看。|night|walk|2|gathering
街角速写|街道发起速写活动，记录正在变化的店面。|street|create|3|gathering
手工修补课|便利店旁开设旧物修补体验。|shop|study|4|opportunity
公共长椅维修|公园一部分长椅进入维修，居民暂时换地方休息。|park|rest|2|repair
图书馆灯具检修|阅览区正在检修灯具，部分居民改在家阅读。|library|read|1|repair
天台栏杆维护|天台临时维护栏杆，晚间散步转移到街道。|night|walk|2|repair
街道铺路|街区局部铺路，行人绕行到公园。|street|walk|3|repair
咖啡机保养|咖啡馆暂停部分热饮供应，店员安排清洁。|cafe|coffee|1|repair
办公室空调维护|公共办公室调整工位，部分工作暂时改在家完成。|office|work|2|repair
社区写作桌|图书馆新增共享写作桌，居民可来整理短文。|library|create|6|opportunity
便民补给台|便利店开设生活补给台，日用品选择增加。|shop|shop|4|opportunity
植物诊疗桌|公园设立植物养护咨询桌。|park|garden|3|opportunity
照片征集|社区征集街区照片，已完成的作品可以参加展示。|street|create|7|opportunity
小型演奏会|咖啡馆向居民开放短曲演奏时间。|cafe|create|4|opportunity
午间读诗|图书馆举办不需准备的午间读诗。|library|read|2|gathering
棋盘下午|咖啡馆摆出了公共棋盘。|cafe|play|3|gathering
安静学习日|图书馆留出一片安静学习区。|library|study|4|opportunity
新人见面会|街道安排居民见面会，让不熟悉的人互相认识。|street|socialize|2|gathering
无主题散步|公园邀请居民自由结伴散步。|park|walk|3|gathering
二手衣物角|便利店设置衣物交换角。|shop|shop|4|opportunity
旧唱片试听|咖啡馆开放旧唱片试听桌。|cafe|coffee|3|gathering
草稿分享会|公共办公室邀请居民分享尚未完成的草稿。|office|create|3|gathering
灯下手工夜|图书馆安排晚间纸艺活动。|library|create|2|gathering
邻里早餐桌|街道设置周末早餐长桌。|street|eat|2|gathering
公共花箱计划|公园启动花箱认养，需要持续照料。|park|garden|7|opportunity
窗台故事征集|社区邀请居民写下窗台上的故事。|apartment|create|6|opportunity
职业交流日|办公室组织居民交流各自工作的经验。|office|socialize|3|opportunity
雨伞共享架|便利店开设共享雨伞架。|shop|shop|5|opportunity
散步路线征集|公园收集居民喜欢的步行路线。|park|walk|5|opportunity
慢生活休息日|咖啡馆安排安静时段，允许只是坐着休息。|cafe|rest|2|gathering
社区小比赛|公园开展无需报名的步行记录挑战。|park|walk|4|gathering
晚间读书灯|图书馆延长部分阅览桌的开放时间。|library|read|5|opportunity
修好的公告板|街道公告板完成维护，新活动可以张贴。|street|walk|3|opportunity
屋顶花盆交换|天台组织闲置花盆交换。|night|garden|3|gathering
纸张再利用|办公室整理出可供练习的单面纸。|office|create|4|opportunity
城市记忆展台|图书馆开放旧物故事展台。|library|read|7|opportunity
微型书店开张|便利店里新增了独立选书的小书架。|shop|read|7|opportunity
咖啡新菜单|咖啡馆开始试做季节饮品。|cafe|coffee|5|opportunity
便民修鞋日|街道邀请修补师处理居民的旧鞋。|street|shop|2|opportunity
居民新作品|{npc}完成了自己的练习项目，愿意与街区分享。|cafe|socialize|4|npc
居民搬家消息|{npc}搬到了新的住处，仍然会在街区活动。|street|socialize|4|npc
居民职业变化|{npc}调整了工作，正在适应新的安排。|office|socialize|4|npc
居民新兴趣|{npc}开始尝试新的兴趣，想找机会继续练习。|park|socialize|4|npc
居民结伴消息|{npc}与另一位居民开始结伴活动。|cafe|socialize|3|npc
`
  .trim()
  .split('\n')
  .map((row, i) => {
    const [title, text, scene, activity, days, effect] = row.split('|');
    return {
      id: `news-${i}`,
      title,
      text,
      scene: scene as Scene,
      activity: activity as Activity,
      days: +days,
      effect: effect as NewsDefinition['effect'],
    };
  });

gifts.push(...outskirtsGifts);

newsTemplates.push(
  ...`
河岸观察桌|芦苇河岸摆出可自由使用的记录板，来往居民可以留下今天看到的水面变化。|riverside|walk|4|opportunity
桥影写生日|河岸留出一处安全的写生位置，初学者也可以只画一小块影子。|riverside|create|3|gathering
步道护栏维护|河岸步道进行护栏检修，这几天先到别处散步。|riverside|walk|2|repair
温室育苗课|玻璃温室开放基础育苗练习，先学习观察土壤再决定是否浇水。|greenhouse|garden|5|opportunity
植物名牌整理|温室邀请居民一起核对名牌与登记册，也可以来读一读植物资料。|greenhouse|study|3|gathering
温室玻璃检修|温室正在检查玻璃和通风窗，暂时关闭公共照料区域。|greenhouse|garden|2|repair
旧物修补桌|工坊开放旧木料和布片练习桌，想学修补可以从最小的一步开始。|workshop|study|5|opportunity
碎布拼贴会|工坊安排一次碎布拼贴活动，没缝过东西也可以先观察。|workshop|create|4|gathering
工具架维护|工坊整理并检修公用工具，这两天暂停开放练习。|workshop|create|2|repair
周末食材桌|集市增加当季食材介绍桌，开放日可以来比较味道和做法。|market|eat|2|opportunity
纸品交换小桌|集市本周末安排公开纸品交换桌，请只带适合分享的非私人物品。|market|shop|2|gathering
集市棚架检修|集市检修遮棚，本次开放暂停，居民改到街角补充日用品。|market|shop|2|repair
剧场开放练习|纸灯小剧场本周安排公开练习时段，居民可以阅读台本或尝试道具制作。|theater|create|6|opportunity
五分钟声音分享|剧场开启简短的声音分享，允许只说一句或安静旁听。|theater|socialize|3|gathering
剧场灯具检修|剧场进行灯具检查，这几天先在其他地方练习或休息。|theater|rest|2|repair
山坡星图桌|观测站摆出纸制星图，阴天也可以学习日期和方向，不承诺特殊天象。|observatory|study|6|opportunity
傍晚天气记录会|山坡安排轻量天气观察，记录看到的云和风就可以，不需要准备设备。|observatory|walk|4|gathering
观测站步道检修|通往观测站的公共步道需要检修，站点暂时关闭，晚间请改在街区活动。|observatory|walk|2|repair
`
    .trim()
    .split('\n')
    .map((row, i) => {
      const [title, text, scene, activity, days, effect] = row.split('|');
      return {
        id: `news-out-${i}`,
        title,
        text,
        scene: scene as Scene,
        activity: activity as Activity,
        days: +days,
        effect: effect as NewsDefinition['effect'],
      };
    }),
);
