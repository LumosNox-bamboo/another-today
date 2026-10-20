import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { decode, encode } from '../electron/persistence';
import { MINUTE } from '../src/engine/model';
let app: ElectronApplication, page: Page, data: string;
const errors: string[] = [];
async function launch() {
  app = await electron.launch({
    args: [resolve('dist-electron/main.cjs')],
    env: { ...process.env, ANOTHER_TODAY_TEST_DATA: data },
  });
  page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForLoadState('domcontentloaded');
}
async function state() {
  return (await page.evaluate(() => window.desktop!.load())).world!;
}
test.describe.serial('real Electron desktop', () => {
  test.beforeAll(async () => {
    data = await mkdtemp(join(tmpdir(), 'another-today-e2e-'));
    await mkdir('docs/screenshots/career-paths-v12', { recursive: true });
    await launch();
  });
  test.afterAll(async () => {
    await app?.close();
    await rm(data, { recursive: true, force: true });
  });
  test('creates a character and displays the live world with sandboxed renderer', async () => {
    await expect(page.getByText('TA 是什么样的人？')).toBeVisible();
    await page.getByLabel('名字', { exact: true }).fill('小满');
    await expect(page.getByLabel('名字', { exact: true })).toHaveValue('小满');
    await page.screenshot({
      path: 'docs/screenshots/career-paths-v12/01-create.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: '继续认识 TA' }).click();
    await page.getByRole('button', { name: '继续认识 TA' }).click();
    await page.getByRole('button', { name: '开始另一个今天' }).click();
    await expect(page.getByText('又是一个小小的今天')).toBeVisible();
    expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined');
    const prefs = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      return (w.webContents as any).getLastWebPreferences();
    });
    expect(prefs.contextIsolation).toBe(true);
    expect(prefs.nodeIntegration).toBe(false);
    expect(prefs.sandbox).toBe(true);
    expect(await app.evaluate(() => process.versions.electron)).toBe('44.9.0');
    await expect.poll(async () => (await state())?.character.name).toBe('小满');
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: 'docs/screenshots/career-paths-v12/02-life.png',
      fullPage: true,
    });
    for (const name of [
      '芦苇河岸',
      '玻璃温室',
      '旧物工坊',
      '周末集市',
      '纸灯小剧场',
      '山坡观测站',
    ]) {
      await page.getByRole('button', { name: '小镇地图', exact: true }).click();
      await page.getByRole('button', { name: `看看${name}`, exact: true }).click();
      await expect(page.locator('.stage-location')).toContainText(name);
      await page
        .locator('.scene-view')
        .screenshot({ path: `docs/screenshots/career-paths-v12/scene-${name}.png` });
    }
    await page.getByRole('button', { name: '跟随 TA', exact: true }).click();
  });
  test('all primary sections render, simulation runs and diary facts are generated', async () => {
    for (const name of ['人物', '关系', '记忆', '人生档案', '设置']) {
      await page.locator('nav').getByRole('button', { name, exact: true }).click();
      await expect(page.locator('main h1')).toBeVisible();
    }
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '快进 6 小时' }).click();
    await expect.poll(async () => (await state()).diaries.length).toBeGreaterThan(0);
    await page.locator('nav').getByRole('button', { name: '双人日记', exact: true }).click();
    await expect(page.getByText('只写下你真实提供的片刻。')).toBeVisible();
    await page.getByRole('button', { name: '整理已确认记录' }).click();
    await expect(
      page.getByText('这一天没有已授权的分享或活动记录，不会自动补写经历。'),
    ).toBeVisible();
    await page.getByRole('button', { name: '自己写几句' }).click();
    await page
      .getByRole('textbox', { name: '玩家日记正文' })
      .fill('今天读完了一篇文章。这是我亲自填写的记录。');
    await page.getByRole('button', { name: '保存这一页' }).click();
    await expect.poll(async () => (await state()).playerDiaries[0]?.text).toContain('亲自填写');
    await page.getByLabel('小人日记日期').selectOption({ index: 1 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: 'docs/screenshots/career-paths-v12/03-diary.png',
      fullPage: true,
    });
  });
  test('chat remembers only explicitly authorized facts, and forgotten facts stay gone', async () => {
    await page.locator('nav').getByRole('button', { name: '今天', exact: true }).click();
    await page.getByRole('button', { name: '和小满聊聊天' }).click();
    await page.getByRole('textbox', { name: '聊天内容' }).fill('秘密：今天买了一本德语书');
    await page.getByRole('button', { name: '发送', exact: true }).click();
    expect((await state()).memories.some((m) => m.content.includes('秘密'))).toBe(false);
    await page.getByRole('textbox', { name: '聊天内容' }).fill('我正在学习德语');
    await page.getByLabel('允许记住这条分享').check();
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await expect
      .poll(async () => (await state()).memories.some((m) => m.content === '我正在学习德语'))
      .toBe(true);
    await page.getByRole('button', { name: '你记得我什么？' }).click();
    await expect(page.locator('.message.character').last()).toContainText('我正在学习德语');
    await page.screenshot({
      path: 'docs/screenshots/career-paths-v12/04-chat.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('nav').getByRole('button', { name: '记忆', exact: true }).click();
    await page.getByRole('button', { name: '删除记忆 我正在学习德语' }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect
      .poll(async () => (await state()).memories.some((m) => m.content === '我正在学习德语'))
      .toBe(false);
  });
  test('focus return requires actual-duration confirmation and compact window resizes', async () => {
    await page.locator('nav').getByRole('button', { name: '今天', exact: true }).click();
    await page.getByRole('button', { name: '任务与计划', exact: true }).click();
    await page.getByRole('button', { name: '番茄钟（可选）', exact: true }).click();
    await page.getByRole('button', { name: '开始一起专注' }).click();
    await page.getByRole('button', { name: '我回来了', exact: true }).click();
    await expect(page.getByText('这不等于实际活动时长。')).toBeVisible();
    await page.getByRole('spinbutton', { name: '实际活动分钟' }).fill('20');
    await page.getByRole('button', { name: '确认保存', exact: true }).click();
    await expect.poll(async () => (await state()).playerActivities[0]?.confirmedMinutes).toBe(20);
    await page.getByRole('button', { name: '桌面小窗', exact: true }).click();
    await expect(page.locator('.app.compact')).toBeVisible();
    const size = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getSize(),
    );
    expect(size[0]).toBe(420);
    expect(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),
    ).toBe(true);
    const controls = await page.locator('.stage-tools').boundingBox();
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(controls!.y + controls!.height).toBeLessThanOrEqual(viewportHeight);
    await page.screenshot({ path: 'docs/screenshots/career-paths-v12/05-compact.png' });
    await page.getByRole('button', { name: '完整观察模式', exact: true }).click();
    await expect(page.locator('.app.compact')).toHaveCount(0);
  });
  test('reopening catches up exactly once and welcome shows real elapsed duration', async () => {
    await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
    await page.getByLabel('游戏时间倍率').selectOption('4');
    await app.close();
    const file = join(data, 'saves', 'world.json'),
      w = decode(await readFile(file, 'utf8'));
    w.lastReal = Date.now() - 30 * MINUTE;
    await writeFile(file, encode(w));
    await launch();
    await expect(page.getByRole('dialog', { name: '你不在的这段时间' })).toBeVisible();
    await expect(page.getByText(/现实经过 30 分钟/)).toBeVisible();
    await page.screenshot({
      path: 'docs/screenshots/career-paths-v12/06-return.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: '继续观察', exact: true }).click();
    const current = await state();
    expect(current.time - w.time).toBeGreaterThanOrEqual(120 * MINUTE);
    expect(current.time - w.time).toBeLessThan(121 * MINUTE);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await expect.poll(async () => (await state()).settings.speed).toBe(0);
    await app.close();
    const before = decode(await readFile(file, 'utf8'));
    await launch();
    await expect(page.getByText('又是一个小小的今天')).toBeVisible();
    const after = await state();
    expect(after.money).toBe(before.money);
    expect(after.events).toEqual(before.events);
    expect(after.diaries).toEqual(before.diaries);
    expect(after.playerDiaries[0].text).toContain('亲自填写');
    expect(after.memories.some((m) => m.content === '我正在学习德语')).toBe(false);
  });
  test('export and import validate files and do not accept bad data', async () => {
    const file = join(data, 'export.json');
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    }, file);
    await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '导出存档', exact: true }).click();
    await expect(page.getByText(/存档已导出/)).toBeVisible();
    expect(decode(await readFile(file, 'utf8')).character.name).toBe('小满');
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, file);
    await page.getByRole('button', { name: '导入存档', exact: true }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect(page.getByText(/存档已导入/)).toBeVisible();
    await writeFile(file, '{}');
    await page.getByRole('button', { name: '导入存档', exact: true }).click();
    await expect(page.getByText(/导入失败：文件不是有效存档/)).toBeVisible();
    expect((await state()).character.name).toBe('小满');
    expect(errors).toEqual([]);
  });
  test('desktop household members and selection survive a real application restart', async () => {
    await page.locator('nav').getByRole('button', { name: '今天', exact: true }).click();
    await page.getByRole('button', { name: '家庭与行动' }).click();
    await page.getByLabel('成员名字').fill('小禾');
    await page.getByLabel('成员年龄').fill('6');
    await page.getByLabel('与当前人物的关系').selectOption('亲子');
    await page.getByRole('button', { name: '加入这个家' }).click();
    await page.getByRole('button', { name: '一起吃饭', exact: true }).click();
    await page.getByRole('button', { name: '切换到小禾' }).click();
    await expect.poll(async () => (await state()).character.name).toBe('小禾');
    await app.close();
    await launch();
    await page.getByRole('button', { name: '家庭与行动' }).click();
    await expect(page.getByRole('button', { name: '切换到小禾' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect((await state()).household.members).toHaveLength(2);
    await page.screenshot({
      path: 'docs/screenshots/career-paths-v12/desktop-family.png',
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
