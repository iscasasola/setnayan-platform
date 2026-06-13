import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  sanitizeSeatLookupQuery,
  SEAT_LOOKUP_MAX_MATCHES,
  type SeatMatch,
} from '@/lib/seat-lookup';

// GET /api/seat-lookup/[slug]?q=<name> — the FREE, public guest seat finder
// (seat-finding PR 1). No session, no SKU: a guest who scanned the shared
// venue QR (which lands on /[slug]) types their name and gets their table
// label. The published-gate + minimal-columns + min-length guarantees live in
// the SECURITY DEFINER public_seat_lookup() RPC; this route adds input
// normalization + a best-effort per-IP throttle on top.

export const dynamic = 'force-dynamic';

// Best-effort in-memory throttle. NOT a hard guarantee across serverless
// instances — the real anti-enumeration guards are the min-length + LIMIT 25 +
// minimal-columns in the RPC. This just blunts a trivial single-instance flood.
const WINDOW_MS = 10_000;
const MAX_HITS = 20;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  if (hits.size > 5000) hits.clear(); // crude bound; best-effort only
  hits.set(ip, recent);
  return recent.length > MAX_HITS;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) return NextResponse.json({ matches: [] });

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }

  const query = sanitizeSeatLookupQuery(new URL(req.url).searchParams.get('q'));
  // Too short / empty → empty result, never an error or a roster dump.
  if (!query) return NextResponse.json({ matches: [] });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('public_seat_lookup', {
    p_slug: slug,
    p_query: query,
  });
  // Pre-migration DB (function absent) or any read error → empty, not a 500.
  if (error) return NextResponse.json({ matches: [] });

  const matches: SeatMatch[] = ((data ?? []) as SeatMatch[]).slice(
    0,
    SEAT_LOOKUP_MAX_MATCHES,
  );
  return NextResponse.json({ matches });
}
