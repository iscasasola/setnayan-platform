'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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
// Co-dispatched with Hero Photo, Dress Code, and Privacy editors (all
// 2026-05-22 same-day).

const MAX_MOMENTS = 8;
const MAX_INTRO_LEN = 240;
const MAX_TIME_LABEL_LEN = 60;
const MAX_TITLE_LEN = 80;
const MAX_NOTE_LEN = 200;

// Fixed enum keeps the landing-page render branch-safe — three modes,
// each gets its own visual treatment (camera icon, quiet phone-down
// icon, Papic-branded chip per iteration 0012). Adding a fourth mode
// requires extending both this validator AND the renderer; do not let
// unknown strings through.
const MODE_VALUES = ['camera_ok', 'phone_down', 'papic_only'] as const;
export type PhotoMomentMode = (typeof MODE_VALUES)[number];

export type PhotoMoment = {
  time_label: string;
  title: string;
  note: string;
  mode: PhotoMomentMode;
};

export type PhotoMomentsConfig = {
  intro_copy: string;
  moments: PhotoMoment[];
};

export type UpdatePhotoMomentsResult =
  | { ok: true }
  | { ok: false; error: string };

function isPhotoMomentMode(value: string): value is PhotoMomentMode {
  return (MODE_VALUES as readonly string[]).includes(value);
}

/**
 * Reads the existing config off events.photo_moments_config and coerces
 * it to a known-good shape for the editor form. Unknown JSON shapes
 * (corrupted, partial, old) degrade gracefully to empty defaults so the
 * editor never crashes on a bad row.
 */
export function parsePhotoMomentsConfig(raw: unknown): PhotoMomentsConfig {
  const empty: PhotoMomentsConfig = { intro_copy: '', moments: [] };
  if (!raw || typeof raw !== 'object') return empty;

  const obj = raw as Record<string, unknown>;
  const intro = typeof obj.intro_copy === 'string' ? obj.intro_copy : '';

  const momentsRaw = Array.isArray(obj.moments) ? obj.moments : [];
  const moments: PhotoMoment[] = [];
  for (const m of momentsRaw) {
    if (!m || typeof m !== 'object') continue;
    const item = m as Record<string, unknown>;
    const timeLabel = typeof item.time_label === 'string' ? item.time_label : '';
    const title = typeof item.title === 'string' ? item.title : '';
    const note = typeof item.note === 'string' ? item.note : '';
    const mode =
      typeof item.mode === 'string' && isPhotoMomentMode(item.mode)
        ? item.mode
        : 'phone_down';
    // Skip rows with no title — they're meaningless on the landing page
    // and produce empty bullet entries that look like dev placeholders.
    if (title.trim().length === 0) continue;
    moments.push({ time_label: timeLabel, title, note, mode });
    if (moments.length >= MAX_MOMENTS) break;
  }

  return { intro_copy: intro, moments };
}

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
      ? introRaw.trim().slice(0, MAX_INTRO_LEN)
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
    const title = titleRaw.trim().slice(0, MAX_TITLE_LEN);
    // Drop rows without a title — scaffold rows the host added but
    // never filled in shouldn't show up as empty bullets. The host
    // doesn't have to manually delete them before saving.
    if (title.length === 0) continue;

    const timeLabelRaw = timeLabels[i];
    const timeLabel =
      typeof timeLabelRaw === 'string'
        ? timeLabelRaw.trim().slice(0, MAX_TIME_LABEL_LEN)
        : '';

    const noteRaw = notes[i];
    const note =
      typeof noteRaw === 'string' ? noteRaw.trim().slice(0, MAX_NOTE_LEN) : '';

    const modeRaw = modes[i];
    const mode: PhotoMomentMode =
      typeof modeRaw === 'string' && isPhotoMomentMode(modeRaw)
        ? modeRaw
        : 'phone_down';

    moments.push({ time_label: timeLabel, title, note, mode });
    if (moments.length >= MAX_MOMENTS) break;
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

// Re-exports so the editor page + landing renderer can share the
// same shape constants without re-typing them.
export const PHOTO_MOMENT_LIMITS = {
  MAX_MOMENTS,
  MAX_INTRO_LEN,
  MAX_TIME_LABEL_LEN,
  MAX_TITLE_LEN,
  MAX_NOTE_LEN,
} as const;

export const PHOTO_MOMENT_MODES = MODE_VALUES;

export const PHOTO_MOMENT_MODE_LABEL: Record<PhotoMomentMode, string> = {
  camera_ok: 'Cameras welcome',
  phone_down: 'Phone-down — stay present',
  papic_only: 'Our paparazzo will capture this',
};

export const PHOTO_MOMENT_MODE_HINT: Record<PhotoMomentMode, string> = {
  camera_ok: 'Guests welcome to shoot freely.',
  phone_down: 'Ask guests to put phones down and savour the moment.',
  papic_only: 'Reserved for your Papic team — guests stay present.',
};
