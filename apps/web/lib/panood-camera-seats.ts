import type { SupabaseClient } from '@supabase/supabase-js';
import { eventSkuActive } from '@/lib/entitlements';
import {
  generateCameraClaimToken,
  missingCameraIndexes,
  type ClaimedCameraView,
  type PanoodCameraRow,
  type PanoodCameraStatus,
  type PanoodTier,
} from '@/lib/panood-camera-seats-pure';

/**
 * apps/web/lib/panood-camera-seats.ts
 *
 * The CAMERA-OPERATOR data layer for the upgraded Panood multicam controller
 * (iteration 0011). A direct clone of the PROVEN Papic seat-claim helpers
 * (lib/papic-seats.ts): the couple provisions N camera "seats" for an event,
 * each carrying a per-camera unguessable claim token; a designated operator
 * scans the QR / opens /panood/cam/[token], binds the camera to their device,
 * and goes live as one feed in the multicam switcher.
 *
 * Reads run behind the couple's RLS session (the controller setup page) OR behind
 * the service-role admin client in a server action that has already verified the
 * caller is on the event. The login-free operator claim path goes through a
 * SECURITY DEFINER RPC / admin client in a later PR — exactly like Papic — so the
 * panood_camera_operators table is strict couple-only RLS (migration
 * 20270227010000), and direct table reads from the public claim route are blocked.
 *
 * Graceful-degrade on a missing/legacy table (42P01 undefined_table · 42703
 * undefined_column) so a pre-bootstrap database surfaces the upgrade / no-cameras
 * state rather than crashing — matches the papic-seats.ts posture.
 *
 * ⚠ THE CONSTANTS, SHAPES AND TOKEN MINT ARE NOT IN THIS FILE — they are in
 * `./panood-camera-seats-pure`, because `resolvePanoodTier` below reaches
 * `eventSkuActive` → the service-role client, and `control-room.tsx` /
 * `live-studio-channel-cameras.ts` need the pure half without it. Everything
 * there is re-exported below, so `@/lib/panood-camera-seats` still resolves
 * every symbol it always did.
 */

export * from '@/lib/panood-camera-seats-pure';

const PANOOD_CAMERA_SELECT =
  'id, event_id, camera_index, label, claim_qr_token, claimer_user_id, claimed_at, last_seen_at, status, revoked_at';

/**
 * Fetch this event's camera-operator seats, ordered by camera_index. Runs behind
 * the couple's RLS session (the controller setup page). Graceful-degrade to [] on
 * a missing/legacy table (42P01) or column (42703) so the page shows the
 * provisioning prompt rather than crashing.
 */
