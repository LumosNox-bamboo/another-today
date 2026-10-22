import { endpoint, type AISettings, getAISettings, trackAIRequest, aiReady } from './settings';
const USAGE = 'another-today-ai-usage-v1';
export const AI_TIMEOUT = 25000;
class AIError extends Error {}
let busy = false;
interface Usage {
  date: string;
  calls: number;
  automatic: number;
  lastAutomatic: number;
}
function usage(): Usage {
  const date = new Date().toLocaleDateString('sv-SE');
  try {
    const value = JSON.parse(localStorage.getItem(USAGE) || '{}');
    if (
      value.date >= date &&
      Number.isInteger(value.calls) &&
      value.calls >= 0 &&
      Number.isInteger(value.automatic) &&
      value.automatic >= 0 &&
      Number.isFinite(value.lastAutomatic)
    )
      return value;
  } catch {
    /* Treat a missing or invalid counter as a new local day. */
  }
  return { date, calls: 0, automatic: 0, lastAutomatic: 0 };
}
export function aiUsage() {
  return usage();
}
export function canAutoAI() {
  const u = usage(),
    s = getAISettings();
  return (
    aiReady(s) &&
    s.automatic &&
    !busy &&
    u.calls < s.dailyLimit &&
    u.automatic < 3 &&
    Date.now() - u.lastAutomatic >= 10 * 60000
  );
}
export async function requestAI(
  messages: { role: string; content: string }[],
  signal: AbortSignal,
  automatic = false,
  config?: AISettings,
): Promise<string> {
  const s = config || getAISettings();
  if (!s.key || !s.model || (!config && !aiReady(s)))
    throw new AIError('AI 未启用，继续使用本地内容。');
  const url = endpoint(s.baseUrl);
  if (signal.aborted) throw new AIError('请求已取消。');
  if (busy) throw new AIError('上一条 AI 回复还在路上，请稍后再试。');
  const u = usage();
  if (u.calls >= s.dailyLimit) throw new AIError('今天已达到本机调用上限，继续使用本地内容。');
  if (automatic && !canAutoAI()) throw new AIError('本次保持安静，继续使用本地内容。');
  u.calls++;
  if (automatic) {
    u.automatic++;
    u.lastAutomatic = Date.now();
  }
  try {
    localStorage.setItem(USAGE, JSON.stringify(u));
  } catch {
    throw new AIError('无法保存调用计数，未发送请求。');
  }
  busy = true;
  const controller = new AbortController();
  const untrack = trackAIRequest(controller);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AI_TIMEOUT);
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.key}` },
      body: JSON.stringify({ model: s.model, messages, stream: false, [s.tokenParameter]: 600 }),
    });
    if (!response.ok) {
      if ([401, 403].includes(response.status))
        throw new AIError('Key 无效或没有模型权限，请检查 API 设置。');
      if (response.status === 429) throw new AIError('服务达到额度或请求频率限制，稍后再试。');
      if ([400, 404, 422].includes(response.status))
        throw new AIError('服务不接受该请求，请检查地址、模型和 Token 参数格式。');
      throw new AIError('AI 服务暂时不可用，继续使用本地内容。');
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim())
      throw new AIError('服务没有返回可显示的文字，继续使用本地内容。');
    if (controller.signal.aborted) throw new AIError('请求已取消。');
    // React renders plain text only. Never interpret model output as game commands.
    return text.trim().slice(0, 1600);
  } catch (error) {
    if (timedOut) throw new AIError('回复等待超时，继续使用本地内容。');
    if (controller.signal.aborted) throw new AIError('请求已取消。');
    if (error instanceof TypeError)
      throw new AIError('连接失败：请检查网络，以及服务是否允许本站浏览器跨域调用（CORS）。');
    // Never surface server response bodies, request headers, or secret-bearing network errors.
    if (error instanceof SyntaxError) throw new AIError('服务返回格式不兼容，继续使用本地内容。');
    if (error instanceof AIError) throw error;
    throw new AIError('AI 请求未完成，继续使用本地内容。');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    untrack();
    busy = false;
  }
}
