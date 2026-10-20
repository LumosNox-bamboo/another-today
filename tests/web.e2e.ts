import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('friends can create, play, export and resume their own browser world', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('./');
  await expect(page.getByText('TA 是什么样的人？')).toBeVisible();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await expect(page.getByText('又是一个小小的今天')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: '桌面小窗', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
  await expect.poll(async () => (await saved())?.character.name).toBe('小满');
  await page.getByRole('button', { name: '和小满聊聊天' }).click();
  await expect(page.getByRole('textbox', { name: '聊天内容' })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  const before = await saved();
  await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '快进 6 小时' }).click();
  await expect.poll(async () => (await saved()).diaries.length).toBeGreaterThan(0);
  const advanced = await saved();
  expect(advanced.time).toBe(before.time + 24 * 60 * 60 * 1000);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出存档', exact: true }).click();
  const exported = await download;
  expect(JSON.parse(await readFile((await exported.path())!, 'utf8')).time).toBe(advanced.time);
  await page.reload();
  await expect(page.getByText('又是一个小小的今天')).toBeVisible();
  expect((await saved()).diaries).toEqual(advanced.diaries);
  expect((await saved()).time).toBe(advanced.time);
  const size = await page.evaluate(() => ({
    width: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(size.content).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(size.width).toBe(page.viewportSize()!.width);
  await page.screenshot({ path: test.info().outputPath('web-game.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('living expansion migrates an old save and exposes real gifts, habits, town and artwork', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  // An actual old-format world has no extension block. Reload must preserve identity.
  await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem('another-today')!);
    delete w.living;
    localStorage.setItem('another-today', JSON.stringify(w));
  });
  // Avoid beforeunload writing the still-open in-memory world over the migration fixture.
  const old = await page.evaluate(() => localStorage.getItem('another-today')!);
  await page.goto('about:blank');
  await page.addInitScript((raw) => {
    if (location.protocol.startsWith('http') && !sessionStorage.getItem('migration-once')) {
      localStorage.setItem('another-today', raw);
      sessionStorage.setItem('migration-once', '1');
    }
  }, old);
  await page.goto('./');
  await expect(page.getByText('又是一个小小的今天')).toBeVisible();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
  await expect.poll(async () => (await saved()).living?.revision).toBe(1);
  await page.locator('nav').getByRole('button', { name: '世界', exact: true }).click();
  await page.getByRole('tab', { name: '礼物与作品' }).click();
  await page.getByLabel('挑选礼物').selectOption('gift-6-0');
  await page.getByRole('button', { name: '送给 TA', exact: true }).click();
  await expect.poll(async () => (await saved()).living.gifts.length).toBe(1);
  await expect(page.getByRole('button', { name: '送给 TA', exact: true })).toBeDisabled();
  await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
  await page.getByLabel('免打扰模式').check();
  await page.getByLabel('季节日历').selectOption('real');
  for (let i = 0; i < 28; i++) await page.getByRole('button', { name: '快进 6 小时' }).click();
  await expect.poll(async () => (await saved()).living.npcLives.length).toBe(18);
  await expect.poll(async () => (await saved()).living.news.length).toBeGreaterThan(0);
  await expect
    .poll(async () => (await saved()).living.habits.filter((h: any) => h.formed).length)
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await saved()).living.creations.filter((c: any) => c.completed).length)
    .toBeGreaterThan(0);
  await page.locator('nav').getByRole('button', { name: '世界', exact: true }).click();
  await page.getByRole('tab', { name: '街区近况' }).click();
  await expect(page.getByRole('heading', { name: '小镇公告' })).toBeVisible();
  await page.getByRole('tab', { name: '礼物与作品' }).click();
  await page.getByRole('button', { name: '查看作品' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('img', { name: /作品/ })).toBeVisible();
  await page.getByRole('button', { name: '把作品送给朋友' }).click();
  await expect(page.getByRole('button', { name: '已经送给朋友' })).toBeDisabled();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('tab', { name: '长线故事' }).click();
  await page.getByLabel('回溯事件').selectOption({ index: 1 });
  await page.getByRole('tab', { name: '习惯与愿望' }).click();
  await expect(page.getByRole('heading', { name: '渐渐形成的习惯' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('living-world.png'), fullPage: true });
  const before = await saved();
  await page.reload();
  await expect(page.getByText(/又是一个小小的今天|夜色正温柔/)).toBeVisible();
  const after = await saved();
  expect(after.living.gifts).toEqual(before.living.gifts);
  expect(after.living.npcBonds).toEqual(before.living.npcBonds);
  expect(after.living.creations).toEqual(before.living.creations);
  expect(errors).toEqual([]);
});

test('outskirts visits, suggestions, keepsakes and six distinct scenes work without replacing an old world', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
  const name = (await saved()).character.name;
  await page.locator('nav').getByRole('button', { name: '世界', exact: true }).click();
  await page.getByRole('tab', { name: '散步与见闻' }).click();
  await expect(page.getByText('走远一点，也可以慢慢来')).toBeVisible();
  await expect(page.locator('.destination-card')).toHaveCount(6);
  const originalActivity = (await saved()).activity;
  const river = page
    .locator('.destination-card')
    .filter({ has: page.getByRole('heading', { name: '芦苇河岸', exact: true }) });
  await river.getByRole('button', { name: '建议有空去看看' }).click();
  await expect
    .poll(async () => (await saved()).living.exploration.suggestion?.scene)
    .toBe('riverside');
  expect((await saved()).activity).toEqual(originalActivity);
  for (const [id, name] of [
    ['riverside', '芦苇河岸'],
    ['greenhouse', '玻璃温室'],
    ['workshop', '旧物工坊'],
    ['market', '周末集市'],
    ['theater', '纸灯小剧场'],
    ['observatory', '山坡观测站'],
  ]) {
    await page.getByRole('button', { name: `看看${name}`, exact: true }).click();
    const modal = page.getByRole('dialog');
    await expect(modal.locator('canvas')).toBeVisible();
    const canvasBounds = await modal.locator('canvas').boundingBox();
    expect(canvasBounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 32);
    expect((await saved()).living.exploration.visits).toEqual({});
    await modal.screenshot({ path: test.info().outputPath(`scene-${id}.png`) });
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  }
  await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
  for (let i = 0; i < 56; i++) await page.getByRole('button', { name: '快进 6 小时' }).click();
  await expect
    .poll(async () => (await saved()).living.exploration.discoveries.length)
    .toBeGreaterThan(0);
  await page.locator('nav').getByRole('button', { name: '世界', exact: true }).click();
  await page.getByRole('tab', { name: '散步与见闻' }).click();
  await page.getByRole('button', { name: '展示在公寓里', exact: true }).first().click();
  const after = await saved();
  expect(after.character.name).toBe(name);
  expect(after.living.exploration.display).toBeTruthy();
  expect(Object.keys(after.living.exploration.visits).length).toBeGreaterThanOrEqual(4);
  await page.screenshot({ path: test.info().outputPath('outskirts-journal.png'), fullPage: true });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.reload();
  expect((await saved()).living.exploration).toEqual(after.living.exploration);
  await page.locator('nav').getByRole('button', { name: '世界', exact: true }).click();
  await page.getByRole('tab', { name: '散步与见闻' }).click();
  await expect(page.getByRole('button', { name: '收起公寓里的展示', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('scene controls explore actual places and give gifts without moving the character', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByLabel('名字', { exact: true }).fill('小满和一个很长的名字');
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
  const original = await saved();
  await page.getByRole('button', { name: '看看屋里的东西' }).click();
  await page.getByRole('button', { name: '查看书架' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '小镇地图', exact: true }).click();
  const map = page.getByRole('dialog');
  await expect(map.locator('.map-place')).toHaveCount(14);
  const mapWidth = await map.locator('.town-map').boundingBox();
  expect(mapWidth!.width).toBeLessThan(page.viewportSize()!.width);
  await page.getByRole('button', { name: '看看芦苇河岸', exact: true }).click();
  await expect(page.locator('.stage-surface')).toHaveAttribute('data-scene', 'riverside');
  await expect(page.getByText('正在浏览 · TA 不在这里')).toBeVisible();
  expect((await saved()).activity).toEqual(original.activity);
  expect((await saved()).living.exploration.visits).toEqual(original.living.exploration.visits);
  await page.getByRole('button', { name: '建议有空去看看', exact: true }).click();
  await expect
    .poll(async () => (await saved()).living.exploration.suggestion?.scene)
    .toBe('riverside');
  await page.getByRole('button', { name: '跟随 TA', exact: true }).click();
  await expect(page.locator('.stage-surface')).toHaveAttribute(
    'data-scene',
    original.activity.scene,
  );
  await page.getByRole('button', { name: '送份礼物', exact: true }).click();
  await page.getByRole('button', { name: '选择礼物 便携画具', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '选择礼物 便携画具', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '送给 TA', exact: true }).click();
  await expect.poll(async () => (await saved()).living.gifts.length).toBe(1);
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: /^小镇来信/ }).click();
  await expect(page.getByRole('dialog')).toContainText(original.events[0].title);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.reload();
  expect((await saved()).living.gifts).toHaveLength(1);
  expect((await saved()).character.name).toBe(original.character.name);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
  if (test.info().project.name === 'desktop') {
    await page.setViewportSize({ width: 1280, height: 720 });
    const dock = await page.locator('.sidebar').boundingBox();
    const tools = await page.locator('.stage-tools').boundingBox();
    const context = await page.locator('.stage-context').boundingBox();
    expect(tools!.y + tools!.height).toBeLessThanOrEqual(dock!.y);
    expect(context!.y + context!.height).toBeLessThanOrEqual(dock!.y);
  } else {
    await page.setViewportSize({ width: 320, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
  }
  await page.screenshot({ path: test.info().outputPath('scene-game.png'), fullPage: true });
});

test('household controls persist members, commands and the selected resident', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '家庭与行动' }).click();
  const dialog = page.getByRole('dialog', { name: '我们的家' });
  await dialog.getByLabel('成员名字').fill('小禾');
  await dialog.getByLabel('成员年龄').fill('6');
  await dialog.getByLabel('与当前人物的关系').selectOption('亲子');
  await dialog.getByRole('button', { name: '加入这个家' }).click();
  await expect(dialog.getByRole('button', { name: '切换到小禾' })).toBeVisible();
  await dialog.getByRole('button', { name: '一起吃饭', exact: true }).click();
  await dialog.getByRole('button', { name: '切换到小禾' }).click();
  await expect(dialog.getByRole('heading', { name: '小禾的安排' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '去工作', exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('行动队列')).toContainText('做饭与吃饭');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('button', { name: '和小禾聊聊天' })).toBeVisible();
  await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '快进 6 小时' }).click();
  await page.reload();
  await page.getByRole('button', { name: '家庭与行动' }).click();
  await expect(dialog.getByRole('button', { name: '切换到小禾' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
  expect(saved.household.members.length).toBe(2);
  expect(saved.household.bonds[0].warmth).toBeGreaterThan(55);
  expect(saved.memories.some((m: { content: string }) => m.content.includes('小满和小禾'))).toBe(
    true,
  );
  await dialog.getByRole('button', { name: '切换到小满' }).click();
  await expect(dialog.getByRole('heading', { name: '小满的安排' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await page.screenshot({ path: test.info().outputPath('household.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('large family saves migrate atomically to IndexedDB and recover their backup', async ({
  page,
}) => {
  const { createWorld } = await import('../src/content/people');
  const { addResident } = await import('../src/engine/HouseholdEngine');
  const { advance } = await import('../src/engine/SimulationEngine');
  const { DAY } = await import('../src/engine/model');
  const w = createWorld();
  for (const age of [8, 16, 35, 67, 80]) addResident(w, `成员${age}`, age, '室友');
  advance(w, 30 * DAY);
  w.settings.speed = 0;
  expect(JSON.stringify(w).length).toBeGreaterThan(1_000_000);
  await page.goto('./');
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByLabel('导入浏览器 JSON 存档').setInputFiles({
    name: 'family.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(w)),
  });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('another-today-storage')))
    .toBe('indexeddb');
  await page.reload();
  await page.getByRole('button', { name: '家庭与行动' }).click();
  await expect(page.getByRole('button', { name: '切换到成员80' })).toBeVisible();
  await page.getByRole('button', { name: '切换到成员16' }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出存档', exact: true }).click();
  const file = await download;
  const exported = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(exported.character.name).toBe('成员16');
  expect(exported.household.members.length).toBe(6);
  // Leave first so beforeunload cannot repair the deliberately corrupted fixture.
  await page.goto('about:blank');
  await page.addInitScript(() => {
    if (!location.protocol.startsWith('http') || sessionStorage.getItem('corrupt-once')) return;
    sessionStorage.setItem('corrupt-once', 'yes');
    const r = indexedDB.open('another-today-worlds', 1);
    r.onsuccess = () => {
      const tx = r.result.transaction('saves', 'readwrite');
      tx.objectStore('saves').put('{broken', 'world');
      tx.oncomplete = () => r.result.close();
    };
  });
  await page.goto('./');
  await expect(page.getByText('已从备份恢复游戏。最近一次保存之后的进度可能丢失。')).toBeVisible();
  await page.getByRole('button', { name: '家庭与行动' }).click();
  await expect(page.getByRole('button', { name: '切换到成员80' })).toBeVisible();
});

test('roommate wallets, marriage and edited personality persist', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '家庭与行动' }).click();
  const dialog = page.getByRole('dialog', { name: '我们的家' });
  await dialog.getByLabel('成员名字').fill('青禾');
  await dialog.getByLabel('成员年龄').fill('26');
  await dialog.getByLabel('成员初始存款').fill('500');
  await dialog.getByRole('button', { name: '加入这个家' }).click();
  await dialog.getByRole('button', { name: '切换到青禾' }).click();
  await expect(dialog.locator('.household-current').getByText(/个人存款 ¥500.00/)).toBeVisible();
  await dialog.getByText('调整青禾的性格', { exact: true }).click();
  await dialog.getByRole('slider', { name: '外向程度' }).press('End');
  await expect(dialog.getByRole('slider', { name: '外向程度' })).toHaveValue('100');
  await dialog.getByRole('button', { name: '保存性格' }).click();
  await dialog.getByLabel('与小满的关系').selectOption('夫妻');
  await expect(
    dialog.locator('.household-current').getByText(/核心家庭存款 ¥3500.00/),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '家庭与行动' }).click();
  await expect(
    dialog.locator('.household-current').getByText(/核心家庭存款 ¥3500.00/),
  ).toBeVisible();
  await dialog.getByText('调整青禾的性格', { exact: true }).click();
  await expect(dialog.getByRole('slider', { name: '外向程度' })).toHaveValue('100');
  await dialog.getByLabel('与小满的关系').selectOption('室友');
  await expect(dialog.locator('.household-current').getByText(/个人存款 ¥1750.00/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

test('real-time pomodoro earns wearable clothes and visible furniture only after confirmation', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
  await page.goto('./');
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
  const initialGameTime = (await saved()).time;
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '任务与计划', exact: true }).click();
    await page.getByRole('button', { name: '番茄钟（可选）', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '一起专注，各自生活' });
    await modal.getByLabel('准备做什么').selectOption(i === 0 ? '收拾房间' : '自定义事项');
    if (i === 1) await modal.getByLabel('事项名称').fill('练习手写字');
    await modal.getByRole('button', { name: '开始一起专注' }).click();
    await expect(modal.locator('.focus-clock')).toContainText('25:00');
    await page.clock.fastForward(61_000);
    await expect(modal.locator('.focus-clock')).toContainText('23:59');
    expect((await saved()).time).toBe(initialGameTime);
    await modal.getByRole('button', { name: '我回来了', exact: true }).click();
    await modal.getByLabel('实际活动分钟').fill('1');
    await modal.getByRole('checkbox', { name: '我确认完成了这次现实任务' }).check();
    await modal.getByRole('button', { name: '确认保存', exact: true }).click();
  }
  await page.getByRole('button', { name: '我的奖励', exact: true }).click();
  await page.getByRole('button', { name: '使用鼠尾草绿衬衫', exact: true }).click();
  await page.getByRole('button', { name: '使用向日葵地毯', exact: true }).click();
  await expect(page.getByRole('button', { name: '已使用向日葵地毯', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.reload();
  await expect(page.locator('.game-calendar').getByLabel('现实时间')).toBeVisible();
  const w = await saved();
  expect(w.focusRewards).toEqual({ completed: 2, placed: ['sunny-rug'] });
  expect(w.character.outfit).toBe('#7f9d85');
  expect(w.playerActivities.map((a: { label: string }) => a.label)).toEqual([
    '收拾房间',
    '练习手写字',
  ]);
  await page.screenshot({
    path: test.info().outputPath('focus-rewards-scene.png'),
    fullPage: true,
  });
});

test('untimed plans persist and award only once through a separate rewards entrance', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '任务与计划', exact: true }).click();
  await page.getByLabel('我的计划', { exact: true }).fill('周末整理衣柜');
  await page.getByRole('button', { name: '添加计划' }).click();
  await page.reload();
  await page.getByRole('button', { name: '任务与计划', exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('task-plan.png'), fullPage: true });
  await page.getByRole('button', { name: '完成：周末整理衣柜', exact: true }).click();
  await page.getByRole('button', { name: '还没完成', exact: true }).click();
  let w = await page.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
  expect(w.focusRewards).toBeUndefined();
  await page.getByRole('button', { name: '完成：周末整理衣柜', exact: true }).click();
  await page.getByRole('button', { name: '确认完成并领奖', exact: true }).click();
  await expect(page.getByRole('button', { name: '完成：周末整理衣柜', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: '打开我的奖励', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '我的奖励', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '礼物与道具' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '我的奖励', exact: true }).click();
  w = await page.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
  expect(w.tasks[0].reward).toBeTruthy();
  expect(w.focusRewards.completed).toBe(1);
  expect(w.playerActivities).toHaveLength(0);
  expect(
    w.taskRewards.owned.length +
      w.taskRewards.bag.reduce((n: number, r: { count: number }) => n + r.count, 0),
  ).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await page.screenshot({ path: test.info().outputPath('task-rewards.png'), fullPage: true });
});

test('new roommate has direct personal panels, private memories and visibly separate savings', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '家庭与行动' }).click();
  await page.getByLabel('成员名字').fill('青禾');
  await page.getByLabel('成员年龄').fill('25');
  await page.getByLabel('成员初始存款').fill('500');
  await page.getByRole('button', { name: '加入这个家' }).click();
  await expect(page.getByRole('button', { name: '切换到小满', exact: true })).toContainText(
    '个人存款 ¥3000.00',
  );
  await expect(page.getByRole('button', { name: '切换到青禾', exact: true })).toContainText(
    '个人存款 ¥500.00',
  );
  await page.getByRole('button', { name: '切换到青禾', exact: true }).click();
  await page.getByRole('button', { name: '查看青禾的个人面板', exact: true }).click();
  await expect(page.getByRole('heading', { name: '青禾的人物小笺' })).toBeVisible();
  await expect(page.getByRole('region', { name: '当前人物与账户' })).toContainText(
    '青禾的个人存款 · ¥500.00',
  );
  await page.getByRole('button', { name: '记忆', exact: true }).click();
  await expect(page.getByRole('heading', { name: '青禾的记忆小抽屉' })).toBeVisible();
  await expect(page.getByText(/青禾搬进.*开始和小满一起生活/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('roommate-memory.png'), fullPage: true });
  await page.getByLabel('主控人物', { exact: true }).selectOption({ label: '小满' });
  await expect(page.getByRole('region', { name: '当前人物与账户' })).toContainText(
    '小满的个人存款 · ¥3000.00',
  );
  await expect(page.getByText(/青禾搬进.*开始和小满一起生活/)).toHaveCount(0);
  await page.getByLabel('主控人物', { exact: true }).selectOption({ label: '青禾' });
  await page.reload();
  await page.getByRole('button', { name: '记忆', exact: true }).click();
  await expect(page.getByRole('heading', { name: '青禾的记忆小抽屉' })).toBeVisible();
  await expect(page.getByRole('region', { name: '当前人物与账户' })).toContainText(
    '青禾的个人存款 · ¥500.00',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

test('global control switches across pages and dialogs; task points redeem real rewards', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '家庭与行动' }).click();
  await page.getByLabel('成员名字').fill('青禾');
  await page.getByLabel('成员年龄').fill('25');
  await page.getByRole('button', { name: '加入这个家' }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  for (const name of ['今天', '人物', '关系', '双人日记', '记忆', '人生档案', '世界', '设置']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByLabel('主控人物', { exact: true }).selectOption({ label: '青禾' });
    await expect(page.getByLabel('主控人物', { exact: true }).locator('option:checked')).toHaveText(
      '青禾',
    );
    await page.getByLabel('主控人物', { exact: true }).selectOption({ label: '小满' });
  }
  await page.getByRole('button', { name: '今天', exact: true }).click();
  await page.getByRole('button', { name: '任务与计划', exact: true }).click();
  await page.getByLabel('切换主控人物', { exact: true }).selectOption({ label: '青禾' });
  await page.getByLabel('我的计划', { exact: true }).fill('读一页书');
  await page.getByRole('button', { name: '添加计划' }).click();
  await page.getByRole('button', { name: '完成：读一页书', exact: true }).click();
  await page.getByRole('button', { name: '确认完成并领奖' }).click();
  await page.getByRole('button', { name: '打开我的奖励' }).click();
  await expect(page.getByRole('heading', { name: '积分兑换 · 10 分' })).toBeVisible();
  await page.getByRole('button', { name: '兑换野餐点心', exact: true }).click();
  await expect(page.getByRole('heading', { name: '积分兑换 · 0 分' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('主控人物').locator('option:checked')).toHaveText('青禾');
  const w = await page.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
  expect(w.exchange.balance).toBe(0);
  expect(
    w.taskRewards.bag.find((i: { id: string }) => i.id === 'picnic-snack').count,
  ).toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: /^小纸条/ }).click();
  await expect(page.getByRole('dialog', { name: '小纸条' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await page.screenshot({
    path: test.info().outputPath('global-control-notes.png'),
    fullPage: true,
  });
});
