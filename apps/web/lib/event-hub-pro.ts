/**
 * apps/web/lib/event-hub-pro.ts
 *
 * ONE UNLOCK, OFFERED WHERE IT IS MISSED — the Event Hub controller's Pro offer.
 * Design: `EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md` § 5.1 rule 1 (*"every
 * upgrade is offered at the point of absence"*) and § 5.3 (the seven items and
 * the channel each belongs to). Drawing: prototype § 4.
 *
 * Owner, 2026-09-02: *"the cinematic reveal, added features like background
 * music, upload photo/video, and other pro features should be managed on the
 * controller as well."*
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
 * It is NOT seven upgrade slots, and it is NOT a shop tab. The seven Pro items
 * are ONE unlock — `COUPLE_WEBSITE_PRO`, titled "Event Hub Pro" in the live
 * catalog — and `pro-panels.tsx` has said so since it shipped: *"the seven Pro
 * items are ONE unlock … no per-feature buy button."* So the controller grows
 * exactly ONE offer, and moves it to whichever channel the couple is standing on
 * when they meet the wall. Same unlock, same price, bought in place.
 *
 * Shaped after `lib/event-hub-control.ts` and `lib/live-studio-control.ts`: the
 * decisions are PURE functions, so the page and the tests share one source of
 * truth and cannot drift.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🪤 THE PRECEDENT THAT MAKES THIS FILE DANGEROUS — PAPIC'S CARD, ONE YEAR DARK
 * ══════════════════════════════════════════════════════════════════════════
 * Papic was gated on `eventPapicSeatsActive()`, a retired SKU with ZERO orders
 * ever, so the one page that exists to say "start this now, it's your wedding
 * day" was permanently stuck on the UPSELL branch for every couple — including
 * couples whose event already held a free camera. A gate that can only ever
 * answer one way is indistinguishable, in the render, from a gate that works.
 *
 * 🔒 So `ownsPro` enters this module as a BOOLEAN THE CALLER MEASURED, and
 * `event-hub-pro.test.ts` constructs an OWNING event and asserts the offer is
 * `null` — the launch branch — rather than only asserting the upsell renders.
 *
 * ⛔ AND NO PRICE IS WRITTEN HERE, OR ANYWHERE IN THE RENDER PATH. The figure is
 * read live from `platform_retail_catalog_v2` through `formatV2Sku` and handed to
 * the component as an already-formatted string. `couple-website-pro.ts` records
 * why: that file once carried ₱3,999 in one docblock and ₱4,999 in another while
 * the live row said ₱3,500 — three figures for one product, in one file.
 */
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';
import { hubOffersAllowed } from '@/lib/event-hub-control';
import {
  WEBSITE_PRO_ITEMS,
  NOT_SOLD_ON,
  type WebsiteProItem,
} from '@/lib/website-pro-items';

/** One chip in the seven — `here` is the item this channel is being sold on. */
export type HubProChip = {
  name: WebsiteProItem;
  /** True for exactly one chip: the item the couple is standing in front of. */
  here: boolean;
};

/** The single offer the controller may make, already resolved for one channel. */
export type HubProOffer = {
  /** The Pro item this channel is missing — the lit chip, and the headline. */
  lead: WebsiteProItem;
  /** Which of the four public pages this offer is attached to. */
  channel: LifecyclePhase;
  headline: string;
  blurb: string;
  /** All seven, in catalog order, exactly one flagged `here`. */
  chips: readonly HubProChip[];
  ctaLabel: string;
  /** Path RELATIVE to `/dashboard/<eventId>` — the shipped buy surface. */
  ctaPath: string;
};

/**
 * THE ITEM EACH CHANNEL IS SOLD ON (design § 5.3 table, prototype § 4).
 *
 * Exhaustive over `LifecyclePhase` on purpose — a `Record` rather than a switch
 * with a default, so adding a fifth public page is a TYPE ERROR here instead of
 * a silent fall-through to whatever the default happened to be.
 *
 * ⚠ TWO OF THE FOUR ARE UNREACHABLE TODAY, AND THAT IS SETTLED, NOT ACCIDENTAL.
 * `hubOffersAllowed` (EH1) is `phase === 'plan'`, and the stage resolver only
 * reaches `event` / `editorial` once the celebration is happening or has
 * happened — which is `dayof` / `after`, both of which that predicate refuses on
 * purpose (see its call site below). So in practice only the Save-the-Date and
 * RSVP channels can ever carry an offer, and that is the owner's ruling working,
 * not a gap. The two entries below are kept because the mapping must be total
 * and because the free-for-all ruling on `EDITORIAL_PRO` is reversible; they are
 * not dead code pretending to be live.
 */
const LEAD_BY_CHANNEL: Record<LifecyclePhase, WebsiteProItem> = {
  // The reveal is the thing the couple watches and cannot have yet.
  save_the_date: 'Cinematic Reveal',
  // The invitation is where the photos go.
  rsvp: 'Photo gallery',
  /*
    The day itself. Nothing here is for sale on the day — `hubOffersAllowed`
    collapses the whole block — so this entry exists for totality. It names a
    global item rather than a day-of one so that IF the day gate is ever widened
    the offer that appears is at least true.
  */
  event: 'Background music',
  // The story. Photos again — never "Editorial editing", which is free (below).
  editorial: 'Photo gallery',
};

