import type { SupabaseClient } from '@supabase/supabase-js';

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
 */

export const PANOOD_CAMERA_CLAIM_PATH = '/panood/cam';

/**
 * Camera-operator seat statuses (mirror the table CHECK constraint):
 *   open     — provisioned, not yet claimed
 *   live     — claimed operator is streaming (recent heartbeat)
 *   offline  — claimed but no recent heartbeat
 *   revoked  — couple revoked the claim; a fresh token must be reissued
 */
export const PANOOD_CAMERA_STATUSES = ['open', 'live', 'offline', 'revoked'] as const;
export type PanoodCameraStatus = (typeof PANOOD_CAMERA_STATUSES)[number];

/**
 * Read shape of a public.panood_camera_operators row. `id` is the bigserial PK,
 * surfaced as a string (Supabase returns bigint as number/string depending on
 * driver config) for stable client keys.
 */
export type PanoodCameraRow = {
  id: number;
  event_id: string;
  camera_index: number;
  label: string | null;
  claim_qr_token: string;
  claimer_user_id: string | null;
  claimed_at: string | null;
  last_seen_at: string | null;
  status: PanoodCameraStatus;
  revoked_at: string | null;
};

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
 * A short, URL-safe claim token. panood_camera_operators.claim_qr_token is the
 * value the per-camera claim link / QR carries; it must be unguessable and
 * unique. 24 bytes of crypto-random base64url (≈ 32 chars) is plenty of entropy
 * and stays well inside a single QR module budget. Reuses the Papic seat-token
 * approach byte-for-byte (generateSeatClaimToken).
 */
export function generateCameraClaimToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa → base64, then make it URL-safe and strip padding.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Build the public claim URL for a camera token. The operator opens this on
 * their phone; the route validates the token, signs them in (login-free in a
 * later PR), and binds the camera to their session.
 */
export function panoodCameraClaimUrl(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}${PANOOD_CAMERA_CLAIM_PATH}/${encodeURIComponent(token)}`;
}

/**
 * Compute the dense set of missing camera indexes in 1..count given the indexes
 * that already exist. Pure logic, exported so the provisioning path and its unit
 * test share one source of truth. Indexes <1 or >count in the existing set are
 * ignored (they can't collide with a 1..count top-up).
 */
export function missingCameraIndexes(existing: Iterable<number>, count: number): number[] {
  const have = new Set<number>();
  for (const n of existing) have.add(n);
  const missing: number[] = [];
  for (let i = 1; i <= count; i += 1) {
    if (!have.has(i)) missing.push(i);
  }
  return missing;
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
