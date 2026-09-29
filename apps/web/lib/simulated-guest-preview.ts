/**
 * Simulated "already replied" guest preview (editor RSVP'd tab · 2026-07-26).
 *
 * WHAT THIS IS FOR. The unified website editor previews the four lifecycle
 * phases by pointing its iframe at the couple's REAL page with `?phase=`. One
 * state it could never reach that way is the RSVPed fork — the moment a guest
 * has answered "attending" and the keepsake ticket takes the ask's place
 * (`site-body.tsx`, inside the `rsvp` phase). That fork is keyed on a GUEST's
 * own `rsvp_status`, and a host previewing their own site has no guest row, so
 * `?phase=rsvp` always shows them the un-answered ask. This module is the fifth
 * preview tab's whole decision + data surface.
 *
 * NOT A NEW LIFECYCLE PHASE. The public route validates `?phase=` against a
 * closed four-value allow-list, and `lib/site-body-plan.ts` is golden-tested
 * against those four. So the tab rides a SEPARATE param (`?as=replied`) and
 * still renders the `rsvp` phase — same phase, substituted identity. Nothing
 * below touches the plan, the widget registry, or the phase union.
 *
 * ── THE GUEST IS FABRICATED, NOT FETCHED ────────────────────────────────────
 * Every value the simulated guest carries is a constant in this file. Nothing
 * here reads the database, and no caller is expected to hand in a real guest.
 * Two reasons this is the design and not merely the convenient shortcut:
 *
 *   1. PRIVACY. Borrowing a real guest to make the preview "realistic" would
 *      render that person's name, meal preference and dietary notes to the host
 *      as set dressing — an RA 10173 surface created for a UI convenience.
 *      There is no consent story for that, so the path does not exist.
 *   2. THE FIREWALL STAYS EXACTLY AS STRONG. `lib/anonymous-zero-guest.test.ts`
 *      guards the "no guest bytes reach a non-guest" fence. Because this
 *      identity is assembled from literals, that fence is not weakened by a
 *      single byte — there is no query for a reviewer to audit, because by
 *      construction real guest data cannot flow down this path at all.
 *
 * ── ONE GATE, AND IT IS THE SERVER-VERIFIED CAPABILITY ──────────────────────
 * `shouldSimulateRepliedGuest` returns false unless the viewer holds an
 * `OwnerCapability` (PR #3764 — resolved from a real `event_members` /
 * `event_moderators` row, never from a param, header or cookie). `?as=replied`
 * is INERT on its own: for a guest or an anonymous visitor it is ignored
 * entirely and the ordinary page renders, byte for byte. There is no second,
 * weaker "maybe this is the host" signal anywhere on this path.
 *
 * 🔄 NARROWED 2026-09-27 (owner, DECISION_LOG "EACH EVENT'S EDITOR ADAPTS TO
 * THAT EVENT": *"each editor of each event will adapt to their event"* —
 * "previews that need a guest use a real guest from that event's list"). The
 * preview may now wear ONE real person's NAME and PLUS-ONE ALLOWANCE
 * (`PreviewPerson`), shown only to a verified host of that event, who already
 * sees that list. Everything else stays fabricated — no answer, meal, dietary
 * note, contact or photo is read — and the id stays the sample's, so nothing is
 * ever written for them. Point 1 above still holds for everything not named here.
 *
 * READ-ONLY BY CONSTRUCTION. This module returns literals. No write, no server
 * action, no persistence — the simulated guest exists for one render and is
 * never stored.
 */
import {
  guestIdentity,
  type GuestSiteIdentity,
  type OwnerCapability,
} from '../app/[slug]/_lib/site-identity';
import type { GuestRow } from '../app/[slug]/_lib/types';
import type { LifecyclePhase } from './invitation-widgets';

/** The query param the editor's RSVP'd tab appends. Deliberately NOT `phase` —
 *  see the module doc: `?phase=` has a closed four-value allow-list. */
export const SIMULATED_GUEST_PARAM = 'as';

/** The only value `?as=` accepts. Anything else is ignored. */
export const SIMULATED_GUEST_PARAM_VALUE = 'replied';

/**
 * The lifecycle phase the simulated guest is meaningful in. The RSVPed fork
 * lives inside `rsvp`; asking for it on the Save-the-Date, the day-of or the
 * editorial page would substitute an identity into a page that has no RSVP ask
 * to replace, so those are denied rather than silently half-applied.
 */
export const SIMULATED_GUEST_PHASE: LifecyclePhase = 'rsvp';

/**
 * Should this render substitute the simulated replied guest?
 *
 * Denies, in order:
 *   - no `OwnerCapability` — THE gate. Guests and anonymous visitors can put
 *     `?as=replied` on any URL they like and get the ordinary page;
 *   - a capability resolved for a DIFFERENT event than the one being rendered
 *     (stricter re-statement of the capability's own event binding, mirroring
 *     `buildOwnerRibbon` — a capability for event A never lights up event B);
 *   - any phase other than `rsvp`;
 *   - any `?as=` value other than `replied` (absent, empty, misspelt, an array
 *     from a repeated param — all false).
 */
