import 'server-only';

import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { ENTOURAGE_COLUMNS } from '@/lib/entourage';
import { isCoupleSeat, seatBindRefusal } from '@/lib/seat-binding';
import { FORMAL_NAME_FIELDS, normalizeNamePart, type FormalName } from '@/lib/formal-name';

/**
 * Persistent guest accounts (PR-E) — link a signed guest session to a new
 * (or returning) Setnayan account so the guest's tagged photos from the
 * event they ATTENDED surface in their Collection hub (/dashboard/library Photos
 * tab). The hub's "attended" path keys off `event_members.guest_id` keyed by
 * (event_id, user_id) — this helper creates exactly that membership row.
 *
 * ── Authorization model ──────────────────────────────────────────────────
 * The ONLY authorization for this link is the SIGNED guest-session cookie
 * (`readGuestSession()` → a verified JWT payload). We NEVER trust URL params
 * for identity — only the cryptographically-signed `guest_id` + `event_id`
 * from the cookie. A forged cookie can't pass `jwtVerify`, so a caller cannot
 * bind themselves to an arbitrary guest row.
 *
 * ── Why the admin (service-role) client ──────────────────────────────────
 * The `member_can_self_join` RLS policy only lets a user self-insert
 * `member_type='guest' AND guest_id IS NULL`. Binding a row WITH `guest_id`
 * set therefore REQUIRES the service role (RLS bypass). This is expected +
 * correct: the signed cookie is the application-level authorization, and we
 * defense-in-depth re-validate the guest row below before writing.
 *
 * ── ONLY ON PURPOSE (2026-09-30 — the owner's own wedding) ────────────────
 * This used to run on EVERY password login and EVERY signup, binding whatever
 * seat the 60-day cookie in that browser named. That is how a test account
 * became the owner's GROOM: the groom row's key had been opened on the device,
 * sign-out left the guest cookie behind, and the next login bound it. The
 * "shared-device caveat" this block used to accept was that exact incident,
 * and the partial unique `(event_id, guest_id)` backstop could not help — the
 * groom row is always FREE (the creator's couple membership has no guest_id).
 *
 * So it is now called ONLY from an act on the seat's own page:
 *   · `linkThisSeatAction` ("Save to my account", signed in) — the button
 *     itself asks "This invitation is for <name>. Save it to <email>?";
 *   · `connectEventForUser`, and only with the guest id the person confirmed
 *     on `/join/{id}/connect/confirm`.
 * `seat-links-only-on-purpose.test.ts` fails if login or signup call it again.
 * Every caller passes `expect.eventId` — a cookie for a DIFFERENT celebration
 * never binds — and a couple seat is refused unless the account is already one
 * of the event's couple members (`lib/seat-binding.ts`).
 *
 * ── Contract ─────────────────────────────────────────────────────────────
 * This helper MUST NEVER throw — every caller is an auth flow (signup/login)
 * where an unhandled throw would break account creation. All paths return a
 * `{ linked, reason }` result; any unexpected error is swallowed to
 * `{ linked: false, reason: 'error' }`.
 */
/**
 * THE NAME COMES WITH THEM TOO (owner 2026-09-25, "1. yes"): an account made
 * from an invitation skips the You card, so the one thing that card asked — what
 * to call them — is taken from the seat the couple already named. FILLS A BLANK
 * ONLY (`.is('display_name', null)`): a name the person set themselves, or one
 * Google handed over, is never replaced by a guest-list spelling. Never throws.
 */
