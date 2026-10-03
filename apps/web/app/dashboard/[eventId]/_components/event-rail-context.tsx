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
 * from `buildCustomerNavGroups` — the rail's projection of the ONE tree in
 * `lib/customer-menu.ts` (`buildEventMenuSections`), which the phone's one
 * bottom bar reads too. Stage D (owner 2026-09-29):
 *
 *   (name row)  → Details (Event settings)
 *   (the five)  → Home · Guests · Suppliers · Hub · More Services (2026-10-01)
 *
 * 🔒 EVERY ROW IS A PLAIN LEAF — "solid menu with no submenus" (owner-locked
 * 2026-07-15) — WITH ONE EXCEPTION, BY THE OWNER, 2026-09-30: the More
 * Services row (key `studio`) expands and collapses to its five services
 * (*"the sidebar will expand and collapse to show these"*; DECISION_LOG "THE
 * SIDEBAR ROW 'MORE SERVICES' EXPANDS TO THE FIVE"). Tapping it only opens or
 * closes it — no navigation. It is CLOSED by default and opens on a tap or when
 * the current page is one of its five (owner 2026-10-01); the five sit in ONE
 * tinted, inset group (`.fd-msub`) so they read as inside More Services. `NavItem.children` is rendered for THAT ROW ONLY; every other row
 * stays a leaf, and a pillar's parts live inside its page (Guest list · Your
 * Team pick theirs from one dropdown; the Maker has Details).
 * `the-event-menu-is-one-tree.test.ts` holds "exactly one row opens".
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
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { asksForMoreServices } from '@/lib/studio-hub';
import { Settings } from 'lucide-react';
import { useRailActiveKey } from '@/app/_components/frontdoor/rail-active-key';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { NavItem } from '@/app/_components/nav/types';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';
import type { EventMenuChild, EventStudioRow } from '@/lib/customer-menu';
import { EventMonogram } from '@/app/_components/event-monogram';
import { buildCustomerNavGroups } from './customer-nav-config';
import { applyRegistry } from './customer-sidebar';
import { formatCount } from '@/lib/format-number';

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
  services,
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
    /** The logo moves and the animation is on (`logoPlaysFor`) — it plays. */
    plays?: boolean;
  } | null;
  navSlots?: Record<string, NavSlotLite>;
  hideKeys?: string[];
  websiteEnabled?: boolean;
  monogramEnabled?: boolean;
  slug?: string | null;
  guestCount?: number | null;
  /** Event lifecycle phase, resolved server-side in layout.tsx. The five rows
   *  are the same in every phase; the builder receives it for its own use —
   *  see `buildCustomerNavGroups`. Omitted ⇒ 'plan'. */
  phase?: MenuLifecyclePhase;
  /** Gates the Seat plan row. Undefined ⇒ shown. */
  seatingEnabled?: boolean;
  /** The event's Studio products as PLAIN DATA (key · href · name) — see
   *  `EventRailInputs.studioRows`. Claimed by the row that holds each one. */
  studioRows?: ReadonlyArray<EventStudioRow>;
  /** The App Store / Play Store shell — the one tree drops every row whose
   *  door `lib/store-shell.ts` refuses (`storeShellRefusesMenuRow`). This is
   *  the ☰ drawer on a phone, so it must not offer "Not available in the app". */
  storeShell?: boolean;
  /** The five under More Services — plain data built in layout.tsx
   *  (`ourServicesMenuChildren`). See `EventMenuCtx.services`. */
  services?: ReadonlyArray<EventMenuChild>;
}) {
  /*
    THE SAME BUILDER AND THE SAME REGISTRY OVERLAY THE SIDEBAR USES.

    🔑 RENDERING LABELS WITHOUT `applyRegistry` WOULD GIVE TWO ANSWERS TO ONE
    QUESTION: an admin renaming "Marketplace" would see it change on the phone
    and on the old sidebar, and NOT on the desktop rail — with nothing thrown.
    The plan names this as trap #6. The overlay also drops rows an admin has
    hidden, which is the sidebar's shipped behaviour for these keys.

    ⚠ `dayOfOpen` is deliberately not passed. It gates the Guests JOURNEY
    CHILDREN, and this rail renders children for More Services only (see the
    plain-leaf lock and its one exception in the header). Passing a
    client-effect value would buy nothing and would open a hydration split for
    a row that cannot render.
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
      services,
    }),
    navSlots,
  );

  /*
    ─── MORE SERVICES IS A ROW OF THE FIVE (Stage D 2026-09-29; renamed and
    opened 2026-09-30) ────────────────────────────────────────────────────
    The shop of Setnayan's own services is ONE row, "More Services" (the
    `studio` key). It opens to the five — Setnayan AI · Papic · Live Studio ·
    Music Maker · Patiktok — and their pages light this row.

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
  const moreOpen = useMoreOpen(activeKey === 'studio');

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
          <EventMonogram event={eventMonogram} size="sm" shape="square" plays={eventMonogram.plays} place="event-rail" />
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
          {/* ⚙ A GEAR, NOT THE WORD "DETAILS" (owner 2026-09-27: "make a
              settings icon"). "Details" also names the Event Hub Maker's
              include-checklist page, so one word meant two places; this row
              opens Event Settings (names, date, venues, guest count), so it
              wears the settings gear and says so. */}
          <span className="fd-rctx-sub fd-rctx-settings">
            <Settings aria-hidden className="fd-rctx-gear" strokeWidth={1.75} />
            Event settings
          </span>
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
              {/* The five carry no heading — an empty label draws nothing
                  rather than an empty eyebrow. */}
              {group.label ? (
                <div className="fd-rlabel fd-rsub">
                  {group.label}
                </div>
              ) : null}
              {group.items.map((item) => {
                const Icon = item.icon;
                const on = activeKey === item.key;
                // 📂 The one row that opens (owner 2026-09-30) — `studio` only.
                if (item.key === 'studio' && item.children?.length) {
                  const [open, setOpen] = moreOpen;
                  return (
                    <div key={item.key}>
                      <button
                        type="button"
                        className="fd-row fd-mrow"
                        data-on={on ? 'true' : 'false'}
                        aria-expanded={open}
                        aria-controls="fd-more-services"
                        onClick={() => setOpen(!open)}
                      >
                        {rowInner(Icon, item.label)}
                        <span className="fd-mchev" aria-hidden="true" />
                      </button>
                      <ul id="fd-more-services" className="fd-msub" hidden={!open} aria-label={item.label}>
                        {item.children.map((c) => (
                          <li key={c.key}>
                            <Link href={c.href} className="fd-row fd-mrow fd-mchild">
                              {rowInner(c.icon, c.label, c.description)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }
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
                    {rowInner(Icon, item.label)}
                    {item.badge ? (
                      <>
                        <span className="fd-ct fd-mono">{formatCount(item.badge.count)}</span>
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

/** One rail row's icon, word and 72px-strip caption — shared by every row. */
function rowInner(Icon: NavItem['icon'], label: string, sub?: string) {
  return (
    <>
      <span className="fd-gi" aria-hidden="true">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      {/* A service's Setnayan name sits small UNDER its plain name (owner d17). */}
      <span className="fd-label-text">
        {sub ? (
          <span className="flex flex-col leading-tight">
            {label}
            <span className="text-[12.5px] text-ink/55">{sub}</span>
          </span>
        ) : (
          label
        )}
      </span>
      <span className="fd-icon-caption">{label}</span>
    </>
  );
}

/** More Services' open/closed. CLOSED by default; a tap opens or closes it,
 *  and arriving on one of its five pages (`on`) opens it. Not remembered on the
 *  device any more (owner 2026-10-01, "closed by default"): a remembered "open"
 *  would bring the five back as eleven rows on the next visit. */
function useMoreOpen(on: boolean): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(on);
  const [was, setWas] = useState(on);
  if (on !== was) {
    setWas(on);
    if (on) setOpen(true);
  }
  /* 🧭 OPENED BY ITS ADDRESS (owner 2026-10-02, tracker d1). The full-page
     More Services is gone; "the services" now opens Home with `?more=services`
     (`studioHubHref`) — and on a laptop that means this row, open. Read from
     the URL each time it changes, so a link from inside the event opens it
     too, not only a fresh load. Still not remembered. */
  const search = useSearchParams()?.toString() ?? '';
  useEffect(() => {
    if (asksForMoreServices(search)) setOpen(true);
  }, [search]);
  return [open, setOpen];
}
