'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { findPatiktokTemplate } from '@/lib/patiktok';

// Iteration 0017 Phase 2 — Patiktok render-job submission.
//
// Replaces the client-side mock in render-form.tsx with a real INSERT into
// `patiktok_render_jobs` (table created in the Phase 1 migration). The job
// row starts at status='queued'; the worker that drains the queue (ffmpeg /
// Remotion vertical-reel render → R2 upload) is the next deliverable — see
// `app/api/internal/patiktok/process-job/route.ts` for the worker seam.
//
// Phase 2 wiring is intentionally minimal: validate the input, confirm the
// caller is a couple on the event, insert the row. No render orchestration,
// no R2 calls, no music selection — those follow in subsequent commits inside
// this iteration.

export async function submitPatiktokRender(formData: FormData) {
  const eventId = formData.get('event_id');
  const templateSlug = formData.get('template_slug');
  const durationRaw = formData.get('duration_sec');
  const performerCountRaw = formData.get('performer_count');
  const musicTrackSlugRaw = formData.get('music_track_slug');

  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('event_id required');
  }
  if (typeof templateSlug !== 'string' || templateSlug.length === 0) {
    throw new Error('template_slug required');
  }
  // Validate the slug against the catalogue so we can't insert rows that
  // reference templates the UI can't render. Phase 2 keeps the catalogue
  // hard-coded; Phase 5+ moves it to DB-backed.
  if (!findPatiktokTemplate(templateSlug)) {
    throw new Error(`Unknown patiktok template: ${templateSlug}`);
  }
  if (typeof durationRaw !== 'string') throw new Error('duration_sec required');
  const durationSec = Number(durationRaw);
  if (!Number.isFinite(durationSec) || durationSec < 1 || durationSec > 30) {
    throw new Error('duration_sec must be 1–30');
  }
  const performerCount =
    typeof performerCountRaw === 'string' && performerCountRaw.length > 0
      ? Math.max(1, Math.floor(Number(performerCountRaw)))
      : 1;
  const musicTrackSlug =
    typeof musicTrackSlugRaw === 'string' && musicTrackSlugRaw.length > 0
      ? musicTrackSlugRaw
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Validate music track if provided. RLS-scoped read; we trust the policy
  // (anyone_reads_active_tracks WHERE is_active = TRUE) to surface only
  // legitimate choices.
  if (musicTrackSlug) {
    const { data: track } = await supabase
      .from('patiktok_music_tracks')
      .select('track_slug')
      .eq('track_slug', musicTrackSlug)
      .eq('is_active', true)
      .maybeSingle();
    if (!track) {
      throw new Error(`Unknown patiktok music track: ${musicTrackSlug}`);
    }
  }

  const { data, error } = await supabase
    .from('patiktok_render_jobs')
    .insert({
      event_id: eventId,
      template_slug: templateSlug,
      requested_by: user.id,
      duration_sec: Math.round(durationSec),
      performer_count: performerCount,
      music_track_slug: musicTrackSlug,
      status: 'queued',
    })
    .select('job_id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not queue render job');
  }

  revalidatePath(`/dashboard/${eventId}/add-ons/patiktok`);
  redirect(
    `/dashboard/${eventId}/add-ons/patiktok?queued=${data.job_id}`,
  );
}
