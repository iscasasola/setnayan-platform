'use client';

import { LayoutGrid, Sparkles, Store, Telescope, Users } from 'lucide-react';
import { BottomDock, BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { AccountBarTab } from '@/lib/account-bar';

/**
 * AccountBottomNav — the phone bar on the account-level screens (the Events
 * board, Memories, People and the other account spokes). Desktop keeps the rail.
 *
 * ── WHAT IT IS (owner "yes to all", 21 Oct 2026) ───────────────────────────────
 * The approved prototype `account_bottom_bar_2026-10-21.html`: Events · Discover
 * · Memories · People, plus Shop for an account that owns one. WHICH tabs is not
 * decided here — the layouts ask `accountBarTabs()` (lib/account-bar.ts) and
 * hand the answer in, so the server, this bar and the guard share one rule.
 *
 * ── WHAT IT REPLACES ───────────────────────────────────────────────────────────
 * `HomePillNav`, a hand-rolled floating glass pill (Home · Memories · ＋ · People
 * · Spaces). It was the one phone bar the 2026-09-25 "the phone's bottom bar is
 * anchored" ruling never reached, because it was not a <BottomNav> and so
 * <BottomDock> never wrapped it. It now IS the canonical bar, inside the dock,
 * exactly as the event, supplier and HQ bars are (lint-bottom-nav.mjs).
 *   · "Home" → "Events": same glyph, same door. Two Homes read as one place.
 *   · The raised ＋ knob is GONE (supersedes the 2026-07-29/30 "Create is the
 *     raised knob, dead-centre"). Create lives on the board it starts from.
 *   · "Spaces" → "Shop", and only for an owner. Admin is never a tab.
 *
 * ── EVERY TARGET IS AN EXISTING, RENDERED DOOR ─────────────────────────────────
 * `/dashboard?hub=1` · `/` · `/dashboard/library` · `/dashboard/people` ·
 * `/vendor-dashboard`. Events carries `?hub=1` for the reason the avatar sheet's
 * Home does: plain `/dashboard` re-fires the board's auto-jump for a couple with
 * one upcoming event, so "Events" would drop them back inside the wedding they
 * were leaving. The tab still LIGHTS on the board's path (matching ignores the
 * query).
 *
 * ── `data-account-bar` ─────────────────────────────────────────────────────────
 * The wrapper's marker is how the shared top bar knows it is on an account-level
 * screen and draws the mark AND the word "Setnayan" side by side there (owner
 * ruling 4, `front-door.css`) — CSS reading the page, so the shell's JavaScript,
 * which the Maker's at-ceiling first load carries, gains nothing.
 */

const TAB: Record<AccountBarTab, BottomNavItem> = {
  events: {
    key: 'events',
    label: 'Events',
    href: '/dashboard?hub=1',
    icon: LayoutGrid,
    // The board itself is exact — `/dashboard` prefixes every spoke — and the
    // create flow it opens belongs to it.
    activeMatchAlsoExact: ['/dashboard'],
    activeMatch: '/dashboard/create-event',
  },
  discover: {
    key: 'discover',
    label: 'Discover',
    href: '/',
    // The rail's glyph for the same door (owner 2026-09-21: Compass is Suppliers).
    icon: Telescope,
    activeMatch: '/',
    activeMatchExact: true,
    // The signed-in search's results page is Discover's answer — the widest
    // place, everything you may reach (lib/shell-search.ts) — so Discover is
    // lit there. Where Discover is not a tab (the store app), nothing is.
    activeMatchAlsoExact: ['/dashboard/search'],
  },
  memories: {
    key: 'memories',
    label: 'Memories',
    href: '/dashboard/library',
    icon: Sparkles,
    activeMatch: '/dashboard/library',
  },
  people: {
    key: 'people',
    label: 'People',
    href: '/dashboard/people',
    icon: Users,
    activeMatch: '/dashboard/people',
  },
  shop: {
    key: 'shop',
    label: 'Shop',
    href: '/vendor-dashboard',
    icon: Store,
    activeMatch: '/vendor-dashboard',
  },
};

/** The bar's items for a list of tabs — exported so the guard renders the real list. */
export function accountBarItems(tabs: readonly AccountBarTab[]): BottomNavItem[] {
  return tabs.map((t) => TAB[t]);
}

export function AccountBottomNav({ tabs }: { tabs: readonly AccountBarTab[] }) {
  return (
    <div data-account-bar="">
      <BottomDock>
        <BottomNav items={accountBarItems(tabs)} />
      </BottomDock>
    </div>
  );
}
