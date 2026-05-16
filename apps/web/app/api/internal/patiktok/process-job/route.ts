import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Iteration 0017 Phase 2 — Patiktok render-job worker.
//
// Internal route invoked either by a Supabase pg_cron job (per the V1 cron
// strategy) or manually from the admin queue. Picks up the next queued job
// (or a specific job_id), transitions it through processing → completed,
// and writes the rendered MP4's R2 signed URL into `output_url`.
//
// THIS IS A STUB. The real ffmpeg / Remotion render pipeline (face-lock
// continuity, masked transitions, music-loop sync, multi-performer detection)
// runs out-of-process — likely in a Vercel Function that mounts an ffmpeg
// binary or in a separate worker service. This route currently:
//   1. Accepts a POST with optional { job_id } or picks the oldest queued job.
//   2. Marks status='processing', stamps started_at.
//   3. Stubs the render with a 100ms sleep + a placeholder output_url.
//   4. Marks status='completed', stamps completed_at, writes output_url.
//
// All four steps must be replaced by the real worker before couples can
// actually use Patiktok. See the `TODO(0017-phase2)` markers below.
//
// Auth: protected by `INTERNAL_WORKER_SECRET` (env var). pg_cron passes it
// as the `Authorization: Bearer …` header; admin manual triggers use the
// same secret in a fetch.

const PLACEHOLDER_OUTPUT =
  'r2://patiktok-renders/_pending/please-replace-with-real-output.mp4';

type ProcessJobBody = {
  job_id?: string;
};

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.INTERNAL_WORKER_SECRET ?? ''}`;
  if (!process.env.INTERNAL_WORKER_SECRET || auth !== expected) {
    return unauthorized();
  }

  let body: ProcessJobBody = {};
  try {
    body = (await req.json()) as ProcessJobBody;
  } catch {
    // empty body is fine — fall through to pick the oldest queued job
  }

  const admin = createAdminClient();

  // 1. Pick the next job (specific or oldest queued)
  let jobId = body.job_id ?? null;
  if (!jobId) {
    const { data: next, error: pickError } = await admin
      .from('patiktok_render_jobs')
      .select('job_id')
      .eq('status', 'queued')
      .order('enqueued_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (pickError) {
      return NextResponse.json({ error: pickError.message }, { status: 500 });
    }
    if (!next) {
      return NextResponse.json({ status: 'no-queued-jobs' }, { status: 200 });
    }
    jobId = next.job_id as string;
  }

  // 2. Transition to processing
  const startedAt = new Date().toISOString();
  const { error: startError } = await admin
    .from('patiktok_render_jobs')
    .update({ status: 'processing', started_at: startedAt })
    .eq('job_id', jobId)
    .eq('status', 'queued');
  if (startError) {
    return NextResponse.json({ error: startError.message }, { status: 500 });
  }

  // 3. Render. STUB: the real ffmpeg pipeline goes here.
  //
  // TODO(0017-phase2): Pull the source clips (R2 keys recorded against this
  //   event), build the vertical-reel timeline (face-lock anchor + masked
  //   transitions + chosen music + 9:16 1080×1920 output), upload the
  //   rendered MP4 to R2 under `patiktok-renders/${event_id}/${job_id}.mp4`,
  //   sign the URL with a 30-day expiry, and write it into `output_url`.
  //   Failure modes (source-clip missing, ffmpeg crash, R2 upload error)
  //   must transition status='failed' with a non-null `failure_reason`.
  await new Promise((r) => setTimeout(r, 100));

  // 4. Mark completed with placeholder output_url
  const completedAt = new Date().toISOString();
  const { error: completeError } = await admin
    .from('patiktok_render_jobs')
    .update({
      status: 'completed',
      completed_at: completedAt,
      output_url: PLACEHOLDER_OUTPUT,
    })
    .eq('job_id', jobId);
  if (completeError) {
    return NextResponse.json(
      { error: completeError.message, jobId },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      status: 'completed-stub',
      job_id: jobId,
      output_url: PLACEHOLDER_OUTPUT,
      note: 'Stub worker — output_url is a placeholder, not a real render.',
    },
    { status: 200 },
  );
}

export async function GET() {
  // Convenience health check so cron-status pings don't blow up.
  return NextResponse.json({ status: 'ready', worker: 'patiktok-process-job' });
}
