'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { findPatiktokTemplate } from '@/lib/patiktok';
import { presignDisplayUrl } from '@/lib/uploads';
import { isR2Configured, R2_BUCKETS } from '@/lib/r2';

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

/**
 * Iteration 0017 PR2 — record a booth-captured clip.
 *
 * Called by the client booth-capture component AFTER it has PUT the recorded
 * blob direct-to-R2 via the presigned URL from `/api/patiktok/upload`. Inserts
 * a `patiktok_source_clips` row pointing at the uploaded object. Uses the
 * cookie-scoped client (NOT the admin client) so RLS enforces event membership
 * on the INSERT — a non-member's row is rejected at the database.
 *
 * Returns the new clip_id so the component can track the session's captures.
 */
export async function recordPatiktokClip(input: {
  eventId: string;
  templateSlug?: string | null;
  r2Bucket?: string | null;
  r2Key: string;
  mimeType?: string | null;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
  performerLabel?: string | null;
}): Promise<{ clipId: string }> {
  if (typeof input.eventId !== 'string' || input.eventId.length === 0) {
    throw new Error('eventId required');
  }
  if (typeof input.r2Key !== 'string' || input.r2Key.length === 0) {
    throw new Error('r2Key required');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('patiktok_source_clips')
    .insert({
      event_id: input.eventId,
      template_slug: input.templateSlug ?? null,
      captured_by: user.id,
      r2_bucket: input.r2Bucket || 'setnayan-media',
      r2_object_key: input.r2Key,
      mime_type: input.mimeType || 'video/webm',
      duration_sec:
        typeof input.durationSec === 'number' && input.durationSec > 0
          ? input.durationSec
          : null,
      width: input.width ?? null,
      height: input.height ?? null,
      size_bytes: input.sizeBytes ?? null,
      performer_label:
        typeof input.performerLabel === 'string' && input.performerLabel.trim()
          ? input.performerLabel.trim()
          : null,
      status: 'uploaded',
    })
    .select('clip_id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not record clip');
  }

  revalidatePath(`/dashboard/${input.eventId}/add-ons/patiktok/booth`);
  return { clipId: data.clip_id as string };
}

/**
 * Iteration 0017 PR3 — claim a render job for the CLIENT-SIDE renderer.
 *
 * The browser (WebCodecs) does the actual encoding, so this server action just
 * (1) confirms the caller can see the job (RLS-scoped read = event membership),
 * (2) gathers the event's captured clips as presigned GET URLs the browser can
 * decode, (3) resolves the chosen music track, and (4) flips the job to
 * `processing` via the service role (couples never write the queue directly).
 *
 * Returns everything the renderer needs. Throws (with a couple-readable
 * message) when there are no clips yet or R2 isn't configured.
 */
