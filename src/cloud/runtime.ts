/// <reference types="vite/client" />
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { cloudConfiguration } from './config';
import {
  SyncController,
  freshMeta,
  type CloudPort,
  type RemoteSave,
  type SyncMeta,
  type SyncState,
} from './SyncController';
import { saveCloudBackup } from './backups';
import { getSnapshot, pauseForCloud, adoptCloudWorld, onWorldReplacement } from '../store';
import { validateWorld } from '../engine/validation';

const config = cloudConfiguration(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
const META_KEY = 'another-today-cloud-link';
const metadataSchema = z.object({
  user: z.string().uuid(),
  enabled: z.boolean(),
  revision: z.number().int().nonnegative().nullable(),
  hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  pending: z.object({ id: z.string().uuid(), hash: z.string().regex(/^[a-f0-9]{64}$/) }).optional(),
});
let client: SupabaseClient | null = null;
let controller: SyncController | null = null;
let session: Session | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let state = {
  configured: !!config,
  email: '',
  recovering: false,
  authBusy: false,
  authMessage: '',
  consented: false,
  sync: null as SyncState | null,
};
const listeners = new Set<() => void>();
function publish(update: Partial<typeof state> = {}) {
  state = { ...state, ...update, sync: controller?.state ?? null };
  listeners.forEach((listener) => listener());
}
export const useCloud = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
function savedMeta(user: string): SyncMeta {
  try {
    const value = metadataSchema.parse(JSON.parse(localStorage.getItem(META_KEY) || 'null'));
    if (value.user === user) return value;
  } catch {
    /* A missing/damaged link never authorizes an upload. */
  }
  return freshMeta();
}
function storeMeta(user: string, meta: SyncMeta) {
  localStorage.setItem(META_KEY, JSON.stringify({ ...meta, user }));
}
export function cloudStartPending() {
  if (!config) return false;
  try {
    return metadataSchema.parse(JSON.parse(localStorage.getItem(META_KEY) || 'null')).enabled;
  } catch {
    return false;
  }
}
function device() {
  const key = 'another-today-cloud-device';
  let id = sessionStorage.getItem(key);
  if (!id || !z.string().uuid().safeParse(id).success) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}
function port(api: SupabaseClient, user: string): CloudPort {
  const id = device(),
    label = window.desktop
      ? '电脑 App'
      : /Mobi|Android/i.test(navigator.userAgent)
        ? '手机浏览器 / App'
        : '电脑浏览器';
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await api.rpc(name, { ...args, p_account: user });
    if (error) throw error;
    return data;
  };
  return {
    async read() {
      const { data, error } = await api
        .from('at_worlds')
        .select('revision,payload,request_id,updated_at')
        .eq('owner', user)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = z
        .object({
          revision: z.number().int().positive(),
          payload: z.unknown(),
          request_id: z.string().uuid(),
          updated_at: z.string(),
        })
        .parse(data);
      return { ...row, payload: validateWorld(row.payload) };
    },
    async claim(takeover) {
      return z
        .object({ ok: z.boolean(), label: z.string().optional() })
        .parse(await rpc('at_claim', { p_device: id, p_label: label, p_takeover: takeover }));
    },
    async push(expected, request, world) {
      return z
        .object({
          ok: z.boolean(),
          revision: z.number().int().positive().optional(),
          reason: z.string().optional(),
        })
        .parse(
          await rpc('at_push', {
            p_device: id,
            p_expected: expected,
            p_request: request,
            p_payload: world,
          }),
        );
    },
    async release() {
      await rpc('at_release', { p_device: id });
    },
    async remove(expected) {
      return z.boolean().parse(await rpc('at_delete', { p_device: id, p_expected: expected }));
    },
  };
}
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  controller?.dispose();
  controller = null;
  pauseForCloud(false);
}
function setSession(next: Session | null, recovery = false) {
  if (next?.user.id === session?.user.id && controller && !recovery) {
    session = next;
    return;
  }
  stop();
  session = next;
  publish({ email: next?.user.email ?? '', recovering: recovery, consented: false });
  if (!next || !client) return;
  const user = next.user.id,
    meta = savedMeta(user);
  controller = new SyncController(
    port(client, user),
    {
      world: () => getSnapshot().world,
      checkpoint: async (current) => {
        const world = getSnapshot().world;
        if (world) await adoptCloudWorld(structuredClone(world), current);
        return getSnapshot().world;
      },
      pause: pauseForCloud,
      backup: saveCloudBackup,
      adopt: adoptCloudWorld,
      meta: (value) => storeMeta(user, value),
    },
    meta,
    () => publish({ consented: controller?.meta.enabled ?? false }),
  );
  publish({ consented: meta.enabled });
  if (meta.enabled && !recovery) void controller.connect();
  timer = setInterval(() => {
    if (
      !state.recovering &&
      document.visibilityState === 'visible' &&
      controller?.meta.enabled &&
      ['ready', 'offline'].includes(controller.state.mode)
    )
      void controller.connect();
  }, 60_000);
}
export function initializeCloud() {
  if (!config || client) return;
  client = createClient(config.url, config.key, {
    db: { retry: false }, // The controller retries after checking the acknowledged revision.
    auth: {
      storageKey: 'another-today-auth',
      flowType: 'pkce',
      detectSessionInUrl: !window.desktop,
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(12_000)])
            : AbortSignal.timeout(12_000),
        }),
    },
  });
  client.auth.onAuthStateChange((event, next) => {
    // Supabase invokes this inside its auth lock; never await another SDK call here.
    setTimeout(() => setSession(next, event === 'PASSWORD_RECOVERY'), 0);
  });
  onWorldReplacement(() => disconnectCloud(true));
  void client.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) {
        pauseForCloud(false);
        publish({ authMessage: '无法读取登录状态，可以继续离线游玩。' });
      } else setSession(data.session);
    })
    .catch(() => {
      pauseForCloud(false);
      publish({ authMessage: '暂时无法连接账号服务，本机进度不受影响。' });
    });
}
export async function authenticate(
  action: 'login' | 'signup' | 'reset' | 'password',
  email: string,
  password: string,
) {
  if (!client || state.authBusy) return;
  if (window.desktop && action === 'reset') {
    publish({
      authMessage:
        '请在系统浏览器中打开游戏网址，在那里请求找回密码，并用同一浏览器打开恢复邮件。更新后可回到桌面版登录。',
    });
    return;
  }
  publish({ authBusy: true, authMessage: '' });
  try {
    const redirectTo = 'https://lumosnox-bamboo.github.io/another-today/';
    const result =
      action === 'login'
        ? await client.auth.signInWithPassword({ email, password })
        : action === 'signup'
          ? await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
          : action === 'reset'
            ? await client.auth.resetPasswordForEmail(email, { redirectTo })
            : await client.auth.updateUser({ password });
    if (result.error) throw result.error;
    publish({
      recovering: action === 'password' ? false : state.recovering,
      authMessage:
        action === 'signup'
          ? '注册请求已提交。如需确认，请查收邮件后再登录。'
          : action === 'reset'
            ? '如果该邮箱可用于恢复，将收到邮件；请在发起请求的同一浏览器打开链接。'
            : action === 'password'
              ? '密码已更新。'
              : '已登录。勾选上传授权后才会连接云存档。',
    });
  } catch {
    publish({
      authMessage:
        '账号操作未完成。请检查邮箱、密码、确认邮件和网络；注册 / 重置邮件还取决于云项目的邮件服务配置。',
    });
  } finally {
    publish({ authBusy: false });
  }
}
export async function signOutCloud() {
  disconnectCloud();
  if (!client) return;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  } catch {
    publish({ authMessage: '已停止同步，但退出账号未完成，请联网后重试。' });
  }
}
export function disconnectCloud(reset = false) {
  const old = controller;
  stop();
  if (session) {
    try {
      storeMeta(session.user.id, {
        ...(reset ? freshMeta() : (old?.meta ?? freshMeta())),
        enabled: false,
      });
    } catch {
      localStorage.removeItem(META_KEY);
    }
  } else localStorage.removeItem(META_KEY);
  // Keep a fresh, disconnected controller so the same signed-in user can opt in again.
  const current = session;
  session = null;
  setSession(current);
  publish({ consented: false });
}
export function connectCloud(consent: boolean) {
  if (!consent || !controller || state.recovering) return;
  publish({ consented: true });
  void controller.connect();
}
export function chooseCloud(source: 'local' | 'cloud', takeover: boolean) {
  if (state.consented) void controller?.choose(source, takeover);
}
export function handoffCloud() {
  void controller?.handoff();
}
export function deleteCloud() {
  void controller?.remove();
}
export async function cloudHistory(): Promise<RemoteSave[]> {
  if (!client || !session) return [];
  const { data, error } = await client
    .from('at_versions')
    .select('revision,payload,updated_at')
    .eq('owner', session.user.id)
    .order('revision', { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    revision: row.revision,
    updated_at: row.updated_at,
    payload: validateWorld(row.payload),
    request_id: '',
  }));
}
