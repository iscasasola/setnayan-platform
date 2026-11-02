import { NextResponse } from 'next/server';
import { sampleOpensHere } from '@/lib/sample-event/switch.server';
import { readSampleGuest } from '@/lib/sample-event/snapshot';
import { renderSamplePassPng } from '@/lib/sample-event/pass';

/**
 * GET /sample/pass/[guestKey][?design=classic|ticket|poster] — a SAMPLE guest's
 * digital ticket, the 1080 × 1440 PNG the shipped ticket renderer draws
 * (`lib/sample-event/pass.ts` → `layoutPassCard` + `renderPassCardPng`).
 *
 * 🔒 The same two gates as every /sample page: the sample must be open for this
 * viewer (`sampleOpensHere` — switch on, or an internal account while it is
 * off; never the native app shell), and the key must be a fixture guest
 * (`readSampleGuest`). Anything else is the plain 404 an unknown address gets.
 * It reads no table and no cookie of a real guest; the QR it draws opens the
 * sample guest's own hub, never an invitation.
 *
 * `private`: while the switch is off only internal accounts may see this, so a
 * shared cache must never hold it. The date on it moves daily (the sample's day
 * is derived from today), so it is kept ten minutes at most.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ guestKey: string }> }) {
  const { guestKey } = await params;
  if (!(await sampleOpensHere())) return new NextResponse('Not found', { status: 404 });
  const guest = readSampleGuest(guestKey);
  if (!guest) return new NextResponse('Not found', { status: 404 });
  const url = new URL(req.url);
  const png = await renderSamplePassPng(guest, { now: new Date(), appUrl: url.origin, design: url.searchParams.get('design') });
  return new NextResponse(Buffer.from(png), {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=600', 'X-Robots-Tag': 'noindex' },
  });
}