export async function claimPatiktokRenderJob(jobId: string): Promise<{
  eventId: string;
  templateSlug: string;
  durationSec: number;
  musicUrl: string | null;
  clips: Array<{ clipId: string; url: string; durationSec: number | null }>;
}> {
  if (typeof jobId !== 'string' || jobId.length === 0) {
    throw new Error('jobId required');
  }
  if (!isR2Configured()) {
    throw new Error('Storage is not configured yet — renders are unavailable.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS-scoped read: only an event member can see this row, so a successful
  // read is also the authorization check.
  const { data: job, error: jobError } = await supabase
    .from('patiktok_render_jobs')
    .select('job_id, event_id, template_slug, duration_sec, music_track_slug, status')
    .eq('job_id', jobId)
    .maybeSingle();
  if (jobError) throw new Error(jobError.message);
  if (!job) throw new Error('Render job not found.');

  // Gather the event's captured clips (oldest first → chronological reel).
  const { data: clipRows, error: clipError } = await supabase
    .from('patiktok_source_clips')
    .select('clip_id, r2_bucket, r2_object_key, duration_sec')
    .eq('event_id', job.event_id)
    .in('status', ['uploaded', 'included'])
    .order('captured_at', { ascending: true });
  if (clipError) throw new Error(clipError.message);
  if (!clipRows || clipRows.length === 0) {
    throw new Error('No booth clips captured yet — record at the booth first.');
  }

  const clips = await Promise.all(
    clipRows.map(async (c) => ({
      clipId: c.clip_id as string,
      // Patiktok clips live in the public media bucket; presign a working GET
      // URL the browser can decode (24h TTL).
      url: await presignDisplayUrl(R2_BUCKETS.media, c.r2_object_key as string),
      durationSec: (c.duration_sec as number | null) ?? null,
    })),
  );

  // Resolve music (may be null — owned catalogue isn't ingested yet).
  let musicUrl: string | null = null;
  if (job.music_track_slug) {
    const { data: track } = await supabase
      .from('patiktok_music_tracks')
      .select('source_url')
      .eq('track_slug', job.music_track_slug)
      .maybeSingle();
    musicUrl = (track?.source_url as string | null) ?? null;
  }

  // Flip to processing (service role — the couple never writes the queue).
  const admin = createAdminClient();
  await admin
    .from('patiktok_render_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('job_id', jobId)
    .neq('status', 'completed');

  return {
    eventId: job.event_id as string,
    templateSlug: job.template_slug as string,
    durationSec: (job.duration_sec as number) ?? 10,
    musicUrl,
    clips,
  };
}

/**
 * Iteration 0017 PR3 — finalize a render job after the browser uploaded the MP4.
 *
 * Marks the job complete with the R2 output pointer, records which clips were
 * stitched (the job→clip junction), and flips those clips to `included`. All
 * writes are service-role; membership is re-verified via an RLS-scoped read.
 * Returns a presigned download URL for the just-rendered reel.
 */
export async function finalizePatiktokRenderJob(input: {
  jobId: string;
  bucket: string;
  key: string;
  bytes: number;
  durationSec: number;
  renderMode: 'client_webcodecs' | 'client_mediarecorder';
  clipIds: string[];
}): Promise<{ downloadUrl: string }> {
  if (typeof input.jobId !== 'string' || input.jobId.length === 0) {
    throw new Error('jobId required');
  }
  if (typeof input.key !== 'string' || input.key.length === 0) {
    throw new Error('output key required');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Membership re-check via RLS-scoped read.
  const { data: job } = await supabase
    .from('patiktok_render_jobs')
    .select('job_id, event_id')
    .eq('job_id', input.jobId)
    .maybeSingle();
  if (!job) throw new Error('Render job not found.');

  // Patiktok reels live in the public media bucket. Presigned GET for
  // immediate download (max 7-day TTL); the durable pointer is
  // output_object_key, resolved fresh by the delivery surface in PR4.
  const bucket = R2_BUCKETS.media;
  const downloadUrl = await presignDisplayUrl(bucket, input.key, 60 * 60 * 24 * 7);

  const admin = createAdminClient();
  const { error: updErr } = await admin
    .from('patiktok_render_jobs')
    .update({
      status: 'completed',
      output_bucket: bucket,
      output_object_key: input.key,
      output_bytes: Number.isFinite(input.bytes) ? Math.round(input.bytes) : null,
      output_url: downloadUrl,
      render_mode: input.renderMode,
      completed_at: new Date().toISOString(),
    })
    .eq('job_id', input.jobId);
  if (updErr) throw new Error(updErr.message);

  const clipIds = Array.isArray(input.clipIds) ? input.clipIds.slice(0, 250) : [];
  if (clipIds.length > 0) {
    await admin.from('patiktok_render_job_clips').upsert(
      clipIds.map((clipId, i) => ({
        job_id: input.jobId,
        clip_id: clipId,
        sort_order: i,
      })),
      { onConflict: 'job_id,clip_id', ignoreDuplicates: true },
    );
    await admin
      .from('patiktok_source_clips')
      .update({ status: 'included' })
      .in('clip_id', clipIds)
      .eq('status', 'uploaded');
  }

  revalidatePath(`/dashboard/${job.event_id}/add-ons/patiktok`);
  return { downloadUrl };
}

/**
 * Iteration 0017 PR3 — mark a render job failed (browser render/upload error).
 */
export async function failPatiktokRenderJob(input: {
  jobId: string;
  reason: string;
}): Promise<void> {
  if (typeof input.jobId !== 'string' || input.jobId.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: job } = await supabase
    .from('patiktok_render_jobs')
    .select('job_id')
    .eq('job_id', input.jobId)
    .maybeSingle();
  if (!job) return;

  const admin = createAdminClient();
  await admin
    .from('patiktok_render_jobs')
    .update({
      status: 'failed',
      failure_reason: (input.reason || 'Render failed').slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq('job_id', input.jobId);
}

/**
 * Phase 3.0.1 — couple-initiated TikTok grant revocation.
 *
 * Soft-revokes the active patiktok_oauth_grants row for the event (sets
 * revoked_at + revoked_reason='couple_disconnected'). The render worker
 * checks revoked_at before posting, so future renders won't reach TikTok
 * via this grant.
 *
 * Note this does NOT call TikTok's revoke endpoint — the access token stays
 * technically valid until it expires naturally (~24h). Couples who want a
 * harder revocation should also remove Setnayan from TikTok Settings →
 * Privacy → Manage apps and websites. The privacy policy documents both
 * paths.
 */
export async function disconnectPatiktokTiktok(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('event_id required');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify the caller is the couple on this event. RLS on patiktok_oauth_grants
  // already restricts reads to event members, but only couples should be able
  // to revoke. Service role write bypasses RLS so we must check authorization
  // ourselves.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    throw new Error('Only the couple can disconnect TikTok for this event');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('patiktok_oauth_grants')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: 'couple_disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .is('revoked_at', null);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/add-ons/patiktok`);
  redirect(
    `/dashboard/${eventId}/add-ons/patiktok?tiktok_disconnected=1`,
  );
}
