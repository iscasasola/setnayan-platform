'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireHostMembership } from '@/lib/host-gate';
import { resolveReturnTo } from '@/lib/editor-return';
import { refChange } from '@/lib/hub-look-pro';
import { requireLookPro } from '@/lib/hub-look-gate';
import { isHubDraftWrite, saveHubDraftPatch } from '@/lib/hub-draft-store';

/**
 * Server actions for the wedding landing page hero photo editor.
 *
 * The actual file bytes are PUT directly to R2 by the `<FileUpload>` client
 * component (apps/web/app/_components/file-upload.tsx) via the
 * `/api/upload` presigned-URL endpoint. By the time these server actions run,
 * the file is already in R2 and the form carries the `r2://` ref in the
 * `hero_image_url` field. All we do here is persist it to
 * `events.landing_page_hero_image_url` + stamp the audit columns.
 *
 * `removeHeroPhoto` nulls the column — the R2 object itself stays (cheap to
 * keep, simple to recover from accidental removes). A future R2 sweep cron
 * can prune orphaned event hero images by walking the bucket prefix; not
 * shipping that today per [[reference_setnayan_cron_strategy]].
 *
 * Auth is enforced via:
 *   1. Supabase session cookie → `auth.uid()` must be a host on this event
 *      (event_moderators row OR legacy event_members couple row). Matches
 *      the requireHostMembership pattern in privacy/actions.ts (PR #381).
 *   2. RLS on `events` UPDATE — hosts can only update events they're on.
 *
 * Error path uses `redirect()` to bail out — Next.js form actions need to
 * return `void | Promise<void>`, so we don't return error objects.
 *
 * Cross-ref: CLAUDE.md 2026-05-22 row · Hero Photo PR sibling of #381
 * Privacy + #382 Dress Code + #383 Photo Moments.
 */

/** The hero photo, into the couple's draft — then back to the Maker. Never returns. */
async function draftHero(eventId: string, ref: string | null, formData: FormData): Promise<never> {
  await saveHubDraftPatch(eventId, { events: { landing_page_hero_image_url: ref } });
  revalidatePath(`/dashboard/${eventId}/launch`);
  revalidatePath('/[slug]', 'page');
  redirect(resolveReturnTo(formData, `/dashboard/${eventId}/launch`));
}

export async function uploadHeroPhoto(formData: FormData) {
  const eventIdRaw = formData.get('event_id');
  const heroImageUrlRaw = formData.get('hero_image_url');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    redirect('/dashboard');
  }
  const eventId = eventIdRaw;

  if (typeof heroImageUrlRaw !== 'string' || heroImageUrlRaw.length === 0) {
    // Empty upload — bounce back to the editor without changing state.
    redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/hero-photo`),
  );
  }
  // Light sanity check — the /api/upload route signs only valid R2 puts so
  // anything not starting with r2:// is either an old vendor logo paste-URL
  // (which the FileUpload won't emit) or hostile input.
  if (!heroImageUrlRaw.startsWith('r2://')) {
    redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/hero-photo`),
  );
  }

  const userId = await requireHostMembership(eventId);

  /* 💾 THE DRAFT DOOR (Event Hub Maker Phase 6 — the one hero). From the Maker
     (`<HubDraftField />`) the photo goes into the couple's draft: guests keep
     the live hero until Apply, and Apply is where Pro is checked — a free couple
     may TRY their own photo and pays at Apply (owner 2026-09-25). The draft holds
     it to the public bucket; Apply holds it to this event's own uploads. */
  if (isHubDraftWrite(formData)) await draftHero(eventId, heroImageUrlRaw, formData);

  const supabase = await createClient();

  /* ⛔ THEIR OWN HERO PHOTO IS PRO (owner 2026-09-24, "A"). A free couple keeps
     the picture we give the page; one who already has their own keeps it and
     may remove it (`removeHeroPhoto`, never gated) — but may not put up a new
     one. Re-saving the photo already stored is 'none' and passes. */
  const { data: current } = await supabase
    .from('events')
    .select('landing_page_hero_image_url')
    .eq('event_id', eventId)
    .maybeSingle();
  await requireLookPro(
    eventId,
    refChange(current?.landing_page_hero_image_url as string | null | undefined, heroImageUrlRaw),
  );

  await supabase
    .from('events')
    .update({
      landing_page_hero_image_url: heroImageUrlRaw,
      landing_page_hero_image_uploaded_at: new Date().toISOString(),
      landing_page_hero_image_uploaded_by_user_id: userId,
    })
    .eq('event_id', eventId);

  // Revalidate the dashboard hub + the website hub + the public landing
  // page so cached HTML reflects the new photo immediately.
  revalidatePath(`/dashboard/${eventId}/website/hero-photo`);
  revalidatePath(`/dashboard/${eventId}/website`);
  revalidatePath('/[slug]', 'page');

  // Land back on the editor so the host sees the new preview tile.
  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/hero-photo`),
  );
}

export async function removeHeroPhoto(formData: FormData) {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    redirect('/dashboard');
  }
  const eventId = eventIdRaw;

  await requireHostMembership(eventId);

  // 💾 The draft door: "Use the invitation card" in the Maker takes the photo
  // off IN THE DRAFT — guests keep it until Apply. Removing is never Pro.
  if (isHubDraftWrite(formData)) await draftHero(eventId, null, formData);

  const supabase = await createClient();

  await supabase
    .from('events')
    .update({
      landing_page_hero_image_url: null,
      landing_page_hero_image_uploaded_at: null,
      landing_page_hero_image_uploaded_by_user_id: null,
    })
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/website/hero-photo`);
  revalidatePath(`/dashboard/${eventId}/website`);
  revalidatePath('/[slug]', 'page');

  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/hero-photo`),
  );
}
