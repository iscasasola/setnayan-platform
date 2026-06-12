'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ShareArtifactType, ShareCreditMode } from '@/lib/social-sharing';

/**
 * Share-consent server actions — the couple side of the Social Sharing &
 * Featuring Program (corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md`
 * + migration 20261130000000_social_sharing_program).
 *
 * A couple grants Setnayan permission, PER ARTIFACT, to feature a creation on
 * the Setnayan Facebook page after their event. Both actions run under the
 * couple's own session — RLS policy `marketing_share_consents_couple`
 * (event_id IN current_couple_event_ids()) is the membership gate, so no
 * extra ownership probe is needed here.
 *
 * Shared by the Feature-Us cards (monogram / save-the-date pages) and the
 * Profile → Privacy & data revoke list; callers pass a `revalidate_path`
 * hidden field so the card they submitted from refreshes in place.
 */

const VALID_ARTIFACT_TYPES: ReadonlyArray<ShareArtifactType> = [
  'monogram',
  'save_the_date',
  'website',
  'reel',
  'led_design',
];

const VALID_CREDIT_MODES: ReadonlyArray<ShareCreditMode> = [
  'first_names',
  'anonymous',
];

function readString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Grant (or re-credit) a feature consent for one artifact. Upsert-style: if a
 * LIVE row already exists for the (event, artifact_type, artifact_ref) triple
 * — the partial unique index `marketing_share_consents_live_unique` — we
 * update its credit_mode instead of failing on the constraint.
 */
export async function grantShareConsent(formData: FormData) {
  const eventId = readString(formData, 'event_id');
  const artifactTypeRaw = readString(formData, 'artifact_type');
  const artifactRef = readString(formData, 'artifact_ref');
  const creditModeRaw = readString(formData, 'credit_mode');
  const revalidatePathRaw = readString(formData, 'revalidate_path');

  if (!eventId) throw new Error('Missing event');
  if (!VALID_ARTIFACT_TYPES.includes(artifactTypeRaw as ShareArtifactType)) {
    throw new Error('Invalid artifact type');
  }
  const artifact_type = artifactTypeRaw as ShareArtifactType;
  const credit_mode: ShareCreditMode = VALID_CREDIT_MODES.includes(
    creditModeRaw as ShareCreditMode,
  )
    ? (creditModeRaw as ShareCreditMode)
    : 'first_names';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Live row for the triple? Update credit_mode rather than insert-collide.
  const { data: existing } = await supabase
    .from('marketing_share_consents')
    .select('consent_id')
    .eq('event_id', eventId)
    .eq('artifact_type', artifact_type)
    .eq('artifact_ref', artifactRef)
    .is('revoked_at', null)
    .maybeSingle();

  if (existing?.consent_id) {
    const { error } = await supabase
      .from('marketing_share_consents')
      .update({ credit_mode, updated_at: new Date().toISOString() })
      .eq('consent_id', existing.consent_id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('marketing_share_consents').insert({
      event_id: eventId,
      customer_id: user.id,
      artifact_type,
      artifact_ref: artifactRef,
      credit_mode,
    });
    if (error) {
      // Race on the partial unique index (double-submit) — treat as success;
      // the live row already says "yes, feature this".
      if (error.code !== '23505') throw new Error(error.message);
    }
  }

  if (revalidatePathRaw.startsWith('/')) revalidatePath(revalidatePathRaw);
}

/**
 * Revoke a consent — sets revoked_at via an RLS-scoped update (status-flip,
 * never delete). Works even after posted_at is set: the admin Social Queue's
 * take-down panel picks up revoked+posted rows for the 24-hour removal SLA.
 */
export async function revokeShareConsent(formData: FormData) {
  const consentId = readString(formData, 'consent_id');
  const revalidatePathRaw = readString(formData, 'revalidate_path');
  if (!consentId) throw new Error('Missing consent');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('marketing_share_consents')
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('consent_id', consentId)
    .is('revoked_at', null);
  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/profile');
  if (revalidatePathRaw.startsWith('/')) revalidatePath(revalidatePathRaw);
}
