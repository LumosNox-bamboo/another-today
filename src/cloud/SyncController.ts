import { type World } from '../engine/model';
import { validateWorld } from '../engine/validation';

export type RemoteSave = {
  revision: number;
  payload: World;
  request_id: string;
  updated_at: string;
};
export type SyncMeta = {
  enabled: boolean;
  revision: number | null;
  hash: string | null;
  pending?: { id: string; hash: string };
};
export const freshMeta = (): SyncMeta => ({ enabled: false, revision: null, hash: null });
export interface CloudPort {
  read(): Promise<RemoteSave | null>;
  claim(takeover: boolean): Promise<{ ok: boolean; label?: string }>;
  push(
    expected: number,
    request: string,
    world: World,
  ): Promise<{ ok: boolean; revision?: number; reason?: string }>;
  release(): Promise<void>;
  remove(expected: number): Promise<boolean>;
}
export interface LocalPort {
  world(): World | null;
  checkpoint(current: () => boolean): Promise<World | null>;
  pause(value: boolean): void;
  backup(world: World): Promise<void>;
  adopt(world: World, current: () => boolean): Promise<void>;
  meta(value: SyncMeta): void;
}
export type SyncState = {
  mode: 'idle' | 'checking' | 'ready' | 'choice' | 'locked' | 'offline' | 'handed-off' | 'error';
  remote: RemoteSave | null;
  message: string;
  busy: boolean;
};
// JSONB reorders object keys. Hash facts canonically, independent of transport formatting.
export async function worldHash(world: World) {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value !== null && typeof value === 'object')
      return `{${Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
        .join(',')}}`;
    return JSON.stringify(value);
  };
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical(JSON.parse(JSON.stringify(world)))),
  );
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export class SyncController {
  state: SyncState = { mode: 'idle', remote: null, message: '', busy: false };
  private disposed = false;
  constructor(
    private remote: CloudPort,
    private local: LocalPort,
    public meta: SyncMeta,
    private changed: () => void,
  ) {}
  private check() {
    if (this.disposed) throw new Error('cancelled');
  }
  private publish(update: Partial<SyncState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...update };
    this.changed();
  }
  private remember(update: Partial<SyncMeta>) {
    this.check();
    const next = { ...this.meta, ...update };
    this.local.meta(next); // A failed durable acknowledgement must not pretend to be synced.
    this.meta = next;
  }
  private async read() {
    const value = await this.remote.read();
    this.check();
    if (value) {
      if (!Number.isSafeInteger(value.revision) || value.revision < 1)
        throw new Error('invalid_revision');
      value.payload = validateWorld(value.payload);
    }
    this.publish({ remote: value });
    return value;
  }
  private async task(work: () => Promise<void>) {
    if (this.disposed || this.state.busy) return;
    this.publish({ busy: true });
    this.local.pause(true);
    try {
      await work();
    } catch {
      if (!this.disposed) {
        this.publish({
          mode: 'offline',
          message: '同步暂未完成，本机进度仍会保存。网络或存储恢复后可重试；不会覆盖另一台设备。',
        });
        this.local.pause(false);
      }
    } finally {
      if (!this.disposed) this.publish({ busy: false });
    }
  }
  private choice(message = '两端的进度需要你确认。先保留备份，再选择从哪一份继续。') {
    this.publish({ mode: 'choice', message });
  }
  private async claim(takeover: boolean) {
    const result = await this.remote.claim(takeover);
    this.check();
    if (!result.ok)
      this.publish({
        mode: 'locked',
        message: `另一台设备（${result.label || '未命名设备'}）正在使用云存档。可以在这里接手，或断开同步继续本机生活。`,
      });
    return result.ok;
  }
  private async upload() {
    this.check();
    const current = await this.local.checkpoint(() => !this.disposed);
    this.check();
    if (!current) {
      this.choice('本机还没有角色，可以先创建，或读取已有云存档。');
      return false;
    }
    const world = validateWorld(structuredClone(current));
    const hash = await worldHash(world);
    this.check();
    const id = crypto.randomUUID();
    this.remember({ pending: { id, hash } });
    const result = await this.remote.push(this.meta.revision ?? 0, id, world);
    this.check();
    if (!result.ok) {
      await this.read();
      if (result.reason === 'lease')
        this.publish({
          mode: 'locked',
          message: '云存档已由另一台设备接手，本机上传已停止。两份进度都保留。',
        });
      else this.choice();
      return false;
    }
    if (!Number.isSafeInteger(result.revision) || result.revision! < 1)
      throw new Error('invalid_ack');
    this.remember({ revision: result.revision!, hash, pending: undefined });
    this.publish({
      mode: 'ready',
      remote: {
        revision: result.revision!,
        payload: world,
        request_id: id,
        updated_at: new Date().toISOString(),
      },
      message: '已同步。每分钟自动保存到云端；换设备前可点“保存并交接”。',
    });
    this.local.pause(false);
    return true;
  }
  async connect() {
    await this.task(async () => {
      this.remember({ enabled: true });
      this.publish({ mode: 'checking', message: '正在检查云存档版本…' });
      const remote = await this.read();
      // Recover an acknowledgement lost in transit without duplicating the save.
      if (remote && remote.request_id === this.meta.pending?.id) {
        const hash = await worldHash(remote.payload);
        this.check();
        if (hash === this.meta.pending.hash)
          this.remember({ revision: remote.revision, hash, pending: undefined });
      }
      if (this.meta.revision === null || (!remote && this.meta.revision !== 0)) {
        this.choice(
          remote
            ? '找到云端进度。请选择接续云端，或用本机进度替换（云端保留最近五版）。'
            : '云端还没有存档。确认上传后，这个角色就能在其他设备继续生活。',
        );
        return;
      }
      const current = this.local.world();
      const hash = current ? await worldHash(current) : null;
      this.check();
      if ((remote?.revision ?? 0) !== this.meta.revision) {
        if (remote && hash === this.meta.hash) {
          await this.select('cloud', false, remote.revision);
        } else this.choice();
        return;
      }
      if (!(await this.claim(false))) return;
      await this.upload();
    });
  }
  private async select(source: 'local' | 'cloud', takeover: boolean, shownRevision: number) {
    if (!(await this.claim(takeover))) return;
    const latest = await this.read();
    if ((latest?.revision ?? 0) !== shownRevision) {
      this.choice('选择期间云存档又有变化，请查看最新进度后重新选择。');
      return;
    }
    if (source === 'cloud') {
      if (!latest) {
        this.choice('云存档已不存在，本机进度仍保留。');
        return;
      }
      const local = this.local.world();
      if (local) await this.local.backup(structuredClone(local));
      this.check();
      await this.local.adopt(structuredClone(latest.payload), () => !this.disposed);
      this.check();
    }
    this.remember({
      enabled: true,
      revision: latest?.revision ?? 0,
      hash: latest ? await worldHash(latest.payload) : null,
      pending: undefined,
    });
    await this.upload();
  }
  async choose(source: 'local' | 'cloud', takeover = false) {
    const revision = this.state.remote?.revision ?? 0;
    await this.task(() => this.select(source, takeover, revision));
  }
  async handoff() {
    if (!this.meta.enabled || this.state.mode !== 'ready') return;
    await this.task(async () => {
      if (!(await this.upload())) return;
      this.local.pause(true);
      await this.remote.release();
      this.check();
      this.publish({
        mode: 'handed-off',
        message: '已保存并交接，本机生活暂时停在这里。现在可以在另一台设备接续。',
      });
    });
  }
  async remove() {
    const revision = this.state.remote?.revision ?? 0;
    await this.task(async () => {
      if (!(await this.claim(false))) return;
      if (!(await this.remote.remove(revision))) {
        await this.read();
        this.choice('云端已变化，未删除任何存档。请重新检查。');
        return;
      }
      this.check();
      this.remember(freshMeta());
      this.publish({
        mode: 'idle',
        remote: null,
        message: '云存档及云端历史已删除，账号与本机存档仍保留。',
      });
      this.local.pause(false);
    });
  }
  dispose() {
    this.disposed = true;
    this.local.pause(false);
  }
}
