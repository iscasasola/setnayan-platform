/**
 * home-segments.ts — HOME, THE ACCOUNT'S ONE PAGE, AND WHERE EACH OF ITS SECTIONS LIVES.
 *
 * Owner, 11 Nov 2026 — "One profile page approve" (v3 of `one-profile-page`, DECISION_LOG 2026-11-11 "HOME PAGE v3 APPROVED"): the bottom bar and the ☰ read **Home · Discover**; Home is the account page that used to be "Events",
 * and Events · People · Shop · Memories are SECTIONS of it (segments, `?seg=`), Shop only for an account that OWNS a
 * shop (`ownsAShop`, the 21 Oct gate). Discover stays the only place that leaves the account.
 *
 * 🔑 ONE ADDRESS PER SECTION, BUILT HERE. Every door into People or Memories — a rail row, a server action's
 * redirect, an email's button, a back link — asks this file, so a section can never be reached at two addresses that
 * drift apart. The old pages (`/dashboard/people`, `/dashboard/library`) forward here keeping every parameter
 * (`forwardToHome`), so a printed or bookmarked link still lands on the right view.
 *
 * Pure and dependency-free: the layouts, the client bar, the rail and the guards all import it.
 * 🔒 lib/home-is-the-profile.test.ts
 */

export type HomeSeg = 'events' | 'people' | 'shop' | 'memories';

/** THE ORDER (owner 2026-11-11, "THE ACCOUNT BAR ORDER", now the segments' order): Events · People · Shop · Memories. */
export const HOME_SEG_ORDER: readonly HomeSeg[] = ['events', 'people', 'shop', 'memories'];

export const HOME_SEG_LABEL: Record<HomeSeg, string> = {
  events: 'Events',
  people: 'People',
  shop: 'Shop',
  memories: 'Memories',
};

/**
 * Home itself. `?hub=1` stays for the reason the Events tab carried it: a couple with one upcoming event is otherwise
 * bounced straight into it by the board's auto-jump (`landingJumpTarget`), and "Home" would land inside the wedding
 * they were leaving.
 */
export const HOME_HREF = '/dashboard?hub=1';

/** The page the sections live on. */
export const HOME_PATH = '/dashboard';

/** The sections this account's Home draws, in order. Shop only for an OWNER (the 21 Oct gate, unchanged). */
export function homeSegments({ ownsShop }: { ownsShop: boolean }): HomeSeg[] {
  return HOME_SEG_ORDER.filter((s) => s !== 'shop' || ownsShop);
}

/** Which section a `?seg=` asks for. Anything unknown — or Shop for an account that owns none — is Events. */
export function resolveHomeSeg(raw: string | string[] | undefined | null, { ownsShop }: { ownsShop: boolean }): HomeSeg {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return homeSegments({ ownsShop }).find((s) => s === v) ?? 'events';
}

type Extra = Readonly<Record<string, string | null | undefined>>;

/**
 * The address of one section, with that section's own parameters (`view`, `tab`, `person`, `error`…) after it.
 * Events is Home itself (`?hub=1`); the others never run the board, so they need no `hub`.
 */
export function homeSegHref(seg: HomeSeg, extra: Extra = {}): string {
  const qs = new URLSearchParams(seg === 'events' ? { hub: '1' } : { seg });
  for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined && v !== '' && k !== 'seg') qs.set(k, v);
  return `${HOME_PATH}?${qs.toString()}`;
}

/** People on Home — the address every People door uses. */
export const PEOPLE_HOME = homeSegHref('people');
/** Memories on Home — the address every Memories door uses. */
export const MEMORIES_HOME = homeSegHref('memories');

/** A People view on Home (`requests` · `connected` · `following` · `followers` · `alaga` · `samahan`). */
export function peopleHomeHref(extra: Extra = {}): string {
  return homeSegHref('people', extra);
}

/** A Memories lens or kept view on Home (`?tab=albums|challenges|editorials|vendors|…`). */
export function memoriesHomeHref(extra: Extra = {}): string {
  return homeSegHref('memories', extra);
}

/**
 * Where an OLD page forwards to — the section on Home with EVERY parameter it was given, so a deep link
 * (`/dashboard/people?view=requests&error=fence`, `/dashboard/library?tab=vendors`) opens the same view in its new
 * place. Repeated keys keep their first value; nothing is dropped.
 */
export function forwardToHome(seg: Exclude<HomeSeg, 'events'>, sp: Readonly<Record<string, string | string[] | undefined>>): string {
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const one = Array.isArray(v) ? v[0] : v;
    if (typeof one === 'string' && one.length > 0) extra[k] = one;
  }
  return homeSegHref(seg, extra);
}

/** The key the bar remembers the last section under, so Discover → Home comes back to it (T5: other tab = last state). */
export const HOME_LAST_SEG_KEY = 'sn-home-last-seg';
