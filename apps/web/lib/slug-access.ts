import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  normalizeVisibility,
  openToStrangers,
  requiresInvitedAccount,
} from '@/lib/event-visibility';
import { readGuestSession } from '@/lib/guest-session';
import { findGuestSeatForUser } from '@/lib/guest-membership-session';
import { viewerIsBookedSupplier } from '@/lib/booked-supplier';
import { closedEventAdmits, type ClosedEventFacts } from '@/lib/closed-event-admission';
import { HOST_MEMBER_TYPES } from '@/app/[slug]/_lib/host-scope';

/**
 * canViewSlugEvent — the single source of truth for "may the current viewer see
 * this wedding's /[slug] content?".
 *
 * app/[slug]/page.tsx applies this gate inline; the sub-routes (find-seat,
 * find-my-table, recap, …) historically did NOT, so a private (pre-launch) page
 * leaked couple data — names/venue/date — through a guessable URL. They now all
 * call this helper.
 *
 * Rules:
 *   • public / unlisted   → always viewable (unlisted = link-only, just noindex).
 *   • invited_accounts    → a signed-in account belonging to somebody on this
 *     event's guest list, PLUS the guest-cookie and host paths below. A
 *     stranger, and anyone merely holding the link, gets the same locked page.
 *   • private             → only an invited guest with a matching guest-session
 *     cookie, a signed-in SEAT-HOLDER (their account is bound to a seat on this
 *     event's guest list), a signed-in host (event_members couple/coordinator,
 *     or an accepted + non-removed event_moderator), OR a supplier the couple
 *     has BOOKED on this event. Everyone else (strangers, and a signed-in
 *     member who is only a `'guest'`-type row with no seat) is blocked.
 *
 * 🔑 THE RULE ITSELF IS NOT WRITTEN HERE. `closedEventAdmits`
 * (lib/closed-event-admission.ts) holds it, because `app/[slug]/page.tsx`
 * decides the same thing for its own lock screen and the two copies had already
 * drifted: the page grew the booked-supplier arm on 2026-08-17 and this gate
 * never did, so a booked supplier who could open the couple's private page was
 * bounced off all seven sub-routes of it — silently, because the refusal is
 * byte-identical to a stranger's. What is written here is only how each FACT is
 * resolved, and the facts are resolved lazily: the rule is an OR, so a question
 * that is never asked stays false and cannot change the answer.
 *
 * Anything unreadable coalesces to 'private' (fail safe), matching the page.
 *
 * 🔴 THIS FUNCTION USED TO OPEN WITH `if (visibility !== 'private') return
 * true;` — an EXCLUSION test, across 31 call sites. The moment
 * 'invited_accounts' was added to the column, that spelling would have made the
 * most private new setting in the product **completely public on every one of
 * them**. It is now an ALLOW-LIST (`openToStrangers`), so a value added later is
 * closed until somebody deliberately opens it.
 * 🔑 Same shape, same column, same day: the editorial loaders asked
 * `.neq(…, 'private')` and were therefore publishing link-only celebrations.
 * An exclusion test over a growing set admits every future member by default.
 */
