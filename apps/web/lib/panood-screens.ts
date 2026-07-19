import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * apps/web/lib/panood-screens.ts
 *
 * The VENUE-SCREEN data layer for the upgraded Panood multicam controller
 * (iteration 0011). A persistent, named multi-screen registry: the couple
 * registers N physical displays (TV / LED wall / projector / stick) for an event,
 * and the control room routes a source/mode to each screen independently
 * (photos / mirror / live_bg / a camera feed / off).
 *
 * This is DISTINCT from the transient wall_display_sessions claim handshake — a
 * panood_screens row is durable, holds the routed `current_source`, and carries
 * the named/indexed identity the control room manages.
 *
 * PAIRING — a screen device (a TV / stick / projector) TYPES a short code rather
 * than scanning a long token, so we reuse the wall_display_sessions.display_code
 * idea: a 6-char Crockford pairing_code printed beside a QR. (Contrast with
 * lib/panood-camera-seats.ts, where a PHONE scans a long unguessable token.)
 *
 * Reads run behind the couple's RLS session (the controller setup page) OR behind
 * the service-role admin client in a server action that has already verified the
 * caller is on the event. The screen pair/claim path goes through a SECURITY
 * DEFINER RPC / admin client in a later PR, so the panood_screens table is strict
 * couple-only RLS (migration 20270227600000), and direct table reads from the
 * public pairing route are blocked.
 *
 * Graceful-degrade on a missing/legacy table (42P01 undefined_table · 42703
 * undefined_column) so a pre-bootstrap database surfaces the upgrade / no-screens
 * state rather than crashing — matches the panood-camera-seats.ts posture.
 */

export const PANOOD_SCREEN_PAIR_PATH = '/wall';

/**
 * Venue-screen statuses (mirror the table CHECK constraint):
 *   pending  — registered, not yet paired/seen
 *   online   — paired device with a recent heartbeat
 *   offline  — paired but no recent heartbeat
 */
export const PANOOD_SCREEN_STATUSES = ['pending', 'online', 'offline'] as const;
export type PanoodScreenStatus = (typeof PANOOD_SCREEN_STATUSES)[number];

/**
 * Unambiguous Crockford-style alphabet for the human-typed pairing code: the
 * 10 digits + 22 letters, dropping I, L, O and U (the four characters most
 * commonly mistyped on a TV remote / from a printed sheet). 32 symbols → 5 bits
 * each → a 6-char code carries ~30 bits of entropy, plenty for a short-lived,
 * RPC-validated pairing code printed beside a QR.
 */
const SCREEN_PAIR_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SCREEN_PAIR_CODE_LENGTH = 6;

/**
 * Read shape of a public.panood_screens row. `id` is the bigserial PK.
 */
export type PanoodScreenRow = {
  id: number;
  event_id: string;
  screen_index: number;
  name: string | null;
  pairing_code: string | null;
  pairing_expires_at: string | null;
  paired_at: string | null;
  current_source: string;
  status: PanoodScreenStatus;
  last_seen_at: string | null;
  revoked_at: string | null;
};

const PANOOD_SCREEN_SELECT =
  'id, event_id, screen_index, name, pairing_code, pairing_expires_at, paired_at, current_source, status, last_seen_at, revoked_at';

/**
 * Fetch this event's venue screens, ordered by screen_index. Runs behind the
 * couple's RLS session (the controller setup page). Graceful-degrade to [] on a
 * missing/legacy table (42P01) or column (42703) so the page shows the
 * registration prompt rather than crashing.
 */
