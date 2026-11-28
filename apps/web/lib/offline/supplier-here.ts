'use client';

// 📶 CAN THIS PHONE KEEP OFFLINE WORK, HERE? (controller review #2 items 6, 19, 22; R17). Asked once before anything is
// queued: a change this browser would lose is never accepted.
//   · the App Store app (`SetnayanApp`): no service worker there and IndexedDB throws — OFF, said plainly, until the
//     iPhone app's own proof (B4). The words say "Add to Home Screen", never "install the app".
//   · a private window: the browser deletes everything when it closes — OFF (R17). `persist()` refused is NOT proof of
//     one; the test is the storage quota PLUS a write that reads back.
//   · iPhone Safari outside Home Screen mode: kept, with a warning (Safari erases a site's data after ~7 days unused).

import { openOfflineDB, SUPPLIER_OUTCOMES_STORE } from './db';

export type OfflineHere = { ok: true; warning: string | null } | { ok: false; why: string };

export const APP_OFFLINE_OFF = 'Offline saving isn’t ready in the iPhone app yet. Add setnayan.com to your Home Screen to work offline.';
export const PRIVATE_WINDOW_OFF = 'Private window · changes need internet here. Open Setnayan in a normal window or the app to work offline.';
export const HOME_SCREEN_WARNING = 'Add Setnayan to your Home Screen so this phone keeps your offline changes.';
const NO_STORAGE = 'This browser can’t keep changes offline. Open Setnayan in a normal window to work offline.';

/** Pure: the verdict from what the browser says about itself (the guard drives this). */
export function offlineHereFrom(env: { userAgent: string; standalone: boolean; hasIdb: boolean; hasWorker: boolean; quotaBytes: number | null; writeReadsBack: boolean }): OfflineHere {
  if (/\bSetnayanApp\b/.test(env.userAgent)) return { ok: false, why: APP_OFFLINE_OFF };
  if (!env.hasIdb || !env.hasWorker) return { ok: false, why: NO_STORAGE };
  // Private windows give a tiny quota (or none) and/or drop the write — never accept a change they will delete.
  if (!env.writeReadsBack || (env.quotaBytes !== null && env.quotaBytes < 50 * 1024 * 1024)) return { ok: false, why: PRIVATE_WINDOW_OFF };
  const iosSafari = /iP(hone|ad|od)/.test(env.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(env.userAgent);
  return { ok: true, warning: iosSafari && !env.standalone ? HOME_SCREEN_WARNING : null };
}

let cached: Promise<OfflineHere> | null = null;

/** The live verdict for this browser (asked once per page). */
export function offlineHere(): Promise<OfflineHere> {
  if (!cached) cached = measure();
  return cached;
}

async function measure(): Promise<OfflineHere> {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  let quotaBytes: number | null = null;
  try {
    const est = await nav?.storage?.estimate?.();
    quotaBytes = typeof est?.quota === 'number' ? est.quota : null;
  } catch {
    quotaBytes = null;
  }
  let writeReadsBack = false;
  try {
    const db = await openOfflineDB();
    const probe = { id: `probe-${Date.now()}` };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SUPPLIER_OUTCOMES_STORE, 'readwrite');
      const st = tx.objectStore(SUPPLIER_OUTCOMES_STORE);
      st.put(probe);
      const back = st.get(probe.id);
      back.onsuccess = () => {
        writeReadsBack = (back.result as { id?: string } | undefined)?.id === probe.id;
        st.delete(probe.id);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch {
    writeReadsBack = false;
  }
  return offlineHereFrom({
    userAgent: nav?.userAgent ?? '',
    standalone: Boolean(typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (nav as Navigator & { standalone?: boolean } | null)?.standalone)),
    hasIdb: typeof indexedDB !== 'undefined',
    hasWorker: Boolean(nav && 'serviceWorker' in nav),
    quotaBytes,
    writeReadsBack,
  });
}
