import { NextResponse, after } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { limitedHelperRefusal } from '@/lib/host-gate';
import { ingestToWall } from '@/lib/live-wall';
import { everyCopyIsNowStale } from '@/lib/a-withdrawal-reaches-every-copy.server';
import { eventDaysOf, eventDaysWords } from '@/lib/papic-phone-uploads';

// /api/papic/phone-uploads — 📲 GUEST PHONE UPLOADS (guest upload v2; owner 2026-11-13, rulings 2026-11-14 on #7607).
//
// The bytes never come here: a phone upload is an ordinary guest capture and travels the guest-capture route
// (sign → PUT to R2 → record → attach), priced and gated THERE. This route only answers the two small questions
// around it:
//
//   GET  ?event_id=…   (the guest's own pass) — what the guest's "Add from your phone" sheet needs to read before it
//                      opens: is adding on, the event day(s), and whether the couple checks photos first.
//   POST {op, …}       (a host of the event) — the couple's choice ("Right away" / "After I check") and their check:
//                      Keep · Leave out · Keep all.
//
// ⚖ A ROUTE, NOT SERVER ACTIONS, deliberately: the server-action budget is at its ceiling and is never raised. The
// gates are the actions' own: the caller is proven a host of THIS event (`event_members.member_type = 'couple'`, the
// same check `getCoupleEventId` makes) and not a limited helper without Photos edit (`limitedHelperRefusal`); every
// write is then made with the service role and scoped to that event_id.
//
// 🔑 KEEP vs LEAVE OUT, and what neither does: a waiting upload is born hidden (the shipped Hide). Keep clears
// hidden_at — it joins Memories and the Recap; Leave out keeps it hidden. Neither moves a credit: the meters never
// filter hidden_at, so a left-out photo is not refunded (owner ruling 4, 2026-11-14).

export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 500;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const asked = url.searchParams.get('event_id')?.trim() || null;
  const session = await readGuestSession(asked ? { eventId: asked } : undefined);
  if (!session) return json({ error: 'no_session' }, 401);
  if (asked && session.event_id !== asked) return json({ error: 'other_event' }, 409);

  const { data, error } = await createAdminClient()
    .from('events')
    .select('display_name, event_date, event_end_date, papic_uploads_open, papic_phone_uploads_held')
    .eq('event_id', session.event_id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('[supabase-error] app/api/papic/phone-uploads/route.ts · GET events', error);
    // Unread is NOT "off" — the sheet says it could not check, never that adding is closed.
    return json({ error: 'unread' }, 503);
  }
  const row = data as {
    display_name: string | null;
    event_date: string | null;
    event_end_date: string | null;
    papic_uploads_open: boolean | null;
    papic_phone_uploads_held: boolean | null;
  };
  const days = eventDaysOf(row.event_date, row.event_end_date);
  return json({
    ok: true,
    open: row.papic_uploads_open !== false && days !== null,
    held: row.papic_phone_uploads_held === true,
    days,
    daysWords: days ? eventDaysWords(days) : null,
    hosts: row.display_name ?? null,
  });
}

type Op =
  | { op: 'set_held'; held: boolean }
  | { op: 'keep' | 'leave_out'; ids: string[] }
  | { op: 'keep_all' };

function readOp(body: Record<string, unknown>): Op | null {
  if (body.op === 'set_held' && typeof body.held === 'boolean') return { op: 'set_held', held: body.held };
  if (body.op === 'keep_all') return { op: 'keep_all' };
  if ((body.op === 'keep' || body.op === 'leave_out') && Array.isArray(body.ids)) {
    const ids = (body.ids as unknown[]).filter((v): v is string => typeof v === 'string' && UUID.test(v));
    if (ids.length === 0 || ids.length > MAX_IDS) return null;
    return { op: body.op, ids };
  }
  return null;
}

/** Proven a host of this event, or the sentence that says why not. */
async function hostOf(eventId: string): Promise<{ ok: true } | { ok: false; status: number; error: string; words?: string }> {
  const helper = await limitedHelperRefusal(eventId, 'photos');
  if (helper) return { ok: false, status: 403, error: 'helper', words: helper };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: 'signed_out' };
  const { data: membership, error } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, status: 503, error: 'unread' };
  if (!membership || (membership as { member_type?: string }).member_type !== 'couple') {
    return { ok: false, status: 403, error: 'not_host' };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  // JSON only — a cross-site form cannot send it without the browser asking first.
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return json({ error: 'bad_request' }, 415);
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object') throw new Error('shape');
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const eventId = typeof body.event_id === 'string' && UUID.test(body.event_id.trim()) ? body.event_id.trim() : null;
  const op = readOp(body);
  if (!eventId || !op) return json({ error: 'bad_request' }, 400);

  const gate = await hostOf(eventId);
  if (!gate.ok) return json({ error: gate.error, ...(gate.words ? { words: gate.words } : {}) }, gate.status);

  const admin = createAdminClient();

  if (op.op === 'set_held') {
    const { error } = await admin.from('events').update({ papic_phone_uploads_held: op.held }).eq('event_id', eventId);
    if (error) {
      console.error('[supabase-error] app/api/papic/phone-uploads/route.ts · set_held', error);
      return json({ error: 'save_failed' }, 500);
    }
    return json({ ok: true, held: op.held });
  }

  // Keep / Leave out — only rows of THIS event still waiting; a row already decided is never moved by a stale screen.
  let q = admin
    .from('papic_guest_captures')
    .update(op.op === 'leave_out' ? { phone_upload: 'left_out' } : { phone_upload: 'kept', hidden_at: null })
    .eq('event_id', eventId)
    .eq('phone_upload', 'waiting');
  if (op.op !== 'keep_all') q = q.in('capture_id', op.ids);
  const { data, error } = await q.select('capture_id');
  if (error) {
    console.error('[supabase-error] app/api/papic/phone-uploads/route.ts · decide', error);
    return json({ error: 'save_failed' }, 500);
  }
  const decided = ((data ?? []) as { capture_id: string }[]).map((r) => r.capture_id);
  // A Keep puts a photo back into view (hidden_at cleared): every stored copy of the event's story, recap, keepsake and
  // share card is told it is stale, exactly as the couple's own Hide / Unhide does.
  if (decided.length > 0) await everyCopyIsNowStale(eventId);

  // A kept photo now shows like any other guest shot: the FaceBlock bake, then the wall gate (best-effort — a failed
  // wall ingest never undoes a Keep; the wall's own reconcile picks it up).
  if (op.op !== 'leave_out' && decided.length > 0) {
    after(async () => {
      for (const id of decided) {
        try {
          const { bakeFaceBlurForCapture } = await import('@/lib/face-blur');
          await bakeFaceBlurForCapture({ table: 'papic_guest_captures', sourceId: id });
          await ingestToWall('papic_guest_captures', id);
        } catch {
          // best-effort
        }
      }
    });
  }
  return json({ ok: true, decided });
}
