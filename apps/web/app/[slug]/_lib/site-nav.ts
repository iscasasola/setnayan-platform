/**
 * THE EVENT-SITE NAVIGATION RESOLVER.
 *
 * One bar. Five slots. It resolves for whoever is holding the phone and for how
 * close the wedding is. Not four different menus — one shape everybody learns
 * once, whose slots fill with what that person can actually use and EMPTY when
 * there is nothing honest to put in them.
 *
 * ── WHY THIS IS A PURE FUNCTION AND NOT A COMPONENT ─────────────────────────
 * Every rule below is an owner ruling, and rulings are what regress. Keeping
 * them in one testable place means the next person changing the bar has to
 * change a decision, not a layout — and the test tells them which decision.
 *
 * ── THE RULINGS IT ENCODES (owner, 2026-08-03) ──────────────────────────────
 *
 *  1. "the couple always have their papic. since they can take photos anytime"
 *     → the couple's camera is UNCONDITIONAL. No phase, no switch removes it.
 *
 *  2. "the papic service will always run but the host of the event has the
 *     power to allow use and not allow use"
 *     → for everyone else the gate is the HOST'S SWITCH, not the calendar. And
 *       when it is closed the slot is still DRAWN, locked — because the camera
 *       is part of what the invitation promises. Never silently absent, never
 *       a dead button.
 *
 *  3. "gallery will be optional if the couple allows which chapters are
 *     viewable in public" … "not see at all"
 *     → when no chapter is public the Gallery slot is NOT DRAWN for anyone but
 *       the couple.
 *
 *     🔑 THE ASYMMETRY IS DELIBERATE, and it is the subtlest thing here: a
 *     LOCKED camera reveals a FEATURE that is coming, which is fine to promise.
 *     A greyed-out Gallery would reveal that PHOTOGRAPHS EXIST AND ARE BEING
 *     WITHHELD — the very thing the couple asked to keep private. So the rule
 *     is: ANNOUNCE FEATURES, HIDE CONTENT.
 *
 *  4. "papic button as well" — on the day a guest needs BOTH the camera and the
 *     broadcast. An earlier draft let Watch take the Gallery slot; that made the
 *     gallery vanish the moment a livestream began. Watch earns its own slot.
 *
 *  5. "there are vendors of a specific category that has special functions.
 *     these functions does not always show. it only shows when they have that
 *     service for the event"
 *     → a supplier's last slot carries only the kit their booked category
 *       unlocks on THIS event, and it is a SET: one person can hold two
 *       ("there is a stylist and an emcee both in 1 service", 2026-08-01).
 *
 * ── NAMING LOCK ─────────────────────────────────────────────────────────────
 * The photo slot is "Gallery", NEVER "Photos" — `site-menu.ts` carries the
 * owner rename. Labels are one word because a nav label that wraps grows its
 * slot and tilts the whole bar.
 */

import type { DayOfPhase } from '@/lib/day-of-mode';

/** Who is holding the phone. */
export type NavViewer =
  | { kind: 'public' }
  | { kind: 'guest' }
  | { kind: 'couple' }
  /** A booked supplier, with the kits their category unlocks on this event. */
  | { kind: 'vendor'; kits: readonly VendorKit[] };

/** The three shipped day-of specializations (lib/vendor-specialization-gate.ts). */
export type VendorKit = 'floor_command' | 'song_desk' | 'stage_script';

/** How close the wedding is. */
export type NavPhase = 'before' | 'day' | 'after';

/**
 * WHICH MOMENT IS IT? — the one mapping from the site's clock to the bar's.
 *
 * 🚨 WHY THIS IS NOT `dayOfPhase` ALONE, WHICH IS WHAT IT USED TO BE.
 *
 * `DayOfPhase` is a WINDOW, not a timeline. Its four values are:
 *
 *     pre   T-3d .. T-12h
 *     live  T-12h .. T+36h
 *     post  T+36h .. T+60h        ← two and a half days, then it stops
 *     inactive  EVERYTHING ELSE   ← both "months before" AND "the week after"
 *
 * The bar used to read `live → day`, `post → after`, everything else `before`.
 * So on the Thursday after a Saturday wedding the site flipped back to
 * `before`: the Gallery slot — the one thing a guest opens the page for now —
 * was not drawn, Home stopped saying "Recap", and the run-up tabs (Details,
 * Story) came back on a page that is a memorial. Nothing failed; the bar simply
 * believed the wedding had not happened yet.
 *
 * 🔑 THE SECOND INPUT IS THE BODY THE PAGE IS ACTUALLY RENDERING. When the site
 * has entered its post-event recap, the wedding is behind us — by definition,
 * because that is the same verdict that put the recap on the screen. Deriving
 * the bar's moment from the page's own moment is what stops the two disagreeing
 * a third time (they have already done so twice in two days).
 *
 * ⚠ `post` is kept as an independent `after` trigger rather than being folded
 * into `isRecapBody`: the recap body additionally requires the website-phases
 * switch, and a wedding that ended yesterday is over whether or not that switch
 * is on.
 */
