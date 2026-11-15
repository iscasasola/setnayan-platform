import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveRenamedPath } from '@/lib/slug-forwarding';
import { readReviewDoor, reviewDoorPath, reviewDoorTarget, type ReviewDoor } from '@/lib/shop-review-door';

/**
 * GET /v/{slug}/review — what a shop's PRINTED Reviews QR opens (owner 2026-11-06: "Write a review").
 *
 * No screen of its own: it sends the couple to the ONE write flow that exists,
 * `/dashboard/<eventId>/vendors/<vendorId>/review`, when they have a booking with this shop that is ready for a
 * review; otherwise to the shop's page at its reviews. Signed out → sign in, then back here. Every branch and why:
 * `lib/shop-review-door.ts`. A failed read lands on the shop's reviews, never on a 404.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const origin = new URL(request.url).origin;

  let userId: string | null = null;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // A guest pass (anonymous session) cannot open a couple's dashboard — it signs in like a stranger.
    userId = user && !(user.is_anonymous ?? false) ? user.id : null;
  } catch {
    userId = null;
  }

  let door: ReviewDoor;
  if (!userId || !supabase) {
    door = { kind: 'sign_in', next: reviewDoorPath(slug) };
  } else {
    try {
      const admin = createAdminClient();
      door = await readReviewDoor({ supabase, admin }, slug, userId, (s) => resolveRenamedPath(admin, s, ['vendor']));
    } catch {
      // Even the service client would not start: the reviews are still on the shop's page.
      door = { kind: 'read', slug, reason: 'read_failed' };
    }
  }
  return NextResponse.redirect(new URL(reviewDoorTarget(door, request.nextUrl.searchParams.get('src')), origin));
}
