import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * guest-membership-session.ts — an invited person who is SIGNED IN should not be
 * asked to prove it again.
 *
 * ⚠ THIS DOES NOT MINT ANYTHING, DELIBERATELY. The first cut of this module
 * backed a `/{slug}/enter` GET route handler that wrote the guest cookie — and a
 * Next.js `<Link>` PREFETCHES, so a board card scrolling into view executed the
 * mint. For a person invited to two weddings that silently rewrote which one
 * their single cookie named, and walking back to the first one they were a
 * stranger: the exact lock-out this module exists to end, caused by looking at
 * their own board. This repo had already written the rule for sign-out —
 * *"a row that can sign you out by being NEAR the pointer"*, which is why that
 * one is a form. **A side effect never goes behind a card.** So the seat is now
 * read by the PAGE'S OWN GATE, at render time, with no cookie written at all.
 *
 * ── THE PROBLEM, MEASURED 2026-08-13 ────────────────────────────────────────
 * Guest identity on a public event page is a cookie: `setnayan_guest_session`,
 * a signed JWT keyed to `guests.guest_id`. It is **NOT** `auth.uid()` — a
 * Setnayan account and a seat on somebody's guest list are two different things.
 *
 * That cookie has a **hard 60-day life and no sliding refresh**
 * (`COOKIE_MAX_AGE_SECONDS` in lib/guest-session.ts; `readGuestSession` never
 * re-issues it), and it carries exactly **ONE** `event_id`. Two consequences,
 * both ordinary rather than exotic:
 *
 *   1. Save-the-dates go out **6–12 months** ahead — the reasoning that moved
 *      address forwarding from 90 days to 24 months on 2026-08-11. So a guest
 *      who scans their invitation when it arrives is a **stranger on that page
 *      by the wedding day.**
 *   2. Anyone invited to **two** events can only ever be recognised on one of
 *      them at a time, whichever they scanned most recently.
 *
 * On a `private` event — and **3 of 5 prod events are private** — an
 * unrecognised viewer gets `PrivateLanding`, which says *"Already invited? Open
 * the personal link the couple sent you, or scan your invitation QR."* We are
 * telling somebody whose membership row we are **holding** to go and find a QR
 * code. That is the same shape as the printed-invitation defect of 2026-08-11:
 * a person who did exactly the right thing is asked to do it again, and it reads
 * as the couple shutting them out.
 *
 * 🔑 **THE BINDING ALREADY EXISTS IN THE DATABASE — SO NO COOKIE IS NEEDED TO
 * READ IT.**
 * `event_members` carries `guest_id` precisely to express "this account is that
 * seat" (lib/link-guest-account.ts's own docblock: *"the hub's 'attended' path
 * keys off `event_members.guest_id`"*), and it is written by every path that
 * creates a guest membership: the QR scan-to-join (`app/join/[eventId]/actions`),
 * the cookie link (`linkGuestSessionToUser`) and the cross-device magic link
 * (`connectEventForUser`). So this module ANSWERS FROM a binding
 * the person already earned. It does not create a new way to become a guest.
 *
 * ── WHY THIS IS NOT AN ESCALATION ───────────────────────────────────────────
 * The cookie asserts *"this browser once held guest X's QR."* An
 * `event_members` row asserts *"this AUTHENTICATED ACCOUNT is bound to guest
 * X"*, and that binding was itself established by holding the QR or by clicking
 * an emailed link sent to the address on the seat. Keyed on `auth.uid()` it is
 * the **stronger** of the two claims, not a weaker one.
 *
 * ⚠ **QR ROTATION — no longer a trade-off, because nothing is minted.**
 * `app/[slug]/rotate-qr-actions.ts` exists so a host can kill sessions minted
 * from a leaked QR (council § 5.11). Since this module writes no session, that
 * mechanism is untouched. What rotation does NOT do is remove somebody from the
 * guest list — and it never did; the eviction paths are removing the membership
 * or soft-deleting the seat, and **both close this door**, see the gates below.
 *
 * 🔒 SCOPE: this admits a seat-holder to the event's own page — the page the
 * couple published and put them on the list for. It does NOT hand them a guest
 * session, so the per-guest surfaces that key on `guests.guest_id` (their table,
 * the photos of them, their RSVP) still require the cookie their invitation
 * mints. **Turning those on for a signed-in seat-holder is a deliberate
 * one-press act on that page and is NOT built here** — named, not silently
 * skipped, because minting on render is impossible in Next.js and minting behind
 * a link is the defect above.
 */