export function navPhaseFor(input: {
  dayOfPhase: DayOfPhase | null | undefined;
  /** Is the page rendering the post-event editorial recap right now? */
  isRecapBody: boolean;
}): NavPhase {
  if (input.dayOfPhase === 'live') return 'day';
  if (input.dayOfPhase === 'post' || input.isRecapBody) return 'after';
  return 'before';
}

export type NavSlotKey = 'home' | 'details' | 'story' | 'camera' | 'watch' | 'gallery' | 'me';

export type NavSlot = {
  key: NavSlotKey;
  /** One word. Never wraps. */
  label: string;
  /** `locked` is drawn but not pressable, and MUST carry a reason. */
  state: 'live' | 'locked';
  /** Why it is locked — shown to the viewer. Absent when live. */
  lockedReason?: string;
  /**
   * Where the slot goes. An in-page `#anchor` for the sections of the site
   * itself; a real path for the ones that LEAVE (the camera, the broadcast).
   * Carried here so the bar renders slots without knowing any routing — the
   * rules live in one tested place, and a component cannot quietly invent a
   * destination the rules never sanctioned.
   */
  href: string;
};

export type NavInput = {
  viewer: NavViewer;
  phase: NavPhase;
  /** The host's Papic switch. Irrelevant for the couple, who always have theirs. */
  hostAllowsCamera: boolean;
  /** Has the couple made at least one gallery chapter public? */
  anyChapterPublic: boolean;
  /** Did the couple write a story section? */
  hasStory?: boolean;
  /** Is a details section actually on the page? Without this the Details tab
   *  was pushed unconditionally and scrolled to an anchor that did not exist —
   *  a tab that does nothing when tapped. */
  hasDetails?: boolean;
  /** Is a broadcast running right now? */
  liveBroadcast: boolean;
  /** Where each leaving slot goes, resolved by the caller (it knows the slug,
   *  the guest's token and whether a paid roll exists). A missing destination
   *  means the caller could not build one — the slot then LOCKS rather than
   *  pointing nowhere. */
  destinations?: { camera?: string | null; watch?: string | null; join?: string | null };
};

/** In-page anchors, mirroring SITE_MENU_ANCHORS. */
const ANCHOR: Record<'home' | 'details' | 'story' | 'gallery' | 'me', string> = {
  home: '#site-home',
  details: '#site-details',
  story: '#site-story',
  gallery: '#site-gallery',
  me: '#site-me',
};

/** One-word kit labels — the nav cannot hold "Script & cues" (it wraps). */
const KIT_SLOT_LABEL: Record<VendorKit, string> = {
  floor_command: 'Floor',
  song_desk: 'Songs',
  stage_script: 'Script',
};

/**
 * Resolve the bar. Returns an ORDERED list of AT MOST FIVE slots; anything a
 * viewer cannot use is simply not returned, so the remaining slots widen rather
 * than leaving a hole or a dead button.
 */
