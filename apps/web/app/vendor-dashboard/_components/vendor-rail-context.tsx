'use client';

/**
 * vendor-rail-context.tsx — the shop's own menu, INSIDE the shared rail.
 *
 * One Shell slice 2 (2026-08-14). Owner, 2026-08-13, over three YouTube
 * screenshots in which the left rail never leaves: *"the sidebar should stay.
 * look at here as we navigate around. what you did was jumping back to the old
 * dashboards."* `ONE_SHELL_PLAN_2026-08-13.md` · `DECISION_LOG.md` 2026-08-13.
 *
 * ─── IT PUSHES; IT DOES NOT SWAP ─────────────────────────────────────────
 * This mounts into `<FrontDoorShell railContext>`. Everything above it — Home,
 * Stories, Marketplace, your events, your Alaala, your story, your shop,
 * HQ — stays exactly where it was. That is the entire difference between one
 * shell and two, and it is why a supplier moving between their shop and their
 * own account never changes product. The binding drawing does the same
 * (`prototypes/one_shell_2026-08-13.html`, the `S.view==='shop'` branch).
 *
 * ─── TWO ROWS ARE LIT AT ONCE, AND THAT IS THE DESIGN ────────────────────
 * The account-level "your shop" row prefix-matches every `/vendor-dashboard/*`
 * URL, so it stays lit the whole time you are in here; this group then lights
 * WHICH of the five you are on. That reads as a breadcrumb — the place, then
 * the page — and it is exactly what the drawing renders (`on('shop')` is true
 * for the whole shop view while `S.shopTab===k` marks the row). It is NOT the
 * double-lighting `rail-active.ts` warns about: that one is two rows at the
 * SAME level, which tells you that you are in two places at once.
 *
 * ⚠ SO DO NOT "FIX" THE ACCOUNT ROW BY MAKING IT `exact`. Doing that would
 * dim the destination on 62 of the 63 screens and leave a menu floating under
 * nothing.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store, Zap } from 'lucide-react';
import { activeRailKey } from '@/app/_components/frontdoor/rail-active';
import { resolveVendorDestinations } from './vendor-nav-destinations';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { VendorTeamRole } from '@/lib/vendor-team';
import { TIER_LABEL, asVendorTier } from '@/lib/vendor-tier-caps';

/**
 * The word the 72px icon strip shows at 1024–1279, keyed by the STABLE key and
 * never by the label — an admin can rename any of these from the registry, and
 * "On the Day".split(' ')[0] is the word "On", which is not a place.
 * A renamed row falls back to its own first word, which is the best guess
 * available for a word we have never seen.
 */
/**
 * The Plan row's key. Deliberately not a word a destination could ever use —
 * the five come from the registry, where an admin names rows, and a collision
 * would silently light two rows or none.
 */
const PLAN_KEY = '__plan';

const CAPTION: Record<string, string> = {
  // Re-cut 2026-08-26: the landing row reads "Today" everywhere it is drawn.
  overview: 'Today',
  shop: 'Shop',
  customers: 'Customers',
  performance: 'Performance',
  'on-the-day': 'Hub',
};

