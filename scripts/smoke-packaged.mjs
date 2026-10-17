import { _electron as electron } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const directory = await mkdtemp(join(tmpdir(), 'another-today-packaged-'));
let app;
try {
  app = await electron.launch({
    executablePath: resolve('release/mac-arm64/Another Today.app/Contents/MacOS/Another Today'),
    args: [],
    env: { ...process.env, ANOTHER_TODAY_TEST_DATA: directory },
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.waitForFunction(async () => (await window.desktop.load()).world?.settings.speed === 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/screenshots/07-packaged.png', fullPage: true });
  const result = await app.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
    architecture: process.arch,
  }));
  if (!result.packaged || result.electron !== '44.9.0' || errors.length)
    throw new Error('Packaged validation failed');
  await app.close();
  app = undefined;
  await writeFile(
    'docs/PACKAGED_SMOKE.json',
    JSON.stringify({ ...result, errors, savedAndQuit: true, passed: true }, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  if (app) await app.close();
  await rm(directory, { recursive: true, force: true });
}
