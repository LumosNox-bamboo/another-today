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