export async function fillAccountNameFromSeat(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  guestId: string,
): Promise<void> {
  try {
    const { data: seat } = await admin
      .from('guests')
      // The shared name-bearing column list (lib/entourage.ts) — one spelling of
      // "the guest's name columns", so this read cannot drift from it.
      .select(ENTOURAGE_COLUMNS)
      .eq('guest_id', guestId)
      .maybeSingle();
    if (!seat) return;
    const own = typeof seat.display_name === 'string' ? seat.display_name.trim() : '';
    const formal = [seat.first_name, seat.last_name]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter((v) => v && v.toLowerCase() !== 'tba')
      .join(' ');
    const name = (own || formal).slice(0, 200);
    if (!name) return;
    const { error: nameError } = await admin
      .from('users')
      .update({ display_name: name })
      .eq('user_id', userId)
      .is('display_name', null);
    // Best-effort, but never silent: a refused name fill is logged, and the
    // link itself (already written above) still stands.
    if (nameError) console.warn('[link-guest-account] name fill refused:', nameError.message);

    /* 🆕 A FIRST-TIME ACCOUNT STARTS WITH ITS PROFILE FILLED (owner 2026-09-30,
       DECISION_LOG "A FIRST-TIME ACCOUNT MADE FROM AN INVITATION STARTS WITH ITS
       PROFILE ALREADY FILLED"). This runs only from an act on the person's OWN
       seat (see "ONLY ON PURPOSE" above), so the seat's five name parts become
       the profile's formal name — but ONLY on a profile that has never held one:
       the update matches only while all five parts are NULL, so a name the
       person typed is never replaced, and a second run is a no-op. They see it
       on their profile and edit it there.
       📷 The photo does NOT travel: a guest's own selfie is a face-tagging
       enrolment asset that is deleted when they withdraw consent, so sharing
       its stored object as a profile photo would leave a dead image behind. */
    const parts = {} as FormalName;
    for (const f of FORMAL_NAME_FIELDS) parts[f] = normalizeNamePart(seat[f as keyof typeof seat]);
    if (parts.first_name && parts.last_name && parts.first_name.toLowerCase() !== 'tba') {
      let fill = admin.from('users').update(parts).eq('user_id', userId);
      for (const f of FORMAL_NAME_FIELDS) fill = fill.is(f, null);
      const { error: partsError } = await fill;
      if (partsError) console.warn('[link-guest-account] formal name fill refused:', partsError.message);
    }
  } catch {
    // Best-effort — a missing name must never cost somebody their link.
  }
}

/** Does this account already hold a `couple` membership on this event? False on any doubt. */
export async function isCoupleMember(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('event_members')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] lib/link-guest-account.ts · from:event_members.select', error);
    return false;
  }
  return Boolean(data);
}

