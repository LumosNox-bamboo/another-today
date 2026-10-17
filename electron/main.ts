import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { SaveRepository, encode, decode } from './persistence';
import { validateWorld } from '../src/engine/validation';
if (process.env.ANOTHER_TODAY_TEST_DATA)
  app.setPath('userData', process.env.ANOTHER_TODAY_TEST_DATA);
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
let win: BrowserWindow | null = null,
  compact = false,
  normalBounds = { width: 1280, height: 840 };
let closing = false,
  quitting = false;
app.on('before-quit', () => {
  quitting = true;
});
const page = pathToFileURL(join(__dirname, '../dist/index.html')).href;
const repo = new SaveRepository(join(app.getPath('userData'), 'saves'));
app.on('second-instance', () => {
  win?.show();
  win?.focus();
});
app.whenReady().then(() => {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Another Today',
        submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
      },
      {
        label: '编辑',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] },
    ]),
  );
  function openWindow() {
    win = new BrowserWindow({
      ...normalBounds,
      minWidth: 900,
      minHeight: 650,
      title: '另一个今天 · Another Today',
      backgroundColor: '#f7f5ee',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e, url) => {
      if (url !== page) e.preventDefault();
    });
    win.loadFile(join(__dirname, '../dist/index.html'));
    win.on('close', (e) => {
      if (closing) return;
      e.preventDefault();
      win?.webContents.send('prepare-close');
      setTimeout(async () => {
        await repo.drain().catch(() => {});
        closing = true;
        if (quitting) app.quit();
        else win?.close();
      }, 1500);
    });
    win.on('closed', () => {
      win = null;
      compact = false;
      closing = false;
    });
  }
  openWindow();
  const handle = (channel: string, fn: (...args: any[]) => unknown) =>
    ipcMain.handle(channel, (e, ...args) => {
      if (!win || e.sender !== win.webContents || e.senderFrame !== win.webContents.mainFrame)
        throw new Error('Untrusted sender');
      return fn(...args);
    });
  handle('save:load', () => repo.load());
  handle('save:write', async (input: unknown) => {
    try {
      await repo.save(validateWorld(input));
      return { ok: true };
    } catch {
      return { ok: false, error: '保存失败，请检查磁盘空间或导出备份。' };
    }
  });
  handle('save:export', async (input: unknown) => {
    const world = validateWorld(input);
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: 'Another-Today-save.json',
      filters: [{ name: '游戏存档', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, encode(world), { mode: 0o600 });
    return true;
  });
  handle('save:import', async () => {
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [{ name: '游戏存档', extensions: ['json'] }],
    });
    if (result.canceled) return null;
    try {
      return { world: decode(await readFile(result.filePaths[0], 'utf8')) };
    } catch {
      return { error: '导入失败：文件不是有效存档或完整性检查未通过。' };
    }
  });
  handle('window:compact', (value: unknown) => {
    if (typeof value !== 'boolean') return compact;
    if (value === compact) return compact;
    compact = value;
    if (value) {
      const b = win!.getBounds();
      normalBounds = { width: b.width, height: b.height };
      win!.setMinimumSize(360, 420);
      win!.setSize(420, 570);
      win!.setAlwaysOnTop(true);
    } else {
      win!.setAlwaysOnTop(false);
      win!.setMinimumSize(900, 650);
      win!.setSize(normalBounds.width, normalBounds.height);
    }
    return compact;
  });
  handle('app:paths', () => ({
    data: repo.directory,
    version: app.getVersion(),
    platform: process.platform,
  }));
  app.on('activate', () => {
    if (!win) openWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
