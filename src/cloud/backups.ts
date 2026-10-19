import { type World } from '../engine/model';
import { validateWorld } from '../engine/validation';
export type CloudBackup = { id: number; createdAt: number; world: World };
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('another-today-cloud-backups', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
export async function saveCloudBackup(world: World) {
  const validated = validateWorld(world);
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('backups', 'readwrite'),
        store = tx.objectStore('backups');
      store.add({ createdAt: Date.now(), world: validated });
      const keys = store.getAllKeys();
      keys.onsuccess = () => keys.result.slice(0, -3).forEach((key) => store.delete(key));
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function cloudBackups(): Promise<CloudBackup[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('backups').objectStore('backups').getAll();
      request.onsuccess = () => resolve(request.result.reverse());
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function clearCloudBackups() {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('backups', 'readwrite');
      tx.objectStore('backups').clear();
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
