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
 * from `buildCustomerNavGroups` — the rail's projection of the ONE sectioned
 * tree in `lib/customer-menu.ts` (`buildEventMenuSections`), which the phone's
 * bottom bar and moment strip read too. By moment (owner 2026-09-24):
 *
 *   (name row)  → Details
 *   (spine)     → Overview · Papic ✦ · Galleries · Editorial (after)
 *   Book        → Your Team · Budget
 *   Look        → Mood Board ✦ · Logo Maker ✦ · Pakanta ✦
 *   Invite      → Guests · Hosts · Event Hub Controller
 *   The day     → Schedule · Check-in (day-of) · Seat plan · 3D Plan ✦ ·
 *                 Live Studio ✦ · Patiktok ✦
 *   (end)       → Setnayan AI ✦ · Suite · Refer a couple
 *
 * 🔒 EVERY ROW IS A PLAIN LEAF — "solid menu with no submenus" (owner-locked
 * 2026-07-15). `NavItem.children` is deliberately NOT rendered here. Sub-
 * navigation lives inside each page (the Marketplace tab strip, the Studio hub
 * body), and the phone keeps its docked sub-nav. A rail that expands children
 * would reverse that lock silently while looking like a nicety.
 *
 * 🔒 BUDGET IS NOT A MAIN ROOM (owner 2026-07-10). It is a quiet row under
 * Book, beside the people you pay — never a phone tab.
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
import type { EventStudioRow } from '@/lib/customer-menu';
import { EventMonogram } from '@/app/_components/event-monogram';
import { buildCustomerNavGroups } from './customer-nav-config';
import { applyRegistry } from './customer-sidebar';

