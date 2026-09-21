import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * guest-account-photos.ts — a guest who has an account wears their own face.
 *
 * ⚖ Owner 2026-09-20, looking at his own row on his own guest list: *"why is my
 * account not showing. i registered on the event as me"* — then, on being told
 * the roster only reads the guest row's photo: *"so when users create their
 * accounts, when they have a profile photo, it will show here too"*.
 *
 * Measured that day: his guest row IS linked (`event_members.guest_id` → his
 * user, role `groom`), so the registration worked perfectly. The roster simply
 * never looked at the account. It built every avatar from `guests.photo_url`
 * alone, so a guest who had joined, claimed their invite and set a profile
 * photo still rendered as two grey initials — indistinguishable from a name the
 * couple typed in and never heard from again.
 *
 * ── PRECEDENCE: THE COUPLE'S CHOICE WINS ───────────────────────────────────
 * `guests.photo_url` is something the couple (or the guest's own RSVP selfie)
 * put there deliberately for THIS wedding. The account photo is a fallback for
 * a row that has none. Reversing that would let a profile picture overwrite a
 * selfie the couple had taken for the seating chart.
 *
 * ── WHY AN ADMIN READ, AND WHAT IT MAY NOT CARRY ───────────────────────────
 * 🔒 Another account's `users` row is invisible under RLS BY DESIGN — the same
 * wall `lib/people-search.ts` documents. So the photo cannot be fetched as the
 * couple; it needs the admin client. An admin read is a visibility surface in
 * its own right and must do its own gating rather than trust its caller:
 *
 *  1. The membership read runs as the CALLER. If they are not on this event,
 *     RLS returns zero rows, there are no user ids, and the admin client is
 *     never asked anything. The gate is a policy, not an `if` in this file.
 *  2. The admin read is keyed to exactly those ids and selects exactly two
 *     columns. No email, no display name, no discoverability flag.
 *  3. Nothing leaves this function but `guest_id → stored photo ref`.
 *
 * ⚖ IT IS OPT-IN, because the owner said so on 2026-09-20 when the disclosure
 * was put to him: *"keep it opt-in, add the preference column"*. Nobody's face
 * reaches a couple until they switch `users.share_profile_photo_with_hosts` on
 * in their own profile. The column is nullable with no default, so an account
 * that has never been asked reads NULL and is excluded — silence is no.
 *
 * ── THE REF IS NOT A URL ───────────────────────────────────────────────────
 * The value returned is the STORED ref, exactly as `guests.photo_url` holds it:
 * an `r2://…` reference that must be signed, or a passthrough OAuth avatar URL.
 * Callers put it through `guestPhotoDisplayUrls` like any other. Handing a raw
 * `r2://` string to an `<img src>` renders a broken-image glyph — the defect
 * `lib/a-guest-face-is-resolved.test.ts` exists to stop, in four loaders at
 * once.
 */
export async function accountPhotoRefsByGuest(
  supabase: SupabaseClient,
  eventId: string,
): Promise<Record<string, string>> {
  // 1. As the caller. RLS decides whether they may see this event's members.
  const { data: members, error: memberErr } = await supabase
    .from('event_members')
    .select('guest_id, user_id')
    .eq('event_id', eventId)
    .not('guest_id', 'is', null)
    .not('user_id', 'is', null);

  if (memberErr) {
    // Degrades to initials, which is exactly what the roster did before this
    // existed — so the page is no worse. Logged because a refused read and an
    // event where nobody has joined look identical from the outside.
    logQueryError('guest-account-photos: event_members', memberErr, { eventId });
    return {};
  }

  const rows = (members ?? []) as Array<{ guest_id: string; user_id: string }>;
  if (rows.length === 0) return {};

  const userIds = [...new Set(rows.map((r) => r.user_id))];

  /*
    2. Admin, keyed to those ids only, two columns only, AND opt-in only.

    ⚖ Owner 2026-09-20: "keep it opt-in, add the preference column". The filter
    is `.eq(true)`, which excludes NULL — and NULL is what every account that
    has never been asked holds. So silence means no, which is what opt-in means.

    🔑 THE FLAG IS FILTERED ON, NOT SELECTED. Keeping it out of the column list
    means this read still carries only the photo and its key: somebody's
    privacy preference is not itself a fact this function needs to hand back,
    and the guard that compares the select exactly stays meaningful.
  */
  const { data: users, error: userErr } = await createAdminClient()
    .from('users')
    .select('user_id, profile_photo_url')
    .in('user_id', userIds)
    .eq('share_profile_photo_with_hosts', true)
    .not('profile_photo_url', 'is', null);

  if (userErr) {
    logQueryError('guest-account-photos: users', userErr, { eventId });
    return {};
  }

  const refByUser = new Map(
    ((users ?? []) as Array<{ user_id: string; profile_photo_url: string | null }>)
      .filter((u) => u.profile_photo_url)
      .map((u) => [u.user_id, u.profile_photo_url!] as const),
  );

  const out: Record<string, string> = {};
  for (const row of rows) {
    const ref = refByUser.get(row.user_id);
    // A guest may hold more than one membership row in principle; first wins,
    // and they all point at the same person anyway.
    if (ref && !out[row.guest_id]) out[row.guest_id] = ref;
  }
  return out;
}