export type GuestMembershipSeat = {
  guestId: string;
  /**
   * The seat's CURRENT token. No caller mints a session today (see the header),
   * but it is read rather than dropped for two reasons: it proves the seat row is
   * live and readable, and the deliberate one-press mint named above needs the
   * live value — a stale token would put a minted cookie permanently at odds with
   * `GUEST_SESSION_TOKEN_CHECK`, which compares it against the database.
   */
  qrToken: string;
  /** The event's public address, as the DATABASE returned it. */
  slug: string;
};

/**
 * The signed-in user's own guest seat on this event, or NULL.
 *
 * Every condition below is a real gate, not defensiveness:
 *   · `user_id` — their OWN row. Never a lookup by seat.
 *   · `member_type = 'guest'` — an organiser has the dashboard and must not be
 *     handed a guest cookie; a `vendor`/`coordinator` row is a different stance
 *     with a different surface.
 *   · `guest_id IS NOT NULL` — an unbound membership names no seat, so there is
 *     nothing to answer from. (`link-guest-account.ts` documents that unbound rows
 *     exist: `member_type='guest' AND guest_id IS NULL`.)
 *   · `hidden_at IS NULL` — the opt-out / "Leave" stamp. `fetchUserEvents`
 *     already filters on it; a person who left must not be re-admitted.
 *   · `guests.deleted_at IS NULL` — the HOST's eviction path. Removing somebody
 *     from the guest list closes this door in the same instant.
 *
 * 🪤 Uses the ADMIN client on purpose. This read spans `event_members` and
 * `guests` for a viewer who — by construction — has no guest session yet, so an
 * RLS-scoped read would return nothing and the door would never open. The
 * narrowing is done HERE, explicitly, because **RLS IS A FLOOR, NOT A SCOPE**:
 * the shipped `guests` policies admit hosts and admins too, so leaning on them
 * would not scope this caller. `user_id` is taken from the session, never from
 * caller input.
 */
export async function findGuestSeatForUser(
  eventId: string,
  userId: string,
): Promise<GuestMembershipSeat | null> {
  const admin = createAdminClient();

  const { data: membership, error: membershipError } = await admin
    .from('event_members')
    .select('guest_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('member_type', 'guest')
    .not('guest_id', 'is', null)
    .is('hidden_at', null)
    .maybeSingle();

  // 🔑 A REJECTED QUERY IS NOT A THROWN ERROR. Supabase resolves with { error },
  // so without this check a phantom column or a lost grant would read as "this
  // person has no seat" and silently restore the exact lock-out this module
  // exists to end. Fail CLOSED, but never silently: the caller renders the page
  // the person would have got anyway, and the error is visible to whoever looks.
  if (membershipError || !membership?.guest_id) return null;

  const { data: seat, error: seatError } = await admin
    .from('guests')
    .select('guest_id, qr_token, events:event_id ( slug )')
    .eq('guest_id', membership.guest_id as string)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .maybeSingle();

  if (seatError || !seat?.qr_token) return null;

  // The slug comes back through the embed so the redirect target is built from
  // what the DATABASE holds, never from caller-supplied text — the open-redirect
  // lesson `app/[slug]/redeem/route.ts` paid for on live prod on 2026-08-06.
  const embedded = (seat as { events?: { slug?: string | null } | { slug?: string | null }[] })
    .events;
  const row = Array.isArray(embedded) ? embedded[0] : embedded;
  const slug = row?.slug?.trim();
  if (!slug) return null;

  return {
    guestId: seat.guest_id as string,
    qrToken: seat.qr_token as string,
    slug,
  };
}
