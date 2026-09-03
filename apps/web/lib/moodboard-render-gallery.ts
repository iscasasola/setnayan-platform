/**
 * Reading renders back — the couple's own gallery, and the admin's all-creations
 * feed (MB8).
 *
 * ── THE RULE THIS FILE IS BUILT AROUND ────────────────────────────────────
 * 🔑 A REFUSED READ MUST NOT LOOK LIKE AN EMPTY GALLERY.
 *
 * This is the guest-list failure exactly: `event_renders` is behind RLS, so a
 * caller who may not read it gets `[]` from PostgREST — byte-identical to a
 * couple who has never rendered anything. Told as "no renders yet", a couple
 * who paid ₱1,000 and made forty photographs would be shown an empty box and
 * an invitation to start. So `readEventRenders` returns `null` for a FAILED
 * read and `[]` only for a genuinely-answered empty, and the surface must
 * render those two differently. Same contract as
 * `readMoodboardRenderBalance`, deliberately — one shape for the whole
 * subsystem.
 *
 * ── AND AN IN-FLIGHT ROW IS CLASSIFIED, NOT SHOWN RAW ─────────────────────
 * A row with no image and no failure is either working or dead, and those look
 * identical in the database. `classifyRender` resolves it against the clock
 * (`isStalledRender`) so a killed process becomes a visible FAILURE with a
 * refund button rather than a tile that spins for the rest of the engagement.
 * That was the stuck upload chip.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isStalledRender } from './moodboard-render-failure';

export type EventRenderRow = {
  render_id: string;
  part_id: string;
  image_key: string | null;
  note: string | null;
  credits_debited: number;
  config_digest: string;
  failed_at: string | null;
  failure_reason: string | null;
  featured_at: string | null;
  created_at: string;
  completed_at: string | null;
};

const RENDER_COLUMNS =
  'render_id, part_id, image_key, note, credits_debited, config_digest, failed_at, failure_reason, featured_at, created_at, completed_at';

/**
 * This event's renders, newest first.
 *
 * `null` = the read was refused or errored — say so. `[]` = answered, and
 * there really are none.
 */
export async function readEventRenders(
  supabase: SupabaseClient,
  eventId: string,
  limit = 60,
): Promise<EventRenderRow[] | null> {
  const { data, error } = await supabase
    .from('event_renders')
    .select(RENDER_COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit);
  // 🔑 THE WHOLE POINT. An error is not an empty gallery.
  if (error || !data) return null;
  return data as EventRenderRow[];
}

/**
 * What a render IS, right now — the single classifier every surface uses, so
 * the couple's tile, the gallery and the admin feed can never disagree about
 * whether one photograph happened.
 */
export type RenderState =
  /** There is an image. */
  | { kind: 'ready' }
  /** It failed and the credits were returned. */
  | { kind: 'failed'; reason: string | null }
  /** Still within the provider's window. Genuinely working. */
  | { kind: 'working' }
  /**
   * In flight past the stall window with nobody left to report it — the
   * process died. Shown as a FAILURE, with the credit still held, and an
   * explicit way to reclaim it.
   */
  | { kind: 'stalled' };

export function classifyRender(row: EventRenderRow, now: number = Date.now()): RenderState {
  if (row.image_key) return { kind: 'ready' };
  if (row.failed_at) return { kind: 'failed', reason: row.failure_reason };
  if (isStalledRender(row, now)) return { kind: 'stalled' };
  return { kind: 'working' };
}

/**
 * The failure code stored in `failure_reason`, which is written as
 * `"<code>: <detail>"` by the server action. Split back out so the tile can
 * show the couple-facing sentence rather than the operator's detail string —
 * a raw `http_error: HTTP 429 {...}` on a wedding board is not communication.
 */
export function failureCodeOf(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const i = reason.indexOf(':');
  return (i > 0 ? reason.slice(0, i) : reason).trim() || null;
}

/* ── the admin all-creations feed ──────────────────────────────────────────── */

export type AdminRenderRow = {
  render_id: string;
  event_id: string;
  event_name: string;
  part_id: string;
  image_key: string | null;
  note: string | null;
  credits_debited: number;
  config_digest: string;
  reusable: boolean;
  reuse_blocked: boolean;
  featured_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  /** Whether the EVENT consented to being featured. Badged, never used to hide. */
  share_consented: boolean;
  created_at: string;
  completed_at: string | null;
};

/**
 * Every render on the platform, newest first.
 *
 * 🔒 DELIBERATELY NOT FILTERED BY CONSENT. Owner lock (2026-06-09, reaffirmed
 * 2026-09-03): the admin sees every render regardless of consent, because this
 * feed is how Setnayan compiles its own content database — a strong render
 * becomes candidate source material for the curated decor library. Consent
 * governs whether a creation may be PUBLISHED, never whether it is retained or
 * visible internally. `share_consented` rides along so the surface badges what
 * is shareable instead of hiding what is not.
 *
 * `null` on a refused read, for the same reason as above: an admin must never
 * be shown "no creations yet" because a gate said no.
 */
export async function readAllRendersForAdmin(
  supabase: SupabaseClient,
  opts: { limit?: number; offset?: number } = {},
): Promise<AdminRenderRow[] | null> {
  const { data, error } = await supabase.rpc('moodboard_admin_all_renders', {
    p_limit: opts.limit ?? 200,
    p_offset: opts.offset ?? 0,
  });
  if (error || !Array.isArray(data)) return null;
  return data as AdminRenderRow[];
}
