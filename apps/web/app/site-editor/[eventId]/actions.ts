'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server actions for INLINE editing inside the full-screen site editor
 * (/site-editor/[eventId]).
 *
 * WHY these exist separately from the /website/* sub-editor actions
 * (e.g. website/hero-photo/actions.ts): those redirect BACK to their own
 * standalone page after a save. The site editor's whole premise is "edit on
 * the page" (Wedding_Website_Effects_and_Editing_Spec_2026-06-11 §1) — the
 * couple must never leave the live preview. So these mirror the same DB write +
 * RLS guard, but **revalidate the editor in place and return void** instead of
 * redirecting. The client closes its sheet + calls router.refresh() to pull the
 * new server-rendered state (and bumps the preview iframe so it reloads).
 *
 * Auth replicates the requireHostMembership guard the sub-editors use
 * (event_moderators OR legacy event_members couple); RLS on events UPDATE is the
 * backstop so a forged event_id can't write another couple's row.
 */

async function requireHostMembership(eventId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // event_moderators (canonical going forward, iteration 0048 V1).
  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return user.id;

  // event_members couple row (V1 backwards-compat).
  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (legacy?.member_type === 'couple') return user.id;

  redirect('/dashboard');
}

/**
 * Persist a newly-uploaded hero photo. The file bytes are already in R2 (the
 * <FileUpload> client PUT them via /api/upload); the form carries the `r2://`
 * ref in `hero_image_url`. We only write the column + stamp the audit fields,
 * then revalidate the editor + the public landing page. No redirect — the
 * client refreshes in place.
 */
export async function saveHeroPhoto(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const heroImageUrlRaw = formData.get('hero_image_url');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;

  // Only persist a real R2 ref. Empty / non-r2 input is a no-op (the client
  // keeps the sheet open so the couple can pick a file).
  if (typeof heroImageUrlRaw !== 'string' || !heroImageUrlRaw.startsWith('r2://')) {
    return;
  }

  const userId = await requireHostMembership(eventId);
  const supabase = await createClient();

  await supabase
    .from('events')
    .update({
      landing_page_hero_image_url: heroImageUrlRaw,
      landing_page_hero_image_uploaded_at: new Date().toISOString(),
      landing_page_hero_image_uploaded_by_user_id: userId,
    })
    .eq('event_id', eventId);

  revalidatePath(`/site-editor/${eventId}`);
  revalidatePath('/[slug]', 'page');
}

/**
 * Clear the hero photo (null the column). The R2 object itself stays — cheap to
 * keep, simple to recover from an accidental remove (mirrors the sub-editor's
 * removeHeroPhoto). No redirect — the client refreshes in place.
 */
export async function clearHeroPhoto(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;

  await requireHostMembership(eventId);
  const supabase = await createClient();

  await supabase
    .from('events')
    .update({
      landing_page_hero_image_url: null,
      landing_page_hero_image_uploaded_at: null,
      landing_page_hero_image_uploaded_by_user_id: null,
    })
    .eq('event_id', eventId);

  revalidatePath(`/site-editor/${eventId}`);
  revalidatePath('/[slug]', 'page');
}