export function VendorRailContext({
  shopName,
  role,
  navSlots,
  bookingsBadge = 0,
  threadsBadge = 0,
  planHref,
  tier,
}: {
  /** The business name, or a neutral word — never blank, never an id. */
  shopName: string;
  /*
    ── EVERY PROP BELOW IS SERIALIZABLE, ON PURPOSE ──────────────────────────
    🔴 THIS USED TO TAKE A FINISHED `destinations: NavItem[]`, WHICH TOOK THE
    WHOLE VENDOR DASHBOARD DOWN. `NavItem.icon` is a React component, so
    building the list meant `layout.tsx` — a SERVER component — calling
    `navIconComponent` out of a `'use client'` module. That throws. Every
    supplier, every screen, from 2026-08-14 until this landed.

    So the rail is now handed the same four raw values the phone's bottom bar
    already gets, and resolves the rows HERE, where the icons live. The two
    surfaces cannot disagree about a renamed row or a count, because they run
    the identical resolver over the identical input.

    ⚠ DO NOT "TIDY" THIS BACK INTO A PREPARED LIST. Any prop whose value is a
    component puts the resolution back on the server and takes the shop down
    again — with a full-page error, not a wrong pixel.
  */
  /** This person's team role; gates WHICH rows they get. Null = not staff. */
  role: VendorTeamRole | null;
  /** The admin nav registry's serializable slot map — labels + icon descriptors. */
  navSlots?: Record<string, NavSlotLite>;
  /** Pending-inquiry count. Real layout data; 0 omits the badge. */
  bookingsBadge?: number;
  /** Unread-thread count. Real layout data; 0 omits the badge. */
  threadsBadge?: number;
  /**
   * The Plan hub. It is passed in rather than hardcoded so the ONE door to it
   * is declared at the mount site, where a reviewer can see it survived.
   */
  planHref: string;
  /** `tier_state`, or null when the probe failed. Normalised below. */
  tier: string | null;
}) {
  const pathname = usePathname() ?? '/vendor-dashboard';

  /*
    Role filter → registry labels → badges, in that order, by the ONE shared
    resolver. Calling it here rather than upstream is the entire fix: the
    sentinel, the staff scoping and the badge rule are unchanged and still
    live in exactly one file.
  */
  const destinations = resolveVendorDestinations({
    role,
    navSlots,
    bookingsBadge,
    threadsBadge,
  });

  /*
    ONE WINNER, RESOLVED BY THE SHIPPED RESOLVER — not a per-row boolean.
    Asking each row "are you active?" independently double-lights, because the
    matcher is prefix-based by contract. `activeRailKey` picks the single most
    specific match and returns `null` when the URL belongs to no row, which
    must render as NOTHING lit rather than falling back to the first row.

    🔑 THE SENTINEL SURVIVES THIS. Overview carries
    `matchPrefix: '__overview-exact__'`, which no pathname can start with, so
    its prefix branch is dead and only `pathname === '/vendor-dashboard'`
    lights it. Passing the real items in — rather than a list rebuilt here —
    is what keeps that true: a copy would have to remember the sentinel.
  */
  const activeKey = activeRailKey(
    // The Plan row takes part in the SAME resolution as the five. Asking it
    // separately with a `pathname.startsWith(planHref)` would be a second
    // answer to one question AND would light Plan on `/…/subscriptions` — the
    // missing-trailing-slash bug `match-path.ts` names in its own header.
    [...destinations, { key: PLAN_KEY, href: planHref }],
    pathname,
  );

  return (
    <>
      <div className="fd-rdiv" />
      <div className="fd-rctx">
        {/* ▣ U+25A3 until now — a typographic character standing in for the
            shop mark, in the one row that names the shop. It is the same
            `Store` the rail's own shop row draws, so the shop reads the same
            whether you are looking at it from outside or standing in it. */}
        <Store className="inline h-[15px] w-[15px] align-[-2px]" strokeWidth={1.75} aria-hidden="true" />{' '}
        {shopName}
      </div>
      <div className="fd-rlabel fd-rlabel-sub">Menu</div>
      {destinations.map((item) => {
        const Icon = item.icon;
        const on = activeKey === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            className="fd-row"
            // NEVER a literal on either of these. A hardcoded `data-on="true"`
            // is precisely the bug One Shell slice 0 was written to close, and
            // it throws nothing when it is wrong. `aria-current` is the half a
            // screen reader gets — a rail that only LOOKS right is half right.
            data-on={on ? 'true' : 'false'}
            aria-current={on ? 'page' : undefined}
          >
            <span className="fd-gi" aria-hidden="true">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <span className="fd-label-text">{item.label}</span>
            <span className="fd-icon-caption">
              {CAPTION[item.key] ?? item.label.split(' ')[0]}
            </span>
            {item.badge && item.badge.count > 0 ? (
              <span className="fd-ct fd-mono">
                {item.badge.count}
                {item.badge.label ? (
                  <span className="sr-only"> — {item.badge.label}</span>
                ) : null}
              </span>
            ) : null}
          </Link>
        );
      })}

      {/*
        THE PLAN ROW — the only PERSISTENT door to the subscription hub.
        It sat pinned under the old sidebar; the five above are owner-locked
        as "the menu" (2026-07-12), so it stays a separate row rather than
        becoming a sixth destination. Everything else that links to this hub
        is a contextual upsell inside a page — remove this and the vendor can
        reach their own plan only by first hitting a paywall.

        ⚠ The token balance that used to sit beside it is NOT coming back.
        Tokens are retired (owner 2026-07-21); a counter for a currency that
        buys nothing is a standing claim that the currency exists.
      */}
      <Link
        href={planHref}
        className="fd-row"
        data-on={activeKey === PLAN_KEY ? 'true' : 'false'}
        aria-current={activeKey === PLAN_KEY ? 'page' : undefined}
      >
        <span className="fd-gi" aria-hidden="true">
          <Zap className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <span className="fd-label-text">Plan</span>
        <span className="fd-icon-caption">Plan</span>
        <span className="fd-ct">{TIER_LABEL[asVendorTier(tier)]}</span>
      </Link>
    </>
  );
}
