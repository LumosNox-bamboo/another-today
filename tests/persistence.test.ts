import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SaveRepository, encode, decode } from '../electron/persistence';
import { createWorld } from '../src/content/people';
describe('atomic local persistence', () => {
  it('round-trips and rejects tampering', () => {
    const w = createWorld();
    const raw = encode(w);
    expect(decode(raw)).toEqual(w);
    expect(() => decode(raw.replace('小满', '陌生人'))).toThrow();
  });
  it('serializes concurrent writes and recovers a corrupted primary from valid backup', async () => {
    const path = await mkdtemp(join(tmpdir(), 'another-today-save-'));
    try {
      const repo = new SaveRepository(path),
        w = createWorld();
      await Promise.all([
        repo.save(w),
        repo.save({ ...w, money: 4000 }),
        repo.save({ ...w, money: 5000 }),
      ]);
      expect((await repo.load()).world?.money).toBe(5000);
      await writeFile(join(path, 'world.json'), '{interrupted');
      const result = await repo.load();
      expect(result.recovered).toBe(true);
      expect(result.world?.money).toBe(4000);
      await repo.save(result.world!);
      expect((await repo.load()).world?.money).toBe(4000);
      expect(decode(await readFile(join(path, 'world.backup.json'), 'utf8')).money).toBe(4000);
    } finally {
      await rm(path, { recursive: true, force: true });
    }
  });
  it('reports both damaged files without silently overwriting them', async () => {
    const path = await mkdtemp(join(tmpdir(), 'another-today-bad-'));
    try {
      await writeFile(join(path, 'world.json'), 'invalid');
      const result = await new SaveRepository(path).load();
      expect(result.world).toBeNull();
      expect(result.error).toBeTruthy();
      expect(await readFile(join(path, 'world.json'), 'utf8')).toBe('invalid');
    } finally {
      await rm(path, { recursive: true, force: true });
    }
  });
});
