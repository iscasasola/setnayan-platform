import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * apps/web/lib/panood-moments.ts
 *
 * The MOMENT-DIRECTOR data layer for the upgraded Panood multicam controller
 * (iteration 0011), PR3 — the live control plane. A "moment" is a named one-tap
 * preset/macro the day-of switcher applies: tapping "The Kiss" can, in one move,
 * push a camera to PROGRAM, enable the monogram + lower-third overlays, route the
 * venue walls, duck the room audio, and drop a lower-third banner. This is the
 * scriptable spine that turns the control room from a raw switcher into a
 * director's run-of-show.
 *
 * Sits ON TOP OF PR1 (lib/panood-camera-seats.ts) and PR2 (lib/panood-screens.ts):
 * a moment's `config.program_source` / `walls_source` reference a camera feed or a
 * screen mode by the same loose-text identifier those layers route by.
 *
 * Reads run behind the couple's RLS session (the controller setup / Moment
 * Director page) OR behind the service-role admin client in a server action that
 * has already verified the caller is on the event. The control room mutates
 * through the admin client (provision / create / update) so a moment lands the
 * instant the Panood order is approved — exactly like the camera + screen layers.
 *
 * Graceful-degrade on a missing/legacy table (42P01 undefined_table · 42703
 * undefined_column) so a pre-bootstrap database surfaces the upgrade / no-moments
 * state rather than crashing — matches the panood-screens.ts posture.
 */

/**
 * The recognized shape of a moment's macro. All fields are optional on purpose —
 * a moment only sets the levers it cares about; everything else is left untouched
 * when the macro is applied. Mirrors the loose-text JSONB column (no DB CHECK).
 */
export type PanoodMomentConfig = {
  /** Which feed/mode goes to PROGRAM (cam1 | cam2 | mirror | …). */
  program_source?: string;
  /** Overlay layer keys to enable (monogram | lower_third | …). */
  overlays?: string[];
  /** What the venue walls/screens route to. */
  walls_source?: string;
  /** Duck floor/room audio (e.g. during vows). */
  audio_duck?: boolean;
  /** Lower-third banner text. */
  banner_label?: string;
  /** Lower-third banner icon (ti-*). */
  banner_icon?: string;
};

/**
 * Read shape of a public.panood_moments row. `id` is the bigserial PK.
 */
export type PanoodMomentRow = {
  id: number;
  event_id: string;
  sort_order: number;
  label: string;
  icon: string | null;
  config: PanoodMomentConfig;
  is_default: boolean;
};

const PANOOD_MOMENT_SELECT = 'id, event_id, sort_order, label, icon, config, is_default';

/**
 * The seeded MOMENT-DIRECTOR spine — the run-of-show beats every wedding has, in
 * ceremony→reception order. Each carries a Tabler icon (ti-*) for its chip and a
 * macro the control room applies on tap. These are seeded `is_default = true`;
 * the couple can reorder, edit, or add custom moments on top. Pure data, exported
 * so the provisioner and its unit test share one source of truth.
 */
export const DEFAULT_MOMENTS: ReadonlyArray<{
  label: string;
  icon: string;
  config: PanoodMomentConfig;
}> = [
  {
    label: 'Processional',
    icon: 'ti-walk',
    config: {
      program_source: 'cam1',
      overlays: ['monogram'],
      walls_source: 'mirror',
      banner_label: 'Processional',
      banner_icon: 'ti-walk',
    },
  },
  {
    label: 'Vows',
    icon: 'ti-heart-handshake',
    config: {
      program_source: 'cam2',
      overlays: ['lower_third'],
      walls_source: 'mirror',
      audio_duck: true,
      banner_label: 'The Vows',
      banner_icon: 'ti-heart-handshake',
    },
  },
  {
    label: 'The Kiss',
    icon: 'ti-heart',
    config: {
      program_source: 'cam1',
      overlays: ['monogram', 'lower_third'],
      walls_source: 'mirror',
      banner_label: 'The Kiss',
      banner_icon: 'ti-heart',
    },
  },
  {
    label: 'Grand Entrance',
    icon: 'ti-confetti',
    config: {
      program_source: 'cam1',
      overlays: ['monogram'],
      walls_source: 'live_bg',
      banner_label: 'Grand Entrance',
      banner_icon: 'ti-confetti',
    },
  },
  {
    label: 'First Dance',
    icon: 'ti-music',
    config: {
      program_source: 'cam2',
      overlays: ['lower_third'],
      walls_source: 'live_bg',
      audio_duck: false,
      banner_label: 'First Dance',
      banner_icon: 'ti-music',
    },
  },
  {
    label: 'Speeches',
    icon: 'ti-microphone',
    config: {
      program_source: 'cam2',
      overlays: ['lower_third'],
      walls_source: 'mirror',
      audio_duck: true,
      banner_label: 'Speeches',
      banner_icon: 'ti-microphone',
    },
  },
  {
    label: 'Cake Cutting',
    icon: 'ti-cake',
    config: {
      program_source: 'cam1',
      overlays: ['monogram'],
      walls_source: 'mirror',
      banner_label: 'Cake Cutting',
      banner_icon: 'ti-cake',
    },
  },
  {
    label: 'Toast',
    icon: 'ti-glass-full',
    config: {
      program_source: 'cam2',
      overlays: ['lower_third'],
      walls_source: 'mirror',
      audio_duck: true,
      banner_label: 'Toast',
      banner_icon: 'ti-glass-full',
    },
  },
];