export function shouldSimulateRepliedGuest(input: {
  ownerCapability: OwnerCapability | null;
  /** `searchParams.as` exactly as Next hands it over — a repeated param
   *  arrives as an array, which is never a match. */
  asParam: string | string[] | undefined;
  /** The phase the page ACTUALLY resolved (`phaseOverride ?? date-derived`). */
  lifecyclePhase: LifecyclePhase;
  /** The event being rendered — checked against the capability's binding. */
  eventId: string;
}): boolean {
  const { ownerCapability, asParam, lifecyclePhase, eventId } = input;
  if (!ownerCapability) return false;
  if (ownerCapability.ownerEventId !== eventId) return false;
  if (lifecyclePhase !== SIMULATED_GUEST_PHASE) return false;
  if (typeof asParam !== 'string') return false;
  return asParam.toLowerCase() === SIMULATED_GUEST_PARAM_VALUE;
}

// ── The fabricated guest ────────────────────────────────────────────────────
// Every literal below is invented. Read as a group they are meant to be
// unmistakable on screen: the host should never wonder whether they are looking
// at one of their actual guests.

/** Rendered name. Says what it is. */
export const SIMULATED_GUEST_DISPLAY_NAME = 'Sample Guest';

/** Sample seat. Not read from `event_tables` — a host with no seating chart
 *  still sees the keepsake's table line, which is the point of the preview. */
export const SIMULATED_GUEST_TABLE_LABEL = 'Table 1 · sample';

/** Stands in for `guests.guest_id`. Not an `S89G-` public id and not a UUID —
 *  it matches no row that can exist. (PahinaKeepsake folds it into a 3-digit
 *  stub number for the ticket corner; it is never rendered raw.) */
export const SIMULATED_GUEST_ID = 'sample-guest-preview';

/**
 * Placeholder for the invitation QR card. The guest tree injects `qrSvg` with
 * `dangerouslySetInnerHTML`, so this is a hand-authored constant rather than
 * anything derived from input — there is no untrusted value in it to escape.
 * A real QR is deliberately NOT generated: it would encode a token, and the
 * simulated guest has no token because it has no row.
 */
export const SIMULATED_GUEST_QR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Sample QR placeholder">' +
  '<rect x="2" y="2" width="116" height="116" rx="10" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="6 5"/>' +
  '<text x="60" y="56" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" letter-spacing="2.5" fill="currentColor" fill-opacity="0.55">SAMPLE</text>' +
  '<text x="60" y="76" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" letter-spacing="1.2" fill="currentColor" fill-opacity="0.4">QR CODE</text>' +
  '</svg>';

/** Copy shown where a real guest sees their personal invitation link. Not a
 *  URL, because a link that resolves to nothing is worse than a sentence. */
export const SIMULATED_GUEST_INVITATION_TEXT =
  'Sample link — every guest gets their own';

/**
 * The fabricated `guests` row. Frozen so a consumer cannot mutate the shared
 * constant; `buildSimulatedGuestIdentity` hands out a copy regardless.
 *
 * `rsvp_status: 'attending'` is the entire point — it is what puts the guest
 * tree on the keepsake side of the RSVPed fork.
 */
const SIMULATED_GUEST_ROW: Readonly<GuestRow> = Object.freeze({
  guest_id: SIMULATED_GUEST_ID,
  first_name: 'Sample',
  last_name: 'Guest',
  display_name: SIMULATED_GUEST_DISPLAY_NAME,
  role: 'guest',
  side: 'both',
  group_category: 'Sample',
  plus_one_of_guest_id: null,
  plus_one_mode: null,
  // The host's preview shows the card WITHOUT the bring-someone block: a
  // simulated guest has no host who allowed them one, and inventing a +1 in a
  // preview would show the couple a control their real guests may not have.
  plus_one_allowed: false,
  plus_one_name: null,
  rsvp_status: 'attending',
  meal_preference: null,
  dietary_restrictions: null,
  guest_note: null,
  // Empty, not invented — for the same reason as `qr_token` below. A sample
  // address or number that LOOKED real would be shown to the host previewing
  // their own site as a guest, and could be acted on. Empty also means the
  // reply card's contact block renders UNFOLDED here, which is the honest
  // preview: this sample person has told us nothing.
  email: null,
  mobile: null,
  custom_tags: [],
  // Empty, not invented: a fake token that LOOKED real could be pasted into a
  // scanner. Empty makes every token-gated affordance (seat pass, hub QR) fall
  // to its own absent-token branch.
  qr_token: '',
  photo_url: null,
  photo_source: null,
} satisfies GuestRow);

/**
 * THE SAMPLE GUEST THE MAKER'S RSVP CANVAS ASKS (owner 2026-09-27: "The
 * questions" is the default view). Same invented person as above, one step
 * EARLIER: they have not replied, so every question the couple switches on is
 * drawn — including "Who are you bringing?", which is why this sample alone is
 * allowed ONE plus-one (the plus-one switch must visibly do something here).
 * Never written anywhere: the RSVP page renders it only for a verified host
 * behind `?editor=1`, and `submitInviteReply` refuses it by id.
 */