export function resolveSiteNav(input: NavInput): NavSlot[] {
  const { viewer, phase, hostAllowsCamera, anyChapterPublic, liveBroadcast } = input;
  const dest = input.destinations ?? {};
  const hasStory = input.hasStory ?? false;
  const isVendor = viewer.kind === 'vendor';
  const isCouple = viewer.kind === 'couple';
  const slots: NavSlot[] = [];

  // 1 — HOME. Always present; its name follows the phase.
  slots.push({
    key: 'home',
    label: phase === 'day' ? 'Now' : phase === 'after' ? 'Recap' : 'Home',
    state: 'live',
    href: ANCHOR.home,
  });

  // 2 — DETAILS, or WATCH once a broadcast is actually running. Watch takes
  //     this slot rather than the Gallery one: on the day a viewer needs the
  //     camera AND the gallery, so the broadcast may not displace either.
  if (phase === 'day' && liveBroadcast && !isVendor) {
    slots.push(
      dest.watch
        ? { key: 'watch', label: 'Watch', state: 'live', href: dest.watch }
        : { key: 'watch', label: 'Watch', state: 'locked', href: '#', lockedReason: 'The broadcast has not started' },
    );
  } else if (phase === 'before' && (input.hasDetails ?? true)) {
    slots.push({ key: 'details', label: 'Details', state: 'live', href: ANCHOR.details });
  } else if (isVendor) {
    slots.push({ key: 'details', label: 'Cues', state: 'live', href: ANCHOR.details });
  }

  // 3 — STORY. The couple's own words, before the day only: once the wedding is
  //     happening, Now/Watch/Camera/Gallery are what a guest needs, and the bar
  //     holds five.
  if (phase === 'before' && !isVendor && hasStory) {
    slots.push({ key: 'story', label: 'Story', state: 'live', href: ANCHOR.story });
  }

  // 4 — CAMERA (Papic). The centre slot on the day.
  if (isCouple) {
    // Unconditional. It is their wedding.
    slots.push(
      dest.camera
        ? { key: 'camera', label: 'Camera', state: 'live', href: dest.camera }
        : {
            key: 'camera',
            label: 'Camera',
            state: 'locked',
            href: '#',
            lockedReason: 'No camera is open for this event yet',
          },
    );
  } else if (!isVendor) {
    slots.push(
      hostAllowsCamera && dest.camera
        ? { key: 'camera', label: 'Camera', state: 'live', href: dest.camera }
        : {
            key: 'camera',
            label: 'Camera',
            state: 'locked',
            href: '#',
            lockedReason: 'The host has not opened the camera',
          },
    );
  }
  // Suppliers get no camera slot: they shoot on their own gear, and Papic is a
  // guest product (owner, 2026-08-03: "papic is not used by photographers").

  // 4 — GALLERY. The couple always has it — they see everything, including what
  //     they have not shared. Everyone else only when a chapter is public, and
  //     when none is, the slot is NOT DRAWN. Hiding content, not announcing it.
  if (!isVendor && (phase === 'day' || phase === 'after')) {
    if (isCouple || anyChapterPublic) {
      slots.push({ key: 'gallery', label: 'Gallery', state: 'live', href: ANCHOR.gallery });
    }
  }

  // 5 — ME. Always last, always present; its name follows who they are.
  //
  // ⚠ A STRANGER'S "Join" USED TO GO NOWHERE. `ANCHOR.me` is an in-page anchor,
  // and for a visitor with no invite that section is an empty aria-hidden div —
  // so the one tab inviting a relative to add themselves did nothing when
  // tapped, while the page that actually works (`/[slug]/invite`) was linked
  // from nowhere. A stranger's Join now LEAVES for that page; if the caller
  // could not build the link, the slot LOCKS rather than pretending.
  const isStranger = !isVendor && !isCouple && viewer.kind !== 'guest';
  if (isStranger) {
    slots.push(
      dest.join
        ? { key: 'me', label: 'Join', state: 'live', href: dest.join }
        : {
            key: 'me',
            label: 'Join',
            state: 'locked',
            href: '#',
            lockedReason: 'Open your invitation link to join this guest list',
          },
    );
  } else {
    slots.push({
      key: 'me',
      href: ANCHOR.me,
      label: isVendor ? vendorSlotLabel(viewer.kits) : isCouple ? 'Manage' : 'Me',
      state: 'live',
    });
  }

  return slots;
}

/**
 * A supplier's last slot. One kit → that kit's name. Two or more → "Kits",
 * because a person can hold several and the bar cannot list them.
 * None → "Tools": not a failure, the ordinary kit is their whole kit.
 */
