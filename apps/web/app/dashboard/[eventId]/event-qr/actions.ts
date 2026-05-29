'use server';

/**
 * V2 Phase D · regenerateEventMasterQR server action.
 *
 * WHY (per CLAUDE.md third 2026-05-28 row · V2 publisher pivot):
 * the master event QR is a durable secret token the host shares with
 * photography + livestream crew. Rotating invalidates further device
 * pairings via the old token — useful when a crew device leaks the QR
 * (e.g., posted to a vendor's group chat by accident).
 *
 * Rotation DOES NOT revoke already-registered devices. They keep their
 * device_id session for telemetry checkpoints (per Phase E). To revoke
 * an individual device, soft-revoke via registered_crew_devices.revoked_at
 * (admin or future host UI; not in scope for Phase D).
 *
 * Auth: host-only. Verified via events RLS — if the calling user can
 * UPDATE the event row, they're a host. The events table's RLS already
 * encodes the event_members / event_moderators dual-membership model
 * (per CLAUDE.md 2026-05-20 row 448), so we don't re-derive it here.
 *
 * Per [[feedback_setnayan_orphan_prevention]] the call site is the
 * [Regenerate] button on /dashboard/[eventId]/event-qr — no orphan.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'node:crypto';

export type RegenerateResult =
  | { ok: true; rotated_at: string }
  | { ok: false; reason: 'not_signed_in' | 'not_found_or_not_host' | 'error'; message?: string };

export async function regenerateEventMasterQR(formData: FormData): Promise<RegenerateResult> {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || !eventId) {
    return { ok: false, reason: 'error', message: 'Missing event_id' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 32 lowercase hex chars (16 bytes · ~128 bits entropy).
  const nextToken = randomBytes(16).toString('hex');
  const nowIso = new Date().toISOString();

  // The UPDATE is RLS-gated: only hosts can mutate the event row. If RLS
  // blocks the update the returned data array is empty (success but 0
  // rows touched). Use that to distinguish host vs non-host.
  const { data, error } = await supabase
    .from('events')
    .update({
      master_qr_token: nextToken,
      master_qr_token_rotated_at: nowIso,
    })
    .eq('event_id', eventId)
    .select('event_id, master_qr_token_rotated_at');

  if (error) {
    return { ok: false, reason: 'error', message: error.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, reason: 'not_found_or_not_host' };
  }

  revalidatePath(`/dashboard/${eventId}/event-qr`);
  return { ok: true, rotated_at: nowIso };
}
