'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  isPhotoMomentMode,
  PHOTO_MOMENT_LIMITS,
  type PhotoMoment,
  type PhotoMomentMode,
  type PhotoMomentsConfig,
  type UpdatePhotoMomentsResult,
} from './config';

// Photo Moments — host-curated phone-down moments shown on the public
// landing page at /[slug]. Replaces the hardcoded sample list
// (Ceremony · The Bridal Walk · etc.) baked into PhotoMomentsWidget on
// apps/web/app/[slug]/page.tsx with host-authored content.
//
// JSONB column on events.photo_moments_config holds the whole config;
// this single server action overwrites the column atomically with the
// validated set of moments + intro_copy. No separate insert/delete
// endpoints — the editor page submits the whole list in one form so the
// host sees a single Save button (not per-row CRUD).
//
// Hotfix 2026-05-22: file used to mix sync helpers + types into the
// 'use server' module which broke the Vercel build (Server Actions
// must be async functions). All sync exports moved to ./config.ts;
// this file is now async-only + clean of non-action exports.
//
// Co-shipped with Hero Photo (PR #388), Dress Code (PR #382), and
// Privacy (PR #381) editors (all 2026-05-22 same-day).

/**
 * Persists the host's photo-moments config onto
 * events.photo_moments_config. The form submits the whole moments list
 * as parallel arrays indexed by row position; this action parses, trims,
 * caps, validates, and writes atomically.
 *
 * Form fields expected:
 *   • event_id (hidden)
 *   • intro_copy (textarea, ≤240 chars, optional)
 *   • time_label[0..N], title[0..N], note[0..N], mode[0..N] (parallel arrays)
 *
 * Rows with empty title are dropped silently so the host can leave
 * scaffold rows in the form without them landing on the public page.
 * After save: revalidates both the editor + the public landing page
 * + the website hub (so the hub's preview iframe shows the new copy).
 */
export async function updatePhotoMoments(
  formData: FormData,
): Promise<UpdatePhotoMomentsResult> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    return {
      ok: false,
      error: 'Missing event reference. Please refresh and try again.',
    };
  }

  // Intro copy — single optional textarea. Trim + cap to keep the
  // landing page render bounded; an over-long intro paragraph would
  // crowd out the moments list which is the load-bearing content.
  const introRaw = formData.get('intro_copy');
  const introCopy =
    typeof introRaw === 'string'
      ? introRaw.trim().slice(0, PHOTO_MOMENT_LIMITS.MAX_INTRO_LEN)
      : '';

  // Parallel arrays — each moment row submits four fields with the
  // same array index. FormData.getAll returns them in DOM order so the
  // row sequence the host sees in the form maps 1:1 to display order on
  // the landing page.
  const timeLabels = formData.getAll('time_label[]');
  const titles = formData.getAll('title[]');
  const notes = formData.getAll('note[]');
  const modes = formData.getAll('mode[]');

  const rowCount = Math.min(
    timeLabels.length,
    titles.length,
    notes.length,
    modes.length,
  );

  const moments: PhotoMoment[] = [];
  for (let i = 0; i < rowCount; i++) {
    const titleRaw = titles[i];
    if (typeof titleRaw !== 'string') continue;
    const title = titleRaw.trim().slice(0, PHOTO_MOMENT_LIMITS.MAX_TITLE_LEN);
    // Drop rows without a title — scaffold rows the host added but
    // never filled in shouldn't show up as empty bullets. The host
    // doesn't have to manually delete them before saving.
    if (title.length === 0) continue;

    const timeLabelRaw = timeLabels[i];
    const timeLabel =
      typeof timeLabelRaw === 'string'
        ? timeLabelRaw.trim().slice(0, PHOTO_MOMENT_LIMITS.MAX_TIME_LABEL_LEN)
        : '';

    const noteRaw = notes[i];
    const note =
      typeof noteRaw === 'string'
        ? noteRaw.trim().slice(0, PHOTO_MOMENT_LIMITS.MAX_NOTE_LEN)
        : '';

    const modeRaw = modes[i];
    const mode: PhotoMomentMode =
      typeof modeRaw === 'string' && isPhotoMomentMode(modeRaw)
        ? modeRaw
        : 'phone_down';

    moments.push({ time_label: timeLabel, title, note, mode });
    if (moments.length >= PHOTO_MOMENT_LIMITS.MAX_MOMENTS) break;
  }

  const config: PhotoMomentsConfig = {
    intro_copy: introCopy,
    moments,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('events')
    .update({ photo_moments_config: config })
    .eq('event_id', eventIdRaw);

  if (error) {
    // RLS denial or any other Postgres error — translate to brand voice
    // so the host sees a polite message, not a raw error string. The
    // help link gives them a clean escape hatch if it keeps failing.
    return {
      ok: false,
      error:
        'Couldn’t save your photo moments. If this keeps happening, please reach out from /help.',
    };
  }

  // Revalidate everywhere this config feeds:
  //   • the editor page so it re-renders with the saved values
  //   • the website hub so its preview iframe picks up the new copy
  //   • the public /[slug] landing page so guests see the new list
  //     on their next visit
  revalidatePath(`/dashboard/${eventIdRaw}/website/photo-moments`);
  revalidatePath(`/dashboard/${eventIdRaw}/website`);
  // The landing page's slug isn't carried in the form, but
  // revalidating the dynamic [slug] segment refreshes every event's
  // landing page in the route group. Safe because each request still
  // does its own DB read — this just busts the static cache.
  revalidatePath('/[slug]', 'page');

  return { ok: true };
}
