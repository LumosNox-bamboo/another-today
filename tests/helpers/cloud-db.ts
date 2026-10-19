import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import type { CloudPort, RemoteSave } from '../../src/cloud/SyncController';
export const USER_A = '10000000-0000-4000-8000-000000000001';
export const USER_B = '10000000-0000-4000-8000-000000000002';
export const DEVICE_A = '20000000-0000-4000-8000-000000000001';
export const DEVICE_B = '20000000-0000-4000-8000-000000000002';
export async function cloudDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    insert into auth.users values ('${USER_A}'), ('${USER_B}');
  `);
  await db.exec(await readFile('supabase/migrations/202610190001_cloud_saves.sql', 'utf8'));
  async function query<T>(user: string | null, sql: string, args: unknown[] = []) {
    return db.transaction(async (tx) => {
      await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}`);
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
      return (await tx.query<T>(sql, args)).rows;
    });
  }
  async function rpc(user: string | null, name: string, args: Record<string, unknown>) {
    const allowed = ['at_claim', 'at_push', 'at_release', 'at_delete'];
    if (!allowed.includes(name)) throw new Error('invalid_rpc');
    const keys = Object.keys(args);
    if (keys.some((key) => !/^p_[a-z_]+$/.test(key))) throw new Error('invalid_argument');
    const result = await query<{ result: unknown }>(
      user,
      `select public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(',')}) as result`,
      Object.values(args),
    );
    return result[0].result;
  }
  function port(user: string, device: string): CloudPort {
    return {
      async read() {
        return (
          (
            await query<RemoteSave>(
              user,
              'select revision::int, payload, request_id::text, updated_at::text from public.at_worlds',
            )
          )[0] ?? null
        );
      },
      async claim(takeover) {
        return (await rpc(user, 'at_claim', {
          p_account: user,
          p_device: device,
          p_label: device,
          p_takeover: takeover,
        })) as Awaited<ReturnType<CloudPort['claim']>>;
      },
      async push(expected, request, world) {
        return (await rpc(user, 'at_push', {
          p_account: user,
          p_device: device,
          p_expected: expected,
          p_request: request,
          p_payload: world,
        })) as Awaited<ReturnType<CloudPort['push']>>;
      },
      async release() {
        await rpc(user, 'at_release', { p_account: user, p_device: device });
      },
      async remove(expected) {
        return (await rpc(user, 'at_delete', {
          p_account: user,
          p_device: device,
          p_expected: expected,
        })) as boolean;
      },
    };
  }
  return { db, query, rpc, port };
}
