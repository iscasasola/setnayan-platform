import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getR2Client } from '@/lib/r2';
import { findPart, partFingerprint } from '@/lib/papic-download-all-core';
import { buildPartZip, readDownloadPlan } from '@/lib/papic-download-all.server';

/**
 * 📦 DOWNLOAD ALL — build ONE numbered part of one chapter and hand back its download link (owner 2026-11-03,
 * "zips by chapter, ~2 GB numbered parts"). The list of parts is drawn by `/dashboard/[eventId]/memories/download-all`;
 * this route re-reads the same plan and builds the part the host pressed.
 *
 * 🔒 Hosts only (the couple membership check), every read on the host's own session (`readDownloadPlan`).
 * 🔁 The page sends the part's fingerprint; if the photos changed since it drew the list, the part is refused with
 *    `changed` and the page asks for a refresh — a ✓ always belongs to the zip the host saw listed.
 * ⏱ 300 s: the part is assembled server-to-server into storage (see `buildPartZip`), never streamed to the phone.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { chapter?: unknown; part?: unknown; fp?: unknown } | null;
  const chapter = typeof body?.chapter === 'string' ? body.chapter : '';
  const part = typeof body?.part === 'number' && Number.isInteger(body.part) ? body.part : 0;
  const fp = typeof body?.fp === 'string' ? body.fp : '';
  if (!chapter || part < 1 || !fp) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const client = getR2Client();
  if (!client) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  const read = await readDownloadPlan(supabase, eventId);
  if (!read.ok) return NextResponse.json({ error: read.reason }, { status: 503 });
  const target = findPart(read.plan, chapter, part);
  if (!target || partFingerprint(target) !== fp) return NextResponse.json({ error: 'changed' }, { status: 409 });

  try {
    const built = await buildPartZip(client, eventId, read.eventName, target);
    return NextResponse.json(built, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[download-all] build failed:', (e as Error)?.message ?? e);
    return NextResponse.json({ error: 'build_failed' }, { status: 502 });
  }
}
