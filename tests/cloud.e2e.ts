import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { cloudDatabase, USER_A, USER_B } from './helpers/cloud-db';
let database: Awaited<ReturnType<typeof cloudDatabase>>;
test.beforeAll(async () => {
  database = await cloudDatabase();
});
test.beforeEach(async () => {
  await database.db.exec('truncate public.at_worlds, public.at_versions, public.at_leases');
});
test.afterAll(async () => {
  await database.db.close();
});
// Auth is a local test double. Every save/permission/lease operation runs the production SQL in PostgreSQL.
async function backend(context: BrowserContext) {
  let online = true;
  await context.route('https://sync-test.supabase.co/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (!online) {
      await route.abort('internetdisconnected');
      return;
    }
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    try {
      let body: unknown = null;
      if (url.pathname === '/auth/v1/token') {
        const { email, password } = request.postDataJSON();
        if (password !== 'correct-password') {
          await route.fulfill({
            status: 400,
            json: { error: 'invalid_grant', error_description: 'Invalid login credentials' },
            headers: cors,
          });
          return;
        }
        const id = email === 'other@example.test' ? USER_B : USER_A;
        const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
        const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.testsignature`;
        body = {
          access_token,
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'test-refresh',
          user: {
            id,
            email,
            aud: 'authenticated',
            role: 'authenticated',
            created_at: new Date().toISOString(),
            app_metadata: { provider: 'email' },
            user_metadata: {},
          },
        };
      } else if (url.pathname === '/auth/v1/logout') {
        await route.fulfill({ status: 204, headers: cors });
        return;
      } else {
        const token = request.headers().authorization?.replace('Bearer ', '') ?? '';
        let user: string;
        try {
          user = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
        } catch {
          await route.fulfill({ status: 401, json: { message: 'Unauthorized' }, headers: cors });
          return;
        }
        if (![USER_A, USER_B].includes(user)) {
          await route.fulfill({ status: 401, json: { message: 'Unauthorized' }, headers: cors });
          return;
        }
        if (url.pathname.startsWith('/rest/v1/rpc/'))
          body = await database.rpc(user, url.pathname.split('/').at(-1)!, request.postDataJSON());
        else if (url.pathname === '/rest/v1/at_worlds')
          body =
            (
              await database.query(
                user,
                'select revision::int,payload,request_id::text,updated_at::text from public.at_worlds',
              )
            )[0] ?? null;
        else if (url.pathname === '/rest/v1/at_versions')
          body = await database.query(
            user,
            'select revision::int,payload,updated_at::text from public.at_versions order by revision desc limit 5',
          );
        else {
          await route.fulfill({ status: 404, json: { message: 'Unknown route' }, headers: cors });
          return;
        }
      }
      await route.fulfill({ status: 200, json: body, headers: cors });
    } catch {
      await route.fulfill({
        status: 400,
        json: { message: 'Database rejected request' },
        headers: cors,
      });
    }
  });
  return {
    offline: () => {
      online = false;
    },
    online: () => {
      online = true;
    },
  };
}
async function login(page: Page, email = 'player@example.test') {
  await page.getByLabel('同步账号邮箱').fill(email);
  await page.getByLabel('账号密码', { exact: true }).fill('correct-password');
  await page.getByRole('button', { name: '登录云存档账号', exact: true }).click();
  await expect(page.getByText(`已登录：${email}`, { exact: true })).toBeVisible();
}
async function consent(page: Page) {
  await page.getByLabel('我同意上传完整游戏存档', { exact: false }).check();
  await page.getByRole('button', { name: '连接 / 重试同步', exact: true }).click();
}
async function create(page: Page) {
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
  await page.getByLabel('免打扰模式').check();
}
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
test('two devices log in, explicitly authorize upload, hand off and resume one real world', async ({
  browser,
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await backend(context);
  await page.goto('/');
  await create(page);
  await login(page);
  expect(await database.query(USER_A, 'select * from public.at_worlds')).toHaveLength(0);
  await consent(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '以本机进度继续', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存并交接', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '快进 6 小时' }).click();
  const original = await saved(page);
  await page.getByRole('button', { name: '保存并交接', exact: true }).click();
  await expect(
    page.getByText('已保存并交接，本机生活暂时停在这里。现在可以在另一台设备接续。', {
      exact: true,
    }),
  ).toBeVisible();
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    await backend(phoneContext);
    const phone = await phoneContext.newPage();
    phone.on('pageerror', (error) => errors.push(error.message));
    phone.on('dialog', (dialog) => dialog.accept());
    await phone.goto('http://127.0.0.1:4175/');
    await phone.getByRole('button', { name: '跨设备存档 / 登录', exact: true }).click();
    await login(phone);
    await consent(phone);
    await phone.getByRole('button', { name: '接续云端进度', exact: true }).click();
    await expect(phone.getByRole('button', { name: '保存并交接', exact: true })).toBeVisible();
    expect((await saved(phone)).character).toEqual(original.character);
    expect((await saved(phone)).time).toBe(original.time);
    expect((await saved(phone)).living.gifts).toEqual(original.living.gifts);
    await phone.getByRole('button', { name: '关闭', exact: true }).click();
    await phone.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
    await phone.getByRole('button', { name: '快进 6 小时' }).click();
    await phone.getByRole('button', { name: '保存并交接', exact: true }).click();
    await expect(
      phone.getByText('已保存并交接，本机生活暂时停在这里。现在可以在另一台设备接续。', {
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
    await expect(page.getByRole('button', { name: '保存并交接', exact: true })).toBeVisible();
    expect((await saved(page)).time).toBe(original.time + 6 * 60 * 60 * 1000);
    await page.getByRole('button', { name: '查看交接前的本机备份', exact: true }).click();
    await expect(page.getByRole('button', { name: /导出 本机备份/ })).toHaveCount(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: test.info().outputPath('cloud-settings.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    expect(errors).toEqual([]);
  } finally {
    await phoneContext.close();
  }
});
test('network loss, conflicting local changes and a different account never silently overwrite progress', async ({
  page,
  context,
}) => {
  const network = await backend(context);
  await page.goto('/');
  await create(page);
  await login(page);
  await consent(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '以本机进度继续', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存并交接', exact: true })).toBeVisible();
  network.offline();
  await page.getByRole('button', { name: '现在同步', exact: true }).click();
  await expect(page.getByText(/同步暂未完成，本机进度仍会保存/)).toBeVisible();
  await page.getByRole('button', { name: '快进 6 小时' }).click();
  const local = await saved(page);
  const port = database.port(USER_A, '20000000-0000-4000-8000-000000000003');
  await port.claim(true);
  const remote = await port.read();
  remote!.payload.money = 765;
  await port.push(remote!.revision, crypto.randomUUID(), remote!.payload);
  await port.release();
  network.online();
  await page.getByRole('button', { name: '连接 / 重试同步', exact: true }).click();
  await expect(page.getByRole('button', { name: '接续云端进度', exact: true })).toBeVisible();
  expect((await saved(page)).time).toBe(local.time);
  await page.getByRole('button', { name: '接续云端进度', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存并交接', exact: true })).toBeVisible();
  expect((await saved(page)).money).toBe(765);
  await page.getByRole('button', { name: '查看交接前的本机备份', exact: true }).click();
  await expect(page.getByRole('button', { name: /导出 本机备份/ })).toHaveCount(1);
  await page.getByRole('button', { name: '退出账号', exact: true }).click();
  await expect(page.getByRole('button', { name: '登录云存档账号', exact: true })).toBeVisible();
  await login(page, 'other@example.test');
  await expect(page.getByLabel('我同意上传完整游戏存档', { exact: false })).not.toBeChecked();
  expect(await database.query(USER_B, 'select * from public.at_worlds')).toHaveLength(0);
});
