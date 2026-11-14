/**
 * admin-mode.ts — the admin's two modes, FOCUS and FULL (owner approved 14 Nov 2026: *"admin focus and full
 * approved"* — DECISION_LOG "ADMIN FOCUS | FULL — APPROVED (v6)" + "THE SIX CALLS ANSWERED"; prototype
 * https://claude.ai/artifact/M2EWM32A9Y9LrJBsYXgagq, specs `02028b1a`).
 *
 *   FOCUS — "N things need you" (Reply · Fix · Refresh) + the ask box. No bottom nav. Where the admin opens.
 *   FULL  — the shipped five tabs, unchanged, each title its ▾ view picker, the ask box above the tabs.
 *
 * The mode is the person's own choice, kept in a cookie so the server draws the right shell on the first byte (no
 * flash of the other mode). No database row, no server action. Pure: no React, no request.
 */

export type AdminMode = 'focus' | 'full';

export const ADMIN_MODE_COOKIE = 'sn_admin_mode';

/** A year — the choice is a habit, not a session. */
export const ADMIN_MODE_MAX_AGE = 60 * 60 * 24 * 365;

/** The cookie as a mode. Anything that is not exactly "full" is Focus: the admin OPENS in Focus (ruling (1)). */
export function readAdminMode(raw: string | null | undefined): AdminMode {
  return raw === 'full' ? 'full' : 'focus';
}

/** The three kinds of thing Focus asks of the admin, in the drawing's order and words. */
export type FocusKind = 'reply' | 'fix' | 'refresh';

export const FOCUS_KIND_LABEL: Readonly<Record<FocusKind, string>> = {
  reply: 'Reply',
  fix: 'Fix',
  refresh: 'Refresh',
};

/**
 * Which queues are a FIX (something broke and needs mending) rather than a REPLY (somebody asked). Everything else
 * a person sent is a reply. REFRESH (a list that drifted from the catalogue) has no measured source in the app yet,
 * so no queue maps to it and Focus draws no Refresh heading — a heading over nothing would say a check ran that did not.
 */
const FIX_QUEUES: ReadonlySet<string> = new Set(['email-bounces', 'problems', 'social-queue']);

export function focusKindOf(queueKey: string): FocusKind {
  return FIX_QUEUES.has(queueKey) ? 'fix' : 'reply';
}

/** "1 thing needs you" · "5 things need you" · "Nothing needs you". */
export function needsYouLine(n: number): string {
  if (n <= 0) return 'Nothing needs you';
  return `${n} ${n === 1 ? 'thing needs' : 'things need'} you`;
}
