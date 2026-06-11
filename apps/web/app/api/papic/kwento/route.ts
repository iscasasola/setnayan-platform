import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { moderateKwentoText } from '@/lib/kwento-moderation';

// POST /api/papic/kwento — a zero-account guest writes the story behind one
// of their captures (Kwento P1, 0012 § Kwento; owner-locked: text-only, free
// for every guest).
//
// Auth: the setnayan_guest_session JWT cookie (the shipped zero-account
// model) — guests have no auth.uid(), so the write goes through the
// service-role-only submit_photo_message RPC, which owns the integrity rules
// (anchor-same-event, block lever, 10/event cap, 3-per-60s burst, the
// one-caption-per-photo upsert with edit-resets-moderation).
//
// Tier-1 moderation runs HERE, synchronously, before the RPC: 'blocked' is
// rejected inline and never stored; 'flagged' stores couple-only (never
// wall-eligible — the DB CHECK backstops); 'clean' proceeds.

export const dynamic = 'force-dynamic';

const FRIENDLY: Record<string, { status: number; error: string }> = {
  'kwento:blocked': { status: 403, error: 'messaging_disabled' },
  'kwento:cap': { status: 429, error: 'limit_reached' },
  'kwento:burst': { status: 429, error: 'too_fast' },
  'kwento:edit_limit': { status: 409, error: 'edit_limit' },
  'kwento:baked': { status: 409, error: 'already_in_keepsake' },
  'kwento:invalid_anchor': { status: 400, error: 'bad_photo' },
  'kwento:invalid_body': { status: 400, error: 'bad_message' },
};

export async function POST(req: Request) {
  const session = await readGuestSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { captureId?: string; body?: string; consent?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const captureId = body.captureId?.trim();
  const text = (body.body ?? '').trim();
  if (!captureId || text.length < 1 || text.length > 280) {
    return NextResponse.json({ error: 'bad_message' }, { status: 400 });
  }
  // RA 10173: consent is captured on EVERY message — no tick, no send.
  if (body.consent !== true) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  }

  const verdict = moderateKwentoText(text);
  if (verdict.state === 'blocked') {
    // Never stored. Warm inline rejection — the guest rephrases.
    return NextResponse.json({ error: 'keep_it_sweet' }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('submit_photo_message', {
    p_guest_id: session.guest_id,
    p_source_table: 'papic_guest_captures',
    p_source_id: captureId,
    p_body: text,
    p_prompt: null,
    p_moderation_state: verdict.state,
    p_moderation_labels: verdict.labels.length ? { labels: verdict.labels } : null,
  });

  if (error) {
    const known = Object.keys(FRIENDLY).find((k) => error.message.includes(k));
    const friendly = known ? FRIENDLY[known] : undefined;
    if (friendly) {
      return NextResponse.json({ error: friendly.error }, { status: friendly.status });
    }
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { message_id?: string; moderation_state?: string }
    | undefined;
  return NextResponse.json({
    ok: true,
    state: row?.moderation_state ?? verdict.state,
  });
}
