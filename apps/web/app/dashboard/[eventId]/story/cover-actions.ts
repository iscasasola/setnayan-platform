'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { hostUserId } from './_lib/host-authority';
import { resolveStoryCover, sanitizeStoryCover } from '@/lib/story-cover';

/**
 * THE COVER'S ONE WRITE (`02` §6 · 08 step 1.5).
 *
 * ═══ WHY THIS IS ITS OWN PRESS, NOT PART OF SAVING THE STORY ════════════════
 * The cover is a PICK with a visible consequence on two surfaces the host is
 * not looking at — the shelf card and the share card. `02` §6 says "pick it
 * once … you can see all three below", so the press and the change are the same
 * gesture. Folding it into the story's Save would mean the previews beside it
 * were showing a cover that was not yet anyone's cover.
 *
 * ═══ WHY IT WRITES WITH THE ADMIN CLIENT ════════════════════════════════════
 * ⚠ NOT AN OVERSIGHT AND NOT A COPIED LINE. S4's migration granted `SELECT` on
 * these two columns and DELIBERATELY no `UPDATE`, recording that "the screen
 * that writes these adds UPDATE if it ever writes through a user session". This
 * screen does not need one: authority is proved FIRST, through the caller's own
 * session (`hostUserId`), and only then does the service role write. Adding a
 * session-level UPDATE grant on `events` to avoid that would widen the write
 * surface of the whole table for one screen's convenience.
 *
 * ═══ THE BROWSER IS NEVER THE ELIGIBILITY CHECK ═════════════════════════════
 * 🔑 A server action is a public POST. The tiles the host sees were filtered by
 * `loadCoverCandidates`, but nothing stops a hand-made request naming a capture
 * that is unscreened, hidden, or carries a guest who opted out. So the pair is
 * RE-RESOLVED here through `resolveStoryCover` — the same function the shelf and
 * the share card read through — and a pair that does not resolve is refused.
 * The rule is asked once and answered in one place, on the way in and on the way
 * out.
 */

export type CoverActionResult = { ok: true } | { ok: false; error: string };

/**
 * THE THIRD JOB — the top of the story — WITHOUT TOUCHING THE STORY'S OWN TREE.
 *
 * 🔑 RULE 0's BEST FIND IN THIS SESSION. The story's lead image is already
 * chosen by a four-rung ladder in the public loader: the couple's own upload
 * (`draft_json.heroUpload`) → a curated capture (`event_editorial.hero_photo_id`)
 * → the Papic auto-pick → the living hero. **`hero_photo_id` HAS NO WRITER** —
 * the loader says so in its own comment ("the normal case — hero_photo_id has no
 * writer yet"). It is a rung that has been waiting for this screen.
 *
 * So the cover does not need the story to learn anything new: it writes the
 * ladder's own top rungs, and the story leads with the host's cover the moment
 * they pick it. Two doors, one room — the same phrasing the last word already
 * uses for `events.special_message`.
 *
 * ⚠ TWO OF THE FIVE KINDS CANNOT BE SAID IN THAT LADDER. A supplier's frame and
 * the animated monogram have no rung, so for those the ladder is CLEARED and the
 * story's own top falls back to the living hero — while the shelf card and the
 * share card, which read `resolveStoryCover` directly, show the real choice. The
 * cover screen says this out loud rather than letting a host find it later; the
 * page lane teaching the story to read the cover directly is what removes the
 * asymmetry, and this bridge with it.
 *
 * ⚠ AND CLEARING IS PART OF THE CHOICE, NOT A SIDE EFFECT. A host who uploaded a
 * cover in "Your own photos" and then picks the living hero here is asking for
 * the living hero; leaving the upload on the ladder's first rung would mean the
 * story kept leading with the picture they just replaced. The file itself is
 * untouched in storage.
 */
async function leadTheStoryWith(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  cover: { kind: string; ref: string | null } | null,
): Promise<boolean> {
  const { data: existing, error: readError } = await admin
    .from('event_editorial')
    .select('draft_json')
    .eq('event_id', eventId)
    .maybeSingle();
  // A REFUSED READ IS NOT AN EMPTY DRAFT. Writing over a document we failed to
  // read would delete the host's headline, deck and every chapter override.
  if (readError) return false;

  const base =
    existing?.draft_json && typeof existing.draft_json === 'object'
      ? (existing.draft_json as Record<string, unknown>)
      : {};

  const { error } = await admin.from('event_editorial').upsert(
    {
      event_id: eventId,
      draft_json: { ...base, heroUpload: cover?.kind === 'upload' ? cover.ref : '' },
      hero_photo_id: cover?.kind === 'capture' ? cover.ref : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id' },
  );
  return !error;
}

const NO_ACCESS = 'You don’t have access to this celebration.';
const NOT_ELIGIBLE =
  'That picture can’t be your cover. It’s either still being screened, or ' +
  'someone in it asked not to be shown.';

export async function setStoryCover(
  eventId: string,
  kind: unknown,
  ref: unknown,
): Promise<CoverActionResult> {
  if (!(await hostUserId(eventId))) return { ok: false, error: NO_ACCESS };

  const admin = createAdminClient();

  // `null` kind is the honest way to clear a cover: back to the living hero,
  // which is what every surface does when nothing was ever chosen.
  const cover = kind === null ? null : sanitizeStoryCover(kind, ref);
  if (kind !== null && !cover) return { ok: false, error: NOT_ELIGIBLE };

  const { data: event, error: readError } = await admin
    .from('events')
    .select('slug, landing_page_hero_image_url')
    .eq('event_id', eventId)
    .maybeSingle();
  // A rejected read is an ABSENCE, not a throw — and without the event row the
  // eligibility re-check below cannot be made, so this refuses rather than
  // writing a pair it could not verify.
  if (readError || !event) return { ok: false, error: 'Could not save your cover. Please try again.' };

  if (cover) {
    const resolved = await resolveStoryCover(admin, eventId, {
      story_cover_kind: cover.kind,
      story_cover_ref: cover.ref,
      landing_page_hero_image_url: event.landing_page_hero_image_url,
    });
    if (!resolved) return { ok: false, error: NOT_ELIGIBLE };
  }

  const { error } = await admin
    .from('events')
    .update({
      story_cover_kind: cover?.kind ?? null,
      story_cover_ref: cover?.ref ?? null,
    })
    .eq('event_id', eventId);
  if (error) return { ok: false, error: 'Could not save your cover. Please try again.' };

  const leadOk = await leadTheStoryWith(admin, eventId, cover);
  if (!leadOk) {
    return {
      ok: false,
      error:
        'Your cover was saved for the shelf and the share card, but the top of ' +
        'your story didn’t change. Try picking it again.',
    };
  }

  revalidatePath(`/dashboard/${eventId}/story`);
  // The shelf card reads the cover now, so the shelf itself has to be rebuilt —
  // this is half of "the shelf card and the OG card both change".
  revalidatePath('/realstories');
  const slug = typeof event.slug === 'string' ? event.slug : null;
  if (slug) {
    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/print`);
  }
  /*
    ⚠ THE SHARE CARD IS NOT REVALIDATED HERE, AND IT IS NOT AN OMISSION.
    `/api/og/realstory-slug/[slug]` is a route handler that renders on request
    and sets its own `max-age=3600, stale-while-revalidate=86400`. There is no
    Next cache entry to invalidate; what it serves changes on its next render,
    and the hour is the crawler cache the route chose deliberately ("a couple can
    republish or swap their hero photo, and we want the card to refresh within
    the hour"). Calling revalidatePath on it would look like a fix and do
    nothing.
  */
  return { ok: true };
}
