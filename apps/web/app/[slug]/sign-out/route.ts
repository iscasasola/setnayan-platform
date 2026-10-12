import { NextResponse, type NextRequest } from 'next/server';
import { clearGuestSession, eventIdForSlug, readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eraseFaceTaggingSelfie } from '@/lib/face-selfie-erase';

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // 🧽 SIGNING OUT OF THE INVITATION ERASES THE FACE-TAGGING SELFIE (owner
  // 2026-09-30: *"face tagging selfie will erase upon log out"*). Read the pass
  // BEFORE it is cleared — it is the only thing that names whose selfie this
  // is. Tags already made stay (lib/face-selfie-erase.ts). Best-effort: an
  // erase that fails never keeps anyone signed in; the Papic-close sweep
  // finishes what it could not.
  // 🎟 THIS event's pass only (one pass per event, 2026-10-12): a pass this
  // browser holds for another event stays (lib/guest-session.ts clearGuestSession)
  // — and so does that other event's selfie. An event that cannot be told (a
  // failed read) signs out whatever pass is active, as before.
  const eventId = await eventIdForSlug(slug).catch(() => null);
  const session = await readGuestSession({ eventId }).catch(() => null);
  if (session?.event_id && session.guest_id && (!eventId || session.event_id === eventId)) {
    await eraseFaceTaggingSelfie(createAdminClient(), session.event_id, session.guest_id).catch(() => null);
  }
  await clearGuestSession({ slug, eventId });
  const url = new URL(request.url);
  // Drop /sign-out segment to land back on the slug root.
  url.pathname = url.pathname.replace(/\/sign-out$/, '');
  return NextResponse.redirect(url, { status: 303 });
}
