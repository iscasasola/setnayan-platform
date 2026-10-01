import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { executeCleanupDelete } from '@/lib/cleanup-delete';
import { planFaceSelfieDelete } from '@/lib/face-data-retention-core';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { FACE_SELFIE_PAPIC_CLOSE_GAP_MS } from '@/lib/periodic-job-registry';
import { papicHasClosed } from '@/lib/face-selfie-lifetime';

/**
 * face-selfie-erase.ts — THE FACE-TAGGING SELFIE ENDS WHEN THE GUEST LOGS OUT,
 * OR WHEN THE EVENT'S PAPIC CLOSES, WHICHEVER COMES FIRST. TAGS STAY.
 *
 * ⚖ Owner, 2026-09-30 (DECISION_LOG): *"face tagging selfie will erase upon
 * log out"* → *"until papic services close then"* → FACE DATA: THREE OWNER
 * ANSWERS (1) *"yes, erase it too"* — the selfie that doubles as the guest's
 * picture goes with it; they fall back to initials. (2) Papic closes twelve
 * hours after the event ends — `papicHasClosed` (lib/face-selfie-lifetime.ts).
 *
 * ── WHAT IT ERASES ─────────────────────────────────────────────────────────
 *   1. every selfie OBJECT in R2 this guest's face data points at — the
 *      enrollment's `asset_url` and a `guests.photo_url` whose source is
 *      'selfie' — ONLY under `events/<event>/guest-selfies/<guest>/`
 *      (`planFaceSelfieDelete`; a ref outside it is refused and counted);
 *   2. the selfie-as-avatar: `photo_url` / `photo_source` cleared where the
 *      source is 'selfie' (initials from then on);
 *   3. every `guest_face_enrollments` row for (event, guest) — the vector, the
 *      model, the consent row and its pointer. Deleted, not tombstoned: nothing
 *      references the table (face-data-retention.ts verified it), and a
 *      tombstone would keep the pointer to an image that no longer exists.
 *
 * ⛔ WHAT IT KEEPS, DELIBERATELY — AND WHY IT IS NOT `eraseGuestFaceData`:
 *   · PHOTO TAGS. *"Tags already made are kept (a tag is not face data)."*
 *     `eraseGuestFaceData` (app/[slug]/actions.ts) pulls every auto-face tag —
 *     right for "No thanks — delete my selfie" and "Delete my face data", where
 *     the guest is withdrawing from recognition. Logging out is not a
 *     withdrawal, and closing Papic is a clock. This file never writes
 *     `photo_tags`; `face-selfie-keeps-tags.test.ts` holds that.
 *   · THE ACCOUNT'S OWN FACE (`user_face_profiles`). It lives on the account,
 *     not on the event, and dies with the account or its own switch.
 *   · The guest's answer (`face_tagging_wanted`) — an answer is not face data.
 *
 * 🔒 BEST-EFFORT, NEVER THROWS. A failed step is counted and the next one still
 * runs; the Papic-close sweep retries whatever is left, and the 92-day
 * `runFaceDataRetention` stays underneath as the last backstop.
 */

type Admin = ReturnType<typeof createAdminClient>;

export type SelfieEraseResult = {
  /** Enrollment rows deleted. */
  enrollments: number;
  /** Selfie objects deleted from R2. */
  objects: number;
  /** Refs refused for sitting outside this guest's own selfie folder. */
  refused: number;
  /** The selfie-as-avatar was cleared. */
  avatarCleared: boolean;
  /** Steps that errored (the row survives to the next sweep). */
  failed: number;
};