export async function fetchPanoodScreens(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PanoodScreenRow[]> {
  const { data, error } = await supabase
    .from('panood_screens')
    .select(PANOOD_SCREEN_SELECT)
    .eq('event_id', eventId)
    .order('screen_index', { ascending: true });

  if (error) {
    if (error.code === '42P01' || error.code === '42703') return [];
    throw new Error(`Failed to read Panood screens: ${error.message}`);
  }

  return (data ?? []) as PanoodScreenRow[];
}

/**
 * A short, human-typed pairing code. panood_screens.pairing_code is the value a
 * screen DEVICE enters (or scans) to pair; it must be easy to read off a printed
 * sheet and type on a TV remote, so it uses a 6-char unambiguous Crockford-style
 * alphabet (no I/L/O/U). Reuses the wall_display_sessions.display_code idea.
 *
 * Uses crypto.getRandomValues with rejection sampling so every character is
 * drawn uniformly from the 32-symbol alphabet (no modulo bias).
 */
export function generateScreenPairingCode(): string {
  const alphabet = SCREEN_PAIR_CODE_ALPHABET;
  const out: string[] = [];
  const max = Math.floor(256 / alphabet.length) * alphabet.length;
  const buf = new Uint8Array(1);
  while (out.length < SCREEN_PAIR_CODE_LENGTH) {
    crypto.getRandomValues(buf);
    const b = buf[0] ?? 0;
    if (b >= max) continue; // reject the biased tail (uniform draw, no modulo bias)
    out.push(alphabet.charAt(b % alphabet.length));
  }
  return out.join('');
}

/**
 * Build the public pairing URL a screen device opens. The device lands on /wall
 * with the code pre-filled (or the operator types it); the route validates the
 * code, pairs the device (login-free in a later PR), and starts playing the
 * routed source.
 */
export function panoodScreenPairUrl(appUrl: string, code: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}${PANOOD_SCREEN_PAIR_PATH}?code=${encodeURIComponent(code)}`;
}

/**
 * Compute the dense set of missing screen indexes in 1..count given the indexes
 * that already exist. Pure logic, exported so the provisioning path and its unit
 * test share one source of truth. Indexes <1 or >count in the existing set are
 * ignored (they can't collide with a 1..count top-up).
 */
export function missingScreenIndexes(existing: Iterable<number>, count: number): number[] {
  const have = new Set<number>();
  for (const n of existing) have.add(n);
  const missing: number[] = [];
  for (let i = 1; i <= count; i += 1) {
    if (!have.has(i)) missing.push(i);
  }
  return missing;
}

/**
 * Admin-side idempotent screen provisioning — a TOP-UP. Mirrors
 * provisionPanoodCamerasAdmin exactly: reads the existing screen_index set first
 * and inserts ONLY the missing indexes in 1..count, so re-running (re-approved
 * order, or after the couple already registered screens) never duplicates a
 * screen and never disturbs an already-paired one. The (event_id, screen_index)
 * UNIQUE constraint is the hard backstop.
 *
 * Runs under the SERVICE-ROLE admin client (bypasses RLS) so screens exist the
 * instant the Panood order is approved — no manual activate step.
 *
 * Best-effort + non-fatal: any error returns 0 so a write failure here can never
 * roll back the payment approval. Returns the number of NEW screens inserted
 * (0 when all `count` already existed, or on a pre-bootstrap DB / bad input).
 */
export async function provisionPanoodScreensAdmin(
  admin: SupabaseClient,
  eventId: string,
  count: number,
): Promise<number> {
  if (!eventId || !Number.isInteger(count) || count <= 0) return 0;
  try {
    // Which screen indexes already exist?
    const { data: existing, error: readError } = await admin
      .from('panood_screens')
      .select('screen_index')
      .eq('event_id', eventId);
    // Missing/legacy table (42P01) or column (42703) → a pre-bootstrap DB; the
    // couple can still self-serve once migrated. Don't throw.
    if (readError) return 0;

    const missingIdx = missingScreenIndexes(
      (existing ?? []).map((r) => r.screen_index as number),
      count,
    );
    if (missingIdx.length === 0) return 0; // already fully provisioned — no-op.

    const rows = missingIdx.map((i) => ({
      event_id: eventId,
      screen_index: i,
      pairing_code: generateScreenPairingCode(),
    }));

    // ignoreDuplicates so a screen raced in between the read and this insert
    // (the UNIQUE (event_id, screen_index) backstop) is silently skipped, never
    // a hard error — same DO-NOTHING semantics as the camera provisioner.
    const { error: insertError } = await admin
      .from('panood_screens')
      .upsert(rows, { onConflict: 'event_id,screen_index', ignoreDuplicates: true });
    if (insertError) return 0;
    return rows.length;
  } catch {
    return 0;
  }
}

/**
 * Admin-side best-effort source routing — set a screen's `current_source` (the
 * routed mode the device should play: photos | mirror | live_bg | off | cam1 |
 * …). Runs under the service-role admin client behind a server action that has
 * already verified the caller is on the event. Non-fatal: returns false on any
 * error / bad input rather than throwing, so a routing hiccup never crashes the
 * control room. Stamps updated_at so the screen's playout watcher picks it up.
 */
export async function setPanoodScreenSourceAdmin(
  admin: SupabaseClient,
  screenId: number,
  source: string,
): Promise<boolean> {
  if (!Number.isInteger(screenId) || screenId <= 0 || !source) return false;
  try {
    const { error } = await admin
      .from('panood_screens')
      .update({ current_source: source, updated_at: new Date().toISOString() })
      .eq('id', screenId);
    return !error;
  } catch {
    return false;
  }
}
