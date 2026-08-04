'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { revokePoolChannelGrant } from '@/lib/live-studio-channel-grants';
import { returnPoolChannel } from '@/lib/live-studio-roam-provision';

/**
 * /admin/live-studio-channels — actions for the Setnayan-owned YouTube channel
 * pool. WAVE 9 · Live_Studio_Unified_Spec_2026-07-25.md § 4h.
 *
 * These manage PLATFORM INFRASTRUCTURE (channels other couples' weddings stream
 * on), so every one of them is admin-guarded AND flag-gated. No action here can
 * ever be reached by a couple or a vendor.
 *
 * 🚫 NO ACTION IN THIS FILE READS, RETURNS OR ACCEPTS A TOKEN. Connecting is a
 * redirect into Google (/api/oauth/youtube/pool/start); disconnecting goes through
 * `revokePoolChannelGrant`, which handles the token internally and returns a
 * boolean. There is deliberately no "show me the refresh token" path, for admins
 * either.
 */

const BOARD = '/admin/live-studio-channels';

/** Shared entry gate: admin + the Live Studio flag. */
async function gate(): Promise<{ userId: string }> {
  const { userId } = await requireAdmin();
  if (!liveStudioRoamEnabled()) throw new Error('Live Studio is not enabled.');
  return { userId };
}

function readChannelId(formData: FormData): number {
  const raw = formData.get('channel_pool_id');
  const id = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid input');
  return id;
}

/** Best-effort audit trail — the house convention for a privileged mutation. */
async function audit(
  actorUserId: string,
  action: string,
  targetId: string,
  after: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('admin_audit_log').insert({
      action,
      target_table: 'live_studio_roam_channel_pool',
      target_id: targetId,
      actor_user_id: actorUserId,
      after_json: after,
    });
  } catch {
    // An audit write must never be the reason a channel cannot be released
    // minutes before a ceremony.
  }
}

/**
 * Mark a pool channel verified / unverified.
 *
 * ⚠ THIS IS A HUMAN ATTESTATION, NOT A CHECK. Setnayan cannot see whether YouTube
 * has enabled live streaming on a channel, nor whether its 24-hour first-stream
 * wait has elapsed (owner action G1). An admin ticks this after confirming it in
 * YouTube Studio. It matters because `checkoutPoolChannel` only ever claims a
 * VERIFIED channel — so an untidy tick here is the difference between a wedding
 * getting a working channel and getting one YouTube will refuse to stream on.
 */
export async function setChannelVerified(formData: FormData) {
  const { userId } = await gate();
  const id = readChannelId(formData);
  const verified = formData.get('verified') === '1';

  const admin = createAdminClient();
  const { error } = await admin
    .from('live_studio_roam_channel_pool')
    .update({ verified, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);

  await audit(userId, 'live_studio_channel.set_verified', String(id), { verified });
  revalidatePath(BOARD);
}

/**
 * Move a channel between `available` and `maintenance` / `retired`.
 *
 * ⚠ Deliberately CANNOT set `checked_out` — that status is owned by
 * `checkoutPoolChannel`, whose partial unique index is what stops two events
 * holding one channel. An admin form that could write `checked_out` without an
 * event id would be a second way into that state, and the index would not catch
 * it (the index only constrains rows that HAVE an event id).
 */
export async function setChannelStatus(formData: FormData) {
  const { userId } = await gate();
  const id = readChannelId(formData);
  const status = formData.get('status');
  if (status !== 'available' && status !== 'maintenance' && status !== 'retired') {
    throw new Error('Invalid input');
  }

  const admin = createAdminClient();
  const { data: current, error: readErr } = await admin
    .from('live_studio_roam_channel_pool')
    .select('status, checked_out_event_id')
    .eq('id', id)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if ((current as { status?: string } | null)?.status === 'checked_out') {
    // Force the admin through Release, which is explicit about abandoning an
    // event's channel, rather than letting a status dropdown do it quietly.
    throw new Error('This channel is checked out to an event — release it first.');
  }

  const { error } = await admin
    .from('live_studio_roam_channel_pool')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);

  await audit(userId, 'live_studio_channel.set_status', String(id), { status });
  revalidatePath(BOARD);
}

