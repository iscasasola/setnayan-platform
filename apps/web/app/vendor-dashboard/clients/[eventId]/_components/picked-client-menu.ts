/**
 * 🗂 THE PICKED CLIENT'S MENU — SEVEN TABS (owner 18 Nov 2026, DECISION_LOG "THE CLIENT PAGE GOES TO SEVEN TABS — BOTH
 * SIDES"; drawing Q37bc7Bf v12): **Chat · Details · Book & Budget · Schedule · Files · Hub · Report**. Hub shows only
 * once booked, sixth so the first five never move when it appears. The page OPENS ON CHAT (owner 11 Nov).
 *
 *   · **Book & Budget** is the id `quote`: the shipped Quotation body and the shipped Payment body on ONE page (owner:
 *     *"we have agreed to integrate quotation and payments together"*). Before booking, the quote only; booked, the
 *     payments first (`#payments`), then the locked quote.
 *   · **Details** holds Forms (`#forms`, the two groups) and Decisions (`#decisions`) after their info.
 *
 * Supersedes the 11 Nov nine-tab order (Chat · Details · Quotation · Payment · Forms · Schedule · Files · Hub · Report).
 * The chat's (+) rows (`lib/chat-plus.ts`) follow this same order, and `lib/chat-plus.test.ts` derives the (+)'s order
 * from THIS list so the two can never drift.
 *
 * Every page is a body under `clients/[eventId]/_pages/<page>.tsx`, rendered by the ONE route
 * `/vendor-dashboard/clients/[eventId]` and switched on the client with `history.replaceState(?tab=)` — a page
 * switch costs no request (the Vercel route ceiling is why it is one segment, not seven routes).
 *
 * `pickedPageOf` is the switch from any `?tab=` a door has ever written to the page it means — and `pickedAnchorOf`
 * the part of it to land on. Every inbound link keeps working (notifications, the Calendar, chat cards):
 *   • `payments` / `payment` → Book & Budget at `#payments` · `quotation` → Book & Budget
 *   • `forms` / `form`       → Details at `#forms`
 *   • `script`   → Schedule (the Script is a fold at the END of Schedule, `#script` — 7 Nov ruling)
 *   • `call`     → Chat (the chat has no calls)
 *   • `overview` → Details (the flag-off card's word for the brief)
 *   • `activity` → Report (the activity feed + private notes live on Report)
 *   • anything unknown or missing → Chat (the page's first tab, owner 11 Nov)
 */
import { BOOK_AND_BUDGET_LABEL } from '@/lib/book-and-budget';
import {
  PICKED_CLIENT_PAGE_IDS,
  type PickedClientPage,
} from '@/lib/upcoming-schedule-door';

export type { PickedClientPage };

export type PickedClientMenuEntry = {
  id: PickedClientPage;
  label: string;
  /** Shown only once the client has booked (v113). */
  bookedOnly: boolean;
};

export { BOOK_AND_BUDGET_LABEL };

export const PICKED_CLIENT_PAGES: readonly PickedClientMenuEntry[] = [
  { id: 'chat', label: 'Chat', bookedOnly: false },
  { id: 'details', label: 'Details', bookedOnly: false },
  { id: 'quote', label: BOOK_AND_BUDGET_LABEL, bookedOnly: false },
  { id: 'schedule', label: 'Schedule', bookedOnly: false },
  { id: 'files', label: 'Files', bookedOnly: false },
  { id: 'hub', label: 'Hub', bookedOnly: true },
  { id: 'report', label: 'Report', bookedOnly: false },
] as const;

/** The ids that are no longer tabs (18 Nov) — still valid door ids, each landing on its part of a tab. */
export const FOLDED_PAGE_ANCHORS: Readonly<Partial<Record<PickedClientPage, { page: PickedClientPage; anchor: string }>>> = {
  payments: { page: 'quote', anchor: 'payments' },
  forms: { page: 'details', anchor: 'forms' },
};

/** The tab's word for a page — the (+) sheet labels its groups with these, so it reads as the menu's mirror. */
export function pickedPageLabel(id: PickedClientPage): string {
  return PICKED_CLIENT_PAGES.find((p) => p.id === id)?.label ?? id;
}

/** Legacy `?tab=` ids every door has ever written, and the page each now means. */
export const LEGACY_PAGE_ALIASES: Readonly<Record<string, PickedClientPage>> = {
  script: 'schedule',
  call: 'chat',
  overview: 'details',
  activity: 'report',
  // The prototype's own words, in case a door copies them.
  quotation: 'quote',
  payment: 'quote',
  form: 'details',
  payments: 'quote',
  forms: 'details',
  book: 'quote',
  budget: 'quote',
  decisions: 'details',
};

/** The part of its page a raw `?tab=` lands on (`#payments`, `#forms`), or null for the page's top. */
export function pickedAnchorOf(rawTab: string | null | undefined): string | null {
  const t = (rawTab ?? '').trim().toLowerCase();
  if (t === 'payments' || t === 'payment') return 'payments';
  if (t === 'forms' || t === 'form') return 'forms';
  if (t === 'decisions') return 'decisions';
  if (t === 'script') return SCRIPT_FOLD_ID;
  return null;
}

/** The page the picked client opens on when no door names one (owner 11 Nov: the first tab is Chat). */
export const DEFAULT_PICKED_PAGE: PickedClientPage = 'chat';

/** The page a raw `?tab=` value opens. Pure, total: every string resolves. */
export function pickedPageOf(rawTab: string | null | undefined): PickedClientPage {
  if (!rawTab) return DEFAULT_PICKED_PAGE;
  const t = rawTab.trim().toLowerCase();
  if (Object.hasOwn(LEGACY_PAGE_ALIASES, t)) return LEGACY_PAGE_ALIASES[t]!;
  if ((PICKED_CLIENT_PAGE_IDS as readonly string[]).includes(t)) return t as PickedClientPage;
  return DEFAULT_PICKED_PAGE;
}

/** The page a raw id NAMES — a page id or a known alias — or null (the shell's `pageOf`: an unknown hash is an anchor). */
export function pickedPageNamed(raw: string): PickedClientPage | null {
  const t = raw.trim().toLowerCase();
  if (!Object.hasOwn(LEGACY_PAGE_ALIASES, t) && !(PICKED_CLIENT_PAGE_IDS as readonly string[]).includes(t)) return null;
  return pickedPageOf(t);
}

/** The menu a client of this stage sees. */
export function pickedMenuFor(isBooked: boolean): PickedClientMenuEntry[] {
  return PICKED_CLIENT_PAGES.filter((p) => isBooked || !p.bookedOnly);
}

/**
 * The page actually drawn: the asked page if this client's menu has it. Payment and Forms are parts of Book & Budget
 * and Details now (`pickedPageOf` already folds them); asked for Hub before booking, the default page (Chat).
 */
export function visiblePickedPage(rawTab: string | null | undefined, isBooked: boolean): PickedClientPage {
  const p = pickedPageOf(rawTab);
  if (pickedMenuFor(isBooked).some((e) => e.id === p)) return p;
  return DEFAULT_PICKED_PAGE;
}

/** `?tab=script` lands on Schedule scrolled to the Script fold. */
export const SCRIPT_FOLD_ID = 'script';
export function wantsScriptFold(rawTab: string | null | undefined): boolean {
  return (rawTab ?? '').trim().toLowerCase() === 'script';
}