export async function eraseFaceTaggingSelfie(
  admin: Admin,
  eventId: string,
  guestId: string,
): Promise<SelfieEraseResult> {
  const out: SelfieEraseResult = { enrollments: 0, objects: 0, refused: 0, avatarCleared: false, failed: 0 };
  if (!eventId || !guestId) return out;
  try {
    const [{ data: rows, error: rowsErr }, { data: guest, error: guestErr }] = await Promise.all([
      admin.from('guest_face_enrollments').select('id, asset_url').eq('event_id', eventId).eq('guest_id', guestId),
      admin.from('guests').select('photo_url, photo_source').eq('event_id', eventId).eq('guest_id', guestId).maybeSingle(),
    ]);
    if (rowsErr) console.error('[supabase-error] lib/face-selfie-erase.ts · from:guest_face_enrollments.select', rowsErr);
    if (guestErr) console.error('[supabase-error] lib/face-selfie-erase.ts · from:guests.select', guestErr);
    if (rowsErr || guestErr) {
      // Could not see what there is — erase nothing on half the picture.
      out.failed += 1;
      return out;
    }
    const g = guest as { photo_url: string | null; photo_source: string | null } | null;
    const selfieAvatar = g?.photo_source === 'selfie' ? g.photo_url : null;
    const enrollments = (rows ?? []) as Array<{ id: number; asset_url: string | null }>;
    if (enrollments.length === 0 && !selfieAvatar) return out;

    // 1 · The objects, FIRST — a deleted row must never orphan its file.
    const refs = new Set<string>();
    for (const r of enrollments) if (r.asset_url) refs.add(r.asset_url);
    if (selfieAvatar) refs.add(selfieAvatar);
    for (const ref of refs) {
      const decision = planFaceSelfieDelete({ event_id: eventId, guest_id: guestId, asset_url: ref });
      if (!decision) continue;
      if (!decision.ok) {
        out.refused += 1;
        continue;
      }
      try {
        await executeCleanupDelete(decision.target);
        out.objects += 1;
      } catch (err) {
        // An orphan is reaped by the R2 lifecycle rule; the rows still go.
        out.failed += 1;
        console.warn('[face-selfie-erase] selfie delete failed (continuing)', {
          eventId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2 · The selfie-as-avatar → initials.
    if (selfieAvatar) {
      const { data: cleared, error: avatarErr } = await admin
        .from('guests')
        .update({ photo_url: null, photo_source: null, photo_updated_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .eq('guest_id', guestId)
        .eq('photo_source', 'selfie')
        .select('guest_id');
      if (avatarErr) {
        console.error('[supabase-error] lib/face-selfie-erase.ts · from:guests.update', avatarErr);
        out.failed += 1;
      } else {
        out.avatarCleared = Array.isArray(cleared) && cleared.length > 0;
      }
    }

    // 3 · The face data itself.
    if (enrollments.length > 0) {
      const { data: gone, error: delErr } = await admin
        .from('guest_face_enrollments')
        .delete()
        .eq('event_id', eventId)
        .eq('guest_id', guestId)
        .select('id');
      if (delErr) {
        console.error('[supabase-error] lib/face-selfie-erase.ts · from:guest_face_enrollments.delete', delErr);
        out.failed += 1;
      } else {
        out.enrollments = Array.isArray(gone) ? gone.length : 0;
      }
    }
  } catch (err) {
    out.failed += 1;
    console.warn('[face-selfie-erase] erase failed', { eventId, error: err instanceof Error ? err.message : String(err) });
  }
  return out;
}

/**
 * Sign-out of an ACCOUNT: the selfie at every event whose seat this account
 * holds (`event_members.user_id → guest_id`). The account session was "their
 * account session on this event" for each of them.
 */
export async function eraseFaceTaggingSelfiesForUser(admin: Admin, userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const { data, error } = await admin
      .from('event_members')
      .select('event_id, guest_id')
      .eq('user_id', userId)
      .not('guest_id', 'is', null);
    if (error) console.error('[supabase-error] lib/face-selfie-erase.ts · from:event_members.select', error);
    if (error || !data) return 0;
    let erased = 0;
    for (const m of data as Array<{ event_id: string | null; guest_id: string | null }>) {
      if (!m.event_id || !m.guest_id) continue;
      const r = await eraseFaceTaggingSelfie(admin, m.event_id, m.guest_id);
      erased += r.enrollments + (r.avatarCleared ? 1 : 0);
    }
    return erased;
  } catch {
    return 0;
  }
}

/**
 * The couple turned face tagging OFF for their event — every guest's selfie
 * there, erased (tags kept). Returns the number of guests erased.
 */
export async function eraseEventFaceTaggingSelfies(admin: Admin, eventId: string): Promise<number> {
  if (!eventId) return 0;
  try {
    const [enr, avatars] = await Promise.all([
      admin.from('guest_face_enrollments').select('guest_id').eq('event_id', eventId),
      admin.from('guests').select('guest_id').eq('event_id', eventId).eq('photo_source', 'selfie'),
    ]);
    if (enr.error) console.error('[supabase-error] lib/face-selfie-erase.ts · from:guest_face_enrollments.select(event)', enr.error);
    if (avatars.error) console.error('[supabase-error] lib/face-selfie-erase.ts · from:guests.select(event)', avatars.error);
    const guests = new Set<string>();
    for (const r of [...(enr.data ?? []), ...(avatars.data ?? [])] as Array<{ guest_id: string | null }>) {
      if (r.guest_id) guests.add(r.guest_id);
    }
    let erased = 0;
    for (const guestId of guests) {
      const r = await eraseFaceTaggingSelfie(admin, eventId, guestId);
      if (r.enrollments > 0 || r.avatarCleared) erased += 1;
    }
    return erased;
  } catch {
    return 0;
  }
}

/**
 * THE PAPIC-CLOSE SWEEP. Every guest still holding a face-tagging selfie (an
 * enrollment, or a selfie avatar) at an event whose Papic has CLOSED is erased
 * through {@link eraseFaceTaggingSelfie} — tags kept.
 *
 * Candidates come from the two places a selfie can live, each joined to its
 * event's clock. An event with no readable clock is SKIPPED (never erased on
 * "we cannot say"), and the 92-day retention sweep still reaches it.
 *
 * Returns the number of guests erased — "erased 0" is an answer, and the run
 * record must be able to say it.
 */
export async function runPapicCloseSelfieErase(
  opts: { limit?: number; nowMs?: number } = {},
): Promise<number> {
  const limit = Math.max(1, Math.min(opts.limit ?? 500, 2000));
  const nowMs = opts.nowMs ?? Date.now();
  const admin = createAdminClient();
  const clock = 'events!inner(event_date, event_end_date, papic_window_end)';
  const [enr, avatars] = await Promise.all([
    admin.from('guest_face_enrollments').select(`event_id, guest_id, ${clock}`).order('id', { ascending: true }).limit(limit),
    admin.from('guests').select(`event_id, guest_id, ${clock}`).eq('photo_source', 'selfie').limit(limit),
  ]);
  if (enr.error) console.error('[supabase-error] lib/face-selfie-erase.ts · from:guest_face_enrollments.select(clock)', enr.error);
  if (avatars.error) console.error('[supabase-error] lib/face-selfie-erase.ts · from:guests.select(clock)', avatars.error);
  // A failed read must not look like a clean run — throw so the run record says FAILED.
  if (enr.error && avatars.error) throw new Error('face-selfie-papic-close: both candidate reads failed');

  type Row = {
    event_id: string | null;
    guest_id: string | null;
    events: { event_date: string | null; event_end_date: string | null; papic_window_end: string | null } | null;
  };
  const due = new Map<string, { eventId: string; guestId: string }>();
  for (const r of [...((enr.data ?? []) as unknown as Row[]), ...((avatars.data ?? []) as unknown as Row[])]) {
    if (!r.event_id || !r.guest_id || !r.events) continue;
    const closed = papicHasClosed(
      { eventDate: r.events.event_date, eventEndDate: r.events.event_end_date, windowEnd: r.events.papic_window_end },
      nowMs,
    );
    if (closed) due.set(`${r.event_id}:${r.guest_id}`, { eventId: r.event_id, guestId: r.guest_id });
  }

  let erased = 0;
  for (const { eventId, guestId } of due.values()) {
    const r = await eraseFaceTaggingSelfie(admin, eventId, guestId);
    if (r.enrollments > 0 || r.avatarCleared) erased += 1;
  }
  if (due.size > 0) {
    // Counts only — never a guest id or a ref.
    console.info(`[face-selfie-papic-close] ${due.size} guest(s) past Papic close; erased ${erased}.`);
  }
  return erased;
}

/**
 * CRON-FREE: rides request traffic through `after()` + a DB claim, like every
 * periodic job in this repo (lib/periodic-job-registry.ts — there is no
 * scheduler by design). Fired from the admin layout AND the public home page,
 * so a quiet admin console cannot hold a guest's selfie past its close.
 */
export async function maybeRunPapicCloseSelfieErase(): Promise<void> {
  await runClaimedJob('face-selfie-papic-close', FACE_SELFIE_PAPIC_CLOSE_GAP_MS, () => runPapicCloseSelfieErase());
}
