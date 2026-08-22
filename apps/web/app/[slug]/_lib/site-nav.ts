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
    // ⚠ THE HOST'S SWITCH IS THE GATE — owner ruling, pinned by
    // site-nav.test.ts ("for everyone else the HOST'S SWITCH is the gate").
    // An earlier cut of this fix ALSO required a guest session here, which
    // reads as the obvious repair for the camera dead-end and quietly repeals
    // that ruling. The dead end was never the gate: it was the DESTINATION,
    // whose only way out left the event entirely. Fixed there instead — the
    // camera link now carries the event so the refusal can send them back to
    // the invitation rather than to Setnayan's homepage.
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
 * ── WHERE THE CARDS ARE, AND WHY IT CHANGED ─────────────────────────────────
 * They were first mounted on the day-of hub — and the hub's own link only
 * appears once the wedding is live or over. So the 3D room's card said "Look
 * around the reception BEFORE YOU ARRIVE" on a surface no one could reach
 * until they had arrived. Both cards now also mount on the event page itself
 * (`site-body.tsx`, above the identity fork), which is the page every guest
 * already has: one mount serves the invited guest and the cookie-less relative
 * alike, in every phase.
 *
 * ⚠ NEITHER PAGE IS TIME-GATED — checked, not assumed. `/venue` asks only
 * whether the plan is published; `/pabuya` asks only its flag, its surface,
 * its visibility and its destinations. Nothing in either refuses a visitor for
 * being early, so nothing here needs a phase.
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
  /**
   * MAY THIS VIEWER OPEN THE MONEY-GIFT PAGE AT ALL?
   *
   * 🚨 THE ONE PLACE THE DOOR AND THE DESTINATION CAN DISAGREE, AND IT IS NOT
   * HYPOTHETICAL. `/[slug]/pabuya` runs `canViewSlugEvent` against the RAW
   * `events.landing_page_visibility` column. Both surfaces that draw this card
   * — the event page and the hub — decide what THEY show from
   * `resolveEffectiveVisibility`, which additionally reports 'public' the
   * instant a SCHEDULED launch falls due, before anything has written the
   * column (the write is deferred to an `after()` task that is allowed to
   * fail). So in that window a stranger reads a fully public wedding page,
   * taps "Send a blessing", and is redirected straight back to where they
   * started with no explanation.
   *
   * The caller answers the destination's own question — the raw column, not
   * the effective one — and a `false` here removes the card. A door must never
   * be drawn by a rule laxer than the one at the other end of it.
   */
  pabuyaViewerAllowed: boolean;
};

/**
 * Everything a doorway decision needs EXCEPT who is holding the phone — the
 * facts about the event, resolved once by the server and handed down. The slug
 * and the personal token are added at the render site, because the same page
 * serves an invited guest (who has one) and a cookie-less relative (who does
 * not) from ONE resolution of these facts.
 */
export type DoorwayFacts = Pick<
  DoorwayInput,
  | 'seatingSurfaceEnabled'
  | 'seatingPublished'
  | 'pabuyaRouteEnabled'
  | 'enabledEgiftCount'
  | 'pabuyaViewerAllowed'
>;

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
  // difference between a page and an apology; the third is the visibility rule
  // the page itself applies, which is NOT the one this page was drawn under.
  const pabuya =
    input.pabuyaRouteEnabled && input.enabledEgiftCount > 0 && input.pabuyaViewerAllowed
      ? `${base}/pabuya`
      : null;

  return { venueWalk, pabuya };
}

