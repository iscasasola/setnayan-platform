/**
 * event-pin-places.ts — 📌 WHERE AM I, FOR THE COUPLE'S ONE PINNED ROW (design template, owner-approved 14 Nov 2026,
 * rule 1: every page wears the app's ONE pinned row at the top — `Page · View ▾` — and no visible title restating the
 * menu). The supplier and admin get theirs from their LAYOUTS; this is the couple event layout's half
 * (`event-pinned-row.tsx`, mounted ONCE in `../layout.tsx`).
 *
 * 🔑 NOT A SECOND LIST OF THE COUPLE'S PAGES. Every page here comes from the ONE event menu tree
 * (`buildEventMenuSections` in `lib/customer-menu.ts`, through `buildCustomerNavGroups`, the rail's own projection):
 *   · the PAGE (left of the ·) is the menu row that holds where you stand — resolved by the rail's own resolver,
 *     `activeRailKey` over `eventRailMatchRows`, the SAME rows the rail lights — so the row and the rail can never
 *     disagree about where you are;
 *   · the VIEWS (the ▾) are that row's door plus the pages it HOLDS (its `alsoMatch` claims), named by the product's
 *     own name (`studioRows`, the catalogue's words) or — for the few fixed pages a row holds — by
 *     `EVENT_HELD_PAGE_WORDS` below, which only NAMES paths the tree already claims. The guard fails if the tree claims
 *     a page with no word, or a word names a path the tree never claims.
 *
 * ⚖ A page the tree does not hold resolves to `null`, and the row draws NOTHING there — never a guessed name (the same
 * rule as `supplierPageMenuOf`: "a ▾ that names the wrong place is worse than none").
 *
 * 🏠 THE EXCEPTIONS (`EVENT_OWN_ROW`): the event Home keeps its cover band (the template's one deliberate exception), and
 * the pages that ALREADY draw their own pinned/sticky first row are skipped here — as DATA, not page edits — so no page
 * wears two rows. 🔒 app/dashboard/[eventId]/the-event-wears-one-pinned-row.test.ts
 *
 * Neutral module (no 'use client'): the layout (server) builds the table, the row (client) resolves it. Everything it
 * returns is plain data — no icon components cross the boundary.
 */
import { activeRailKey, type RailMatchRow } from '@/app/_components/frontdoor/rail-active';
import { buildCustomerNavGroups } from './customer-nav-config';
import { eventRailMatchRows, type EventRailInputs } from './event-rail-match-rows';
import { STUDIO_ABSORBED } from '@/lib/customer-menu';

/**
 * The words for the FIXED pages a menu row holds (its `alsoMatch` claims that are not a product page), keyed by the
 * path under `/dashboard/<id>/`. Each is the word the app already uses for that page (Home › Budget, Home › Schedule,
 * Guests › Seats, the page's own masthead title).
 */
export const EVENT_HELD_PAGE_WORDS: Readonly<Record<string, string>> = {
  budget: 'Budget',
  schedule: 'Schedule',
  hosts: 'Your access',
  'event-qr': 'Event QR',
  people: 'Who is here',
  seating: 'Seats',
  story: 'Story Maker',
  // The page's own section heading — not "Galleries" (owner 2026-10-23: no "gallery" word in the UI), and not its
  // masthead "Memories", which the Memories row's own page already carries in the same ▾.
  galleries: 'More from your day',
};

/**
 * Claims that are a FAMILY, not a page — no `page.tsx` answers them, so they are never offered as a view (a ▾ row that
 * opens a 404 is a fake door). `studio` is Home's claim on every product page under `/studio/…`; each product that IS a
 * page is named by its own catalogue row.
 */
export const EVENT_FAMILY_CLAIMS: readonly string[] = ['studio'];

/**
 * 🏠 The pages that keep their OWN first row (path under `/dashboard/<id>/`; `''` is the event Home). `exact` = that
 * page only; `prefix` = the page and everything under it. One reason each:
 */
export const EVENT_OWN_ROW: { readonly exact: readonly string[]; readonly prefix: readonly string[] } = {
  exact: [
    '', //            Home — its cover band (`home-cover-band.tsx`) is the template's deliberate exception.
    'guests', //      Guests — `guests-screen.tsx` pins `Guests · List ▾ · ✓ ✕ ? · ⚙` (the-pinned-row-is-one-row).
    'vendors', //     Suppliers — `services-takeover.tsx` pins `Find · Build · Booked ▾ · ⚙`.
    'schedule', //    Schedule — `schedule-one-line.tsx` pins its `Event Day ▾` one line.
    'memories', //    Memories — `event-memories-gallery.tsx` draws its `Albums ▾ · ⚙` first row.
    'launch', //      Hub — the Maker's own shell (`maker-shell.tsx`) and its Page ▾.
    'details', //     Event Details — its sticky record bar (name · Undo · Apply).
    'seating', //     Seat plan — the seating editor's own chrome (`seat-plan-phone.tsx`).
  ],
  prefix: [
    'website/editor', //   the Maker's editor shell (`editor-shell.tsx`).
    'seating/lab', //      the 3D room's own tools.
    'studio/mood-board', // the Mood Board's sticky tab strip pins at the top.
    'website/our-story', // the Love Story book's sticky chapter strip pins at the top.
  ],
};

