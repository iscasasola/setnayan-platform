/**
 * lib/basic-setup-gate.ts — 🧰 BASIC SETUP FIRST (owner, verbatim, 2026-10-29: *"I want her to create her address and
 * basic shop information. Meaning we want them to complete the basic setup of their shop. Which is a must before they
 * can do anything."*). Pure — no I/O, no clock.
 *
 * ONE PLACE DECIDES. The supplier layout asks `basicSetupHoldOf` once (from the shop row it already read — no new
 * request) and hands the answer to `BasicSetupHold`, which asks `pageIsHeld` for the address on screen. No page carries
 * its own copy of the rule.
 *
 * WHAT "BASIC SETUP" IS: the shipped `businessProfileChecklist` — logo · shop name · owner · address · contact number ·
 * email · EST · services covered (· a venue's room size). Not a second list.
 *
 * WHO IS HELD: the OWNER or ADMIN (`canManageVendor`) of a shop NOT YET VERIFIED — the people who can fill it in,
 * while Today still draws the six setup steps "Back to setup" returns to. A helper (agent ·
 * viewer) cannot write those fields, so holding one would be a dead end; a coordinator-only account has no shop at all
 * and never reaches this tree. A shop row that was not fully read (`legacy_read`, or no row) holds NOBODY — a read
 * that did not happen never locks anyone out.
 *
 * NEVER A DEAD END — what stays open while held:
 *   · Today (`/vendor-dashboard`, exact) — the six setup steps are there, in place;
 *   · Your details (`/profile`) and documents (`/verify`) — where the basic setup is done;
 *   · Events you run (`/events`) — a coordinator or co-host must still run the event before her shop is complete
 *     (the event itself, `/dashboard/<id>`, is outside this tree and never held);
 *   · chat — Messages (`/messages/…`) and Customers' People list (its default segment; Money and Dates are held);
 *   · the account — Settings, Notifications, Help, Helpers (`/team`), Plan (`/subscription`), switching shop
 *     (`/switch-shop`), and sign-out (the avatar sheet in the top bar, which this never wraps);
 *   · and the page where a missing step is DONE: "Services covered" is set on the shop's Coverage
 *     (`/shop`, `/services` redirects there) — so while services are missing those two are open too.
 */
import type { BusinessProfileItem } from './vendor-profile';

export const BASIC_SETUP_HOME = '/vendor-dashboard';

/** Open while held — exact Today, and every page under each of these. */
export const OPEN_WHILE_SETTING_UP: readonly string[] = [
  '/vendor-dashboard/profile',
  '/vendor-dashboard/verify',
  '/vendor-dashboard/events',
  '/vendor-dashboard/messages',
  '/vendor-dashboard/customers',
  '/vendor-dashboard/notifications',
  '/vendor-dashboard/settings',
  '/vendor-dashboard/help',
  '/vendor-dashboard/team',
  '/vendor-dashboard/subscription',
  '/vendor-dashboard/switch-shop',
];

/** Customers' segments that are the shop's business, not its chat — held. */
const HELD_CUSTOMER_SEGMENTS: ReadonlySet<string> = new Set(['money', 'dates']);

/** The page where a missing checklist step is done — open while that step is missing. */
const STEP_HOMES: Readonly<Record<string, readonly string[]>> = {
  services: ['/vendor-dashboard/shop', '/vendor-dashboard/services'],
};

export type BasicSetupHold = {
  /** The checklist keys still missing (for the step homes, and the one line). */
  missing: string[];
  /** The labels still missing — "Logo · Company address". */
  missingLabels: string[];
};

/**
 * Is this shop held on its basic setup? Null = not held (complete, a helper, or not measured). `checklist` is the
 * shipped `businessProfileChecklist(profile)` — the layout computes it from the row it already read; this file stays
 * free of server imports so the client hold can ask `pageIsHeld`.
 */
export function basicSetupHoldOf(input: {
  /** The shop row was read in full (not absent, not the legacy fallback). */
  measured: boolean;
  /** Owner or admin (`canManageVendor`). */
  canManage: boolean;
  /**
   * The shop is VERIFIED — already approved, and Today no longer draws the six setup steps for it, so "Back to setup"
   * would land nowhere. A verified shop that later misses a field is never held (Your details still asks for it).
   */
  verified: boolean;
  checklist: { items: ReadonlyArray<BusinessProfileItem>; complete: boolean } | null;
}): BasicSetupHold | null {
  if (!input.measured || !input.canManage || input.verified || !input.checklist || input.checklist.complete) return null;
  const left = input.checklist.items.filter((i) => !i.ok);
  if (left.length === 0) return null;
  return { missing: left.map((i) => i.key), missingLabels: left.map((i) => i.label) };
}

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/**
 * Is THIS address held? `seg` is Customers' `?seg=` (absent = its default, People).
 */
export function pageIsHeld(pathname: string, hold: BasicSetupHold | null, seg?: string | null): boolean {
  if (!hold) return false;
  const path = pathname.replace(/\/+$/, '') || '/';
  if (!under(path, BASIC_SETUP_HOME)) return false; // outside the supplier tree (the event itself) — never held
  if (path === BASIC_SETUP_HOME) return false;
  for (const key of hold.missing) {
    if ((STEP_HOMES[key] ?? []).some((b) => under(path, b))) return false;
  }
  if (under(path, '/vendor-dashboard/customers')) return HELD_CUSTOMER_SEGMENTS.has(seg ?? '');
  return !OPEN_WHILE_SETTING_UP.some((b) => under(path, b));
}

/** The one short line under the title — what is left, by its own words. */
export function basicSetupLine(hold: BasicSetupHold): string {
  const n = hold.missingLabels.length;
  if (n === 0) return 'A few details are left.';
  if (n <= 2) return `Left: ${hold.missingLabels.join(' · ')}.`;
  return `${n} details are left — ${hold.missingLabels.slice(0, 2).join(' · ')} and more.`;
}
