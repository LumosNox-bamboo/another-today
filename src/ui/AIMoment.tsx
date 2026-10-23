import { useEffect, useRef, useState } from 'react';
import { type World } from '../engine/model';
import { getSnapshot, useGame } from '../store';
import { aiReady, useAISettings } from '../ai/settings';
import { aiMessages, type AIKind } from '../ai/context';
import { requestAI, canAutoAI } from '../ai/client';
const cache = new Map<string, string>();
const attempted = new Set<string>();
export function AIMoment({
  world: w,
  kind,
  source,
  basis,
  label,
  automatic = false,
  directNote = false,
}: {
  world: World;
  kind: Exclude<AIKind, 'chat'>;
  source: string;
  basis: string;
  label: string;
  automatic?: boolean;
  directNote?: boolean;
}) {
  const settings = useAISettings();
  const paused = useGame().cloudPaused;
  const key = `${settings.baseUrl}:${settings.model}:${settings.shareMemories}:${w.createdReal}:${w.household.active}:${kind}:${source}:${basis}`;
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const quiet =
    paused ||
    w.living.notifications.dnd ||
    !w.living.notifications.enabled ||
    w.playerActivities.some((a) => !a.returned);
  async function generate(auto = false) {
    if (pending.current || paused) return;
    const actor = w.household.active;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError('');
    try {
      const result = await requestAI(
        aiMessages(w, kind, `本次要表达的资料：${basis}`, [], settings.shareMemories),
        controller.signal,
        auto,
      );
      if (controller.signal.aborted || getSnapshot().world !== w || w.household.active !== actor)
        return;
      cache.set(key, result);
      if (cache.size > 60) cache.delete(cache.keys().next().value!);
      setText(result);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    setText(cache.get(key) || '');
    setError('');
    if (
      aiReady(settings) &&
      automatic &&
      !quiet &&
      !cache.has(key) &&
      !attempted.has(key) &&
      canAutoAI()
    ) {
      attempted.add(key);
      if (attempted.size > 100) attempted.delete(attempted.values().next().value!);
      void generate(true);
    }
    return () => {
      pending.current?.abort();
      pending.current = null;
      setBusy(false);
    };
  }, [key, w, settings, quiet]);
  if (!aiReady(settings)) return null;
  return (
    <div className="ai-moment">
      <button disabled={busy || paused} onClick={() => void generate()}>
        {busy
          ? directNote
            ? `${w.character.name}正在写纸条…`
            : '正在想怎么说…'
          : text
            ? '换一种说法 · AI'
            : label}
      </button>
      {busy && (
        <button className="quiet-button" onClick={() => pending.current?.abort()}>
          取消
        </button>
      )}
      {text && (
        <p className="ai-prose">
          {text}
          <small>AI 表达 · 以原始记录为准</small>
        </p>
      )}
      {error && (
        <p role="status" className="muted">
          {directNote ? '纸条暂时没写好，可以稍后再拆开。' : '原有内容仍可使用。'} {error}
        </p>
      )}
    </div>
  );
}
