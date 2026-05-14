import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiErrorResponse } from '@/lib/api-auth';

type Params = { params: Promise<{ publicId: string }> };

const PUBLIC_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/**
 * GET /api/v1/vendors/:publicId
 *
 * PUBLIC — no auth required. Returns a single published vendor profile by
 * its public_id (B89G-...) or business_slug. Contact fields (email, phone)
 * are intentionally masked even though they live on the same row — the
 * V1.5 booking flow will surface them after a booking is confirmed.
 *
 * 404 if the row is missing OR is_published is false (don't leak the
 * existence of an unpublished profile).
 */
export async function GET(req: Request, { params }: Params) {
  const { publicId } = await params;

  if (!publicId) {
    return withCors(apiErrorResponse(400, 'invalid_request', 'Missing vendor id.'));
  }

  const admin = createAdminClient();

  // Look up by public_id first; fall back to business_slug for marketplace-
  // friendly URLs. Both columns are unique and indexed.
  const looksLikePublicId = /^B[A-Z0-9-]+/i.test(publicId);
  let row: VendorDetailRow | null = null;

  if (looksLikePublicId) {
    const { data } = await admin
      .from('vendor_profiles')
      .select(SELECT_COLUMNS)
      .eq('public_id', publicId)
      .eq('is_published', true)
      .maybeSingle();
    row = (data as VendorDetailRow | null) ?? null;
  }

  if (!row) {
    const { data } = await admin
      .from('vendor_profiles')
      .select(SELECT_COLUMNS)
      .ilike('business_slug', publicId)
      .eq('is_published', true)
      .maybeSingle();
    row = (data as VendorDetailRow | null) ?? null;
  }

  if (!row) {
    return withCors(apiErrorResponse(404, 'vendor_not_found', 'Vendor not found.'));
  }

  return NextResponse.json(
    {
      data: {
        vendor_profile_id: row.vendor_profile_id,
        public_id: row.public_id,
        business_name: row.business_name,
        business_slug: row.business_slug,
        tagline: row.tagline,
        logo_url: row.logo_url,
        services: row.services ?? [],
        location_city: row.location_city,
        website: row.website,
        // Mask sensitive contact fields. `has_*` flags let the UI show
        // "contact available via booking" without exposing the value.
        contact_email: maskEmail(row.contact_email),
        contact_phone: maskPhone(row.contact_phone),
        has_contact_email: Boolean(row.contact_email),
        has_contact_phone: Boolean(row.contact_phone),
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
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

type VendorDetailRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  services: string[];
  location_city: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_COLUMNS =
  'vendor_profile_id, public_id, business_name, business_slug, tagline, logo_url, services, location_city, website, contact_email, contact_phone, created_at, updated_at';

function maskEmail(value: string | null): string | null {
  if (!value) return null;
  const [user, domain] = value.split('@');
  if (!user || !domain) return null;
  const masked = user.length <= 2 ? '*'.repeat(user.length) : `${user[0]}***${user[user.length - 1]}`;
  return `${masked}@${domain}`;
}

function maskPhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(PUBLIC_CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}