export async function canViewSlugEvent(
  eventId: string,
  visibilityRaw: string | null | undefined,
): Promise<boolean> {
  const visibility = normalizeVisibility(visibilityRaw);
  if (openToStrangers(visibility)) return true;

  const facts: ClosedEventFacts = {
    holdsGuestPass: false,
    isSignedInHost: false,
    isSeatHolder: false,
    isInvitedAccount: false,
    isBookedSupplier: false,
  };

  // Path A — invited guest who redeemed their personal link on this device.
  const session = await readGuestSession();
  facts.holdsGuestPass = session?.event_id === eventId;
  if (closedEventAdmits(visibility, facts)) return true;

  // Path B — signed-in host (couple member or accepted moderator).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  facts.isSignedInHost = await isSignedInEventHost(eventId);
  if (closedEventAdmits(visibility, facts)) return true;

  // Path B2 — signed-in SEAT-HOLDER, on BOTH closed visibilities.
  //
  // 🔒 THIS SHIPS IN THE SAME COMMIT AS THE HOST NARROWING ABOVE, AND MUST.
  // app/[slug]/page.tsx has admitted a seat-holder on `private` since
  // 2026-08-13 (`findGuestSeatForUser`); this shared gate never grew that arm,
  // and the over-wide host check was masking the divergence — a seat-bound
  // account read as a "host" here and was let through by accident. Narrowing
  // host alone would start bouncing, off all seven sub-routes, exactly the
  // people the page was rewritten to admit: the guest cookie has a hard 60-day
  // life with no sliding refresh, and save-the-dates go out 6–12 months ahead,
  // so the ORDINARY invited cousin has no live cookie by the day itself.
  //
  // 🔒 NOT A WIDENING — it is the SAME claim by a stronger key. The cookie says
  // "this browser once held guest X's QR"; the membership row says "this
  // AUTHENTICATED ACCOUNT is bound to guest X", a binding established by holding
  // that QR or clicking a link emailed to the address on the seat.
  // `findGuestSeatForUser` requires the caller's OWN row, member_type='guest', a
  // non-null guest_id, no `hidden_at` (their own Leave) and no `guests.deleted_at`
  // (the host's eviction) — so removing somebody closes this in the same instant.
  //
  // ⚠ It admits them to the PAGE ONLY. No guest session is minted, so every
  // per-guest surface still keys on the cookie this viewer does not have.
  facts.isSeatHolder = (await findGuestSeatForUser(eventId, user.id)) !== null;
  if (closedEventAdmits(visibility, facts)) return true;

  // Path D — a supplier this couple has BOOKED on this event.
  //
  // 🔴 THE DIVERGENCE THIS CLOSES. `app/[slug]/page.tsx` has admitted a booked
  // supplier past its own lock screen since 2026-08-17 (PR #4483 corrected the
  // ordering in exactly that one file and touched no sub-route). This gate is
  // what the other seven surfaces ask, and it had no supplier arm — so the
  // photographer working a private wedding could open the couple's page and was
  // then refused the venue address, the recap, both seat finders, the live hub,
  // the money-gift page and the print keepsake. Every one of those refusals
  // looks exactly like a stranger's, which is why nothing ever reported it.
  //
  // 🔒 BOOKED, NOT MERELY LISTED, and the predicate is shared, not re-typed:
  // `lib/reusable-bookings.server.ts` mints a linked row at 'shortlisted' for a
  // reuse offer the couple has yet to lock, and a supplier the couple is still
  // only considering has not been chosen to read a private celebration. Same
  // boundary PR-H draws on the vendor brief: an ASKED supplier gets no venue
  // address and no run-of-show.
  //
  // 🔒 IT ADMITS THEM TO THE PAGE AND NOTHING ELSE. No guest session is minted,
  // so every per-guest surface still keys on the cookie this viewer does not
  // have.
  facts.isBookedSupplier = await viewerIsBookedSupplier(eventId, user.id);
  if (closedEventAdmits(visibility, facts)) return true;

  // Path C — signed-in guest. ONLY for 'invited_accounts': a private
  // celebration deliberately does not admit somebody just for being on the
  // list, because 'private' means hosts and redeemed invitations only. Widening
  // it here would quietly change what 'private' has always promised — which is
  // why the visibility, and not only the fact, has to allow it inside the rule.
  if (requiresInvitedAccount(visibility)) {
    facts.isInvitedAccount = await isInvitedAccount(eventId, user.id);
  }

  return closedEventAdmits(visibility, facts);
}

/**
 * isInvitedAccount — is this signed-in account somebody on the event's guest
 * list?
 *
 * TWO claims, checked in order of strength. Either admits.
 *
 * A · THE ACCOUNT IS BOUND TO A SEAT — `event_members` (member_type 'guest',
 *   a `guest_id`, not hidden). This is the SHIPPED primitive behind
 *   `findGuestSeatForUser`, and the binding was itself established by holding
 *   the invitation QR or clicking a link emailed to the address on the seat.
 *   The guest did something; it is a claim they proved.
 *   🔑 Found by reading app/[slug]/page.tsx's existing "Path C" AFTER writing
 *   B below. A parallel weaker mechanism was one file away from shipping beside
 *   a stronger one that already existed — check for the shipped primitive
 *   before inventing the concept.
 *
 * B · THE ACCOUNT OWNS A PERSON ON THE LIST — a guest row carries an email →
 *   the `set_guest_person` trigger resolves it into `people` → that person is
 *   `claimed_by_user_id` once they sign up. Nobody has to tag anyone and the
 *   guest need not have redeemed anything, which is what the owner asked for:
 *   "anyone on the guest list who has an account".
 *
 * ⚠ B IS WEAKER THAN A AND THE DIFFERENCE MATTERS. A says "this person proved
 * they hold that seat". B says "the host typed an email that belongs to this
 * account". If a host mistypes, B opens the celebration to whoever owns that
 * address. That is the same trust the invitation itself already relies on — the
 * invitation is emailed to exactly that address — so it is accepted here
 * deliberately, and it is why B never grants anything beyond READING a page the
 * host chose to share with their guests.
 *
 * ⚠ TODAY THIS RETURNS FALSE FOR EVERYBODY, AND THAT IS THE RULE WORKING. Prod
 * holds 35 guests with ZERO emails (the trigger deliberately leaves a name-only
 * guest unlinked — "needs a confirm") and no guest-type member rows. So
 * 'invited_accounts' currently means "only the hosts", which is precisely the
 * owner's "no tagged account means it is private for them". Do NOT loosen the
 * match to make it do something: a name is not an identity.
 *
 * Read with the admin client because the viewer is not a host and cannot see
 * the guest list under RLS. Returns a BOOLEAN; no row ever leaves.
 */