export async function fetchPanoodCameras(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PanoodCameraRow[]> {
  const { data, error } = await supabase
    .from('panood_camera_operators')
    .select(PANOOD_CAMERA_SELECT)
    .eq('event_id', eventId)
    .order('camera_index', { ascending: true });

  if (error) {
    if (error.code === '42P01' || error.code === '42703') return [];
    throw new Error(`Failed to read Panood cameras: ${error.message}`);
  }

  return (data ?? []) as PanoodCameraRow[];
}

/**
 * Resolve the camera a token points at IF AND ONLY IF it is bound to this user.
 *
 * The /panood/cam GET page can't read panood_camera_operators under the
 * operator's session (RLS is control-room-only and the operator is neither
 * couple nor coordinator), so the GET page uses the admin client — but ONLY to
 * confirm the operator's OWN binding (claimer_user_id = userId) before rendering
 * the publish view. Returns null for any token that isn't this user's live
 * (non-revoked) camera, so the admin read can never leak another operator's
 * camera or the secret token. Graceful-degrade to null on a missing/legacy table.
 */
export async function fetchClaimedCameraForUser(
  admin: SupabaseClient,
  token: string,
  userId: string,
): Promise<ClaimedCameraView | null> {
  if (!token || !userId) return null;
  try {
    const { data, error } = await admin
      .from('panood_camera_operators')
      .select('camera_index, label, event_id, status, claimer_user_id, revoked_at')
      .eq('claim_qr_token', token)
      .maybeSingle();
    if (error || !data) return null;
    if (data.revoked_at || data.status === 'revoked') return null;
    if (data.claimer_user_id !== userId) return null;
    return {
      camera_index: data.camera_index as number,
      label: (data.label as string | null) ?? null,
      event_id: data.event_id as string,
      status: data.status as PanoodCameraStatus,
    };
  } catch {
    return null;
  }
}


/**
 * Admin-side idempotent camera provisioning — a TOP-UP. Mirrors
 * provisionPapicSeatsAdmin exactly: reads the existing camera_index set first and
 * inserts ONLY the missing indexes in 1..count, so re-running (re-approved order,
 * or after the couple already provisioned) never duplicates a camera and never
 * disturbs an already-claimed one. The (event_id, camera_index) UNIQUE constraint
 * is the hard backstop.
 *
 * Runs under the SERVICE-ROLE admin client (bypasses RLS) so cameras exist the
 * instant the Panood order is approved — no manual activate step.
 *
 * Best-effort + non-fatal: any error returns 0 so a write failure here can never
 * roll back the payment approval. Returns the number of NEW cameras inserted
 * (0 when all `count` already existed, or on a pre-bootstrap DB / bad input).
 */
export async function provisionPanoodCamerasAdmin(
  admin: SupabaseClient,
  eventId: string,
  count: number,
): Promise<number> {
  if (!eventId || !Number.isInteger(count) || count <= 0) return 0;
  try {
    // Which camera indexes already exist?
    const { data: existing, error: readError } = await admin
      .from('panood_camera_operators')
      .select('camera_index')
      .eq('event_id', eventId);
    // Missing/legacy table (42P01) or column (42703) → a pre-bootstrap DB; the
    // couple can still self-serve once migrated. Don't throw.
    if (readError) return 0;

    const missingIdx = missingCameraIndexes(
      (existing ?? []).map((r) => r.camera_index as number),
      count,
    );
    if (missingIdx.length === 0) return 0; // already fully provisioned — no-op.

    const rows = missingIdx.map((i) => ({
      event_id: eventId,
      camera_index: i,
      claim_qr_token: generateCameraClaimToken(),
    }));

    // ignoreDuplicates so a camera raced in between the read and this insert
    // (the UNIQUE (event_id, camera_index) backstop) is silently skipped, never
    // a hard error — same DO-NOTHING semantics as the Papic provisioner.
    const { error: insertError } = await admin
      .from('panood_camera_operators')
      .upsert(rows, { onConflict: 'event_id,camera_index', ignoreDuplicates: true });
    if (insertError) return 0;
    return rows.length;
  } catch {
    return 0;
  }
}

/**
 * Resolve whether an event has paid for Live Studio.
 *
 * Still checks BOTH SKUs even though only `PANOOD_SYSTEM` is sellable now: the retired
 * `PANOOD_SYSTEM_MOBILE` row is deactivated in the catalog, not revoked, so any historical
 * holder must keep working. (Prod has zero such orders — this is belt and braces, and it costs
 * one cached lookup.)
 *
 * Every ownership check must route through here, never through a SKU literal. That is what
 * caused the defect where a Mobile buyer was shown an upsell wall on the console they had just
 * bought, bounced from the OBS pop-out, and refused on every control action.
 *
 * Degrades to 'free' rather than throwing: a failed entitlement lookup must land the couple on
 * the overlaid free tier, never a dead end.
 */
export async function resolvePanoodTier(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PanoodTier> {
  const [current, legacy] = await Promise.all([
    eventSkuActive(supabase, eventId, 'PANOOD_SYSTEM').catch(() => false),
    eventSkuActive(supabase, eventId, 'PANOOD_SYSTEM_MOBILE').catch(() => false),
  ]);
  return current || legacy ? 'paid' : 'free';
}

/**
 * Mint a fresh claim token for a camera, unbinding whoever currently holds it.
 *
 * This is the ONLY way a claimed camera returns to 'open' — the couple's remedy when an operator
 * drops out, loses their phone, or was simply the wrong person. Clears the binding and the
 * revocation together so one action fully recycles the seat.
 *
 * Scoped by BOTH id and event_id so a token from another event can never be recycled here, and
 * left to table RLS (couple + coordinator) rather than a SECURITY DEFINER RPC — unlike the claim
 * path, the caller here IS a control-room member and can write the row under their own session.
 */
export async function reissuePanoodCameraToken(
  supabase: SupabaseClient,
  eventId: string,
  cameraId: number,
): Promise<string | null> {
  const token = generateCameraClaimToken();
  const { error } = await supabase
    .from('panood_camera_operators')
    .update({
      claim_qr_token: token,
      claimer_user_id: null,
      claimed_at: null,
      revoked_at: null,
      status: 'open',
    })
    .eq('id', cameraId)
    .eq('event_id', eventId);
  return error ? null : token;
}
