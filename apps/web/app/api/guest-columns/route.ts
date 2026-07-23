import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { moderateKwentoText } from '@/lib/kwento-moderation';
import {
  GUEST_COLUMN_BODY_MAX,
  GUEST_COLUMN_TITLE_MAX,
} from '@/lib/guest-columns';
import { guestColumnsActive } from '@/lib/guest-columns-gate';

// POST   /api/guest-columns — a zero-account guest submits (or edits) their ONE
//                             column for the couple's paper.
// DELETE /api/guest-columns — the guest withdraws it (RA 10173 self-serve
//                             takedown; works pre- and post-approval, stays
//                             open after the editorial submissions cutoff).
//
// Kwento (app/api/papic/kwento/route.ts) near-clone:
//   * Auth = the setnayan_guest_session JWT cookie (zero-account canon) —
//     guests have no auth.uid(), so writes go through the service-role-only
//     guest_submit_column / guest_withdraw_column RPCs, which own the
//     integrity rules (block lever, EDITORIAL-PHASE cutoff, advisory lock,
//     burst guard, one-column-per-guest upsert with edit-resets-moderation).
//   * Tier-1 moderation (moderateKwentoText — generic text lexicon, reused
//     as-is) runs HERE, synchronously, BEFORE the RPC: 'blocked' is rejected
//     inline and never stored; 'flagged' stores couple-only; 'clean' proceeds.
//     Title and body are screened together (one verdict covers the column).
//   * RA 10173: consent is required on every submit — no tick, no send
//     (consent_captured_at NOT NULL is the DB backstop).
//
// Whole surface behind GUEST_COLUMNS_ENABLED (default OFF) AND the
// 'guest_columns' DPO control (/admin/data-privacy, fail-closed) — the env
// flag short-circuits first, so the dark path stays DB-read-free.

export const dynamic = 'force-dynamic';

const FRIENDLY: Record<string, { status: number; error: string }> = {
  'gcol:blocked': { status: 403, error: 'messaging_disabled' },
  'gcol:burst': { status: 429, error: 'too_fast' },
  'gcol:edit_limit': { status: 409, error: 'edit_limit' },
  'gcol:already_published': { status: 409, error: 'already_published' },
  'gcol:submissions_closed': { status: 409, error: 'submissions_closed' },
  'gcol:invalid_title': { status: 400, error: 'bad_title' },
  'gcol:invalid_body': { status: 400, error: 'bad_message' },
  'gcol:unknown_guest': { status: 401, error: 'unauthorized' },
};

export async function POST(req: Request) {
  if (!(await guestColumnsActive())) {
    return NextResponse.json({ error: 'not_available' }, { status: 404 });
  }
  const session = await readGuestSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { title?: string; body?: string; consent?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const title = (body.title ?? '').trim();
  const text = (body.body ?? '').trim();
  if (title.length < 1 || title.length > GUEST_COLUMN_TITLE_MAX) {
    return NextResponse.json({ error: 'bad_title' }, { status: 400 });
  }
  if (text.length < 1 || text.length > GUEST_COLUMN_BODY_MAX) {
    return NextResponse.json({ error: 'bad_message' }, { status: 400 });
  }

  // RA 10173: consent on EVERY submit (edits included) — no tick, no send.
  if (body.consent !== true) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  }

  // Tier-1 sync moderation over the whole column (title + body — a slur in
  // either kills the submit; 'blocked' is never stored).
  const verdict = moderateKwentoText(`${title}\n${text}`);
  if (verdict.state === 'blocked') {
    return NextResponse.json({ error: 'keep_it_sweet' }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('guest_submit_column', {
    p_guest_id: session.guest_id,
    p_title: title,
    p_body: text,
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
    | { status?: string; moderation_state?: string }
    | undefined;
  return NextResponse.json({ ok: true, state: row?.moderation_state ?? verdict.state });
}

export async function DELETE() {
  if (!(await guestColumnsActive())) {
    return NextResponse.json({ error: 'not_available' }, { status: 404 });
  }
  const session = await readGuestSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('guest_withdraw_column', {
    p_guest_id: session.guest_id,
  });
  if (error) {
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  // The RPC returns FALSE when there was nothing to withdraw — report it
  // honestly instead of a false success (0-row-update discipline).
  if (data !== true) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
