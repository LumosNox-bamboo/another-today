import type { EventDefinition } from './events';
import { careerTracks } from './careers';

// Stable, additive IDs: old saves keep their original event references.
const careerMoments = [
  [
    'office',
    '表格里的第二个版本',
    '发现共享表格有两个版本，没有急着覆盖，先对照日期把不同之处标了出来。',
  ],
  [
    'software',
    '错误信息终于说人话了',
    '把一条含糊的报错改成了具体提示，再用错误输入试了一次。这次不用翻日志也知道哪里出了问题。',
  ],
  [
    'barista',
    '奶泡上的小练习',
    '用练习杯试了一个更慢的倾倒角度。图案还不太像叶子，不过奶泡比上一次细腻了。',
  ],
  [
    'retail',
    '标签朝外的一排货架',
    '整理货架时把相似包装分开摆放，又核对了一遍价签。以后找货应该能少绕一点路。',
  ],
  [
    'freelance',
    '给修改留一个边界',
    '在交付清单里补上了修改轮次和反馈时间。写得清楚一点，自己安排下一周时也踏实一点。',
  ],
  [
    'illustration',
    '缩小之后才看见',
    '把草图缩成小图，才发现主体被背景抢了风头。擦掉几笔后，画面反而清楚了。',
  ],
  [
    'writing',
    '删掉最舍不得的一句',
    '一句漂亮的话总把段落带偏。犹豫了一会儿，把它移到素材本里，留给别的故事。',
  ],
  [
    'teaching',
    '换一种问法',
    '备课时发现一道题只会让学生回答对或错，于是加了一个“你是怎么想到的”。决定留时间听推理过程。',
  ],
  [
    'student-general',
    '先修课的小箭头',
    '把感兴趣的课程连成一张先修图。原来不用同时学完所有东西，先选好起点就够了。',
  ],
  [
    'student-cs',
    '空数组也算输入',
    '作业在普通输入上正常，换成空数组却出错了。补上边界测试后，给自己记了一条检查提醒。',
  ],
  [
    'student-medicine',
    '模型旁的方向标记',
    '在解剖模型旁练习辨认方向，发现自己换个角度就容易混淆。重新画了示意图，没有把记不清的地方硬背成答案。',
  ],
  [
    'student-nursing',
    '交班练习的停顿',
    '复听模拟交班录音，发现自己说得太快。把最需要观察的事项挪到前面，再慢慢练了一遍。',
  ],
  [
    'student-law',
    '判决旁边的问号',
    '读教学案例时把事实、争点和论证分开标记。同一个结果背后，原来还有需要仔细区分的理由。',
  ],
  [
    'student-economics',
    '横轴的单位',
    '复核课程图表时发现两组数据的时间单位不同。统一口径后，原先看起来惊人的差距变小了。',
  ],
  [
    'student-business',
    '预算里的缓冲格',
    '课程方案把预算排得太满，稍有变化就会超支。重新留出缓冲，再写明哪些项目可以后延。',
  ],
  [
    'student-literature',
    '同一句的另一种读法',
    '对照作品的上下文重读一句话，发现初读时把叙述者和作者混在了一起。给读书笔记补了一条修正。',
  ],
  [
    'student-languages',
    '直译留下的拐弯',
    '译完一段对话后读出声，感觉语序很别扭。保留意思，换成更自然的表达，再回头检查有没有漏掉语气。',
  ],
  [
    'student-journalism',
    '练习稿里的出处',
    '检查课程新闻稿，把找不到原始出处的数字标为待核实。稿子暂时短了一点，但每一句更站得住了。',
  ],
  [
    'student-education',
    '十分钟的试讲',
    '试讲计时到了，准备的内容还没讲完。删去重复解释，把时间留给提问和练习。',
  ],
  [
    'student-psychology',
    '相关不等于原因',
    '整理课堂论文时差点把相关写成因果。改回谨慎的说法，并记下研究设计还不能回答的问题。',
  ],
  [
    'student-architecture',
    '纸模型的入口',
    '从纸模型里模拟人的行走路线，发现入口转角太局促。先调整动线，暂时放下立面的装饰。',
  ],
  [
    'student-mechanical',
    '图纸上的公差',
    '复核课程零件图时发现只标了尺寸，没有考虑配合要求。回到例题重新核对公差标注。',
  ],
  [
    'student-biology',
    '空白对照的位置',
    '检查教学实验记录，发现一处对照信息没有写清。标明缺失，准备向老师核实，没有凭印象补出结果。',
  ],
  [
    'student-design',
    '远一点看海报',
    '把课程海报缩小到手机尺寸，发现副标题几乎看不见。重新调整字号后，信息顺序终于清楚了。',
  ],
  [
    'student-music',
    '节拍器慢了下来',
    '把总是卡住的乐句降速练习。慢得有点不习惯，却终于听清了两个音之间该留的距离。',
  ],
  [
    'school-primary',
    '题目里圈出的词',
    '做练习时漏看了“还剩”两个字，重新圈出条件，再画了小图。这次明白该算什么了。',
  ],
  [
    'school-secondary',
    '错题本上的原因',
    '没有把整道题抄一遍，只写下自己漏掉的条件。复习页变短了，问题却更清楚了。',
  ],
  [
    'between-jobs',
    '简历里的一件小事',
    '修改简历时删掉了笼统的形容词，换成一件自己确实做过的事。暂时没有投递，先把描述写准确。',
  ],
  [
    'retired',
    '不用赶完的课程',
    '学习时遇到不懂的地方，给书页夹了一张纸。今天不必全弄明白，下一次可以从这里接着看。',
  ],
];
export const everydayEvents: EventDefinition[] = careerMoments.map(([id, title, description]) => {
  const track = careerTracks.find((t) => t.id === id)!;
  return {
    eventId: `daily-career-${id}`,
    category: '职业与学业见闻',
    title,
    description,
    triggerConditions: { activities: [track.activity], gate: 'any' },
    careerTrack: id,
    scenes: [track.scene],
    weight: 2,
    cooldown: 7 * 1440,
    participants: 'self',
    playerChoiceRequired: false,
    choices: [],
    effects: { mood: 2, stress: -1, money: 0 },
    followUpEvents: [],
    memoryTags: [track.name, title],
    rarity: 'common',
    repeatPolicy: 'cooldown',
  };
});

