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

export type NavSlotKey = 'home' | 'details' | 'camera' | 'watch' | 'gallery' | 'me';

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
  /** Is a broadcast running right now? */
  liveBroadcast: boolean;
  /** Where each leaving slot goes, resolved by the caller (it knows the slug,
   *  the guest's token and whether a paid roll exists). A missing destination
   *  means the caller could not build one — the slot then LOCKS rather than
   *  pointing nowhere. */
  destinations?: { camera?: string | null; watch?: string | null };
};

/** In-page anchors, mirroring SITE_MENU_ANCHORS. */
const ANCHOR: Record<'home' | 'details' | 'gallery' | 'me', string> = {
  home: '#site-home',
  details: '#site-details',
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
  } else if (phase === 'before') {
    slots.push({ key: 'details', label: 'Details', state: 'live', href: ANCHOR.details });
  } else if (isVendor) {
    slots.push({ key: 'details', label: 'Cues', state: 'live', href: ANCHOR.details });
  }

  // 3 — CAMERA (Papic). The centre slot on the day.
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
  slots.push({
    key: 'me',
    href: ANCHOR.me,
    label: isVendor
      ? vendorSlotLabel(viewer.kits)
      : isCouple
        ? 'Manage'
        : viewer.kind === 'guest'
          ? 'Me'
          : 'Join',
    state: 'live',
  });

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
