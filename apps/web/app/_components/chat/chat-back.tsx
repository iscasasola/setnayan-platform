'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

/**
 * ‹ RETURNS TO THE LIST, IN PLACE (owner 2026-10-28: tap an event → its chat full screen, ‹ back to the list). The ‹
 * itself is the shared `BackButton` (`variant="chat"`, its link from `lib/page-home.ts`); this wraps it. When this tab
 * came to the page FROM a list (marked by {@link ChatOriginMark}), the press is the browser's own back — the list
 * comes back where it was scrolled. Otherwise (a deep link, a notification) the link goes to the page's home.
 *
 * 👥 A GROUP'S ‹ TOO (owner 2026-10-29, live in the iPhone app: *"back from a group. it returns but not from the
 * previous screen where we were on people and scrolled down to groups. it returned to people with just the groups."*).
 * The group page wraps its ‹ in this, and People + Notifications mount the mark — so ‹ from a group brings back the
 * People list, its view and its scroll, instead of jumping to People › Groups.
 *
 * 🔑 THE MARK BELONGS TO ONE DOCUMENT. It carries `performance.timeOrigin`, so a list seen BEFORE a full page load (a
 * push notification or a deep link opens the app with `location.assign` — `native-bridge.tsx`; a reload; a new tab)
 * does not count: the browser's back there would leave the app, or land somewhere the person never came from. And the
 * page this document LANDED on has nothing of ours behind it, so it never goes back either — the link does.
 * 🔒 lib/groups-return-to-people.test.ts · lib/the-chat-is-messenger-shaped.test.ts
 */
const KEY = 'sn-chat-origin';

type Mark = { at: string; doc: string };

/** This document's identity — the same number for every page shown in it, a new one after any full load. */
function thisDocument(): string {
  return String(window.performance.timeOrigin);
}

/** The address this document first loaded — the one page with nothing of ours behind it. */
function landedOn(): string | null {
  const nav = window.performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (!nav?.name) return null;
  const u = new URL(nav.name);
  return u.pathname + u.search;
}

/** True when ‹ may be the browser's back: a list was shown earlier IN THIS DOCUMENT and this is not its landing page. */
export function cameFromAList(raw: string | null, here: string, doc: string, landing: string | null, depth: number): boolean {
  if (!raw || depth <= 1) return false;
  let mark: Mark | null = null;
  try {
    mark = JSON.parse(raw) as Mark;
  } catch {
    return false;
  }
  if (!mark || typeof mark.at !== 'string' || mark.doc !== doc) return false;
  return landing !== here;
}

export function ReturnInPlace({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <span
      className="contents"
      onClickCapture={(e) => {
        let raw: string | null = null;
        try {
          raw = window.sessionStorage.getItem(KEY);
        } catch {
          raw = null;
        }
        const here = window.location.pathname + window.location.search;
        if (cameFromAList(raw, here, thisDocument(), landedOn(), window.history.length)) {
          // Captured before the link's own handler, which honours a prevented default and does not navigate.
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </span>
  );
}

/** Mounted by a list: "this tab is on a list now" — so the next page's ‹ can go back to it in place. */
export function ChatOriginMark() {
  useEffect(() => {
    try {
      const mark: Mark = { at: window.location.pathname + window.location.search, doc: thisDocument() };
      window.sessionStorage.setItem(KEY, JSON.stringify(mark));
    } catch {
      /* storage refused — ‹ is the plain link */
    }
  }, []);
  return null;
}
