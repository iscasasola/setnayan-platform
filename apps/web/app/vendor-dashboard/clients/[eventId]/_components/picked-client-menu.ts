/**
 * 🗂 THE PICKED CLIENT'S MENU — nine pages, one dynamic segment (THE ONE BUILD, 8 Nov 2026 · prototype v113).
 *
 * Owner-approved order: Details · Chat · Schedule · Quotation · Payment · Forms · Files · Hub · Report.
 * Every page is a body under `clients/[eventId]/_pages/<page>.tsx`, rendered by the ONE route
 * `/vendor-dashboard/clients/[eventId]` and switched on the client with `history.replaceState(?tab=)` — a page
 * switch costs no request (the Vercel route ceiling is why it is one segment, not nine routes).
 *
 * `pickedPageOf` is the switch from any `?tab=` a door has ever written to the page it means:
 *   • `script`   → Schedule (the Script is a fold at the END of Schedule, `#script` — 7 Nov ruling)
 *   • `call`     → Chat (the chat has no calls)
 *   • `overview` → Details (the flag-off card's word for the brief)
 *   • `activity` → Report (the activity feed + private notes live on Report)
 *   • anything unknown or missing → Details
 *
 * Payment and Hub show only for a BOOKED client (prototype v113 `miniKeys`: an unbooked client has no money
 * schedule and no Hub to open); their ids still resolve so an old door never 404s — it lands on Details.
 */
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

export const PICKED_CLIENT_PAGES: readonly PickedClientMenuEntry[] = [
  { id: 'details', label: 'Details', bookedOnly: false },
  { id: 'chat', label: 'Chat', bookedOnly: false },
  { id: 'schedule', label: 'Schedule', bookedOnly: false },
  { id: 'quote', label: 'Quotation', bookedOnly: false },
  { id: 'payments', label: 'Payment', bookedOnly: true },
  { id: 'forms', label: 'Forms', bookedOnly: false },
  { id: 'files', label: 'Files', bookedOnly: false },
  { id: 'hub', label: 'Hub', bookedOnly: true },
  { id: 'report', label: 'Report', bookedOnly: false },
] as const;

/** Legacy `?tab=` ids every door has ever written, and the page each now means. */
export const LEGACY_PAGE_ALIASES: Readonly<Record<string, PickedClientPage>> = {
  script: 'schedule',
  call: 'chat',
  overview: 'details',
  activity: 'report',
  // The prototype's own words, in case a door copies them.
  quotation: 'quote',
  payment: 'payments',
  form: 'forms',
};

export const DEFAULT_PICKED_PAGE: PickedClientPage = 'details';

/** The page a raw `?tab=` value opens. Pure, total: every string resolves. */
export function pickedPageOf(rawTab: string | null | undefined): PickedClientPage {
  if (!rawTab) return DEFAULT_PICKED_PAGE;
  const t = rawTab.trim().toLowerCase();
  if ((PICKED_CLIENT_PAGE_IDS as readonly string[]).includes(t)) return t as PickedClientPage;
  return LEGACY_PAGE_ALIASES[t] ?? DEFAULT_PICKED_PAGE;
}

/** The menu a client of this stage sees. */
export function pickedMenuFor(isBooked: boolean): PickedClientMenuEntry[] {
  return PICKED_CLIENT_PAGES.filter((p) => isBooked || !p.bookedOnly);
}

/**
 * The page actually drawn: the asked page if this client's menu has it, else Details (an unbooked client asked for
 * Payment or Hub lands on Details rather than a page that is not in their menu).
 */
export function visiblePickedPage(rawTab: string | null | undefined, isBooked: boolean): PickedClientPage {
  const p = pickedPageOf(rawTab);
  return pickedMenuFor(isBooked).some((e) => e.id === p) ? p : DEFAULT_PICKED_PAGE;
}

/** `?tab=script` lands on Schedule scrolled to the Script fold. */
export const SCRIPT_FOLD_ID = 'script';
export function wantsScriptFold(rawTab: string | null | undefined): boolean {
  return (rawTab ?? '').trim().toLowerCase() === 'script';
}
