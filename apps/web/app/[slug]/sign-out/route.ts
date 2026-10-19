import { NextResponse, type NextRequest } from 'next/server';
import { clearGuestSession, eventIdForSlug, readGuestPassStanding } from '@/lib/guest-session';
import { HOST_PREVIEW_PASS_COOKIE_NAME } from '@/lib/pass-account-rule';
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
  // 🪪 Only the pass's OWN holder's press erases the selfie (lib/pass-account-rule.ts): a pass the signed-in account
  // outranked ("Remove it from this browser") and a host's "Open as <name>" preview are not that guest signing out.
  const { session, standing } = await readGuestPassStanding({ eventId }).catch(() => ({ session: null, standing: null }));
  if (standing !== 'host_preview' && session?.event_id && session.guest_id && (!eventId || session.event_id === eventId)) {
    await eraseFaceTaggingSelfie(createAdminClient(), session.event_id, session.guest_id).catch(() => null);
  }
  await clearGuestSession({ slug, eventId });
  const url = new URL(request.url);
  // Drop /sign-out segment to land back on the slug root.
  url.pathname = url.pathname.replace(/\/sign-out$/, '');
  const res = NextResponse.redirect(url, { status: 303 });
  // The host's "Open as <name>" mark goes with the pass it named.
  res.cookies.delete(HOST_PREVIEW_PASS_COOKIE_NAME);
  return res;
}