export async function linkGuestSessionToUser(
  userId: string,
  expect: { eventId: string; guestId?: string },
): Promise<{ linked: boolean; reason: string }> {
  try {
    const session = await readGuestSession();
    if (!session) return { linked: false, reason: 'no_guest_session' };

    // Identity comes ONLY from the signed session — never URL params.
    const { guest_id, event_id } = session;
    // 🔒 THE SEAT THE PERSON WAS ASKED ABOUT, OR NOTHING. A cookie naming a
    // different celebration (or a different row than the one confirmed) binds
    // nothing — the old binder linked whatever the browser happened to hold.
    if (event_id !== expect.eventId) return { linked: false, reason: 'wrong_event' };
    if (expect.guestId && guest_id !== expect.guestId) return { linked: false, reason: 'not_confirmed' };

    const admin = createAdminClient();

    // Defense-in-depth: confirm the guest row exists AND its event_id matches
    // the session's event_id (a signed-but-stale cookie pointing at a deleted
    // guest, or a guest moved between events, must not bind). Also read the
    // canonical role to mirror onto the membership.
    const { data: guest, error: guestError } = await admin
      .from('guests')
      .select('guest_id, event_id, role, extra_roles, meal_preference, dietary_restrictions')
      .eq('guest_id', guest_id)
      .maybeSingle();

    if (guestError) return { linked: false, reason: 'error' };
    if (!guest || guest.event_id !== event_id) {
      return { linked: false, reason: 'guest_not_found' };
    }

    // 🔒 A COUPLE SEAT IS NEVER BOUND BY A GUEST LINK (lib/seat-binding.ts).
    // Only an account that is already one of this event's couple members may
    // hold the bride / groom / celebrant row by this door.
    if (isCoupleSeat(guest.role as string | null, guest.extra_roles as string[] | null)) {
      const accountIsCouple = await isCoupleMember(admin, event_id, userId);
      if (
        seatBindRefusal({
          seatRole: guest.role as string | null,
          seatExtraRoles: guest.extra_roles as string[] | null,
          accountIsCouple,
        })
      ) {
        return { linked: false, reason: 'couple_seat' };
      }
    }

    // Idempotent insert. `onConflict: 'event_id,user_id'` + ignoreDuplicates
    // makes a re-run (same user, already linked) a clean no-op. A conflict on
    // the OTHER constraint — the partial unique `(event_id, guest_id)` — means
    // this guest row is already bound to a DIFFERENT user; that surfaces as a
    // 23505 unique_violation, which we catch below and report as
    // `guest_already_claimed` (never throw). Column shape mirrors
    // finalize_guest_claim's insert (role cast to text, member_type 'guest').
    const { error: insertError } = await admin.from('event_members').upsert(
      {
        event_id,
        user_id: userId,
        member_type: 'guest',
        guest_id,
        role: (guest.role as string) ?? 'guest',
        joined_via: 'guest_signup',
      },
      { onConflict: 'event_id,user_id', ignoreDuplicates: true },
    );

    if (insertError) {
      // 23505 = unique_violation. The (event_id, user_id) conflict is absorbed
      // by ignoreDuplicates, so a 23505 here is the partial-unique
      // (event_id, guest_id) firing → guest already bound to another account.
      if (insertError.code === '23505') {
        return { linked: false, reason: 'guest_already_claimed' };
      }
      return { linked: false, reason: 'error' };
    }

    // ── THE ANSWERS COME WITH THEM (owner 2026-08-21) ────────────────────
    // *"if they create an account to sync, these information will be saved on
    // their account automatically."*
    //
    // This is the ONE moment a name on somebody's list becomes a person with an
    // account, so it is where the answers they already gave stop being about
    // one wedding and start belonging to them. Next invitation, the reply card
    // offers their meal and their allergy back instead of asking again.
    //
    // 🔒 FILLS BLANKS ONLY. It never overwrites something the person has typed
    // into their own profile — an old guest row from a wedding two years ago
    // must not silently replace the allergy they corrected last week. The
    // `.is(…, null)` pair is the whole guard: no read-then-write race, and a
    // second run is a no-op.
    //
    // ⚠ Dietary text is HEALTH DATA (RA 10173) and carries a consent stamp on
    // the profile. Stamping it HERE is honest: the person typed it into an
    // event's reply card and then chose to create the account that carries it.
    //
    // Best-effort by contract — this function may never throw, and failing to
    // carry a meal preference must never cost somebody their account link.
    try {
      // ⚠ ONE UPDATE PER FIELD, each guarded on ITS OWN blank. A single
      // statement carrying both would AND the two `.is(… , null)` filters, so a
      // profile that already had a meal preference would match nothing and the
      // ALLERGY would be silently dropped — the one value here that matters
      // most. Two statements; each lands on its own merits.
      if (guest.meal_preference) {
        await admin
          .from('users')
          .update({ meal_preference: guest.meal_preference })
          .eq('user_id', userId)
          .is('meal_preference', null);
      }
      const diet = (guest.dietary_restrictions as string | null)?.trim();
      if (diet) {
        await admin
          .from('users')
          .update({
            dietary_restrictions: diet.slice(0, 300),
            dietary_restrictions_consent_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .is('dietary_restrictions', null);
      }
    } catch {
      // Deliberately swallowed — see the contract note above.
    }

    await fillAccountNameFromSeat(admin, userId, guest_id);

    return { linked: true, reason: 'linked' };
  } catch {
    // Auth-flow contract: never throw. Any unexpected failure (admin env not
    // configured, network, etc.) degrades to a silent no-link.
    return { linked: false, reason: 'error' };
  }
}
