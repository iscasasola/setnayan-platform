'use client';

/**
 * event-rail-context.tsx — the event's own menu, PUSHED into the shared rail.
 *
 * One Shell slice 1. Owner, 2026-08-13, over three YouTube screenshots in which
 * the left rail never leaves: *"the sidebar should stay. look at here as we
 * navigate around. what you did was jumping back to the old dashboards. so what
 * we want to see the dashboards converted for this desktop view."*
 * `ONE_SHELL_PLAN_2026-08-13.md` § 1 · drawing
 * `prototypes/one_shell_2026-08-13.html` (`EVSECTIONS` + `.rctx` + `.rlab.sub`).
 *
 * ─── IT PUSHES. IT DOES NOT SWAP. ────────────────────────────────────────
 * This mounts into `<FrontDoorShell railContext>`, which sits BELOW the account
 * rows and above nothing. Opening a wedding therefore adds a group; it removes
 * none of the person's own rows. That is the entire difference between one
 * shell and two, and it is the ONE place this session's ask diverges from the
 * approved seam prototype (which draws a wholesale swap) — flagged for the
 * owner's eye, per the plan's OWNER DECISION #4.
 *
 * ─── NOTHING HERE IS A NEW IA ────────────────────────────────────────────
 * The rows, their order, their labels, their routes and their gating all come
 * from `buildCustomerNavGroups` — the SSOT the desktop sidebar and (through
 * `lib/customer-menu.ts`) the phone's bottom bar already read. Three named
 * sections ship today and are reproduced exactly:
 *
 *   Plan                → Overview · Guests · Marketplace · Studio
 *   Go live             → Launch            (gated on the website surface)
 *   Also in this event  → Schedule · Seat plan · Budget
 *
 * 🔒 EVERY ROW IS A PLAIN LEAF — "solid menu with no submenus" (owner-locked
 * 2026-07-15). `NavItem.children` is deliberately NOT rendered here. Sub-
 * navigation lives inside each page (the Marketplace tab strip, the Studio hub
 * body), and the phone keeps its docked sub-nav. A rail that expands children
 * would reverse that lock silently while looking like a nicety.
 *
 * 🔒 BUDGET IS NOT A TOP-LEVEL MENU (owner removed it 2026-07-10). It appears
 * under "Also in this event" as a quiet flat link — which is where it already
 * lives in the shipped rail — never promoted back into Plan.
 *
 * ─── WHICH ROW IS LIT ────────────────────────────────────────────────────
 * `activeRailKey` — THE shipped resolver, the same one the account rows above
 * use, which itself calls the shipped `matchesPath`. Rows are not asked "are
 * you active?" one at a time: that double-lights, because the matcher is
 * prefix-based and `/dashboard/x` is a prefix of every other event route.
 * Overview's `__home__` sentinel prefix (from the SSOT) makes its prefix branch
 * unmatchable, so only its exact branch lights it — unchanged from the sidebar.
 *
 * 🪤 A SECOND MATCHER HERE WOULD DRIFT WITHIN A WEEK. There is one, it is
 * imported, and the tests call the real list rather than a copy of it.
 *
 * ─── THE GUEST COUNT VANISHES ON THE 72px STRIP, AND THAT IS DECIDED ─────
 * Between 1024 and 1279 the shared rail collapses to a 72px icon strip and
 * `.fd-ct` is hidden — so the Guests head-count goes with it, exactly as the
 * events and Alaala counts on the account rows above already do. Naming it
 * here because the plan lists it as a thing to decide rather than discover; the
 * count is information, not work waiting, and the row itself never disappears.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { activeRailKey } from '@/app/_components/frontdoor/rail-active';
import type { RailMatchRow } from '@/app/_components/frontdoor/rail-active';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';
import { buildCustomerNavGroups } from './customer-nav-config';
import { applyRegistry } from './customer-sidebar';

export function EventRailContext({
  eventId,
  eventName,
  navSlots,
  hideKeys,
  websiteEnabled,
  monogramEnabled,
  slug,
  guestCount,
  phase,
}: {
  eventId: string;
  /** Already resolved server-side, and never blank — see the layout's
   *  `plaqueName`, which falls back to the event type for an unnamed draft. */
  eventName: string;
  navSlots?: Record<string, NavSlotLite>;
  hideKeys?: string[];
  websiteEnabled?: boolean;
  monogramEnabled?: boolean;
  slug?: string | null;
  guestCount?: number | null;
  /** Event lifecycle phase, resolved server-side in layout.tsx. In the After
   *  phase the builder relabels the first section and adds the Editorial +
   *  Galleries rows — see `buildCustomerNavGroups`. Omitted ⇒ 'plan'. */
  phase?: MenuLifecyclePhase;
}) {
  const pathname = usePathname() ?? `/dashboard/${eventId}`;

  /*
    THE SAME BUILDER AND THE SAME REGISTRY OVERLAY THE SIDEBAR USES.

    🔑 RENDERING LABELS WITHOUT `applyRegistry` WOULD GIVE TWO ANSWERS TO ONE
    QUESTION: an admin renaming "Marketplace" would see it change on the phone
    and on the old sidebar, and NOT on the desktop rail — with nothing thrown.
    The plan names this as trap #6. The overlay also drops rows an admin has
    hidden, which is the sidebar's shipped behaviour for these keys.

    ⚠ `dayOfOpen` is deliberately not passed. It gates the Guests JOURNEY
    CHILDREN, and this rail renders no children (see the plain-leaf lock in the
    header). Passing a client-effect value would buy nothing and would open a
    hydration split for a row that cannot render.
  */
  const groups = applyRegistry(
    buildCustomerNavGroups(eventId, {
      hideKeys,
      websiteEnabled,
      monogramEnabled,
      slug,
      guestCount,
      phase,
    }),
    navSlots,
  );

  /*
    Every row that can be the current page, declared ONCE and handed to the
    shipped resolver, which picks the single most specific match.
  */
  const matchRows: RailMatchRow[] = groups.flatMap((group) =>
    group.items.map((item) => ({
      key: item.key,
      href: item.href,
      ...(item.matchPrefix ? { matchPrefix: item.matchPrefix } : {}),
    })),
  );
  const activeKey = activeRailKey(matchRows, pathname);

  return (
    <>
      <div className="fd-rdiv" />
      {/* The place you are in, then ITS OWN section headings underneath —
          `.rctx` in the binding drawing. Not a link: the way OUT of an event is
          the "Your events" row that is still sitting above this group, which is
          the whole point of pushing rather than swapping. */}
      <div className="fd-rctx">{eventName}</div>

      {groups.map((group) => (
        <div key={group.key}>
          {/* A heading over nothing is a fake door in label form — and a
              section can legitimately empty out here (a vendor-free Simple
              Event drops Marketplace; an admin can hide a row). */}
          {group.items.length === 0 ? null : (
            <>
              <div className="fd-rlabel fd-rsub">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const on = activeKey === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="fd-row"
                    /* `data-on` is the style hook the stylesheet already reads;
                       `aria-current` is the half a screen reader gets. A rail
                       that only LOOKS right is only half right. Both come from
                       the one resolver so they can never disagree. */
                    data-on={on ? 'true' : 'false'}
                    aria-current={on ? 'page' : undefined}
                  >
                    <span className="fd-gi" aria-hidden="true">
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="fd-label-text">{item.label}</span>
                    <span className="fd-icon-caption">{item.label}</span>
                    {item.badge ? (
                      <>
                        <span className="fd-ct fd-mono">{item.badge.count}</span>
                        {item.badge.label ? (
                          <span className="fd-sr-only">{item.badge.label}</span>
                        ) : null}
                      </>
                    ) : null}
                  </Link>
                );
              })}
            </>
          )}
        </div>
      ))}
    </>
  );
}
