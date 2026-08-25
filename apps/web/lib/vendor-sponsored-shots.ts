import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * THE ONLY GUEST PHOTOGRAPHS A SUPPLIER MAY EVER SEE.
 *
 * Owner, 2026-08-26, ruling on whether suppliers may reach guest media at all:
 * *"the host will allow access. they only get shots from the sponsored papic
 * challenge."*
 *
 * That is a narrow, consent-shaped answer, and it is the reason the supplier
 * lane can be opened at all. A supplier does not roam a couple's gallery. They
 * write a challenge, **the host approves it**, guests choose whether to answer
 * it, and the supplier receives only the pictures taken FOR that challenge by
 * guests who **consented to share them**.
 *
 * 🔑 EVERY GATE BELOW IS LOAD-BEARING AND EACH ONE IS SOMEBODY'S DECISION.
 * Dropping any single one widens this from "the photos guests took for your
 * challenge" to "the couple's gallery", which is the thing the DPO question was
 * ever about:
 *
 *   1. `m.event_id`        — this event, never another booking of theirs.
 *   2. `m.vendor_id`       — THEIR challenge, never another supplier's.
 *   3. `m.source='vendor'` — a supplier challenge, never the couple's own.
 *   4. `m.approved`        — **the host said yes.** This is the access grant,
 *                            and un-approving it is the host's revoke.
 *   5. `m.is_active`       — a retired challenge stops feeding.
 *   6. `mc.consent_to_share` — **the guest said yes**, per photograph.
 *   7. `c.hidden_at IS NULL`  — the couple's own take-down is honoured.
 *   8. `c.moderation_state='clean'` — an ALLOWLIST, not a deny-list. Anything
 *      `unscreened` is excluded by construction, so a photo the safety screen
 *      has not looked at can never reach a supplier. ⚠ Two of the states in
 *      this column (`consent_withheld`, `faceblock_withheld`) are filtered on
 *      elsewhere in the app and **written by nothing** — which is exactly why
 *      this asks for the one good value rather than excluding the bad ones.
 *
 * ⚠ SERVICE-ROLE READ, SO THE APP-SIDE GATE IS THE WHOLE FENCE. RLS is a floor,
 * not a scope — this runs outside it, and there is no policy underneath to catch
 * a dropped clause. That is what `vendor-sponsored-shots-are-scoped.test.ts`
 * exists for.
 *
 * ⚠ Supabase resolves with `{ error }` rather than throwing, so the explicit
 * error check is the only one there is. On a failed read this returns an EMPTY
 * list and says so — never a partial one, because a partial list of somebody
 * else's wedding photographs is the failure that matters.
 */
export type SponsoredShot = {
  captureId: string;
  displayR2Key: string | null;
  posterR2Key: string | null;
  prompt: string;
  capturedAt: string | null;
};

export type SponsoredShotsRead = {
  /** false = the read failed. NEVER "there are none" — see the docblock. */
  ok: boolean;
  shots: SponsoredShot[];
};

export async function fetchVendorSponsoredShots(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<SponsoredShotsRead> {
  if (!vendorProfileId || !eventId) return { ok: true, shots: [] };

  const { data, error } = await admin
    .from('papic_mission_completions')
    .select(
      'capture_id, consent_to_share, papic_missions!inner(mission_id, prompt, event_id, vendor_id, source, approved, is_active), papic_guest_captures!inner(capture_id, display_r2_key, poster_r2_key, hidden_at, moderation_state, created_at)',
    )
    .eq('event_id', eventId)
    .eq('consent_to_share', true)
    .eq('papic_missions.event_id', eventId)
    .eq('papic_missions.vendor_id', vendorProfileId)
    .eq('papic_missions.source', 'vendor')
    .eq('papic_missions.approved', true)
    .eq('papic_missions.is_active', true)
    .is('papic_guest_captures.hidden_at', null)
    .eq('papic_guest_captures.moderation_state', 'clean');

  if (error) return { ok: false, shots: [] };

  type Row = {
    capture_id: string | null;
    papic_missions: { prompt?: string | null } | null;
    papic_guest_captures: {
      capture_id?: string | null;
      display_r2_key?: string | null;
      poster_r2_key?: string | null;
      created_at?: string | null;
    } | null;
  };

  const shots = ((data ?? []) as unknown as Row[])
    // `capture_id` is ON DELETE SET NULL — a completion outlives its photo.
    .filter((r) => !!r.capture_id && !!r.papic_guest_captures)
    .map((r) => ({
      captureId: r.capture_id as string,
      displayR2Key: r.papic_guest_captures?.display_r2_key ?? null,
      posterR2Key: r.papic_guest_captures?.poster_r2_key ?? null,
      prompt: r.papic_missions?.prompt ?? '',
      capturedAt: r.papic_guest_captures?.created_at ?? null,
    }));

  return { ok: true, shots };
}