const quietMoments: [
  string,
  string,
  string,
  EventDefinition['triggerConditions']['activities'],
  EventDefinition['scenes'],
][] = [
  [
    'rice',
    '锅盖上的水汽',
    '做饭时看见锅盖上的水珠聚到一起，顺着边缘滑了下去。把火调小，给自己留了一顿慢慢吃的饭。',
    ['eat'],
    ['apartment'],
  ],
  [
    'drawer',
    '抽屉里的空位',
    '整理抽屉时没有继续往里塞东西，反而腾出一个空格。以后常用的小东西终于有地方放了。',
    ['rest', 'wash'],
    ['apartment'],
  ],
  [
    'laundry',
    '晾衣夹的小队伍',
    '把散落的夹子收在一起，按颜色排了一排。没什么特别用途，只是看着有点开心。',
    ['wash'],
    ['apartment'],
  ],
  [
    'margin',
    '留给疑问的页边',
    '读到没想明白的一段，没有急着划重点，只在笔记边上写了一个问号。下次也许会有不同理解。',
    ['read'],
    ['library', 'apartment'],
  ],
  [
    'bench',
    '长椅的另一端',
    '散步经过长椅，选了一处不挡路的位置坐下。鞋底沾着一点叶屑，休息够了再慢慢走。',
    ['walk', 'rest'],
    ['park'],
  ],
  [
    'recipe',
    '给下次的食谱备注',
    '尝过自己做的饭，在食谱旁写下“下次少放一点盐”。不算失败，只是有了更合自己口味的版本。',
    ['eat'],
    ['apartment'],
  ],
  [
    'stretch',
    '肩膀终于放下了',
    '伸展时才发现肩膀一直绷着。动作放慢了一点，没有追求幅度，结束后觉得轻松了些。',
    ['rest'],
    ['apartment', 'park'],
  ],
  [
    'bookmark',
    '书签停在半句话',
    '读到一半注意力飘走了，干脆合上书。书签夹在那里，故事不会因为休息一下就跑掉。',
    ['read'],
    ['library', 'apartment'],
  ],
  [
    'sketch',
    '留下那条歪线',
    '创作时画出一条歪线，本想擦掉，又觉得它有点生动。暂时留着，看看接下来会变成什么。',
    ['create'],
    ['apartment'],
  ],
  [
    'window',
    '擦亮一小块玻璃',
    '擦拭窗边时先清理了一小块玻璃。外面的轮廓清楚了，不知不觉又把旁边也擦干净了。',
    ['wash'],
    ['apartment'],
  ],
  [
    'pace',
    '不一样的步速',
    '走到熟悉的路段，刻意放慢几步。原来平时匆匆经过的树根旁，还长着一簇小草。',
    ['walk'],
    ['park'],
  ],
  [
    'pause',
    '待办里的空白行',
    '重新看了一遍自己的安排，没有再加一件事，而是留了一行空白。临时变化也需要一点位置。',
    ['rest'],
    ['apartment'],
  ],
];
for (const [id, title, description, activities, scenes] of quietMoments) {
  everydayEvents.push({
    eventId: `daily-small-${id}`,
    category: '生活小事',
    title,
    description,
    triggerConditions: { activities, gate: 'any' },
    scenes,
    weight: 1,
    cooldown: 5 * 1440,
    participants: 'self',
    playerChoiceRequired: false,
    choices: [],
    effects: { mood: 2, stress: -2, money: 0 },
    followUpEvents: [],
    memoryTags: ['日常', title],
    rarity: 'common',
    repeatPolicy: 'cooldown',
  });
}
const conversations = [
  [
    'silence',
    '可以一起不说话',
    '和{npc}坐了一会儿，没有一直找话题。偶尔看看周围，也是一种舒服的相处。',
  ],
  [
    'disagree',
    '保留不同的看法',
    '和{npc}聊起一本书的结尾，发现喜欢的地方完全不同。没有争出胜负，倒是多了一种读法。',
  ],
  [
    'listen',
    '先听完再回答',
    '{npc}说起最近的小烦恼。忍住了立刻给建议的冲动，先问对方是想一起想办法，还是只想说一说。',
  ],
  [
    'joke',
    '笑点来得有点晚',
    '{npc}说了一句俏皮话，过了一会儿才反应过来。两个人又为这慢半拍笑了一次。',
  ],
  [
    'boundary',
    '把改天说清楚',
    '和{npc}聊起见面的安排，没有随口答应所有提议。先说清自己的空闲时间，约定以后再确认。',
  ],
  [
    'small',
    '认真听一件小事',
    '{npc}分享了一件不大的生活琐事。认真听完才发现，有些开心不需要很大的理由。',
  ],
];
for (const [id, title, description] of conversations) {
  everydayEvents.push({
    eventId: `daily-friend-${id}`,
    category: '朋友日常',
    title,
    description,
    triggerConditions: { activities: ['socialize'], gate: 'friend' },
    weight: 1,
    cooldown: 6 * 1440,
    participants: 'npc',
    playerChoiceRequired: false,
    choices: [],
    effects: { mood: 3, stress: -1, money: 0 },
    followUpEvents: [],
    memoryTags: ['朋友', title],
    rarity: 'uncommon',
    repeatPolicy: 'cooldown',
  });
}
// Quiet follow-ups require a real earlier event and at least two game days.
for (const [id, title, description] of [
  [
    'recipe',
    '食谱的第二行备注',
    '照着上次留下的少盐备注又做了一次饭。这回更合口味，在旁边画了一个小小的勾。',
  ],
  [
    'margin',
    '问号旁的新想法',
    '翻到之前留下的阅读疑问，试着用自己的话重新解释。还没有完全想通，但比上次多懂了一点。',
  ],
  [
    'sketch',
    '歪线长出了故事',
    '重新看那张留下歪线的草稿，顺着它补了几笔。意外的部分成了画面里最喜欢的地方。',
  ],
  [
    'drawer',
    '空格真的派上了用场',
    '需要收好一件随手用的小东西时，想起之前腾出的抽屉空格。没有再花时间四处找位置。',
  ],
]) {
  const first = everydayEvents.find((e) => e.eventId === `daily-small-${id}`)!;
  const nextId = `daily-follow-${id}`;
  first.followUpEvents.push(nextId);
  everydayEvents.push({
    ...first,
    eventId: nextId,
    title,
    description,
    requiresEvent: { id: first.eventId, days: 2 },
    followUpEvents: [],
    memoryTags: ['日常后续', title],
    rarity: 'uncommon',
    repeatPolicy: 'once',
  });
}
