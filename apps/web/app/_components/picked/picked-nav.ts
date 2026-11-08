'use client';

/**
 * 🗂 Switch a picked page from inside it (a ⚙ row, a "See the quote →") without a request — the same `replaceState`
 * switch the menu uses. Provided by the ONE `PickedShell` (`./picked-shell.tsx`) on both sides; outside it the value is
 * null and the caller falls back to a plain link. Each side narrows the page ids (`picked-client-nav.tsx` on the
 * supplier's).
 */
import { createContext } from 'react';

export type PickedShellNav = { select: (page: string) => void; page: string };

export const PickedNavContext = createContext<PickedShellNav | null>(null);

/**
 * ⌨ The page menu's arrow keys (WAI-ARIA tabs): → / ← step ONE page by its own id, wrapping round; Home / End jump to
 * the first / last. Carried over from the retired two-sided workspace strip (controller, 2026-10-08: the handler was
 * once handed the tab's PLACE and skipped a page) — the rule is given an id, never an index. Any other key: null, left
 * alone. Guard: `lib/workspace-tabs-step-one-at-a-time.test.ts`.
 */
export function nextPanelTabId(panelIds: readonly string[], currentId: string, key: string): string | null {
  if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return null;
  if (panelIds.length === 0) return null;
  const at = panelIds.indexOf(currentId);
  if (key === 'Home' || at < 0) return panelIds[0] ?? null;
  if (key === 'End') return panelIds[panelIds.length - 1] ?? null;
  const step = key === 'ArrowRight' ? 1 : -1;
  return panelIds[(at + step + panelIds.length) % panelIds.length] ?? null;
}

/**
 * 📌 THE PICKED HEAD'S ACTION SLOT (v8.3, approved 9 Nov: title · 📞 · 🎥 · 📎 · ⚙ · ✕). The shell draws an empty slot in
 * its pinned row, between the title and ⚙, and hands it down; the page on show (Chat) portals its own head actions
 * into it — the booked calls and the 📎 — so they sit in the ONE head row and leave the chat's host strip.
 * `null` outside a picked shell (the routed thread pages keep their own head).
 * 🔒 lib/the-picked-head-carries-the-chat-actions.test.ts
 */
export const PickedHeadContext = createContext<HTMLElement | null>(null);
