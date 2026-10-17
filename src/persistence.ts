import { type World } from './engine/model';
import { validateWorld } from './engine/validation';
declare global {
  interface Window {
    desktop?: {
      load: () => Promise<{ world: World | null; recovered: boolean; error: string | null }>;
      save: (state: World) => Promise<{ ok: boolean; error?: string }>;
      exportSave: (state: World) => Promise<boolean>;
      importSave: () => Promise<{ world?: World; error?: string } | null>;
      compact: (v: boolean) => Promise<boolean>;
      paths: () => Promise<{ data: string; version: string; platform: string }>;
      onClose: (callback: () => void) => () => void;
    };
  }
}
export async function load() {
  if (window.desktop) return window.desktop.load();
  let found = false;
  for (const key of ['another-today', 'another-today-backup']) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        found = true;
        return {
          world: validateWorld(JSON.parse(raw)),
          recovered: key.endsWith('backup'),
          error: null,
        };
      }
    } catch {
      found = true;
    }
  }
  return {
    world: null,
    recovered: false,
    error: found ? '浏览器存档无法读取，请导入备份。' : null,
  };
}
export async function save(w: World) {
  if (window.desktop) return window.desktop.save(w);
  try {
    validateWorld(w);
    const raw = localStorage.getItem('another-today');
    if (raw) {
      try {
        validateWorld(JSON.parse(raw));
        localStorage.setItem('another-today-backup', raw);
      } catch {}
    }
    localStorage.setItem('another-today', JSON.stringify(w));
    return { ok: true };
  } catch {
    return { ok: false, error: '保存失败，可能没有足够的浏览器存储空间。请导出备份。' };
  }
}
export async function exportSave(w: World) {
  if (window.desktop) return window.desktop.exportSave(w);
  const blob = new Blob([JSON.stringify(w, null, 2)], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = 'Another-Today-browser-save.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
