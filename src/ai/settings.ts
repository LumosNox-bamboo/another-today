import { useSyncExternalStore } from 'react';
export interface AISettings {
  enabled: boolean;
  baseUrl: string;
  model: string;
  key: string;
  rememberKey: boolean;
  shareMemories: boolean;
  automatic: boolean;
  dailyLimit: number;
  tokenParameter: 'max_tokens' | 'max_completion_tokens';
}
export const AI_STORAGE = 'another-today-ai-settings-v1';
const defaults: AISettings = {
  enabled: false,
  baseUrl: '',
  model: '',
  key: '',
  rememberKey: false,
  shareMemories: false,
  automatic: false,
  dailyLimit: 30,
  tokenParameter: 'max_tokens',
};
export function endpoint(base: string) {
  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    throw new Error('请填写完整的 HTTPS API 地址。');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('API 地址须使用 HTTPS，不能包含账号、密码、查询参数或片段。');
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/chat/completions') ? path : `${path}/chat/completions`;
  return url.href;
}
function load(): AISettings {
  try {
    const raw = JSON.parse(localStorage.getItem(AI_STORAGE) || '{}');
    return {
      ...defaults,
      enabled: raw.enabled === true,
      baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl.slice(0, 500) : '',
      model: typeof raw.model === 'string' ? raw.model.slice(0, 100) : '',
      key: raw.rememberKey === true && typeof raw.key === 'string' ? raw.key : '',
      rememberKey: raw.rememberKey === true,
      shareMemories: raw.shareMemories === true,
      automatic: raw.automatic === true,
      dailyLimit: Number.isInteger(raw.dailyLimit)
        ? Math.min(100, Math.max(1, raw.dailyLimit))
        : 30,
      tokenParameter:
        raw.tokenParameter === 'max_completion_tokens' ? 'max_completion_tokens' : 'max_tokens',
    };
  } catch {
    return { ...defaults };
  }
}
let current = load();
const listeners = new Set<() => void>();
const pending = new Set<AbortController>();
export function trackAIRequest(controller: AbortController) {
  pending.add(controller);
  return () => pending.delete(controller);
}
export function getAISettings() {
  return current;
}
export function aiReady(s = current) {
  return s.enabled && !!s.key.trim() && !!s.model.trim() && !!s.baseUrl.trim();
}
export function saveAISettings(s: AISettings) {
  if (s.enabled) {
    endpoint(s.baseUrl);
    if (!s.key.trim() || !s.model.trim()) throw new Error('请填写模型名称和 API Key。');
  }
  const next = {
    ...s,
    baseUrl: s.baseUrl.trim(),
    model: s.model.trim(),
    key: s.key.trim(),
    dailyLimit: Math.min(100, Math.max(1, Math.floor(s.dailyLimit || 30))),
  };
  // Persist first so an unavailable browser store cannot silently claim success.
  localStorage.setItem(
    AI_STORAGE,
    JSON.stringify({ ...next, key: next.rememberKey ? next.key : '' }),
  );
  for (const c of pending) c.abort();
  current = next;
  listeners.forEach((f) => f());
}
export function clearAISettings() {
  localStorage.removeItem(AI_STORAGE);
  for (const c of pending) c.abort();
  current = { ...defaults };
  listeners.forEach((f) => f());
}
export function useAISettings() {
  return useSyncExternalStore((f) => {
    listeners.add(f);
    return () => listeners.delete(f);
  }, getAISettings);
}
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== AI_STORAGE && e.key !== null) return;
    for (const c of pending) c.abort();
    current = load();
    listeners.forEach((f) => f());
  });
