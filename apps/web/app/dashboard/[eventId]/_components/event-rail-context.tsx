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
 * ─── WHICH ROW IS LIT — DECIDED ABOVE, READ HERE (2026-08-23) ────────────
 * This component no longer resolves anything. The shell draws the Studio group
 * over the very URLs this menu claims, so a resolver per component double-lit
 * exactly as a boolean per row would: two lit rows tell the reader they are in
 * two places at once. The layout hands the same rows to the shell, the shell
 * resolves the union once with the shipped `activeRailKey`, and this reads the
 * answer through `useRailActiveKey`.
 *
 * 🪤 A SECOND MATCHER HERE WOULD DRIFT WITHIN A WEEK — and a second RESOLVER
 * drifted within two days. There is one of each now.
 *
 * ─── THE GUEST COUNT VANISHES ON THE 72px STRIP, AND THAT IS DECIDED ─────
 * Between 1024 and 1279 the shared rail collapses to a 72px icon strip and
 * `.fd-ct` is hidden — so the Guests head-count goes with it, exactly as the
 * events and Alaala counts on the account rows above already do. Naming it
 * here because the plan lists it as a thing to decide rather than discover; the
 * count is information, not work waiting, and the row itself never disappears.
 */

import Link from 'next/link';
import { useRailActiveKey } from '@/app/_components/frontdoor/rail-active-key';
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
  const groupsWithHub = applyRegistry(
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
    ─── THE SERVICES SHELF IS NOT LISTED TWICE ──────────────────────────────
    Owner, 2026-08-21: the Studio group must stay in the rail inside an event.
    It now sits a few rows below this one, headed "Studio", carrying the named
    products and ending in an "All services" row that opens this exact page.

    So this row — labelled "Studio" or "Suite" depending on the flag — would be
    the same destination under a second name, directly above a heading using
    the first. The shell's own Marketplace note records why that is forbidden:
    the same word twice in one rail is two different places in the reader's
    head, and here the two words are worse than one repeated.

    🔒 THE BUILDER IS NOT TOUCHED, AND THAT IS DELIBERATE. It is the SSOT for
    the phone's bottom bar too, and the phone carries NO Studio group — take
    the row out there and a phone loses its only door to the shelf. This drops
    it from the DESKTOP RAIL, where the group replaces it, and nowhere else.
    `lib/customer-menu.test.ts` still pins 'studio' in the phone's keys.
  */
  const groups = groupsWithHub.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.key !== 'studio'),
  }));

  /*
    ─── WHICH ROW IS LIT IS NOT DECIDED HERE ANY MORE (2026-08-23) ──────────
    This component used to call `activeRailKey` over its OWN rows. That is one
    resolver per COMPONENT, which is the same mistake as one boolean per ROW,
    one level up: the shell draws the Studio group over the same URLs this menu
    claims, so on `/dashboard/<id>/seating/lab` it would light "3D Plan" while
    this lit "Seat plan", and two lit rows tell the reader they are in two
    places at once.

    The layout now hands the SAME rows to the shell as `contextMatchRows`; the
    shell resolves the union once and publishes the winner. Reading it is the
    whole of this component's part in it.

    🔑 `null` IS A REAL ANSWER and renders as "no row lit". There is no local
    fallback resolver on purpose — one would silently restore the second answer
    this removes, and it would look like a safety net while doing it.
  */
  const activeKey = useRailActiveKey();

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
