import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/venue-scene/[slug]?t=<personal-token> — read-only data for the
// guest-facing 3D venue explorer (Sims-style; owner 2026-06-26). All the safety
// lives in the SECURITY DEFINER public_venue_scene() RPC: published-gated, room
// geometry + ANONYMISED occupancy always, guest NAMES only for a caller holding
// a valid per-guest qr_token (their own invite link) and only that guest's OWN
// table. No token → zero names. This route just adds a best-effort per-IP
// throttle and never 500s (a missing RPC / read error degrades to unpublished).

export const dynamic = 'force-dynamic';

const WINDOW_MS = 10_000;
const MAX_HITS = 30;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  if (hits.size > 5000) hits.clear();
  hits.set(ip, recent);
  return recent.length > MAX_HITS;
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) return NextResponse.json({ published: false });

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }

  // The guest's personal token (from their invite link) authenticates "you" —
  // the only path that surfaces names. Absent → an anonymous, name-free scene.
  const token = new URL(req.url).searchParams.get('t')?.trim() || null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('public_venue_scene', { p_slug: slug, p_token: token });
  if (error || !data) return NextResponse.json({ published: false });

  return NextResponse.json(data);
}