/* ══════════════════════════════════════════════════════════════════════════
 * "WE'LL BE STREAMING" — the sentence that was only ever said too late.
 *
 * The broadcast block (`watch-live-block.tsx`) is loaded and rendered ONLY
 * while `dayOfPhase === 'live'`. Everything before that — the months when a
 * relative in Dubai or Riyadh is deciding whether to take the day off, and the
 * morning when they are wondering whether to stay up — says nothing at all.
 * The couple has saved their broadcast link; the page simply keeps it to
 * itself until the window opens, which is the one moment the information is no
 * longer useful.
 *
 * ── WHY IT IS A NOTICE AND NOT A DOOR ───────────────────────────────────────
 * 🔑 THE SAME RULE AS THE CARDS ABOVE, AND IT LANDS THE OTHER WAY HERE. A
 * doorway is only honest if the destination would let this viewer in — and a
 * YouTube or Facebook link saved weeks ahead CANNOT be known to be open. A
 * scheduled premiere shows a countdown; a link typed for a stream not yet
 * created shows "video unavailable"; and there is no way to tell the two apart
 * from here, because the Google account that could answer is suspended (appeal
 * 73857927). The live block already carries an apology for exactly this, and
 * it is there because on the day the player is unavoidable. Before the day it
 * is entirely avoidable.
 *
 * So this draws NO outbound link. It says one true thing — there will be a
 * stream, and it will appear on the page they are already looking at — which
 * is a promise about a page they have open, and therefore the only promise
 * here that cannot dead-end.
 *
 * ── THE FOUR FACTS ──────────────────────────────────────────────────────────
 * `liveMediaVisible` is load-bearing and easy to miss: a couple may keep the
 * livestream to invited guests only (`events.live_media_public` FALSE), and
 * announcing it to a cookie-less stranger would leak the existence of the very
 * thing they fenced. Rule 3 again — announce features, hide content.
 * ═══════════════════════════════════════════════════════════════════════════ */

export type BroadcastNoticeInput = {
  /**
   * Has the couple saved at least one USABLE destination? Read through
   * `resolveWatchLinks`, the same reducer the player is built from, so a
   * forged or malformed stored URL is "no broadcast" here exactly as it is
   * there. A saved link the player would refuse must not become a promise.
   */
  broadcastPlanned: boolean;
  /**
   * May THIS viewer tier see the couple's live media at all? Guests always;
   * a cookie-less visitor only when the couple opted `live_media_public`.
   * (`resolveSiteBodyPlan().liveMediaVisible` is exactly this value.)
   */
  liveMediaVisible: boolean;
  /** The window this page is rendering in. */
  dayOfPhase: DayOfPhase | null | undefined;
  /**
   * Is the real player already mounted on this page? Two claims about one
   * broadcast, one of them stale, is worse than the silence this replaces.
   */
  playerOnPage: boolean;
  /**
   * 🚨 THE SECOND INPUT, AND THE REASON IT EXISTS. `dayOfPhase` CANNOT tell
   * "before" from "after" on its own: `inactive` is EVERYTHING outside the
   * day-of window — the months before the wedding AND the Thursday after it.
   * `post` runs out about two and a half days past the event, and then the
   * clock says `inactive` again forever. Gating this notice on `post` alone
   * therefore brings it BACK the following week, telling the guests of a
   * wedding that already happened that it "will be streamed live" on a date in
   * the past.
   *
   * This is the same trap `navPhaseFor` above documents, one surface over: the
   * bar had it twice in two days. The honest second input here is the calendar
   * — `events.event_date`, compared by DATE. Absent/unparseable never
   * suppresses: an event with no date has not happened.
   */
  eventDate: string | null | undefined;
};

/** Should the "we'll be streaming" notice be drawn? */
export function showBroadcastNotice(
  input: BroadcastNoticeInput,
  now: Date = new Date(),
): boolean {
  if (!input.broadcastPlanned) return false;
  if (!input.liveMediaVisible) return false;
  if (input.playerOnPage) return false;
  // Inside the day-of window's tail the phase is enough and is exact.
  if (input.dayOfPhase === 'post') return false;
  // Outside it, only the calendar knows which side of the wedding we are on.
  if (eventDayIsBehindUs(input.eventDate, now)) return false;
  return true;
}

/**
 * Is the event's calendar day strictly before today? Compared as DATES, not
 * instants, and in UTC — deliberately the crude comparison, because the only
 * job here is to tell "next March" from "last Saturday". The hours around the
 * wedding itself are owned by `dayOfPhase`, which is timezone-exact; this
 * closes the long tail after `post` expires, where the phase stops helping.
 */
function eventDayIsBehindUs(eventDate: string | null | undefined, now: Date): boolean {
  const raw = (eventDate ?? '').trim();
  if (!raw) return false;
  const day = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const today = now.toISOString().slice(0, 10);
  return day < today;
}
