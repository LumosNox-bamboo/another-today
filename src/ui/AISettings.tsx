import { useEffect, useRef, useState } from 'react';
import { aiReady, clearAISettings, endpoint, saveAISettings, useAISettings } from '../ai/settings';
import { aiUsage, requestAI } from '../ai/client';
export function AISettingsPanel() {
  const saved = useAISettings();
  const [draft, setDraft] = useState(saved);
  const [consent, setConsent] = useState(saved.enabled);
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    setDraft(saved);
    setConsent(saved.enabled);
  }, [saved]);
  useEffect(() => () => request.current?.abort(), []);
  const edit = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    request.current?.abort();
    setTesting(false);
    setStatus('');
    setDraft((d) => ({ ...d, [key]: value }));
  };
  async function test() {
    if (!consent) {
      setStatus('请先确认允许向所填 API 服务发送内容。');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setTesting(true);
    setStatus('正在测试，仅发送一条连接问候，不发送游戏资料。');
    try {
      endpoint(draft.baseUrl);
      await requestAI(
        [{ role: 'user', content: '连接测试，请只回复：连接成功。' }],
        controller.signal,
        false,
        { ...draft, enabled: true },
      );
      if (!controller.signal.aborted) setStatus('连接成功，可以保存并开启 AI 陪伴。');
    } catch (e) {
      if (!controller.signal.aborted) setStatus((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setTesting(false);
    }
  }
  return (
    <section className="card full ai-settings" aria-label="可选 AI 陪伴设置">
      <h2>可选 AI 陪伴</h2>
      <p>开启后，聊天和生活分享会更丰富。不配置也可以完整游玩；连接失败时继续使用本地内容。</p>
      <p className="muted">
        使用你自己的 OpenAI 兼容 Chat Completions
        服务，费用由该服务计收。服务须支持浏览器跨域调用（CORS）。
      </p>
      <div className="form-grid">
        <label>
          API 基础地址
          <input
            type="url"
            value={draft.baseUrl}
            placeholder="https://你的服务地址/v1"
            onChange={(e) => edit('baseUrl', e.target.value)}
            autoComplete="off"
          />
        </label>
        <label>
          模型名称
          <input
            value={draft.model}
            placeholder="填写服务提供的模型 ID"
            onChange={(e) => edit('model', e.target.value)}
            autoComplete="off"
          />
        </label>
        <label>
          API Key
          <input
            type="password"
            value={draft.key}
            onChange={(e) => edit('key', e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          本机每日调用上限
          <input
            type="number"
            min={1}
            max={100}
            value={draft.dailyLimit}
            onChange={(e) => edit('dailyLimit', Number(e.target.value))}
          />
        </label>
        <label>
          Token 参数格式
          <select
            value={draft.tokenParameter}
            onChange={(e) => edit('tokenParameter', e.target.value as typeof draft.tokenParameter)}
          >
            <option value="max_tokens">通用兼容服务（max_tokens）</option>
            <option value="max_completion_tokens">OpenAI 新模型（max_completion_tokens）</option>
          </select>
        </label>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={draft.rememberKey}
          onChange={(e) => edit('rememberKey', e.target.checked)}
        />
        记住本机 Key（以明文保存在此浏览器，公共设备请勿勾选）
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={draft.shareMemories}
          onChange={(e) => edit('shareMemories', e.target.checked)}
        />
        额外附带我已授权保存的最近记忆（最多 5 条）
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={draft.automatic}
          onChange={(e) => edit('automatic', e.target.checked)}
        />
        为可见的新分享和纸条自动润色（每天最多 3 次，专注与免打扰时关闭）
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            request.current?.abort();
            setTesting(false);
            setConsent(e.target.checked);
          }}
        />
        我允许将当前聊天、所选内容及当前人物的必要资料发送到我填写的 API 服务
      </label>
      <p className="muted">
        Key 不进入游戏存档、导出或云同步。未勾选“记住”时，仅在本次打开期间保留。AI
        文字可能不准确，不作为人生档案事实，也不会改变金钱和关系。
      </p>
      <div className="button-row">
        <button disabled={testing || !consent} onClick={() => void test()}>
          {testing ? '测试中…' : '测试连接'}
        </button>
        <button
          className="primary"
          disabled={testing || !consent}
          onClick={() => {
            try {
              saveAISettings({ ...draft, enabled: true });
              setStatus('AI 陪伴已开启。可以去聊天，或在日记、纸条和作品旁尝试 AI。');
            } catch (e) {
              setStatus((e as Error).message);
            }
          }}
        >
          保存并开启 AI
        </button>
        <button
          disabled={!saved.enabled}
          onClick={() => {
            try {
              saveAISettings({ ...saved, enabled: false });
              setStatus('已关闭 AI，继续本地陪伴。');
            } catch {
              setStatus('无法保存设置，请检查浏览器存储。');
            }
          }}
        >
          关闭 AI
        </button>
        <button
          onClick={() => {
            try {
              clearAISettings();
              setStatus('已清除本机 API 配置和 Key。');
            } catch {
              setStatus('无法清除，请检查浏览器存储。');
            }
          }}
        >
          清除 API 配置
        </button>
      </div>
      <p role="status">
        {status ||
          `${aiReady(saved) ? 'AI 已开启' : '当前使用本地陪伴'} · 今天已发出 ${aiUsage().calls} 次请求（含连接测试和失败请求）`}
      </p>
    </section>
  );
}