/** The headline + blurb for each item the controller may lead with. */
const PITCH: Record<WebsiteProItem, { headline: string; blurb: string }> = {
  'Cinematic Reveal': {
    headline: 'Open with a cinematic reveal.',
    blurb:
      'The veil, the church doors, the curtain — your save-the-date opens with one of them instead of starting flat. It is playing above right now; the unlock is what keeps it.',
  },
  'Save-the-Date video': {
    headline: 'Put your own film on the save-the-date.',
    blurb:
      'A clip of the two of you, where the hero photo is — the first thing anyone sees when your link goes out.',
  },
  'Photo gallery': {
    headline: 'Give your guests the photos.',
    blurb:
      'A gallery on the page itself, so the people you invited can look through the day rather than hunt for a folder.',
  },
  'Background music': {
    headline: 'Your page can have a song.',
    blurb:
      'One track, playing quietly behind whichever page your guests land on. It carries across all four.',
  },
  'Editorial editing': {
    /*
      ⛔ UNREACHABLE BY CONSTRUCTION — `resolveHubProOffer` refuses to lead on any
      item in `NOT_SOLD_ON`, and this is the only member. The entry exists so the
      `Record` stays total; if the owner ever reverses the free ruling, the copy
      is already here rather than invented in a hurry.
    */
    headline: 'Write the story yourself.',
    blurb: 'Chapters, named moments and your own words, in the after-story your guests come back to.',
  },
  'Background color': {
    headline: 'Your own colours, not ours.',
    blurb:
      'The background and the buttons, set to your palette — on every one of the four pages your link becomes.',
  },
  'Button color': {
    headline: 'Your own colours, not ours.',
    blurb:
      'The background and the buttons, set to your palette — on every one of the four pages your link becomes.',
  },
};

/**
 * THE ONE OFFER, OR NOTHING.
 *
 * `null` means the controller shows no offer at all — and it is `null` far more
 * often than not. The four ways it refuses, in order:
 *
 *   1. THE COUPLE ALREADY OWNS IT. No offer on any channel, ever. This is the
 *      branch the Papic defect could not reach for a year; it is tested with an
 *      owning event, not inferred.
 *   2. THE READ DID NOT HAPPEN. An unmeasured stage is not a stage. Selling a
 *      couple the reveal because a refused query resolved to 'save_the_date' is
 *      the same defect as telling them they have no guests — it just costs money.
 *   3. `hubOffersAllowed` SAYS NO. EH1's predicate, already tested there, called
 *      and never re-derived. ⚠ ITS ONE LINE DOES THREE JOBS, and its own docblock
 *      names all three — read it before touching anything near it:
 *        · ON THE DAY — an offer never outranks the day (design § 5.1 rule 3).
 *        · AFTER THE DAY — the row closes rather than sells. This is the OWNER'S
 *          RULING of 2026-08-21 ("stop selling the day itself once the day is
 *          over"), shipped three weeks before this stream and guarded by
 *          `lib/stop-selling-the-day-after-the-day.test.ts`.
 *        · UNMEASURED (`null`) — we do not know whether it is their wedding day,
 *          and an unread state must never become a sale. This is a THIRD case,
 *          not a corollary of the other two, and it is proved at the render in
 *          `hub-pro-offer-renders.test.ts`.
 *      🛑 DO NOT WIDEN IT, do not relax it to day-only, and do not write a second
 *      gate beside it. `phase === 'plan'` is correct as shipped and is settled.
 *      When the design document said only "never on the day", the DOCUMENT was
 *      the stale half — it has since been corrected in the corpus to state all
 *      three. The code was right the whole time.
 *   4. THE ONLY THING TO SELL IS ALREADY FREE. `NOT_SOLD_ON` — see below.
 *
 * ⚠ `ownsPro` must be the ACTIVE gate (`eventCoupleWebsiteProActive`), not the
 * buy-surface reader: a couple whose payment is still in reconciliation should
 * not be asked to buy the same unlock twice, and `eventOwnsCoupleWebsitePro`
 * counts that 'submitted' order. The caller passes owned-OR-active for exactly
 * that reason and its own comment says so.
 */
export function resolveHubProOffer(args: {
  /** The live public channel, from `resolveHubStage`. Null ⇒ unmeasured. */
  channel: LifecyclePhase | null;
  /** The dashboard phase, from `resolveHubPhase`. Null ⇒ unmeasured. */
  phase: MenuLifecyclePhase | null;
  /** Measured ownership of `COUPLE_WEBSITE_PRO`. True ⇒ no offer, anywhere. */
  ownsPro: boolean;
}): HubProOffer | null {
  if (args.ownsPro) return null;
  if (args.channel === null) return null;
  if (!hubOffersAllowed(args.phase)) return null;

  const lead = LEAD_BY_CHANNEL[args.channel];
  /*
    ⛔ THE ONE WE MAY NOT SELL ON. If a channel's lead item is free for everyone
    the controller says nothing rather than charging for an inclusion the couple
    already has. Today that is only 'Editorial editing', and no channel leads
    with it — but the mapping and the free list are two separate owner decisions,
    and this is the line that keeps them from silently colliding.
  */
  if (NOT_SOLD_ON.includes(lead)) return null;

  return {
    lead,
    channel: args.channel,
    headline: PITCH[lead].headline,
    blurb: PITCH[lead].blurb,
    chips: WEBSITE_PRO_ITEMS.map((name) => ({ name, here: name === lead })),
    ctaLabel: 'Unlock all seven',
    // The SHIPPED buy surface — the same href `website/editor/page.tsx` uses for
    // `ProLockPanel`. No new checkout, no new route.
    ctaPath: '/studio/website-pro',
  };
}
