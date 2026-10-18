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