export function EventRailContext({
  eventId,
  eventName,
  eventMonogram,
  navSlots,
  hideKeys,
  websiteEnabled,
  monogramEnabled,
  slug,
  guestCount,
  phase,
  seatingEnabled,
  studioRows,
  storeShell,
}: {
  eventId: string;
  /** Already resolved server-side, and never blank — see the layout's
   *  `plaqueName`, which falls back to the event type for an unnamed draft. */
  eventName: string;
  /**
   * The event's OWN mark, above its name. Owner 2026-09-23, pointing at the
   * `.fd-rctx` name row: *"on top of this, show the logo/monogram of the
   * event"*.
   *
   * 🔑 THE SHAPE `EventMonogram` ALREADY TAKES, passed whole rather than
   * re-derived here. It resolves an uploaded / bespoke SVG, then the couple's
   * designed lockup, then the lettered badge — three cases this component has
   * no business re-deciding, and a fourth answer to "what is this event's
   * mark" is exactly the drift this rail was built to stop.
   *
   * ⚠ `monogram_custom_svg` MUST ARRIVE ALREADY GATED. `EventMonogram` reads
   * that one column, and both SVG columns are host-writable through PostgREST
   * — the layout passes `resolveEventMonogramSvg(event)`, the read-time gate
   * (SEC-3, `lib/monogram-svg-safe.ts`), never the raw column.
   *
   * Optional: omitted ⇒ the name renders alone, exactly as it did before.
   */
  eventMonogram?: {
    display_name: string | null;
    monogram_text: string | null;
    monogram_color: string | null;
    monogram_frame_key?: string | null;
    monogram_font_key?: string | null;
    monogram_style?: string | null;
    monogram_custom_svg?: string | null;
  } | null;
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
  /** Gates the Seat plan row. Undefined ⇒ shown. */
  seatingEnabled?: boolean;
  /** The event's Studio products as PLAIN DATA (key · href · name) — see
   *  `EventRailInputs.studioRows`. Placed at their moments by the one tree. */
  studioRows?: ReadonlyArray<EventStudioRow>;
  /** The App Store / Play Store shell — the one tree drops every row whose
   *  door `lib/store-shell.ts` refuses (`storeShellRefusesMenuRow`). This is
   *  the ☰ drawer on a phone, so it must not offer "Not available in the app". */
  storeShell?: boolean;
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
      seatingEnabled,
      studioRows,
      storeShell,
    }),
    navSlots,
  );

  /*
    ─── THE SUITE ROW STAYS NOW (2026-09-24) ────────────────────────────────
    This used to drop the `studio` row, because the shell drew a Studio group
    below whose "All services" row opened the same page. That group is
    dissolved — its products are rows at their moments in THIS menu — so the
    row, now called "Suite", is the only door to the shelf and closes the list.

    The event's Details row is not drawn as a row: it IS the event's name row
    (the `event` group), so the place you are in opens its own facts.
  */
  const detailsRow =
    groupsWithHub.find((g) => g.key === 'event')?.items.find((i) => i.key === 'personalization') ?? null;
  const groups = groupsWithHub.filter((g) => g.key !== 'event');

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
          the "Back to events" row directly above this group — since 2026-09-21
          the rail FOCUSES on the event (owner) and that row is the only one
          above it. */}
      {/*
        THE EVENT'S MARK, ABOVE ITS NAME (owner 2026-09-23). Its own element,
        NOT a child of `.fd-rctx` — and that is the whole design decision here.
        `.fd-rctx` is prose, so the stylesheet hides it at the 72px icon strip
        (1024–1279px) along with every other word in the rail. A mark is not
        prose: it is the one thing still saying WHICH event you are standing in
        once the names are gone, so it keeps its own element, survives that
        width and centres there.

        The badge is already `aria-hidden`. The event's name is this group's
        accessible label and sits directly under it, so a screen reader hearing
        the initials first would only hear the same thing twice.
      */}
      {eventMonogram ? (
        <div className="fd-rctx-mark">
          <EventMonogram event={eventMonogram} size="sm" shape="square" />
        </div>
      ) : null}
      {/*
        THE EVENT'S NAME OPENS ITS DETAILS (owner 2026-09-24 — the rail's
        Personalization row, renamed Details, moved onto the name). Names,
        date, venue and budget are facts ABOUT the event, so they open from
        the event's name: that is where a person looks to change "our wedding".
        Still no way OUT of the event here — that is the Events row above.
        Falls back to the plain name if the row is ever absent (hidden by an
        admin or a future gate), rather than a link to nowhere.
      */}
      {detailsRow ? (
        <Link
          href={detailsRow.href}
          className="fd-rctx fd-rctx-link fd-mrow"
          data-on={activeKey === detailsRow.key ? 'true' : 'false'}
          aria-current={activeKey === detailsRow.key ? 'page' : undefined}
        >
          <span className="fd-rctx-name">{eventName}</span>
          <span className="fd-rctx-sub">{detailsRow.label} ›</span>
        </Link>
      ) : (
        <div className="fd-rctx">{eventName}</div>
      )}

      {groups.map((group) => (
        <div key={group.key}>
          {/* A heading over nothing is a fake door in label form — and a
              section can legitimately empty out here (a vendor-free Simple
              Event drops Marketplace; an admin can hide a row). */}
          {group.items.length === 0 ? null : (
            <>
              {/* The spine and the end of the list carry no heading — an
                  empty label draws nothing rather than an empty eyebrow. */}
              {group.label ? (
                <div className="fd-rlabel fd-rsub">
                  {group.label}
                  {/* "now" on The day while it is the day — the drawing's
                      marker, so the moment you are in reads as current. */}
                  {group.key === 'day' && phase === 'dayof' ? <small>now</small> : null}
                </div>
              ) : null}
              {group.items.map((item) => {
                const Icon = item.icon;
                const on = activeKey === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="fd-row fd-mrow"
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
                    <span className="fd-label-text">
                      {item.label}
                      {/* ✦ — a Studio product, sitting at its moment. The
                          heading that used to say so is dissolved. */}
                      {item.studio ? (
                        <span className="fd-spark" aria-hidden="true">✦</span>
                      ) : null}
                    </span>
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
