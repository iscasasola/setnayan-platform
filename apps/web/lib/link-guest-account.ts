import 'server-only';

import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';

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
 * ── Shared-device caveat ─────────────────────────────────────────────────
 * A guest session is a 60-day cookie. On a SHARED device, a cached session
 * links to whoever signs up next on that browser. We accept this for the
 * low-assurance "your event photos followed you" growth loop; the partial
 * unique `(event_id, guest_id) WHERE guest_id IS NOT NULL` is the hard
 * backstop — a guest row can only ever be bound to ONE account, so a second
 * person inheriting a stale cookie is rejected as `guest_already_claimed`
 * rather than stealing the binding. Higher-assurance binding (OTP / couple
 * review) goes through `finalize_guest_claim`, which this helper never
 * touches.
 *
 * ── Contract ─────────────────────────────────────────────────────────────
 * This helper MUST NEVER throw — every caller is an auth flow (signup/login)
 * where an unhandled throw would break account creation. All paths return a
 * `{ linked, reason }` result; any unexpected error is swallowed to
 * `{ linked: false, reason: 'error' }`.
 */
export async function linkGuestSessionToUser(
  userId: string,
): Promise<{ linked: boolean; reason: string }> {
  try {
    const session = await readGuestSession();
    if (!session) return { linked: false, reason: 'no_guest_session' };

    // Identity comes ONLY from the signed session — never URL params.
    const { guest_id, event_id } = session;

    const admin = createAdminClient();

    // Defense-in-depth: confirm the guest row exists AND its event_id matches
    // the session's event_id (a signed-but-stale cookie pointing at a deleted
    // guest, or a guest moved between events, must not bind). Also read the
    // canonical role to mirror onto the membership.
    const { data: guest, error: guestError } = await admin
      .from('guests')
      .select('guest_id, event_id, role')
      .eq('guest_id', guest_id)
      .maybeSingle();

    if (guestError) return { linked: false, reason: 'error' };
    if (!guest || guest.event_id !== event_id) {
      return { linked: false, reason: 'guest_not_found' };
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

    return { linked: true, reason: 'linked' };
  } catch {
    // Auth-flow contract: never throw. Any unexpected failure (admin env not
    // configured, network, etc.) degrades to a silent no-link.
    return { linked: false, reason: 'error' };
  }
}
