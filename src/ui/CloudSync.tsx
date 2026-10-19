import { useEffect, useState } from 'react';
import {
  useCloud,
  authenticate,
  signOutCloud,
  connectCloud,
  chooseCloud,
  handoffCloud,
  disconnectCloud,
  deleteCloud,
  cloudHistory,
} from '../cloud/runtime';
import { cloudBackups, clearCloudBackups } from '../cloud/backups';
import { useGame } from '../store';
import { exportSave } from '../persistence';
import type { World } from '../engine/model';

export function CloudSync() {
  const cloud = useCloud(),
    game = useGame();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false),
    [note, setNote] = useState('');
  const [backups, setBackups] = useState<{ label: string; world: World }[]>([]);
  useEffect(() => {
    setConsent(false);
    setBackups([]);
    setNote('');
    setPassword('');
  }, [cloud.email, cloud.consented]);
  const busy = cloud.authBusy || cloud.sync?.busy;
  async function auth(action: 'login' | 'signup' | 'reset' | 'password') {
    await authenticate(action, email.trim(), password);
    setPassword('');
  }
  async function listBackups(source: 'local' | 'cloud') {
    try {
      const rows =
        source === 'local'
          ? (await cloudBackups()).map((row) => ({
              label: `本机备份 · ${new Date(row.createdAt).toLocaleString()}`,
              world: row.world,
            }))
          : (await cloudHistory()).map((row) => ({
              label: `云端第 ${row.revision} 版 · ${new Date(row.updated_at).toLocaleString()}`,
              world: row.payload,
            }));
      setBackups(rows);
      setNote(rows.length ? '可导出这些备份；恢复时使用原来的导入存档功能。' : '暂时没有备份。');
    } catch {
      setNote('暂时无法读取备份，请检查网络或本机存储权限。');
    }
  }
  function choose(source: 'local' | 'cloud') {
    const takeover = cloud.sync?.mode === 'locked';
    const message =
      source === 'cloud'
        ? '将先备份本机世界，再从云端继续。另一台设备若还在游玩，会在下次同步时停止上传。继续？'
        : '以本机世界继续，并将其保存到云端；云端保留最近五版。另一台设备的未同步进度不会合并。继续？';
    if (window.confirm(message)) chooseCloud(source, takeover);
  }
  return (
    <section className="card cloud-card" aria-label="跨设备云存档">
      <h2>同一个今天，换个设备继续</h2>
      {!cloud.configured ? (
        <p>云同步尚未接通正式服务。目前仍保存在本机，可用下方的导出 / 导入转移进度。</p>
      ) : !cloud.email || cloud.recovering ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void auth(cloud.recovering ? 'password' : 'login');
          }}
        >
          {!cloud.recovering && (
            <label>
              同步账号邮箱
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
          )}
          <label>
            {cloud.recovering ? '设置新密码' : '账号密码'}
            <input
              type="password"
              minLength={8}
              autoComplete={cloud.recovering ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <div className="button-row">
            <button type="submit" disabled={busy}>
              {cloud.recovering ? '更新密码' : '登录云存档账号'}
            </button>
            {!cloud.recovering && (
              <button
                type="button"
                disabled={busy || !email.includes('@') || password.length < 8}
                onClick={() => void auth('signup')}
              >
                注册账号
              </button>
            )}
            {!cloud.recovering && (
              <button
                type="button"
                disabled={busy || !email.includes('@')}
                onClick={() => void auth('reset')}
              >
                忘记密码
              </button>
            )}
          </div>
          <p className="muted">登录本身不会上传存档。无需登录也可以继续在本机玩。</p>
          {window.desktop && (
            <a
              href="https://lumosnox-bamboo.github.io/another-today/"
              target="_blank"
              rel="noreferrer"
            >
              在浏览器中处理邮箱确认 / 密码找回
            </a>
          )}
        </form>
      ) : (
        <>
          <p>已登录：{cloud.email}</p>
          {!cloud.consented && (
            <label className="cloud-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              我同意上传完整游戏存档，包括我写的日记、授权小人记住的生活分享与共同活动记录。
            </label>
          )}
          <p className="muted">
            存档存放于
            Supabase，按账号隔离，云服务管理员仍可能访问数据；不提供端到端加密。不同步的内容请先导出备份并从游戏中删除，或保持本机游玩。
          </p>
          <p role="status">{cloud.sync?.message || '勾选上传授权后，可以检查云端进度。'}</p>
          {cloud.sync?.remote && (
            <p>
              云端：{cloud.sync.remote.payload.character.name} · 第 {cloud.sync.remote.revision} 版
              · {new Date(cloud.sync.remote.updated_at).toLocaleString()}
            </p>
          )}
          {['choice', 'locked'].includes(cloud.sync?.mode ?? '') ? (
            <div className="button-row">
              {cloud.sync?.remote && (
                <button disabled={busy} onClick={() => choose('cloud')}>
                  接续云端进度
                </button>
              )}
              {game.world && (
                <button disabled={busy} onClick={() => choose('local')}>
                  以本机进度继续
                </button>
              )}
            </div>
          ) : (
            <div className="button-row">
              <button
                disabled={busy || (!consent && !cloud.consented)}
                onClick={() => connectCloud(consent || cloud.consented)}
              >
                {cloud.sync?.mode === 'ready' ? '现在同步' : '连接 / 重试同步'}
              </button>
              {cloud.sync?.mode === 'ready' && (
                <button disabled={busy} onClick={handoffCloud}>
                  保存并交接
                </button>
              )}
            </div>
          )}
          <div className="button-row">
            <button onClick={() => disconnectCloud()}>断开同步，继续本机</button>
            <button disabled={busy} onClick={() => void signOutCloud()}>
              退出账号
            </button>
            <button disabled={busy} onClick={() => void listBackups('cloud')}>
              查看云端最近五版
            </button>
          </div>
          {cloud.consented && (
            <button
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    '删除此账号的云存档与全部云端历史？本机存档及账号不会删除。其他设备的本机副本也不会删除。',
                  )
                )
                  deleteCloud();
              }}
            >
              删除云存档与云端历史
            </button>
          )}
        </>
      )}
      {game.cloudPaused && !cloud.email && (
        <button onClick={() => disconnectCloud()}>继续本机游玩</button>
      )}
      {cloud.authMessage && <p role="status">{cloud.authMessage}</p>}
      <p className="muted">
        接续云端前保留最近三份本机备份。冲突时暂停交接，由你选一份继续，不拼接剧情或重复结算。
      </p>
      <div className="button-row">
        <button onClick={() => void listBackups('local')}>查看交接前的本机备份</button>
        <button
          onClick={async () => {
            if (!window.confirm('清除交接前的本机备份？当前游戏存档不会删除。')) return;
            try {
              await clearCloudBackups();
              setBackups([]);
              setNote('本机交接备份已清除。');
            } catch {
              setNote('未能清除备份，请检查本机存储权限。');
            }
          }}
        >
          清除本机交接备份
        </button>
      </div>
      {note && <p role="status">{note}</p>}
      {backups.map((row, i) => (
        <button
          key={`${row.label}-${i}`}
          onClick={() =>
            void exportSave(row.world).catch(() => setNote('导出失败，请检查存储空间。'))
          }
        >
          导出 {row.label}
        </button>
      ))}
    </section>
  );
}