export const RSVP_CANVAS_GUEST: Readonly<GuestRow> = Object.freeze({
  ...SIMULATED_GUEST_ROW,
  rsvp_status: 'pending',
  plus_one_allowed: true,
  plus_one_count: 1,
  custom_tags: [],
} satisfies GuestRow);

/**
 * 🎭 "EACH EDITOR OF EACH EVENT WILL ADAPT TO THEIR EVENT" (owner 2026-09-27,
 * DECISION_LOG): the Maker previews the RSVP as a REAL person from this event's
 * own list — their NAME and their PLUS-ONE ALLOWANCE only — instead of "Sample
 * Guest". Nothing else of theirs is read (no answer, no meal, no contact), and
 * the preview keeps the sample's id, so it can never write a reply, a scan row
 * or anything else for them. With nobody on the list, a neutral "Your guest".
 */
export type PreviewPerson = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  plus_one_allowed: boolean | null;
  plus_one_count: number | null;
};

export const PREVIEW_FALLBACK_NAME = 'Your guest';

export function previewNames(person: PreviewPerson | null | undefined): {
  row: Pick<GuestRow, 'first_name' | 'last_name' | 'display_name' | 'plus_one_allowed' | 'plus_one_count'>;
} {
  const first = (person?.first_name ?? '').trim();
  const last = (person?.last_name ?? '').trim();
  const shown = (person?.display_name ?? '').trim() || `${first} ${last}`.trim();
  if (!person || !shown) {
    return {
      row: { first_name: 'Your', last_name: 'guest', display_name: PREVIEW_FALLBACK_NAME, plus_one_allowed: true, plus_one_count: 1 },
    };
  }
  return {
    row: {
      first_name: first || shown,
      last_name: last,
      display_name: shown,
      plus_one_allowed: person.plus_one_allowed === true,
      plus_one_count: person.plus_one_allowed ? Math.max(1, Math.min(4, person.plus_one_count ?? 1)) : 0,
    },
  };
}

/** The RSVP canvas's guest for this event — `RSVP_CANVAS_GUEST` wearing the person's name and allowance. */
export function rsvpCanvasGuestFor(person: PreviewPerson | null | undefined): GuestRow {
  return { ...RSVP_CANVAS_GUEST, ...previewNames(person).row, custom_tags: [] };
}

/**
 * Build the simulated guest identity.
 *
 * Routed through `guestIdentity()` — the key-pick constructor — for the same
 * reason the real path is: whatever is written above, the object handed to the
 * body tree has exactly the fifteen declared guest keys and can never carry an
 * owner capability or a stray extra field.
 *
 * Everything guest-shaped is a constant. `slug` is the only input, and it is
 * EVENT data (the host's own public address, already on screen in the editor
 * chrome), not guest data — it feeds the hub card's in-site nav links so they
 * point somewhere real instead of 404ing mid-preview.
 */
export function buildSimulatedGuestIdentity(input: {
  slug: string;
  /** "Each editor of each event will adapt to their event" — see `PreviewPerson`. */
  person?: PreviewPerson | null;
}): GuestSiteIdentity {
  const who = previewNames(input.person);
  return guestIdentity({
    guest: { ...SIMULATED_GUEST_ROW, ...who.row, custom_tags: [] },
    qrSvg: SIMULATED_GUEST_QR_SVG,
    invitationUrl: SIMULATED_GUEST_INVITATION_TEXT,
    // Null / false / empty across the board: every one of these is a real
    // per-guest lookup on the live path, and the preview performs none of them.
    guestLiveGallery: null,
    seatPassActive: false,
    needsFaceEnroll: false,
    guestHubData: {
      firstName: who.row.first_name,
      displayName: who.row.display_name ?? SIMULATED_GUEST_DISPLAY_NAME,
      rsvpStatus: 'attending',
      tableLabel: SIMULATED_GUEST_TABLE_LABEL,
      mealPreference: null,
      dietaryRestrictions: null,
      nextScheduleBlock: null,
      slug: input.slug,
      isLimitedPlusOne: false,
      arrived: false,
    },
    seatMap: null,
    papicGuest: null,
    // The host already has an account (that is how they hold the capability),
    // so the claim-account prompt would be nonsense here.
    showClaimAccountCta: false,
    accountlessPhotosClosed: false,
    // Empty rather than the couple's real booked vendors: this is a preview of
    // the RSVPed state, and the vendor-credits strip is not part of that fork.
    eventVendorCredits: [],
    saveFlash: null,
    // The simulated guest is a literal, never a real render outcome — there is
    // no reply to have succeeded or failed.
    rsvpFlash: null,
    // mode_b = no face embedding computed. The conservative arm, and correct:
    // there is no face to enroll for a guest who does not exist.
    faceMode: 'mode_b',
    // The preview shows the reply card as a guest meets it, question included —
    // nothing is written (the simulated guest has no session to save through).
    faceTaggingAskable: true,
  });
}
