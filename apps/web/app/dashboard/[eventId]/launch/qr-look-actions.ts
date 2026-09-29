'use server';

import { getCurrentUser } from '@/lib/auth';
import { requireHostMembership } from '@/lib/host-gate';
import { createAdminClient } from '@/lib/supabase/admin';
import { QR_STYLE_PREF_KEY, qrStyleFromPreferences, sanitizeQrStyle, type StoredQrStyle } from '@/lib/qr-look';
import { logQueryError } from '@/lib/supabase/error-detect';
import { draftedEventColumn, saveHubDraftPatch } from '@/lib/hub-draft-store';

/**
 * updateQrStyle — the Maker's Details page saving the couple's QR choices
 * (shape · pattern · colour).
 *
 * ── 💾 INTO THE DRAFT, NOT LIVE (owner 2026-09-29, "yes to all 3") ─────────
 * It used to write `events.style_preferences.qr` straight away and refuse a
 * couple without Event Hub Pro. Now every couple's pick goes into the Event Hub
 * DRAFT as `style_preferences: { qr }` — the Details preview draws it for the
 * host (`/api/website/qr/<slug>?draft=1`), the Apply sheet names it ("QR look ·
 * Your QR code"), and Apply MERGES it into the live blob only with Pro
 * (`planHubDraftApply` → `hub-draft-actions.ts`). The blob's other keys (the
 * couple's onboarding answers) are never drafted and never overwritten.
 *
 * Same export, same signature: the controls' save path is the only thing that
 * moved (+0 server actions).
 */
export type UpdateQrStyleResult = { ok: true } | { ok: false; reason: 'signed_out' | 'failed' };

export async function updateQrStyle(eventId: string, patch: StoredQrStyle): Promise<UpdateQrStyleResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'signed_out' };
  await requireHostMembership(eventId);

  // Re-check every field: a patch is data a browser sent, not a promise about shape.
  const next = sanitizeQrStyle(patch);

  /* Build on what is DRAFTED when the draft holds the QR, otherwise on live —
     a second pick must not drop the first. A refused draft read fails closed. */
  let current: StoredQrStyle;
  try {
    const drafted = await draftedEventColumn(eventId, 'style_preferences');
    if (drafted.drafted) current = qrStyleFromPreferences(drafted.value);
    else {
      const { data: row, error: readErr } = await createAdminClient()
        .from('events')
        .select('style_preferences')
        .eq('event_id', eventId)
        .maybeSingle();
      if (readErr) {
        logQueryError('updateQrStyle.read', readErr, { event_id: eventId }, 'graceful_degrade');
        return { ok: false, reason: 'failed' };
      }
      current = qrStyleFromPreferences(row?.style_preferences);
    }
  } catch {
    return { ok: false, reason: 'failed' };
  }

  const merged: StoredQrStyle = { ...current, ...next };
  // An explicit reset (`ink: undefined` from "Ink") drops the key rather than storing undefined.
  for (const k of Object.keys(patch) as Array<keyof StoredQrStyle>) {
    if (patch[k] === undefined) delete merged[k];
  }

  try {
    await saveHubDraftPatch(eventId, { events: { style_preferences: { [QR_STYLE_PREF_KEY]: merged } } });
  } catch (e) {
    console.error('[qr-look] draft save failed:', e instanceof Error ? e.message : e);
    return { ok: false, reason: 'failed' };
  }
  return { ok: true };
}
