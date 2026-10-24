'use client';

/**
 * open-event-hub.ts — "View Event Hub" opens the couple's PUBLIC page without leaving Home (owner 2026-10-24: *"view
 * event hub opens to a new browser if browser based"*).
 *
 *   · In a web browser: a NEW TAB (`noopener`), so Home stays open.
 *   · In the app shell: an in-app browser sheet (Done returns to Home) — that helper is being built on its own branch
 *     (`rd/app-in-app-browser`, planned `apps/web/lib/open-external.ts` → `openEventHub(url)`). Until it lands this is a
 *     LOCAL stand-in with the SAME name and signature, so the switch is one import line. It does not add the Capacitor
 *     plugin and never opens the system browser on its own.
 *
 * The link it is called from keeps `target="_blank" rel="noopener noreferrer"` too, so with no script (or a refused
 * popup) the browser still opens a new tab (`home-hub-view-opens-a-new-tab.test.ts`).
 */
export function openEventHub(url: string): void {
  if (typeof window === 'undefined') return;
  window.open(url, '_blank', 'noopener');
}
