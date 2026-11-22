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
 * 🔎 THE HEAD'S SEARCH DOOR → THE CHAT'S OWN SEARCH (Unichat part G for part D, 20 Nov 2026; drawing UNICHAT-LIVE: "the
 * magnifier in the header"). The search itself lives in the chat (`lib/chat-search.ts`, part D — the box, the count, the
 * steps); the header is the shell. The shell's magnifier (`headSearch`) says so with this event on `window`, fired
 * INSIDE the tap, so the chat can open its box and focus it in the same gesture (a phone raises its keyboard only
 * from one). `detail.pickedId` is the shell's `pickedId` — a chat under another picked screen ignores it.
 *
 * 🔌 THE SLOT: nothing listens yet on this branch. The chat's side is one effect in `chat-message-stream.tsx` (part D's
 * file): `window.addEventListener(PICKED_CHAT_SEARCH_EVENT, () => openSearch())`. Until that lands no side turns
 * `headSearch` on — a magnifier that opens nothing would be a dead control.
 */
export const PICKED_CHAT_SEARCH_EVENT = 'sn:picked-chat-search';

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

/**
 * 📅 THE PICKED HEAD'S LINE UNDER THE TITLE (DECISION_LOG 2026-11-16 CHAT-09 — "date + Free sit under the title in the
 * head; the separate date row goes"). The shell draws an empty line under its title and hands it down; the supplier's
 * Chat portals the couple's date and the day's answer into it (`PickedHeadLine`). Empty = nothing drawn (`empty:hidden`),
 * so every other page keeps the one-line head. `null` outside a picked shell.
 */
export const PickedHeadLineContext = createContext<HTMLElement | null>(null);

/**
 * 🙈 THE PAGE UNDER A RISEN ONE IS NOT ON SHOW (19 Nov 2026 — the client page is one chat that holds everything). With
 * the chat as the page's home it stays MOUNTED while Book & Budget, Schedule or Details is risen over it, so "mounted"
 * no longer means "the reader is looking at it". True while a page is risen over the body; a part that acts on being
 * SEEN (the chat's mark-as-read) waits for false. False everywhere else, and outside a picked shell.
 */
export const PickedCoveredContext = createContext(false);
