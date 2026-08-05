import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Can THIS viewer read the couple-scoped halves of the Papic gallery?
 *
 * ── WHY THIS HAS TO BE ASKED SEPARATELY ─────────────────────────────────────
 * The gallery is three reads: the paparazzi seats' photos (`papic_photos`), the
 * guests' own captures (`papic_guest_captures`), and the vendors' documentation
 * shots (`vendor_papic_captures`). The first two are couple-only. The third
 * names more member types, so a promoted coordinator can read it.
 *
 * **An RLS refusal arrives as an empty list with NO error.** `error` is null,
 * `data` is `[]`, and `fetchPapicGallery` folds that into the same shape as a
 * wedding where nobody took a picture. So a coordinator opening the gallery saw
 * only the vendor's documentation shots — rendered as if that were the whole
 * album, with nothing on screen saying two thirds had been withheld.
 *
 * You cannot tell the two apart from the response. The only honest way is to
 * ask the permission question directly, which is what this does — running the
 * SAME predicate the two couple-only policies use.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
 * The client is INJECTED and there is no `server-only` module-scope import, so
 * this stays unit-testable — the same pattern `lib/papic-face-mode.ts` uses for
 * its server resolver, and for the same reason: the rule here matters more than
 * the plumbing, so it must be reachable by a test.
 *
 * It does not widen anything. A coordinator's grant list (`COORDINATOR_AREAS`)
 * contains guest list, seat plan, schedule, vendors, invitations and mood board
 * — **no photo area at all**. Whether a coordinator should ever see a couple's
 * Papic photos is a privacy decision nobody has made, and it is not made here.
 * This only stops the screen from implying it already happened.
 */
export async function viewerSeesCoupleScopedPapic(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // The same predicate as `papic_photos_couple_full` and
  // `papic_guest_captures_couple_read`: a `couple` member of this event.
  // Admins are covered too — their own policies grant is_admin(), and the
  // `event_members` read below simply returns nothing for them, which is the
  // safe answer for a note that only ever ADDS a caveat.
  const { data, error } = await supabase
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();

  // Fail toward SHOWING the caveat: if we cannot prove the viewer is permitted,
  // say the album may be incomplete. An unproven "you see everything" is the
  // exact claim this module exists to stop making.
  if (error) return false;
  return data !== null;
}
