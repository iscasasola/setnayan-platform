import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveBoothStudioContent } from '@/lib/booth-studio';
import { withYourTableName } from '@/lib/venue-your-table';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { withBoothShopFacts } from '@/app/[slug]/venue/_lib/venue-scene-joins.server';
import { readShownTableNames } from '@/lib/table-auto-name.server';

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
type SceneBooth = {
  vendor?: { logoUrl?: string | null; posterUrl?: string | null; posterContent?: unknown } | null;
};
async function resolveBoothLogos(data: unknown): Promise<unknown> {
  if (!data || typeof data !== 'object') return data;
  const booths = (data as { booths?: SceneBooth[] | null }).booths;
  if (!booths || booths.length === 0) return data;
  // The account logo and the per-event poster are both raw refs on the same
  // vendor block — resolve them in ONE batch, since a booth commonly has both.
  const distinct = [
    ...new Set(
      booths
        .flatMap((b) => [b.vendor?.logoUrl, b.vendor?.posterUrl])
        .filter((r): r is string => !!r),
    ),
  ];
  if (distinct.length === 0) return data;
  const resolved: Record<string, string> = Object.fromEntries(
    (
      await Promise.all(distinct.map(async (ref) => [ref, await displayUrlForStoredAsset(ref)] as const))
    ).filter((e): e is [string, string] => e[1] !== null),
  );
  // Booth Studio: resolve the STRUCTURED poster content and attach the vendor
  // logo as a PUBLIC (never presigned) URL — read from the RAW logo ref BEFORE
  // it is overwritten with the presigned display URL below. Harmless data when
  // the render flag is off (nothing reads it), so no cache-key coupling.
  const publicBase = process.env.R2_PUBLIC_URL;
  return {
    ...(data as object),
    booths: booths.map((b) => {
      const v = b.vendor;
      if (!v) return b;
      const studio = resolveBoothStudioContent(v.posterContent, v.logoUrl, publicBase);
      if (!v.logoUrl && !v.posterUrl && !studio) return b;
      return {
        ...b,
        vendor: {
          ...v,
          logoUrl: v.logoUrl ? resolved[v.logoUrl] ?? null : null,
          posterUrl: v.posterUrl ? resolved[v.posterUrl] ?? null : null,
          ...(studio ? { posterContent: studio } : {}),
        },
      };
    }),
  };
}

// GET /api/venue-scene/[slug]?t=<personal-token> — read-only data for the
// guest-facing 3D venue explorer (Sims-style; owner 2026-06-26). All the safety
// lives in the SECURITY DEFINER public_venue_scene() RPC: published-gated, room
// geometry + ANONYMISED occupancy always, guest NAMES only for a caller holding
// a valid per-guest qr_token (their own invite link) and only that guest's OWN
// table. No token → zero names. This route just adds a best-effort per-IP
// throttle and never 500s (a failed read answers 503, which the live refresh treats as "not news").

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
  const [{ data, error }, eventRow] = await Promise.all([
    admin.rpc('public_venue_scene', { p_slug: slug, p_token: token }),
    // A7-01: the couple's colours and the event id for the booth join — the same row the page reads (`.ilike`).
    admin.from('events').select('event_id, role_palette').ilike('slug', slug).maybeSingle(),
  ]);
  // A7-01: a failed read is NOT "taken down" — the walk's live refresh keeps the last good scene on a non-2xx answer,
  // while `{published:false}` tells it the couple took the room down.
  if (error || eventRow.error) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  if (!data) return NextResponse.json({ published: false });

  // The guest's own table by its NAME (the RPC sends only the public id): the same join the page makes,
  // so a live refresh never puts the code back in the caption.
  const named = await withYourTableName(admin, data as { you?: { table: string } | null }, readShownTableNames);
  const row = eventRow.data as { event_id?: string | null; role_palette?: unknown } | null;
  const resolved = (await resolveBoothLogos(await resolveScenePhotos(named))) as Record<string, unknown>;
  if (resolved.published === false) return NextResponse.json(resolved);
  // A7-01: the booth shop facts and the couple's colours — the page's own joins, so a refresh changes nothing that
  // did not really move.
  const withShops = await withBoothShopFacts(
    admin,
    resolved as { booths?: Array<{ id: string; vendor?: Record<string, unknown> | null }> | null },
    row?.event_id ?? null,
  );
  return NextResponse.json({ ...withShops, rolePalette: sanitizeRolePalette(row?.role_palette ?? null) });
}
