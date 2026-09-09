import 'server-only';

import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';
import { storySurfacesFor } from './a-withdrawal-reaches-every-copy';

/**
 * THE ONE CALL A CONSENT WRITE MAKES — `04` §3 · `07` Q6 · 08 step 4.1.
 *
 * The list of surfaces lives in the pure module beside this one; this is the
 * effect. Two things happen, in this order and never the other way round:
 *
 *   1. **the story is stamped** with the moment it changed, so a print taken
 *      after this says what it is and the share-card URL moves;
 *   2. **every cached public surface is thrown away**, so the next reader —
 *      including the regeneration triggered by step 1 — builds from the new
 *      truth rather than re-publishing the old stamp.
 *
 * ⚠ THE ORDER IS THE WHOLE POINT. Revalidating first would race the write: the
 * page can be rebuilt, read the version that is still on its way out, and cache
 * the OLD share-card address for another hour. Stamp, then invalidate.
 *
 * ── IT NEVER THROWS, AND THAT IS A DECISION WITH A REASON ───────────────────
 * By the time this is called the guest's withdrawal is already IN THE DATABASE —
 * it is durable, it is what the veto reads, and it is correct. Throwing here
 * would tell a guest exercising an RA 10173 right that it failed when it did
 * not, and would leave them pressing the button again. So a refused stamp is
 * logged and swallowed; the withdrawal still lands, and the surfaces still get
 * invalidated, they simply carry the previous version token until the next
 * write. **A rejected query is an absence** — `error` set, nothing thrown — so
 * it is checked for explicitly rather than left to a `catch` that would never
 * fire.
 *
 * 🔑 WHAT IT STILL CANNOT REACH, said here so nobody assumes otherwise:
 * a share somebody has already posted (it holds the old card address), and paper.
 */
export async function everyCopyIsNowStale(eventId: string): Promise<void> {
  const clean = eventId?.trim();
  if (!clean) return;

  const admin = createAdminClient();

  const { data: ev, error: evError } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', clean)
    .maybeSingle();
  if (evError) {
    console.warn('[everyCopyIsNowStale] could not read the event', {
      eventId: clean,
      error: evError.message,
    });
  }
  const slug = typeof ev?.slug === 'string' ? ev.slug.trim() : '';
  if (!slug) return;

  /*
    The stamp. `story_version_at` is a timestamp rather than a counter on
    purpose (see the migration): `now()` is a blind write, so two guests
    withdrawing in the same second cannot lose one another's bump the way
    `version = version + 1` read-modify-write would.

    `update` and not `upsert`: a row exists for every event from creation, and
    inventing one here for an event that somehow has none would create an
    editorial row as a side effect of a guest touching their own consent.
  */
  const { error: stampError } = await admin
    .from('event_editorial')
    .update({ story_version_at: new Date().toISOString() })
    .eq('event_id', clean);
  if (stampError) {
    console.warn('[everyCopyIsNowStale] could not stamp the story version', {
      eventId: clean,
      error: stampError.message,
    });
  }

  /*
    The nested `/u/{owner}/{slug}` form, resolved through the SAME helper every
    URL in the product goes through. Today the cutover flag is off and this
    returns null without running a query, so the list is unchanged; the day it is
    flipped, the canonical surface joins the set without anyone remembering to
    come back here.
  */
  let ownerSlug: string | null = null;
  try {
    const { resolveEventOwnerSlug } = await import('./public-event-url');
    ownerSlug = await resolveEventOwnerSlug(admin, clean);
  } catch {
    ownerSlug = null;
  }

  for (const path of storySurfacesFor(slug, ownerSlug)) {
    revalidatePath(path);
  }
}
