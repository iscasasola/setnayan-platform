'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireHostMembership } from '@/lib/host-gate';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { QR_STYLE_PREF_KEY, sanitizeQrStyle, type StoredQrStyle } from '@/lib/qr-look';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * updateQrStyle — the Maker's Details page saving the couple's QR choices
 * (shape · pattern · colour) into `events.style_preferences.qr`.
 *
 * ── WHY `style_preferences`, AND WHY LIVE ──────────────────────────────────
 * The blob already holds the couple's onboarding preferences under their own
 * keys (`interested_categories`, `refinements`, `basic_moodboard`, …) and is
 * read-modify-written by lib/pending-inquiries.ts the same way this does. A
 * new `events` column would have cost a GRANT block, an `events_host` rebuild
 * and an exposure-baseline widening for one small object (Rule 0: a flag flip
 * beats new schema). Live, not drafted: the QR is not a page a guest reads
 * before Apply — it is the picture on every print and pass — and the control
 * says so on the page (`HubSavesImmediately`).
 *
 * ── THE GATE IS HERE, NOT ONLY ON THE BUTTON ───────────────────────────────
 * The controls wear a padlock for a free couple and never call this; but a
 * padlock is a picture, so this refuses too. `eventCoupleWebsiteProActive` —
 * the same reader every Event Hub Pro perk gates on, bundle-aware and true for
 * §10a internal-hosted events.
 */
export type UpdateQrStyleResult = { ok: true } | { ok: false; reason: 'signed_out' | 'not_pro' | 'failed' };

export async function updateQrStyle(eventId: string, patch: StoredQrStyle): Promise<UpdateQrStyleResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'signed_out' };
  await requireHostMembership(eventId);

  const admin = createAdminClient();
  const ownsPro = await eventCoupleWebsiteProActive(admin, eventId).catch(() => false);
  if (!ownsPro) return { ok: false, reason: 'not_pro' };

  // Re-check every field: a patch is data a browser sent, not a promise about shape.
  const next = sanitizeQrStyle(patch);

  const { data: row, error: readErr } = await admin
    .from('events')
    .select('style_preferences')
    .eq('event_id', eventId)
    .maybeSingle();
  if (readErr) {
    logQueryError('updateQrStyle.read', readErr, { event_id: eventId }, 'graceful_degrade');
    return { ok: false, reason: 'failed' };
  }
  const prefs =
    row?.style_preferences && typeof row.style_preferences === 'object'
      ? { ...(row.style_preferences as Record<string, unknown>) }
      : {};
  const current = sanitizeQrStyle(prefs[QR_STYLE_PREF_KEY]);
  const merged: StoredQrStyle = { ...current, ...next };
  // An explicit reset (`ink: undefined` from "Ink") drops the key rather than storing undefined.
  for (const k of Object.keys(patch) as Array<keyof StoredQrStyle>) {
    if (patch[k] === undefined) delete merged[k];
  }
  prefs[QR_STYLE_PREF_KEY] = merged;

  const { error } = await admin.from('events').update({ style_preferences: prefs }).eq('event_id', eventId);
  if (error) {
    logQueryError('updateQrStyle.write', error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false, reason: 'failed' };
  }
  revalidatePath(`/dashboard/${eventId}/launch`);
  return { ok: true };
}
