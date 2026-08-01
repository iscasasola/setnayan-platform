'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { captchaOptions, captchaTokenFromForm } from '@/lib/turnstile';
import { eventPapicActive } from '@/lib/papic-seats';
import { fetchEventPoolStatus } from '@/lib/papic-event-pool';
import {
  provisionPoolJoinSeatAdmin,
  resolvePapicPoolToken,
} from '@/lib/papic-pool-join';

/**
 * Join the shared pool from the poster QR — mint a camera and start shooting.
 *
 * Owner-locked 2026-08-01: **"No limit — first come, first served."** No
 * per-scanner allowance, no camera cap, no host approval. What still gates the
 * request is only what would otherwise be broken or dishonest:
 *
 *   1. the token must resolve to a real event;
 *   2. Papic must actually be ON for that event;
 *   3. the pool must EXIST (a grant or a pass) — handing someone a camera with
 *      no purse behind it is a working shutter that refuses every shot, which
 *      reads as broken software rather than as "we're out".
 *
 * An EMPTY pool is deliberately NOT a refusal here. Running out mid-party is a
 * normal state the capture screen already explains ("out of shots"), and
 * turning the poster off at zero would strand guests who scanned seconds
 * earlier. The fence lives on the shutter, not on the door.
 *
 * ⚠ SERVER ACTION, so this only runs on POST. A GET must never mint anything:
 * chat apps and link previewers fetch a URL the instant it is pasted, and a
 * GET-minted camera would burn seats and anonymous auth rows before any guest
 * scanned. Same rule the seat claim path follows.
 */
export async function joinPapicPool(formData: FormData) {
  const raw = formData.get('token');
  const token = typeof raw === 'string' ? raw.trim() : '';
  if (!token) redirect('/');

  const admin = createAdminClient();

  const target = await resolvePapicPoolToken(admin, token);
  if (!target) redirect(`/papic/pool/${encodeURIComponent(token)}?state=invalid`);
  const { eventId } = target!;

  // Papic must be live on this event.
  if (!(await eventPapicActive(admin, eventId))) {
    redirect(`/papic/pool/${encodeURIComponent(token)}?state=off`);
  }

  // A pool must exist. `applies=false` means neither a grant nor a pass — a
  // camera here could never take a single shot.
  const pool = await fetchEventPoolStatus(admin, eventId);
  if (pool.applies !== true) {
    redirect(`/papic/pool/${encodeURIComponent(token)}?state=off`);
  }

  // Anonymous session for a scanner with no account — the same native-anon
  // machinery the seat claim uses, minted only AFTER the checks above so a
  // dead poster cannot leave orphan auth rows behind.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const { data: anon, error: anonError } = await supabase.auth.signInAnonymously({
      options: captchaOptions(captchaTokenFromForm(formData)),
    });
    if (anonError || !anon.user) {
      console.error('[joinPapicPool] anon sign-in failed:', anonError?.message);
      redirect(`/papic/pool/${encodeURIComponent(token)}?state=error`);
    }
  }

  const claimToken = await provisionPoolJoinSeatAdmin(admin, eventId);
  if (!claimToken) {
    redirect(`/papic/pool/${encodeURIComponent(token)}?state=error`);
  }

  // Straight into the camera. The capture surface claims the seat to whoever
  // arrives holding the session, exactly as it does for a hand-shared link.
  redirect(`/papic/claim/${claimToken}`);
}
