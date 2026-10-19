/// <reference types="vite/client" />
import { useSyncExternalStore } from 'react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let prompt: InstallPrompt | null = null;
let state = { offlineReady: false, failed: false, updateReady: false, canInstall: false };
const listeners = new Set<() => void>();
function publish(update: Partial<typeof state>) {
  state = { ...state, ...update };
  listeners.forEach((listener) => listener());
}
export const usePwa = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );

export async function installApp() {
  const available = prompt;
  if (!available) return;
  prompt = null;
  publish({ canInstall: false });
  try {
    await available.prompt();
    await available.userChoice;
  } catch {
    // Browser-menu instructions remain available if the native prompt is unavailable.
  }
}

export function initializePwa() {
  if (window.desktop || !import.meta.env.PROD || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    publish({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    prompt = null;
    publish({ canInstall: false });
  });
  if (!('serviceWorker' in navigator)) {
    publish({ failed: true });
    return;
  }
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
    .then((registration) => {
      const refresh = () => publish({ updateReady: !!registration.waiting });
      refresh();
      const track = () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          refresh();
          if (worker.state === 'redundant') publish({ failed: true });
        });
      };
      track();
      registration.addEventListener('updatefound', track);
      return navigator.serviceWorker.ready;
    })
    .then(() => publish({ offlineReady: true, failed: false }))
    .catch(() => publish({ failed: true }));
}