export async function isInvitedAccount(
  eventId: string,
  userId: string,
): Promise<boolean> {
  const admin = createAdminClient();

  // A — bound to a seat on this event.
  const { data: bound, error: boundErr } = await admin
    .from('event_members')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('member_type', 'guest')
    .not('guest_id', 'is', null)
    .is('hidden_at', null)
    .limit(1);
  // 🪤 A REJECTED QUERY IS NOT A THROWN ERROR — Supabase resolves with
  // { error }, so an unchecked read would make a lost grant look like "not
  // invited". Here that direction is the safe one, so we fall through to B
  // rather than refusing outright; a hard refusal on a transient error would
  // lock out a legitimate guest mid-event.
  if (!boundErr && (bound?.length ?? 0) > 0) return true;

  // B — owns a person who is on the guest list.
  const { data: mine, error: mineErr } = await admin
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null);
  if (mineErr || !mine || mine.length === 0) return false;

  const personIds = mine.map((p) => (p as { person_id: string }).person_id);

  const { data: seat, error: seatErr } = await admin
    .from('guests')
    .select('guest_id')
    .eq('event_id', eventId)
    .in('person_id', personIds)
    .is('deleted_at', null)
    .limit(1);
  // Fail CLOSED on the final read: by here nothing else can admit them, and
  // this decides who sees somebody's celebration.
  if (seatErr) return false;

  return (seat?.length ?? 0) > 0;
}

/**
 * isSignedInEventHost — is the CURRENT signed-in user a host of this event?
 * (a couple/coordinator member in event_members, OR an accepted + non-removed
 * moderator).
 *
 * 🔴 THIS SELECTED `member_type` AND NEVER COMPARED IT, returning
 * `Boolean(memberRow)`. `event_members` IS NOT A HOST TABLE — it is the event's
 * people table, and `'guest'` is one of its values, written by the event-QR
 * scan-to-join, the cookie link and the cross-device magic link. So ANY signed-in
 * member, including a guest who merely scanned the QR, was a HOST here: they
 * passed the private gate on all seven sub-routes, and the keepsake reader
 * (`who-can-see-your-story.ts`) returns true for a host BEFORE it tests the
 * audience — so they could read the couple's unfinished story months before it
 * was published.
 * 🔑 This is the exact bug `app/[slug]/_lib/host-scope.ts` was written to kill.
 * The twin (`loadHostMembership`) was fixed and pinned; THIS CLONE NEVER
 * INHERITED IT. *A clone inherits the bug its twin fixed.* Both now filter on
 * the one shared `HOST_MEMBER_TYPES` definition.
 *
 * ⚠ AND THE SENTENCE THAT STOOD HERE WAS FALSE. It claimed the guard "pins BOTH
 * by source so a third copy cannot quietly hold a laxer rule". It could not: the
 * guard pinned a HAND-TYPED list of three paths, and a THIRD copy was live in
 * `app/[slug]/hub/page.tsx` — where it let a QR-scan guest force `?phase=` and
 * switch on day-of surfaces the couple had not launched — for the entire time
 * that guard was green. A fourth sat in the save-the-date view beacon. A
 * hand-typed list is a list of the doors somebody thought of, and writing "so a
 * third copy cannot" beside one does not make it so. `host-means-host.test.ts`
 * now DERIVES its file set from the tree and is FLOORED, so a sweep that stops
 * seeing anything fails instead of reading as a pass.
 *
 * Extracted from the inline `event_members` / `event_moderators` check that
 * app/[slug]/page.tsx runs for its private-gate + `?phase=` preview allowance,
 * so surfaces that need the same "hosts can preview" rule share ONE
 * implementation instead of re-deriving it — the /[slug]/print keepsake, which
 * lets hosts preview pre-event, and the /[slug]/hub `?phase=` preview, which had
 * re-derived it and got it wrong. Returns false for anonymous / guest-cookie-only
 * viewers.
 */
export async function isSignedInEventHost(eventId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const admin = createAdminClient();
  const [{ data: memberRow }, { data: moderatorRow }] = await Promise.all([
    admin
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .in('member_type', [...HOST_MEMBER_TYPES])
      .maybeSingle(),
    admin
      .from('event_moderators')
      .select('moderator_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ]);
  return Boolean(memberRow) || Boolean(moderatorRow);
}