export type EventPinView = {
  /** The view's address (with any query the product's door carries) — where a pick goes. */
  href: string;
  /** The path it answers (no query). */
  path: string;
  label: string;
  /** The row's own door, matched exactly (Home's door is every event page's prefix). */
  exact?: true;
};
export type EventPinPillar = { key: string; label: string; views: EventPinView[] };
export type EventPinTable = { base: string; matchRows: RailMatchRow[]; pillars: EventPinPillar[] };

const pathOf = (href: string) => href.split('#')[0]!.split('?')[0]!;

/** Builds the table from the SAME inputs the rail is built from (`eventRailInputs` in the layout). */
export function eventPinTable(inputs: EventRailInputs): EventPinTable {
  const { eventId } = inputs;
  // The rail's own inputs — the same object `eventRailMatchRows` is handed (the tree ignores what it does not read).
  const opts: Parameters<typeof buildCustomerNavGroups>[1] = inputs;
  const base = `/dashboard/${eventId}`;
  const matchRows = eventRailMatchRows(inputs);
  const lit = new Set(matchRows.map((r) => r.key));

  // A product's pages — its own door and the routes another row absorbed — carry the product's catalogue name.
  const productName = new Map<string, { name: string; href: string }>();
  for (const t of inputs.studioRows ?? []) {
    const own = pathOf(t.href);
    productName.set(own, { name: t.name, href: t.href });
    for (const r of STUDIO_ABSORBED[t.key]?.routes(base) ?? []) productName.set(r, { name: t.name, href: r });
  }

  const pillars: EventPinPillar[] = buildCustomerNavGroups(eventId, opts)
    .flatMap((g) => g.items)
    .filter((item) => lit.has(item.key))
    .map((item) => {
      const door = pathOf(item.href);
      const views: EventPinView[] = [
        { href: item.href, path: door, label: item.label, ...(item.matchPrefix === '__home__' ? { exact: true as const } : {}) },
      ];
      const seen = new Set([door]);
      for (const claim of item.alsoMatch ?? []) {
        const path = pathOf(claim);
        if (seen.has(path)) continue;
        const product = productName.get(path);
        const word = EVENT_HELD_PAGE_WORDS[path.slice(base.length + 1)];
        if (!product && !word) continue;
        seen.add(path);
        views.push({ href: product?.href ?? path, path, label: product?.name ?? word! });
      }
      return { key: item.key, label: item.label, views };
    });

  return { base, matchRows, pillars };
}

/** Does this page keep its own first row (or is it the Home)? */
export function eventPageKeepsItsOwnRow(base: string, pathname: string): boolean {
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return false;
  const rest = pathname === base ? '' : pathname.slice(base.length + 1).replace(/\/+$/, '');
  if (EVENT_OWN_ROW.exact.includes(rest)) return true;
  return EVENT_OWN_ROW.prefix.some((p) => rest === p || rest.startsWith(`${p}/`));
}

export type EventPinPlace = { pillar: EventPinPillar; view: EventPinView | null };

/** Where the couple stands → the row's page and view, or `null` (the row draws nothing). Pure. */
export function eventPinPlaceOf(table: EventPinTable, pathname: string): EventPinPlace | null {
  if (eventPageKeepsItsOwnRow(table.base, pathname)) return null;
  const key = activeRailKey(table.matchRows, pathname);
  if (!key) return null;
  const pillar = table.pillars.find((p) => p.key === key);
  if (!pillar) return null;
  let view: EventPinView | null = null;
  for (const v of pillar.views) {
    const hit = v.exact ? pathname === v.path : pathname === v.path || pathname.startsWith(`${v.path}/`);
    if (hit && (!view || v.path.length > view.path.length)) view = v;
  }
  return { pillar, view };
}

/** The picker's face — "Today · Budget", or the page's word alone on the row's own door. */
export function eventPinFace(place: EventPinPlace): string {
  const { pillar, view } = place;
  return view && view.path !== pillar.views[0]?.path ? `${pillar.label} · ${view.label}` : pillar.label;
}
