import { beforeAll, beforeEach, afterAll, describe, expect, test } from 'vitest';
import { cloudDatabase, USER_A, USER_B, DEVICE_A, DEVICE_B } from './helpers/cloud-db';
import { createWorld, defaultCharacter } from '../src/content/people';
const world = () => createWorld(structuredClone(defaultCharacter), Date.now(), 123);
let db: Awaited<ReturnType<typeof cloudDatabase>>;
beforeAll(async () => {
  db = await cloudDatabase();
}, 30_000);
beforeEach(async () => {
  await db.db.exec('truncate public.at_worlds, public.at_versions, public.at_leases');
});
afterAll(async () => {
  await db.db.close();
});
describe('real PostgreSQL cloud permissions and transactions', () => {
  test('anonymous callers cannot read or mutate saves', async () => {
    await expect(db.query(null, 'select * from public.at_worlds')).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.rpc(null, 'at_claim', { p_account: USER_A, p_device: DEVICE_A, p_label: 'phone' }),
    ).rejects.toThrow(/permission denied/);
  });
  test('owners read their own world; another account sees nothing and cannot impersonate them', async () => {
    const a = db.port(USER_A, DEVICE_A),
      b = db.port(USER_B, DEVICE_B);
    await a.claim(false);
    await a.push(0, crypto.randomUUID(), world());
    expect((await a.read())?.revision).toBe(1);
    expect(await b.read()).toBeNull();
    await expect(
      db.rpc(USER_B, 'at_claim', { p_account: USER_A, p_device: DEVICE_B, p_label: 'other' }),
    ).rejects.toThrow(/authentication_required/);
    expect(await db.query(USER_B, 'select * from public.at_versions')).toEqual([]);
    expect(await db.query(USER_B, 'select * from public.at_leases')).toEqual([]);
  });
  test('direct writes cannot bypass optimistic concurrency or create foreign saves', async () => {
    await expect(db.query(USER_A, 'delete from public.at_worlds')).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query(USER_A, 'update public.at_leases set expires_at = now()'),
    ).rejects.toThrow(/permission denied/);
    await expect(db.query(USER_A, 'delete from public.at_versions')).rejects.toThrow(
      /permission denied/,
    );
  });
  test('only one of two writes to the same revision wins; retries are idempotent', async () => {
    const a = db.port(USER_A, DEVICE_A);
    await a.claim(false);
    const id = crypto.randomUUID(),
      w = world();
    expect(await a.push(0, id, w)).toEqual({ ok: true, revision: 1 });
    expect(await a.push(0, id, w)).toEqual({ ok: true, revision: 1 });
    const results = await Promise.all([
      a.push(1, crypto.randomUUID(), w),
      a.push(1, crypto.randomUUID(), w),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => r.reason === 'conflict')).toHaveLength(1);
    expect((await a.read())?.revision).toBe(2);
  });
  test('takeover blocks the former device, including stale release and delete attempts', async () => {
    const a = db.port(USER_A, DEVICE_A),
      b = db.port(USER_A, DEVICE_B);
    await a.claim(false);
    await a.push(0, crypto.randomUUID(), world());
    expect((await b.claim(false)).ok).toBe(false);
    expect((await b.claim(true)).ok).toBe(true);
    expect(await a.push(1, crypto.randomUUID(), world())).toEqual({ ok: false, reason: 'lease' });
    await a.release();
    expect(await a.remove(1)).toBe(false);
    expect(
      await db.rpc(USER_A, 'at_delete', { p_account: USER_A, p_device: null, p_expected: 1 }),
    ).toBe(false);
    expect((await b.push(1, crypto.randomUUID(), world())).ok).toBe(true);
  });
  test('expired leases cannot upload and can be acquired by a different device', async () => {
    const a = db.port(USER_A, DEVICE_A),
      b = db.port(USER_A, DEVICE_B);
    await a.claim(false);
    await db.db.exec("update public.at_leases set expires_at = now() - interval '1 second'");
    expect((await a.push(0, crypto.randomUUID(), world())).reason).toBe('lease');
    expect((await b.claim(false)).ok).toBe(true);
  });
  test('keeps exactly five real snapshots and deletion checks the revision', async () => {
    const a = db.port(USER_A, DEVICE_A);
    await a.claim(false);
    for (let i = 0; i < 7; i++) {
      const w = world();
      w.money = i;
      await a.push(i, crypto.randomUUID(), w);
    }
    const versions = await db.query<{ revision: number }>(
      USER_A,
      'select revision::int from public.at_versions order by revision',
    );
    expect(versions.map((v) => v.revision)).toEqual([3, 4, 5, 6, 7]);
    expect(await a.remove(6)).toBe(false);
    expect((await a.read())?.payload.money).toBe(6);
    expect(await a.remove(7)).toBe(true);
    expect(await a.read()).toBeNull();
    expect(await db.query(USER_A, 'select * from public.at_versions')).toEqual([]);
  });
  test('malformed and unsupported payloads are rejected without changing a world', async () => {
    const a = db.port(USER_A, DEVICE_A);
    await a.claim(false);
    await expect(
      db.rpc(USER_A, 'at_push', {
        p_account: USER_A,
        p_device: DEVICE_A,
        p_expected: 0,
        p_request: crypto.randomUUID(),
        p_payload: { version: 2 },
      }),
    ).rejects.toThrow(/invalid_save/);
    await expect(
      db.rpc(USER_B, 'at_push', {
        p_account: USER_A,
        p_device: DEVICE_A,
        p_expected: 0,
        p_request: crypto.randomUUID(),
        p_payload: world(),
      }),
    ).rejects.toThrow(/authentication_required/);
    expect(await a.read()).toBeNull();
  });
});
