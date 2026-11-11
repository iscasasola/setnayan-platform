'use client';

import { useEffect, useState } from 'react';
import { House, Telescope } from 'lucide-react';
import { BottomDock, BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { AccountBarTab } from '@/lib/account-bar';
import { HOME_HREF, HOME_LAST_SEG_KEY, HOME_SEG_ORDER, homeSegHref, type HomeSeg } from '@/lib/home-segments';

/**
 * AccountBottomNav — the phone bar on the account-level screens (the Events
 * board, Memories, People and the other account spokes). Desktop keeps the rail.
 *
 * ── WHAT IT IS (owner "yes to all", 21 Oct 2026) ───────────────────────────────
 * The approved prototype `account_bottom_bar_2026-10-21.html`: Events · Discover
 * · Memories · People, plus Shop for an account that owns one. WHICH tabs is not
 * decided here — the layouts ask `accountBarTabs()` (lib/account-bar.ts) and
 * hand the answer in, so the server, this bar and the guard share one rule.
 * 🔁 Their ORDER was re-ruled 11 Nov 2026 (owner: *"Events - People - Shop -
 * Memories - Discover"*, DECISION_LOG "THE ACCOUNT BAR ORDER"); that order is
 * also `accountBarTabs()`'s, and the record below is written in it.
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
 * `/dashboard?hub=1` · `/dashboard/people` · `/vendor-dashboard` ·
 * `/dashboard/library` · `/`. Events carries `?hub=1` for the reason the avatar sheet's
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

/*
 * 🏠 HOME · DISCOVER (owner 11 Nov 2026, "One profile page approve", DECISION_LOG "HOME PAGE v3 APPROVED"). The four
 * account tabs became the four SECTIONS of Home (`lib/home-segments.ts`); the bar keeps two. Home lights on Home and
 * on every page that belongs to one of its sections and still has its own address — an alaga's page, a group's
 * chat room, the create flow — and on the old section addresses while they forward (they never paint).
 */
const TAB: Record<AccountBarTab, BottomNavItem> = {
  home: {
    key: 'home',
    label: 'Home',
    href: HOME_HREF,
    icon: House,
    activeMatchAlsoExact: ['/dashboard'],
    activeMatch: ['/dashboard/create-event', '/dashboard/people', '/dashboard/samahan', '/dashboard/library'],
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
};

/** The bar's items for a list of tabs — exported so the guard renders the real list. */
export function accountBarItems(tabs: readonly AccountBarTab[]): BottomNavItem[] {
  return tabs.map((t) => TAB[t]);
}

/**
 * 🔁 THE OTHER TAB KEEPS ITS LAST STATE (T5): from Discover, Home comes back to the section you left (Home writes it,
 * `home-segment-bar.tsx`). Read after mount — the server draws the plain Home door, so the first paint matches.
 * Re-tapping Home ON Home is the page's to answer (back to the top, `useTabReselect('home')`).
 */
function useHomeDoor(): string {
  const [href, setHref] = useState(HOME_HREF);
  useEffect(() => {
    try {
      const last = window.sessionStorage.getItem(HOME_LAST_SEG_KEY) as HomeSeg | null;
      if (last && HOME_SEG_ORDER.includes(last) && last !== 'events') setHref(homeSegHref(last));
    } catch {
      /* storage refused (private window) — the plain Home door is a correct answer */
    }
  }, []);
  return href;
}

export function AccountBottomNav({ tabs }: { tabs: readonly AccountBarTab[] }) {
  const homeDoor = useHomeDoor();
  const items = accountBarItems(tabs).map((it) => (it.key === 'home' ? { ...it, href: homeDoor } : it));
  return (
    <div data-account-bar="">
      <BottomDock>
        <BottomNav items={items} />
      </BottomDock>
    </div>
  );
}
