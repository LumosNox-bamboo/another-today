import { transact } from '../src/engine/model';
import { addResident, selectResident } from '../src/engine/HouseholdEngine';
import { startShared, inviteShared } from '../src/engine/SharedActivityEngine';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  endpoint,
  saveAISettings,
  clearAISettings,
  getAISettings,
  AI_STORAGE,
} from '../src/ai/settings';
import { sharedAIContext, aiMessages, aiContext } from '../src/ai/context';
import { requestAI, AI_TIMEOUT, aiUsage, canAutoAI } from '../src/ai/client';
import { createWorld, defaultCharacter } from '../src/content/people';
import { rememberPlayer } from '../src/engine/MemoryEngine';
import { validateWorld } from '../src/engine/validation';
const disk = new Map<string, string>();
const cfg = () => ({
  ...getAISettings(),
  enabled: true,
  baseUrl: 'https://api.example.test/v1',
  model: 'test-model',
  key: 'test-secret-only',
  dailyLimit: 30,
});
const message = [{ role: 'user', content: '你好' }];
const ok = (text = '我在窗边读书。') =>
  new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => disk.get(k) || null,
    setItem: (k: string, v: string) => disk.set(k, v),
    removeItem: (k: string) => disk.delete(k),
  });
  disk.clear();
  clearAISettings();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('normalizes only HTTPS endpoints without credential or query leakage', () => {
  expect(endpoint('https://api.example.test/v1/')).toBe(
    'https://api.example.test/v1/chat/completions',
  );
  expect(endpoint('https://api.example.test/v1/chat/completions')).toBe(
    'https://api.example.test/v1/chat/completions',
  );
  for (const url of [
    'http://api.example.test',
    'javascript:alert(1)',
    'https://u:p@example.test',
    'https://example.test/?key=secret',
    'https://example.test/#secret',
  ])
    expect(() => endpoint(url)).toThrow();
});
it('keeps keys in memory by default and erases explicit stored keys when requested', () => {
  saveAISettings(cfg());
  expect(getAISettings().key).toBe('test-secret-only');
  expect(disk.get(AI_STORAGE)).not.toContain('test-secret-only');
  saveAISettings({ ...cfg(), rememberKey: true });
  expect(disk.get(AI_STORAGE)).toContain('test-secret-only');
  saveAISettings({ ...cfg(), rememberKey: false });
  expect(disk.get(AI_STORAGE)).not.toContain('test-secret-only');
  clearAISettings();
  expect(disk.has(AI_STORAGE)).toBe(false);
  expect(getAISettings().key).toBe('');
});
it('sends bounded factual context and only opt-in player memories, without mutating or exporting secrets', () => {
  const w = createWorld(structuredClone(defaultCharacter), Date.UTC(2026, 9, 22, 9), 72);
  rememberPlayer(w, '我正在学德语', Date.UTC(2026, 9, 22, 9));
  const before = JSON.stringify(w);
  saveAISettings({ ...cfg(), rememberKey: true });
  const history = Array.from({ length: 20 }, () => ({
    role: 'player' as const,
    text: '你记得什么？',
  }));
  const plain = aiMessages(w, 'chat', '你好', history, false);
  expect(plain).toHaveLength(11);
  expect(JSON.stringify(plain)).not.toContain('德语');
  expect(JSON.stringify(aiMessages(w, 'chat', '你好', [], true))).toContain('德语');
  expect(JSON.stringify(plain)).not.toContain('test-secret-only');
  expect(JSON.stringify(w)).toBe(before);
  expect(JSON.stringify(validateWorld(w))).not.toContain('test-secret-only');
});
it('does not call an API while disabled; uses bounded authenticated requests when enabled', async () => {
  const fetcher = vi.fn().mockResolvedValue(ok());
  vi.stubGlobal('fetch', fetcher);
  await expect(requestAI(message, new AbortController().signal)).rejects.toThrow('未启用');
  expect(fetcher).not.toHaveBeenCalled();
  saveAISettings(cfg());
  expect(await requestAI(message, new AbortController().signal)).toBe('我在窗边读书。');
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe('https://api.example.test/v1/chat/completions');
  expect(init.credentials).toBe('omit');
  expect(init.redirect).toBe('error');
  expect(init.headers.Authorization).toBe('Bearer test-secret-only');
  expect(JSON.parse(init.body).max_tokens).toBe(600);
  expect(aiUsage().calls).toBe(1);
});
it('supports the OpenAI token parameter and never returns raw error bodies', async () => {
  saveAISettings({ ...cfg(), tokenParameter: 'max_completion_tokens' });
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response('sensitive-upstream-body', { status: 401 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(requestAI(message, new AbortController().signal)).rejects.toThrow('Key 无效');
  expect(JSON.parse(fetcher.mock.calls[0][1].body).max_completion_tokens).toBe(600);
  fetcher.mockRejectedValue(new TypeError('test-secret-only'));
  await expect(requestAI(message, new AbortController().signal)).rejects.toThrow('CORS');
  fetcher.mockResolvedValue(new Response('invalid JSON', { status: 200 }));
  await expect(requestAI(message, new AbortController().signal)).rejects.toThrow('格式');
});
it('caps calls and automatic opportunities without retry storms', async () => {
  saveAISettings({ ...cfg(), automatic: true, dailyLimit: 2 });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => Promise.resolve(ok())),
  );
  expect(canAutoAI()).toBe(true);
  await requestAI(message, new AbortController().signal, true);
  expect(canAutoAI()).toBe(false);
  await requestAI(message, new AbortController().signal);
  await expect(requestAI(message, new AbortController().signal)).rejects.toThrow('上限');
  expect(aiUsage().calls).toBe(2);
});
it('cancels requests when disabled and releases the request slot', async () => {
  saveAISettings(cfg());
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation(
        (_url, init) =>
          new Promise((_, reject) =>
            init.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            ),
          ),
      ),
  );
  const pending = requestAI(message, new AbortController().signal);
  const checked = expect(pending).rejects.toThrow('取消');
  await expect(requestAI(message, new AbortController().signal)).rejects.toThrow('上一条');
  saveAISettings({ ...cfg(), enabled: false });
  await checked;
  saveAISettings(cfg());
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok('恢复了')));
  expect(await requestAI(message, new AbortController().signal)).toBe('恢复了');
});
it('times out stalled requests and rejects missing text safely', async () => {
  vi.useFakeTimers();
  saveAISettings(cfg());
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation(
        (_url, init) =>
          new Promise((_, reject) =>
            init.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            ),
          ),
      ),
  );
  const checked = expect(requestAI(message, new AbortController().signal)).rejects.toThrow('超时');
  await vi.advanceTimersByTimeAsync(AI_TIMEOUT + 1);
  await checked;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
  await expect(requestAI(message, new AbortController().signal)).rejects.toThrow('可显示');
});
it('shared activity context belongs only to its owner or actually invited resident', () => {
  const w = createWorld(structuredClone(defaultCharacter), Date.now(), 72);
  const second = addResident(w, '室友', 25, '室友');
  const third = addResident(w, '另一位', 25, '室友');
  startShared(w, '阅读', 25, Date.now());
  const activity = w.playerActivities[0];
  activity.independent = [{ kind: 'read', minutes: 10 }];
  inviteShared(w, second, 'rest');
  activity.invitations![0].independent = [{ kind: 'rest', minutes: 20 }];
  expect(sharedAIContext(w, activity)!.independent).toEqual([{ kind: 'read', minutes: 10 }]);
  selectResident(w, second);
  expect(sharedAIContext(w, activity)!.independent).toEqual([{ kind: 'rest', minutes: 20 }]);
  selectResident(w, third);
  expect(sharedAIContext(w, activity)).toBeNull();
});
it('automatic generation has a separate three-call ceiling even with a larger daily limit', async () => {
  vi.useFakeTimers();
  saveAISettings({ ...cfg(), automatic: true, dailyLimit: 30 });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => Promise.resolve(ok())),
  );
  for (let i = 0; i < 3; i++) {
    await requestAI(message, new AbortController().signal, true);
    await vi.advanceTimersByTimeAsync(10 * 60000);
  }
  expect(canAutoAI()).toBe(false);
  await expect(requestAI(message, new AbortController().signal, true)).rejects.toThrow('保持安静');
  expect(aiUsage().calls).toBe(3);
});

it('gives AI the selected resident actual finances without leaking roommate bills', () => {
  const w = createWorld();
  const id = addResident(w, '室友', 25, '室友', 800);
  transact(w, -37, '主控专属消费');
  selectResident(w, id);
  transact(w, -19, '室友专属消费');
  const loaded = validateWorld(JSON.parse(JSON.stringify(w)));
  const finances = aiContext(loaded, false).finances;
  expect(finances.balance).toBe(781);
  expect(finances.recentPersonalTransactions).toEqual([
    { date: expect.any(String), amount: -19, reason: '室友专属消费' },
  ]);
  expect(JSON.stringify(finances)).not.toContain('主控专属消费');
  selectResident(loaded, 'resident-0');
  expect(aiContext(loaded, false).finances.balance).toBe(2963);
  expect(JSON.stringify(aiContext(loaded, false).finances)).not.toContain('室友专属消费');
});
