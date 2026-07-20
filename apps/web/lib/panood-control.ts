import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * apps/web/lib/panood-control.ts
 *
 * The live PROGRAM/PREVIEW/ROUTING control-plane data layer for the upgraded
 * Panood multicam controller (iteration 0011), PR3. There is exactly ONE
 * public.panood_control_state row per event (UNIQUE event_id): the single source
 * of truth the control room writes and every screen/feed watcher reads —
 * which source is on PROGRAM (broadcast), which is cued on PREVIEW, whether the
 * director is hands-on, whether the show is live, and which moment-director preset
 * (lib/panood-moments.ts) is currently active.
 *
 * Every helper here mutates through the SERVICE-ROLE admin client (passed in by
 * the caller) behind a server action that has already verified the caller is on
 * the event (the control-room roles — couple + coordinator — per the table's
 * RLS). All mutations are best-effort + non-fatal (return false / null / never
 * throw on a missing table) and stamp updated_at so watchers pick up the change —
 * mirrors setPanoodScreenSourceAdmin's posture in lib/panood-screens.ts.
 *
 * NOTE: like its two sibling layers (lib/panood-screens.ts,
 * lib/panood-camera-seats.ts) this module takes the admin client as a parameter
 * rather than constructing it, and so carries NO `'server-only'` import — it holds
 * no secret of its own and stays unit-testable under `tsx --test` (CI's "unit
 * tests" step). The service-role client is created in the server action that calls
 * these helpers; that boundary is where the server-only guard lives.
 */

/**
 * Read shape of the single public.panood_control_state row for an event.
 * `id` is the bigserial PK.
 */
export type PanoodControlState = {
  id: number;
  event_id: string;
  program_source: string | null;
  preview_source: string | null;
  director_mode: boolean;
  is_live: boolean;
  active_moment_id: number | null;
  updated_at: string;
  /**
   * Write-once timestamp of the FIRST press-live. Anchors the 24h paid broadcast window
   * (lib/panood-watermark). Never moved by a re-press — DB trigger enforces it.
   */
  first_live_at: string | null;
};

const PANOOD_CONTROL_SELECT =
  'id, event_id, program_source, preview_source, director_mode, is_live, active_moment_id, updated_at, first_live_at';

/**
 * Get-or-create the single control-state row for an event (idempotent). On first
 * call the row doesn't exist yet, so we upsert on the UNIQUE event_id — a re-run
 * is a no-op that returns the existing row. Runs under the service-role admin
 * client. Returns null on a pre-bootstrap DB (42P01/42703) or any error so the
 * caller can surface the upgrade state rather than crashing.
 */
export async function fetchOrInitControlStateAdmin(
  admin: SupabaseClient,
  eventId: string,
): Promise<PanoodControlState | null> {
  if (!eventId) return null;
  try {
    // Idempotent get-or-create: upsert on the UNIQUE event_id. ignoreDuplicates so
    // a concurrent init that raced in is silently kept (DO NOTHING), never an error.
    const { error: upsertError } = await admin
      .from('panood_control_state')
      .upsert({ event_id: eventId }, { onConflict: 'event_id', ignoreDuplicates: true });
    if (upsertError && upsertError.code !== '42P01' && upsertError.code !== '42703') {
      // A real write failure (not a pre-bootstrap DB) — still try the read below;
      // the row may already exist from a prior init.
    }
    if (upsertError && (upsertError.code === '42P01' || upsertError.code === '42703')) {
      return null;
    }

    const { data, error } = await admin
      .from('panood_control_state')
      .select(PANOOD_CONTROL_SELECT)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) {
      if (error.code === '42P01' || error.code === '42703') return null;
      return null;
    }
    return (data as PanoodControlState | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Best-effort single-field control-plane writer. Upserts on the UNIQUE event_id so
 * it both creates the row (first write) and updates it (subsequent writes), always
 * stamping updated_at. Non-fatal: returns false on any error / pre-bootstrap DB.
 * Shared by every setter below so the get-or-create + updated_at semantics live in
 * one place.
 */
async function writeControlStateAdmin(
  admin: SupabaseClient,
  eventId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  if (!eventId) return false;
  try {
    const { error } = await admin
      .from('panood_control_state')
      .upsert(
        { event_id: eventId, ...patch, updated_at: new Date().toISOString() },
        { onConflict: 'event_id' },
      );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Set which source is ON AIR (the program bus). Loose text — sources are dynamic
 * per event (cam1 | cam2 | mirror | …). Best-effort.
 */
export async function setProgramSourceAdmin(
  admin: SupabaseClient,
  eventId: string,
  source: string | null,
): Promise<boolean> {
  return writeControlStateAdmin(admin, eventId, { program_source: source });
}

/**
 * Set which source is cued on PREVIEW (the director takes it to program on cut).
 * Best-effort.
 */
export async function setPreviewSourceAdmin(
  admin: SupabaseClient,
  eventId: string,
  source: string | null,
): Promise<boolean> {
  return writeControlStateAdmin(admin, eventId, { preview_source: source });
}

/**
 * Toggle director (hands-on manual switching) mode. Best-effort.
 */
export async function setDirectorModeAdmin(
  admin: SupabaseClient,
  eventId: string,
  directorMode: boolean,
): Promise<boolean> {
  return writeControlStateAdmin(admin, eventId, { director_mode: !!directorMode });
}

/**
 * Set whether the show is broadcasting (is_live). Best-effort.
 */
export async function setLiveAdmin(
  admin: SupabaseClient,
  eventId: string,
  isLive: boolean,
): Promise<boolean> {
  // Stamp the window anchor on the way UP only, and only if unset. The DB trigger
  // (trg_panood_first_live_at_immutable) is the real guarantee; this just avoids a pointless
  // write. Stopping and restarting a broadcast must never open a fresh 24 hours.
  if (!isLive) return writeControlStateAdmin(admin, eventId, { is_live: false });

  const existing = await fetchOrInitControlStateAdmin(admin, eventId);
  const patch: Record<string, unknown> = { is_live: true };
  if (!existing?.first_live_at) patch.first_live_at = new Date().toISOString();
  return writeControlStateAdmin(admin, eventId, patch);
}

/**
 * Apply a moment-director preset: mark it the active_moment_id on the control row.
 * The macro's effects (program_source, walls, overlays, audio_duck, banner) are
 * fanned out by the caller (the server action reads the moment's config and calls
 * the relevant setters + screen routing); this records WHICH preset is live so the
 * control room can highlight the active chip. Passing null clears it (back to
 * manual). Best-effort.
 */
export async function applyMomentAdmin(
  admin: SupabaseClient,
  eventId: string,
  momentId: number | null,
): Promise<boolean> {
  if (momentId !== null && (!Number.isInteger(momentId) || momentId <= 0)) return false;
  return writeControlStateAdmin(admin, eventId, { active_moment_id: momentId });
}
