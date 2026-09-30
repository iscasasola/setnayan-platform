import { NextResponse, type NextRequest } from 'next/server';
import { clearGuestSession, readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eraseFaceTaggingSelfie } from '@/lib/face-selfie-erase';

export async function POST(request: NextRequest) {
  // 🧽 SIGNING OUT OF THE INVITATION ERASES THE FACE-TAGGING SELFIE (owner
  // 2026-09-30: *"face tagging selfie will erase upon log out"*). Read the pass
  // BEFORE it is cleared — it is the only thing that names whose selfie this
  // is. Tags already made stay (lib/face-selfie-erase.ts). Best-effort: an
  // erase that fails never keeps anyone signed in; the Papic-close sweep
  // finishes what it could not.
  const session = await readGuestSession().catch(() => null);
  if (session?.event_id && session.guest_id) {
    await eraseFaceTaggingSelfie(createAdminClient(), session.event_id, session.guest_id).catch(() => null);
  }
  await clearGuestSession();
  const url = new URL(request.url);
  // Drop /sign-out segment to land back on the slug root.
  url.pathname = url.pathname.replace(/\/sign-out$/, '');
  return NextResponse.redirect(url, { status: 303 });
}
