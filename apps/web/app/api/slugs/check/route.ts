import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidSlug } from '@/lib/slugs';

// Live-availability endpoint for the slug field per spec § Customer slug.
// 60 requests/min/IP cap is enforced by Vercel's default edge limits + the
// debounced client component; we don't need a Redis bucket for V1.

type Response =
  | { status: 'current' }
  | { status: 'available'; slug: string }
  | { status: 'taken'; suggestions: string[] }
  | { status: 'invalid_format'; reason: string }
  | { status: 'reserved'; reason: string };

export async function GET(request: NextRequest): Promise<NextResponse<Response>> {
  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') ?? '').trim().toLowerCase();
  const entityId = url.searchParams.get('entity_id') ?? '';
  const entityType = url.searchParams.get('entity_type') ?? 'event';

  if (!slug) {
    return NextResponse.json({
      status: 'invalid_format',
      reason: 'Slug is required.',
    });
  }

  if (!isValidSlug(slug)) {
    if (slug.length < 3 || slug.length > 32) {
      return NextResponse.json({
        status: 'invalid_format',
        reason: 'Slugs must be 3–32 characters.',
      });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({
        status: 'invalid_format',
        reason: 'Lowercase letters, numbers, and hyphens only.',
      });
    }
    return NextResponse.json({
      status: 'reserved',
      reason: 'That slug is reserved by Setnayan.',
    });
  }

  // Only event slugs are supported in V1; vendor slugs land with iteration 0022.
  if (entityType !== 'event') {
    return NextResponse.json({
      status: 'invalid_format',
      reason: 'Unsupported entity type.',
    });
  }

  const admin = createAdminClient();
  const { data: clash } = await admin
    .from('events')
    .select('event_id, slug')
    .ilike('slug', slug)
    .maybeSingle();

  if (!clash) {
    return NextResponse.json({ status: 'available', slug });
  }

  if (entityId && clash.event_id === entityId) {
    return NextResponse.json({ status: 'current' });
  }

  // Suggest 3 alternatives.
  const suggestions = await suggestAlternatives(admin, slug);
  return NextResponse.json({ status: 'taken', suggestions });
}

async function suggestAlternatives(
  admin: ReturnType<typeof createAdminClient>,
  base: string,
): Promise<string[]> {
  const candidates: string[] = [];
  const yearSuffix = new Date().getFullYear().toString();

  const tries = [
    base.replace(/-/g, ''),
    `${base}-${yearSuffix}`,
    `${base}-wedding`,
    `${base}-and-friends`,
    `our-${base}`,
  ];

  for (const candidate of tries) {
    if (candidates.length >= 3) break;
    if (!isValidSlug(candidate)) continue;
    const { data } = await admin
      .from('events')
      .select('event_id')
      .ilike('slug', candidate)
      .maybeSingle();
    if (!data) candidates.push(candidate);
  }
  return candidates;
}
