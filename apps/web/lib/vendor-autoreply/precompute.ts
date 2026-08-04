// lib/vendor-autoreply/precompute.ts
//
// THE PRECOMPUTE STEP — runs ONCE PER VOICE EDIT, never per reply.
//
// This is the module the whole "voice-match is free to run" claim rests on: the
// expensive-looking work (deciding how this vendor sounds) is materialized here
// into `vendor_reply_templates`, and the reply path only substitutes a slot.
//
// ⚠ NO MODEL CALL — and none is needed. `buildPhrasingLibrary()` is a pure,
// deterministic combinator over the vendor's approved voice profile, so the
// precompute is ₱0 too. If a future variant ever DOES want a model pass, it must
// land in its own clearly-named server-only module invoked from HERE (per
// voice edit), never from `voice-runtime.ts` (per reply) — that boundary is the
// owner-locked "Setnayan AI is deterministic and free" rule made structural.
//
// WRITE PATH: `vendor_reply_templates` RLS grants writes to admins only
// (`vendor_reply_templates_admin`); generation is documented as a service-role
// write in migration 20270822679405. Callers MUST have verified (a) the flag,
// (b) that the signed-in user owns `vendorProfileId`, and (c) the Advanced
// entitlement, BEFORE calling — this module trusts its arguments.

import type { SupabaseClient } from '@supabase/supabase-js';

import type { VoiceProfile } from '../vendor-voice-profile';
import { buildPhrasingLibrary } from './phrasings';

export type PrecomputeResult = { ok: true; rows: number } | { ok: false; error: string };

/**
 * Regenerate the vendor's phrasing library from an APPROVED voice profile.
 *
 * Overwrite semantics (§ 7D: "cache, not log") — the vendor's rows are deleted
 * and rewritten, so the table never accumulates. If the delete succeeds and the
 * insert fails the vendor is left with NO phrasings, which the serving gate
 * reads as `no_phrasings` and answers in the neutral house voice: the safe
 * direction, and self-healing on the next save.
 */
export async function regenerateVoicePhrasings(
  admin: SupabaseClient,
  vendorProfileId: string,
  profile: VoiceProfile,
  nowIso: string = new Date().toISOString(),
): Promise<PrecomputeResult> {
  const library = buildPhrasingLibrary(profile);

  const { error: deleteError } = await admin
    .from('vendor_reply_templates')
    .delete()
    .eq('vendor_profile_id', vendorProfileId);
  if (deleteError) return { ok: false, error: deleteError.message };

  const rows = library.map((row) => ({
    vendor_profile_id: vendorProfileId,
    intent: row.intent,
    // Envelopes carry no facts, so they are not per-service/per-package — see
    // the "why a catalog edit does not invalidate the library" note in
    // phrasings.ts. The schema allows both refs to be NULL.
    service_id: null,
    package_id: null,
    phrasings: row.phrasings,
    generated_at: nowIso,
  }));

  const { error: insertError } = await admin.from('vendor_reply_templates').insert(rows);
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true, rows: rows.length };
}
