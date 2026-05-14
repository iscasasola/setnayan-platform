import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiErrorResponse } from '@/lib/api-auth';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const PUBLIC_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

type VendorRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  services: string[];
  location_city: string | null;
  website: string | null;
  created_at: string;
};

/**
 * GET /api/v1/vendors
 *
 * PUBLIC — no auth required. Lists published vendor profiles. Optional
 * filters:
 *   - ?category=photographer   exact match against any element of services[]
 *   - ?city=manila             case-insensitive substring on location_city
 *   - ?q=…                     case-insensitive substring on business_name
 *
 * Pagination follows the same cursor pattern as /api/v1/events. Ordering
 * is by created_at DESC so newly-published vendors surface first; ties
 * break on public_id DESC for deterministic paging.
 *
 * Sensitive contact fields (contact_email, contact_phone) are intentionally
 * not selected — callers must use the booking flow (V1.5+) to reach the
 * vendor.
 *
 * CORS: open to any origin. The auth-required endpoints inherit Next.js's
 * default same-origin policy.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get('limit'));
  const cursor = url.searchParams.get('cursor');
  const category = url.searchParams.get('category')?.trim() || null;
  const city = url.searchParams.get('city')?.trim() || null;
  const q = url.searchParams.get('q')?.trim() || null;

  const admin = createAdminClient();

  let query = admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, public_id, business_name, business_slug, tagline, logo_url, services, location_city, website, created_at',
    )
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .order('public_id', { ascending: false })
    .limit(limit + 1);

  if (category) {
    // services is a TEXT[]; `cs` ("contains") matches when the array
    // includes every element of the supplied set.
    query = query.contains('services', [category]);
  }

  if (city) {
    query = query.ilike('location_city', `%${city}%`);
  }

  if (q) {
    query = query.ilike('business_name', `%${q}%`);
  }

  if (cursor) {
    const { data: cursorRow } = await admin
      .from('vendor_profiles')
      .select('created_at, public_id')
      .eq('public_id', cursor)
      .maybeSingle();

    if (cursorRow) {
      query = query.or(
        `created_at.lt.${cursorRow.created_at},and(created_at.eq.${cursorRow.created_at},public_id.lt.${cursorRow.public_id})`,
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    return jsonError(apiErrorResponse(500, 'database_error', error.message));
  }

  const rows = (data ?? []) as VendorRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.public_id ?? null) : null;

  return NextResponse.json(
    {
      data: pageRows.map((v) => ({
        vendor_profile_id: v.vendor_profile_id,
        public_id: v.public_id,
        business_name: v.business_name,
        business_slug: v.business_slug,
        tagline: v.tagline,
        logo_url: v.logo_url,
        services: v.services ?? [],
        location_city: v.location_city,
        website: v.website,
      })),
      next_cursor: nextCursor,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'Content-Type': 'application/json; charset=utf-8',
        ...PUBLIC_CORS_HEADERS,
      },
    },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}

function clampLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function jsonError(res: NextResponse): NextResponse {
  // Public endpoints need to attach CORS headers to errors too — otherwise
  // browser callers receive opaque network errors instead of the JSON body.
  for (const [k, v] of Object.entries(PUBLIC_CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}
