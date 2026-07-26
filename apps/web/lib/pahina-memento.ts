/**
 * After-Event memento gate (design 2026-07-25 §11 · Pahina tail).
 *
 * `PahinaKeepsake` has shipped `variant="attended"` — the "YOU WERE THERE"
 * stamp — since wave A PR-4. It was never mounted, for one specific reason
 * recorded in the build resume: the After-Event takeover is the `phasedBody`
 * helper in `site-body.tsx`, and that helper is SHARED by both identity tiers.
 * Mounting a guest-only memento there means branching a path that also serves
 * anonymous visitors.
 *
 * WHY A PURE MODULE AND NOT AN INLINE `&&`. Exactly the reason
 * `lib/owner-ribbon.ts` gives: the interesting part is a DECISION ("may this
 * viewer see proof of their own presence?"), it sits on a shared path where a
 * mistake leaks guest state to strangers, and it is not testable inside a
 * server component. So the call site becomes `buildAfterEventMemento(...) ? …`
 * and every rule lives here where `lib/pahina-memento.test.ts` holds it down.
 *
 * THE ANONYMOUS DENIAL IS RE-STATED, NOT ASSUMED. The call site is already
 * inside `guestTree`, which only runs for `identity.kind === 'guest'` — so
 * `identityKind` below is, strictly speaking, redundant. It is required anyway,
 * and checked first, for the same reason `buildOwnerRibbon` re-checks the
 * capability's event binding: the shared `phasedBody` path is one refactor away
 * from being called with the wrong tier, and a redundant gate that a test pins
 * is cheaper than the leak it prevents. This module can only ever widen who
 * sees the memento by someone editing THIS file, in front of these tests.
 *
 * READ-ONLY BY CONSTRUCTION. This produces a verdict object. Nothing here
 * queries, writes, or reaches for data the guest tree does not already hold —
 * both signals below are values `site-body.tsx` has in scope already
 * (`guest.rsvp_status` and `guestHubData.arrived`).
 */
import type { RsvpStatus } from '@/lib/guests';
import type { SiteBodyKind, SiteIdentityKind } from '@/lib/site-body-plan';

/**
 * The verdict. `variant` is literally the prop `PahinaKeepsake` takes, so the
 * call site can never mount the wrong ticket: there is no value of this type
 * that says `'accepted'`.
 */
export type AfterEventMemento = {
  variant: 'attended';
  /**
   * WHICH signal earned the memento. Not consumed by the current mount — it
   * exists because the two are not equally strong evidence and a future pass
   * (e.g. a "we missed you" variant, or a different meta line for a guest who
   * physically scanned in) needs to tell them apart without re-deriving the
   * rule. `checked_in` is the stronger claim and wins when both are true.
   */
  proof: 'checked_in' | 'rsvp';
};

/**
 * Build the memento model, or `null` when no memento should exist.
 *
 * Denies, in order:
 *   - any tier that is not `guest` — an anonymous visitor has no reply state
 *     and no check-in, so "you were there" is neither true nor addressable;
 *   - any body other than the editorial (After-Event) takeover — the memento
 *     is the archive's object; before the wedding the same ticket is already
 *     mounted as `variant="accepted"` on the RSVPed fork, and showing both
 *     would double the keepsake;
 *   - a guest with neither proof of presence.
 *
 * PROOF OF PRESENCE IS EITHER SIGNAL, NOT BOTH — OWNER-LOCKED 2026-07-27. The
 * owner was offered the stricter door-scan-only rule and chose to keep this as
 * it stands, so do not tighten it without a fresh ruling. `arrived` (a `guest_checkins`
 * row, surfaced on `guestHubData`) is the harder evidence and is honoured on
 * its own — including for a guest who declined and then came anyway, which is
 * a real and common PH wedding outcome. But door-scanning is optional and most
 * events never do it, so requiring it would make the memento almost never
 * appear; `rsvp_status === 'attending'` therefore also qualifies. A guest who
 * declined and never scanned in gets nothing, which is the correct silence.
 */
export function buildAfterEventMemento(input: {
  /** The identity tier the body is rendering for. Only `guest` may qualify. */
  identityKind: SiteIdentityKind;
  /** `plan.body` — the body the page ACTUALLY resolved, not the raw phase, so
   *  a `?phase=editorial` host preview and a date-driven After-Event agree. */
  body: SiteBodyKind;
  /** This guest's own reply (`guests.rsvp_status`). */
  rsvpStatus: RsvpStatus;
  /** True once this guest scanned in at the door (`guestHubData.arrived`). */
  arrived: boolean;
}): AfterEventMemento | null {
  const { identityKind, body, rsvpStatus, arrived } = input;
  if (identityKind !== 'guest') return null;
  if (body !== 'editorial') return null;
  if (arrived) return { variant: 'attended', proof: 'checked_in' };
  if (rsvpStatus === 'attending') return { variant: 'attended', proof: 'rsvp' };
  return null;
}
