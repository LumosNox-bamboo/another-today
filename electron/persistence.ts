import { mkdir, readFile, writeFile, rename, open } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateWorld } from '../src/engine/validation';
import type { World } from '../src/engine/model';
export function encode(w: World) {
  const data = JSON.stringify(validateWorld(w));
  return JSON.stringify({
    format: 'another-today',
    version: 1,
    sha256: createHash('sha256').update(data).digest('hex'),
    data,
  });
}
export function decode(raw: string) {
  if (Buffer.byteLength(raw) > 16 * 1024 * 1024) throw new Error('存档超过大小上限');
  const e = JSON.parse(raw);
  if (e.format !== 'another-today' || e.version !== 1 || typeof e.data !== 'string')
    throw new Error('不是兼容的 Another Today 存档');
  if (createHash('sha256').update(e.data).digest('hex') !== e.sha256)
    throw new Error('存档完整性检查失败');
  return validateWorld(JSON.parse(e.data));
}
export class SaveRepository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}
  async load() {
    let missing = 0;
    for (const name of ['world.json', 'world.backup.json']) {
      try {
        const raw = await readFile(join(this.directory, name), 'utf8');
        return { world: decode(raw), recovered: name.includes('backup'), error: null };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') missing++;
      }
    }
    return {
      world: null,
      recovered: false,
      error:
        missing === 2
          ? null
          : '主存档与备份均无法读取。原文件已保留；请导入以前导出的存档，或明确选择重新开始。',
    };
  }
  save(world: World) {
    const encoded = encode(world);
    const job = this.queue
      .catch(() => {})
      .then(async () => {
        await mkdir(this.directory, { recursive: true });
        const path = join(this.directory, 'world.json');
        try {
          const prior = await readFile(path, 'utf8');
          decode(prior);
          await writeFile(join(this.directory, 'world.backup.tmp'), prior, { mode: 0o600 });
          await rename(
            join(this.directory, 'world.backup.tmp'),
            join(this.directory, 'world.backup.json'),
          );
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
            /* Never replace a good backup with an invalid primary. */
          }
        }
        const tmp = join(this.directory, 'world.tmp');
        const file = await open(tmp, 'w', 0o600);
        try {
          await file.writeFile(encoded);
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(tmp, path);
      });
    this.queue = job;
    return job;
  }
  async drain() {
    await this.queue;
  }
}
