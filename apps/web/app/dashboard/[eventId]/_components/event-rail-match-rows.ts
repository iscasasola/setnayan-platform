/**
 * event-rail-match-rows.ts — the event menu's rows, as MATCH DATA, in a module
 * a server layout and a client component can both import.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────
 * Until 2026-08-23 the rail resolved "which row is lit" TWICE, in two
 * components that could not see each other: `FrontDoorShell` over the account
 * rows, and `EventRailContext` over the event menu. That was survivable only
 * because the Studio rows were left UNLIT — named debt, recorded in the
 * shell's own docblock — since lighting them double-lights:
 *
 *   /dashboard/<id>/seating/lab   3D Plan (exact) AND Seat plan (prefix)
 *   /dashboard/<id>/website       Event Hub (exact) AND Launch (prefix)
 *   /dashboard/<id>/website/editor Launch (exact) AND Event Hub (prefix)
 *
 * Measured, not assumed: those three are the WHOLE collision set across the
 * eight Studio products and the ten event rows. Two lit rows tell the reader
 * they are in two places at once, which is not a smaller bug than zero.
 *
 * 🔑 THE FIX IS ONE LIST AND ONE RESOLVER, NOT A SPECIAL CASE PER PAIR. The
 * shipped `activeRailKey` already picks the single most specific match — it
 * simply never saw both halves at once. Given the union it resolves all three
 * correctly by the rule it already has: 3D Plan wins its own page, Launch wins
 * the website family it claims by prefix.
 *
 * So the layout builds this list ONCE and hands the SAME data to both: the
 * shell (which resolves and publishes the winner) and the rail context (which
 * reads it). A second builder here would be two answers to one question, which
 * is the failure this replaces rather than a new one.
 *
 * ⚠ NO `'use client'` ON PURPOSE. `layout.tsx` is a server component and is the
 * only place that holds every input, so the builder has to be importable there.
 * That is also why this takes the REGISTRY-HIDDEN rule with it (below) instead
 * of calling `applyRegistry`, which lives in a `'use client'` file because it
 * resolves icon COMPONENTS — something a match row has no use for.
 */
import { buildCustomerNavGroups } from './customer-nav-config';
import { SIDEBAR_SLOT_KEYS } from './customer-nav-slot-keys';
import type { RailMatchRow } from '@/app/_components/frontdoor/rail-active';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';

/**
 * Everything the event menu needs to exist. Built ONCE in `layout.tsx` and
 * spread into both consumers, so the two can never be handed different inputs.
 */
export type EventRailInputs = {
  eventId: string;
  navSlots?: Record<string, NavSlotLite>;
  hideKeys?: string[];
  websiteEnabled?: boolean;
  monogramEnabled?: boolean;
  slug?: string | null;
  guestCount?: number | null;
  phase?: MenuLifecyclePhase;
};

/**
 * The event menu's rows that can be the current page.
 *
 * 🔒 `studio` IS DROPPED, mirroring `EventRailContext`'s own filter — the rail
 * carries a Studio GROUP a few rows below, so the event menu's single Studio
 * row would be the same destination under a second name. It is dropped from
 * the DESKTOP RAIL only; the phone's bottom bar keeps it, and
 * `lib/customer-menu.test.ts` still pins it there.
 *
 * ⚠ A row an admin has HIDDEN must not be matchable. It renders nowhere, so
 * lighting it would light nothing while suppressing the row that should have
 * won.
 */
export function eventRailMatchRows(inputs: EventRailInputs): RailMatchRow[] {
  const { eventId, navSlots, ...opts } = inputs;
  return buildCustomerNavGroups(eventId, opts)
    .flatMap((group) => group.items)
    .filter((item) => {
      if (item.key === 'studio') return false;
      const slotKey = SIDEBAR_SLOT_KEYS[item.key];
      return !(slotKey && navSlots?.[slotKey]?.isHidden);
    })
    .map((item) => ({
      key: item.key,
      href: item.href,
      ...(item.matchPrefix ? { matchPrefix: item.matchPrefix } : {}),
    }));
}
