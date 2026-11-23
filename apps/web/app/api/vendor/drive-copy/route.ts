import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { copyShopEventToDrive } from '@/lib/supplier-drive-copy.server';

// POST /api/vendor/drive-copy   body: { event_id, since? }
//
// ☁️ ONE PRESS of "Copy this event to Google Drive" for the signed-in supplier's shop (owner 2026-11-22, corpus
// DECISION_LOG "COPY THIS EVENT TO GOOGLE DRIVE"). Copies what the shop stores for that ONE event into a folder for
// the event in the shop's own Drive, for up to ~35 s, and answers with the counts; the page presses again while the
// answer is `copying` (passing `since`, the start of this copy, so a file that already failed is not retried in a loop).
//
// A route, not a server action: the action budget is at its ceiling (fold, never raise) and a copy is long-running.
// The shop is resolved from the session (`fetchOwnVendorProfile`), never taken from the body; the copy reads only that
// shop's rows for that event, so another shop's or the couple's files can never be reached. Never counted against
// storage, never a gate on anything.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: 'no_session' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { event_id?: unknown; since?: unknown } | null;
  const eventId = typeof body?.event_id === 'string' ? body.event_id.trim() : '';
  if (!UUID.test(eventId)) return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  const since = typeof body?.since === 'string' ? body.since : null;

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ ok: false, reason: 'no_vendor' }, { status: 403 });

  const result = await copyShopEventToDrive({ shopId: profile.vendor_profile_id, eventId, since });
  return NextResponse.json(result, { status: 200 });
}
