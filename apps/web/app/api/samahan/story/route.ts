import { NextResponse, after } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured, r2Upload, R2_BUCKETS } from '@/lib/r2';
import { classifyImageBytes, decideNsfw } from '@/lib/nsfw-screen';
import { hardDeleteStory } from '@/lib/samahan-stories';
import { notifySamahanCoMembers } from '@/lib/samahan-notify';

// POST /api/samahan/story — a member posts one story clip to their samahan.
// DELETE /api/samahan/story — the author takes their own story down early.
//
// The Setlog rules live where they can't be argued with:
//   · membership   — the caller's OWN client must be able to see the
//     community row (RLS: members only);
//   · one per hour — the UNIQUE (community_id, user_id, hour_bucket) index;
//     the route only translates 23505 into words;
//   · screening    — the poster frame is classified HERE, before any row
//     exists. A flagged post is refused outright: there is no unscreened
//     state to surface later. Classifier failure also refuses (fail closed) —
//     a story is a retryable two-second clip, not lost work;
//   · 24 hours     — expires_at DEFAULT in the table + the read policy.
//
// The clip arrives ALREADY transcoded by the member's browser (web720, the
// same compressVideoForWeb path both Papic cameras use) — the caps below are
// sanity ceilings, not the compressor.

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_CLIP_BYTES = 12 * 1024 * 1024; // web720 @ 10s worst-case is ~1.5 MB; ceiling only
const MAX_POSTER_BYTES = 2 * 1024 * 1024;
const MAX_DURATION_MS = 10_000; // platform clip cap (owner 2026-07-22)

function bad(status: number, error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return bad(401, 'sign_in');
  if (!isR2Configured()) return bad(503, 'storage_unavailable');

  const form = await req.formData().catch(() => null);
  if (!form) return bad(400, 'bad_form');
  const communityId = String(form.get('community_id') ?? '').trim();
  const clip = form.get('clip');
  const poster = form.get('poster');
  const durationMs = Math.round(Number(form.get('duration_ms') ?? 0));
  if (!communityId || !(clip instanceof File) || !(poster instanceof File)) {
    return bad(400, 'missing_fields');
  }
  if (!Number.isFinite(durationMs) || durationMs < 1 || durationMs > MAX_DURATION_MS) {
    return bad(400, 'too_long');
  }
  if (clip.size < 1 || clip.size > MAX_CLIP_BYTES) return bad(400, 'clip_size');
  if (poster.size < 1 || poster.size > MAX_POSTER_BYTES) return bad(400, 'poster_size');
  if (!/^video\/(mp4|webm)$/.test(clip.type)) return bad(400, 'clip_type');

  // Membership gate through the caller's OWN session — RLS hides the
  // community row from non-members, so an empty read IS the refusal.
  const supabase = await createClient();
  const { data: community } = await supabase
    .from('communities')
    .select('community_id, archived')
    .eq('community_id', communityId)
    .maybeSingle();
  if (!community || (community as { archived?: boolean }).archived) {
    return bad(403, 'not_a_member');
  }

  // Screen BEFORE anything is stored: classify the poster frame (the same
  // proxy screenCapture uses for clips — nsfwjs is image-only).
  const posterBytes = new Uint8Array(await poster.arrayBuffer());
  let verdict: ReturnType<typeof decideNsfw>;
  try {
    verdict = decideNsfw(await classifyImageBytes(posterBytes));
  } catch {
    return bad(503, 'screen_unavailable');
  }
  if (verdict !== 'clean') return bad(422, 'screen_refused');

  const clipBytes = new Uint8Array(await clip.arrayBuffer());
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const ext = clip.type === 'video/webm' ? 'webm' : 'mp4';
  const clipKey = `samahan/${communityId}/story-${stamp}.${ext}`;
  const posterKey = `samahan/${communityId}/story-${stamp}-poster.jpg`;
  try {
    await r2Upload({
      bucket: R2_BUCKETS.media,
      key: clipKey,
      body: clipBytes,
      contentType: clip.type,
    });
    await r2Upload({
      bucket: R2_BUCKETS.media,
      key: posterKey,
      body: posterBytes,
      contentType: 'image/jpeg',
    });
  } catch {
    return bad(503, 'upload_failed');
  }

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from('samahan_stories')
    .insert({
      community_id: communityId,
      user_id: user.id,
      r2_object_key: `r2://${R2_BUCKETS.media}/${clipKey}`,
      poster_r2_key: `r2://${R2_BUCKETS.media}/${posterKey}`,
      clip_bytes: clipBytes.length,
      duration_ms: durationMs,
      screened_at: new Date().toISOString(),
    })
    .select('story_id, expires_at')
    .single();
  if (error || !inserted) {
    // The insert failed, so the two objects just written have no row naming
    // them — remove them now rather than leaving orphans for no reader.
    await Promise.allSettled([
      import('@/lib/r2').then((m) => m.r2Delete({ bucket: R2_BUCKETS.media, key: clipKey })),
      import('@/lib/r2').then((m) => m.r2Delete({ bucket: R2_BUCKETS.media, key: posterKey })),
    ]);
    if (error?.code === '23505') return bad(409, 'one_per_hour');
    return bad(500, 'save_failed');
  }
  // The group hears it. A story is gone in 24 hours by RLS, so a member who is
  // never told has not missed a notification — they have missed the thing
  // itself. Runs after the response; a failure here cannot unmake the story.
  after(() =>
    notifySamahanCoMembers({ communityId, actorUserId: user.id, kind: 'story' }),
  );
  return NextResponse.json({ ok: true, story: inserted });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return bad(401, 'sign_in');
  const body = (await req.json().catch(() => null)) as { story_id?: string } | null;
  const storyId = String(body?.story_id ?? '').trim();
  if (!storyId) return bad(400, 'missing_fields');

  // Authorship gate: only the author's own story matches this filter — the
  // admin client is used to DO the delete, never to widen who may ask for it.
  const admin = createAdminClient();
  const { data: row } = await admin
    .from('samahan_stories')
    .select('id, r2_object_key, poster_r2_key, user_id')
    .eq('story_id', storyId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!row) return bad(404, 'not_found');

  const done = await hardDeleteStory(
    admin,
    row as { id: number; r2_object_key: string; poster_r2_key: string },
  );
  if (!done) return bad(503, 'delete_retry');
  return NextResponse.json({ ok: true });
}
