'use client';

/**
 * tauri-global.ts — the typed `window.__TAURI__` accessor, and nothing else.
 *
 * 📦 WHY IT IS ITS OWN FILE (2026-10-22). These two functions lived in
 * `lib/desktop-oauth.ts`, and the root layout's `DesktopUpdaterListener` (on
 * EVERY page) imported them from there — which pulled the whole desktop sign-in
 * flow into every page's first load with them: the Supabase browser client, the
 * terms-reaccept server action and the terms helpers. Every visitor downloaded
 * the desktop app's OAuth code to ask "am I the desktop app?". This file imports
 * nothing; `desktop-oauth.ts` re-exports it, so its callers are unchanged.
 * Held by `lib/the-root-layout-stays-light.test.ts` and the shared first-load
 * ceiling (`scripts/check-bundle-size.mjs`).
 */

interface TauriCore {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
}
interface TauriEvent {
  listen: (
    event: string,
    handler: (e: { payload: unknown }) => void,
  ) => Promise<() => void>;
}
export interface TauriGlobal {
  core: TauriCore;
  event: TauriEvent;
}

/**
 * Exported so other desktop-only modules (e.g. lib/desktop-stream-key.ts, S8)
 * can invoke additional Tauri commands through the SAME typed accessor rather
 * than re-declaring the `window.__TAURI__` shape a second time.
 */
export function tauri(): TauriGlobal | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __TAURI__?: TauriGlobal };
  const t = w.__TAURI__;
  return t && t.core && t.event ? t : null;
}

/** True only inside the Tauri desktop shell (globalTauri injected). */
export function isTauri(): boolean {
  return tauri() !== null;
}