/** Rename a pool channel (admin nickname only — never the YouTube channel). */
export async function setChannelLabel(formData: FormData) {
  const { userId } = await gate();
  const id = readChannelId(formData);
  const raw = formData.get('label');
  const label = typeof raw === 'string' ? raw.trim().slice(0, 80) : '';

  const admin = createAdminClient();
  const { error } = await admin
    .from('live_studio_roam_channel_pool')
    .update({ label: label || null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);

  await audit(userId, 'live_studio_channel.set_label', String(id), { label });
  revalidatePath(BOARD);
}

/** Set the soft per-channel concurrency cap the provisioner respects. */
export async function setChannelCap(formData: FormData) {
  const { userId } = await gate();
  const id = readChannelId(formData);
  const raw = formData.get('concurrent_cap');
  const cap = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(cap) || cap < 1 || cap > 50) throw new Error('Cap must be 1–50');

  const admin = createAdminClient();
  const { error } = await admin
    .from('live_studio_roam_channel_pool')
    .update({ concurrent_cap: cap, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);

  await audit(userId, 'live_studio_channel.set_cap', String(id), { concurrent_cap: cap });
  revalidatePath(BOARD);
}

/**
 * ⭐ RELEASE — return a checked-out channel to the pool.
 *
 * THE ANTI-STRANDING LEVER, and the reason it is unconditional. Two ways a channel
 * gets stuck holding inventory nobody is using:
 *   ① a provisioning run that failed partway (its own safe release refuses while
 *      any stream is still ready/testing/live, which is right for the automatic
 *      path and wrong as a permanent state);
 *   ② the event was DELETED — `checked_out_event_id` is `ON DELETE SET NULL`, so
 *      the row keeps `status='checked_out'` with a null event and the partial
 *      unique index (which requires a non-null event id) stops caring about it.
 *      Nothing automatic can find that row by event.
 *
 * So this releases by CHANNEL ID, not by event, and does not consult the streams
 * table. An admin looking at "checked out 6 days ago, 0 active streams" needs a
 * button that works, not one that argues.
 */
export async function releaseChannel(formData: FormData) {
  const { userId } = await gate();
  const id = readChannelId(formData);

  const admin = createAdminClient();
  const { data: before } = await admin
    .from('live_studio_roam_channel_pool')
    .select('checked_out_event_id')
    .eq('id', id)
    .maybeSingle();
  const eventId = (before as { checked_out_event_id?: string | null } | null)?.checked_out_event_id ?? null;

  // Go through the shared helper when we know the event, so the release path is
  // the same one provisioning uses; fall back to a direct clear for the orphaned
  // (event-deleted) case it cannot address.
  const released = eventId ? await returnPoolChannel(admin, eventId) : false;
  if (!released) {
    const { error } = await admin
      .from('live_studio_roam_channel_pool')
      .update({
        status: 'available',
        checked_out_event_id: null,
        checked_out_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  await audit(userId, 'live_studio_channel.release', String(id), { released_event_id: eventId });
  revalidatePath(BOARD);
  redirect(`${BOARD}?released=1`);
}

/**
 * Disconnect a channel's Google grant: revoke at Google, blank the tokens, mark
 * the row revoked. The pool row itself stays (its history and its checkout state
 * are still meaningful) but it can no longer be provisioned onto — the token
 * accessor returns null for a revoked grant, and provisioning releases the channel
 * rather than claiming it.
 */
export async function disconnectChannel(formData: FormData) {
  const { userId } = await gate();
  const id = readChannelId(formData);

  const admin = createAdminClient();

  // 🚨 REFUSE WHILE CHECKED OUT. Revoking the grant of a channel an event is
  // holding kills the credentials mid-wedding: "End broadcast" could no longer
  // transition it on YouTube, and a re-provision would fail. Same posture as
  // setChannelStatus — an admin who really means it releases first, which is a
  // deliberate act with the checkout age on screen beside it.
  const { data: current } = await admin
    .from('live_studio_roam_channel_pool')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if ((current as { status?: string } | null)?.status === 'checked_out') {
    redirect(
      `${BOARD}?error=${encodeURIComponent(
        'This channel is checked out to an event — release it before disconnecting.',
      )}`,
    );
  }

  const ok = await revokePoolChannelGrant(admin, id);
  if (!ok) redirect(`${BOARD}?error=${encodeURIComponent('Could not disconnect that channel.')}`);

  // A disconnected channel must not sit in the pool looking claimable.
  await admin
    .from('live_studio_roam_channel_pool')
    .update({ verified: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('status', 'checked_out');

  await audit(userId, 'live_studio_channel.disconnect', String(id), {});
  revalidatePath(BOARD);
  redirect(`${BOARD}?disconnected=1`);
}
