import { validateWorld } from './engine/validation';
import type { World } from './engine/model';

// Large households exceed localStorage's quota, especially with a safety backup.
// Keep the same World JSON; IndexedDB commits the current save and backup atomically.
export const databaseMarker = 'another-today-storage';
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('another-today-worlds', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('本地存储升级被其他窗口阻止'));
  });
}
export async function readDatabase() {
  const db = await openDatabase();
  try {
    return await new Promise<{ world: World | null; recovered: boolean; error: string | null }>(
      (resolve, reject) => {
        const tx = db.transaction('saves', 'readonly'),
          store = tx.objectStore('saves');
        const primary = store.get('world'),
          backup = store.get('backup');
        tx.oncomplete = () => {
          for (const [raw, recovered] of [
            [primary.result, false],
            [backup.result, true],
          ] as const) {
            try {
              if (raw)
                return resolve({ world: validateWorld(JSON.parse(raw)), recovered, error: null });
            } catch {
              /* Try the backup without overwriting the damaged original. */
            }
          }
          resolve({ world: null, recovered: false, error: '本地家庭存档无法读取，请导入备份。' });
        };
        tx.onabort = () => reject(tx.error);
      },
    );
  } finally {
    db.close();
  }
}
export async function writeDatabase(w: World, previous: string | null) {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite'),
        store = tx.objectStore('saves');
      const current = store.get('world');
      current.onsuccess = () => {
        const old = previous ?? current.result;
        try {
          if (old) {
            validateWorld(JSON.parse(old));
            store.put(old, 'backup');
          }
        } catch {
          /* Preserve the last valid backup. */
        }
        store.put(JSON.stringify(w), 'world');
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