function vendorSlotLabel(kits: readonly VendorKit[]): string {
  if (kits.length === 0) return 'Tools';
  if (kits.length > 1) return 'Kits';
  const only = kits[0];
  return only ? KIT_SLOT_LABEL[only] : 'Tools';
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE DOORS THAT ARE NOT SLOTS.
 *
 * A feature audit found two FINISHED, WORKING guest pages that nothing in the
 * product linked to: the 3D walk-through of the reception (`/[slug]/venue`) and
 * the money-gift page (`/[slug]/pabuya`). Both shipped, both render — and the
 * only way to reach either was to type the address by hand.
 *
 * ── WHY THEY ARE NOT TABS ───────────────────────────────────────────────────
 * The bar above holds FIVE slots and both the pre-day and the live-broadcast
 * bars are already full (Home · Details · Story · Camera · Me, and Now · Watch ·
 * Camera · Gallery · Me). A sixth tab is not a small addition — it is a redesign
 * of an owner-locked shape, and a tab that appears only when the bar happens to
 * have room teaches people the bar is unreliable, which is the exact failure
 * this file's rulings exist to prevent. So these two are CARDS on a surface a
 * guest is already reading, and the rules for whether to draw them live HERE,
 * next to the slot rules, because they are the same kind of thing: a decision
 * about whether a door is honest to show.
 *
 * ── THE ONE RULE BOTH OBEY ──────────────────────────────────────────────────
 * 🔑 A DOORWAY MUST BE GATED ON WHAT THE DESTINATION ITSELF DEMANDS, NOT ON
 * WHETHER THE ROUTE EXISTS. Both pages are reachable-but-refusing in ordinary
 * conditions: `/venue` answers "the 3D venue isn't ready yet" until the couple
 * PUBLISHES the floor plan, and `/pabuya` answers "hasn't set up e-gifts yet"
 * until at least one destination is enabled. Linking to either without the
 * matching check trades an invisible page for a visible dead end, which is
 * worse — a guest who is turned away once stops tapping.
 *
 * Unlike the slots, these NEVER draw locked. A locked tab announces a feature
 * the invitation promises; a locked card would announce that this couple has a
 * money-gift page they have not filled in, which is theirs to disclose.
 * Announce features, hide content — rule 3 above, applied one layer out.
 * ═══════════════════════════════════════════════════════════════════════════ */

export type DoorwayInput = {
  /** The event's own slug. Absent → no doors: we cannot build an address. */
  slug: string | null | undefined;
  /**
   * The viewer's personal invitation token, when they hold one. It is what
   * makes the 3D room show THEIR seat and their tablemates' names; without it
   * the walk-through still opens, just anonymised.
   */
  guestToken?: string | null;
  /**
   * Does this event TYPE have seating at all? `public_venue_scene` asks
   * `event_type_profiles` the same question and answers "not published" when
   * the answer is no.
   */
  seatingSurfaceEnabled: boolean;
  /** `event_floor_plan.published_at IS NOT NULL` — the RPC's own gate. */
  seatingPublished: boolean;
  /** `PABUYA_PUBLIC_ROUTE_ENABLED`. Off ⇒ the route 404s, so no door. */
  pabuyaRouteEnabled: boolean;
  /**
   * How many e-gift destinations the couple has ENABLED. Zero ⇒ the page
   * renders its empty state, so the card would be a door onto an apology.
   */
  enabledEgiftCount: number;
};

export type GuestDoorways = {
  /** `/[slug]/venue`, with the personal token when we have one. */
  venueWalk: string | null;
  /** `/[slug]/pabuya`. */
  pabuya: string | null;
};

/** Resolve the two non-slot doors. `null` means DO NOT DRAW IT. */
export function resolveGuestDoorways(input: DoorwayInput): GuestDoorways {
  const slug = (input.slug ?? '').trim();
  if (!slug) return { venueWalk: null, pabuya: null };
  const base = `/${encodeURIComponent(slug)}`;

  // The 3D walk-through. Both conditions are the RPC's, restated — if it would
  // answer `{published:false}`, we do not offer the door.
  const token = (input.guestToken ?? '').trim();
  const venueWalk =
    input.seatingSurfaceEnabled && input.seatingPublished
      ? token
        ? `${base}/venue?t=${encodeURIComponent(token)}`
        : `${base}/venue`
      : null;

  // The money-gift page. The flag is the route's own switch; the count is the
  // difference between a page and an apology.
  const pabuya =
    input.pabuyaRouteEnabled && input.enabledEgiftCount > 0 ? `${base}/pabuya` : null;

  return { venueWalk, pabuya };
}
