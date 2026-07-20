import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';

// Guest photos in the payload (present only for a token holder + a host setting
// that returns them) arrive as RAW stored refs (r2:// or bare URL). A client
// can't resolve an r2:// ref, so — exactly like the venue page — resolve them
// here before returning. The RPC already privacy-gates WHICH photos appear; this
// is purely ref → display URL. Failed refs drop to null (→ initials fallback).
type PhotoEntry = { table: string; seatNumber: number; photoUrl: string | null };
async function resolveScenePhotos(data: unknown): Promise<unknown> {
  if (!data || typeof data !== 'object') return data;
  const photos = (data as { photos?: PhotoEntry[] | null }).photos;
  if (!photos || photos.length === 0) return data;
  const distinct = [...new Set(photos.map((p) => p.photoUrl).filter((r): r is string => !!r))];
  const resolved: Record<string, string> = Object.fromEntries(
    (
      await Promise.all(distinct.map(async (ref) => [ref, await displayUrlForStoredAsset(ref)] as const))
    ).filter((e): e is [string, string] => e[1] !== null),
  );
  return {
    ...(data as object),
    photos: photos.map((p) => ({ ...p, photoUrl: p.photoUrl ? resolved[p.photoUrl] ?? null : null })),
  };
}

// Booth vendor logos arrive as RAW stored refs too (vendor_profiles.logo_url is
// whatever the vendor uploaded — usually r2://bucket/key). BoothSign feeds the
// value straight to THREE.TextureLoader, which cannot resolve an r2:// ref, so
// resolve here exactly as /[slug]/venue/page.tsx already does for its own
// server-rendered scene. Latent until v8 started returning `tier` (before that
// boothCanBrand was always false and the branded backdrop never mounted).
// Failed refs drop to null → the generic booth, same as an unbranded tier.
type SceneBooth = { vendor?: { logoUrl?: string | null } | null };
async function resolveBoothLogos(data: unknown): Promise<unknown> {
  if (!data || typeof data !== 'object') return data;
  const booths = (data as { booths?: SceneBooth[] | null }).booths;
  if (!booths || booths.length === 0) return data;
  const distinct = [...new Set(booths.map((b) => b.vendor?.logoUrl).filter((r): r is string => !!r))];
  if (distinct.length === 0) return data;
  const resolved: Record<string, string> = Object.fromEntries(
    (
      await Promise.all(distinct.map(async (ref) => [ref, await displayUrlForStoredAsset(ref)] as const))
    ).filter((e): e is [string, string] => e[1] !== null),
  );
  return {
    ...(data as object),
    booths: booths.map((b) =>
      b.vendor?.logoUrl
        ? { ...b, vendor: { ...b.vendor, logoUrl: resolved[b.vendor.logoUrl] ?? null } }
        : b,
    ),
  };
}

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

  return NextResponse.json(await resolveBoothLogos(await resolveScenePhotos(data)));
}