/**
 * Fetch this event's moment-director presets, ordered by sort_order. Runs behind
 * the couple's RLS session (the Moment Director rail). Graceful-degrade to [] on a
 * missing/legacy table (42P01) or column (42703) so the page shows the
 * provisioning prompt rather than crashing.
 */
export async function fetchPanoodMoments(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PanoodMomentRow[]> {
  const { data, error } = await supabase
    .from('panood_moments')
    .select(PANOOD_MOMENT_SELECT)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });

  if (error) {
    if (error.code === '42P01' || error.code === '42703') return [];
    throw new Error(`Failed to read Panood moments: ${error.message}`);
  }

  return (data ?? []) as PanoodMomentRow[];
}

/**
 * Admin-side idempotent moment provisioning — SEED-ONLY-WHEN-EMPTY. Reads whether
 * the event already has ANY moment first and seeds the DEFAULT_MOMENTS spine only
 * if it has none, so re-running (re-approved order, or after the couple already
 * customised their rail) never duplicates the spine and never disturbs custom
 * moments. (Contrast with the camera/screen TOP-UP provisioners, which fill dense
 * 1..N gaps — moments have no dense index, so the guard is "any rows yet?".)
 *
 * Runs under the SERVICE-ROLE admin client (bypasses RLS) so the moment rail
 * exists the instant the Panood order is approved — no manual setup step.
 *
 * Best-effort + non-fatal: any error returns 0 so a write failure here can never
 * roll back the payment approval. Returns the number of NEW moments seeded
 * (0 when the event already had moments, or on a pre-bootstrap DB / bad input).
 */
export async function provisionPanoodMomentsAdmin(
  admin: SupabaseClient,
  eventId: string,
): Promise<number> {
  if (!eventId) return 0;
  try {
    // Seed only when the event has NO moments yet (idempotent — never re-seed).
    const { count, error: countError } = await admin
      .from('panood_moments')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    // Missing/legacy table (42P01) or column (42703) → a pre-bootstrap DB; the
    // couple can still self-serve once migrated. Don't throw.
    if (countError) return 0;
    if ((count ?? 0) > 0) return 0; // already has moments — no-op.

    const rows = DEFAULT_MOMENTS.map((m, i) => ({
      event_id: eventId,
      sort_order: i,
      label: m.label,
      icon: m.icon,
      config: m.config,
      is_default: true,
    }));

    const { error: insertError } = await admin.from('panood_moments').insert(rows);
    if (insertError) return 0;
    return rows.length;
  } catch {
    return 0;
  }
}

/**
 * Admin-side best-effort moment creation — append a single custom moment to the
 * rail. Runs under the service-role admin client behind a server action that has
 * already verified the caller is on the event. Non-fatal: returns false on any
 * error / bad input rather than throwing.
 */
export async function createPanoodMomentAdmin(
  admin: SupabaseClient,
  eventId: string,
  moment: { label: string; icon?: string | null; config?: PanoodMomentConfig; sortOrder?: number },
): Promise<boolean> {
  if (!eventId || !moment?.label) return false;
  try {
    const { error } = await admin.from('panood_moments').insert({
      event_id: eventId,
      label: moment.label,
      icon: moment.icon ?? null,
      config: moment.config ?? {},
      sort_order: Number.isInteger(moment.sortOrder) ? moment.sortOrder : 0,
      is_default: false,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Admin-side best-effort moment update — patch a moment's label / icon / config /
 * sort_order. Runs under the service-role admin client. Non-fatal: returns false
 * on any error / bad input rather than throwing. Stamps updated_at.
 */
export async function updatePanoodMomentAdmin(
  admin: SupabaseClient,
  momentId: number,
  patch: { label?: string; icon?: string | null; config?: PanoodMomentConfig; sortOrder?: number },
): Promise<boolean> {
  if (!Number.isInteger(momentId) || momentId <= 0 || !patch) return false;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.icon !== undefined) update.icon = patch.icon;
  if (patch.config !== undefined) update.config = patch.config;
  if (patch.sortOrder !== undefined && Number.isInteger(patch.sortOrder)) {
    update.sort_order = patch.sortOrder;
  }
  // Only updated_at present → nothing meaningful to patch.
  if (Object.keys(update).length === 1) return false;
  try {
    const { error } = await admin.from('panood_moments').update(update).eq('id', momentId);
    return !error;
  } catch {
    return false;
  }
}
