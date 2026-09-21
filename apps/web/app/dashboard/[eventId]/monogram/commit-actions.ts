'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  sanitizeStudioConfig,
  sanitizeStudioSvg,
  ANIM_KINDS,
  ANIM_TEMPO_TIMINGS,
  type StudioAnimKind,
} from '@/lib/monogram-studio-shared';
import { isMarkInkMode, writeMarkInkMode, type MarkInkMode } from '@/lib/monogram-ink';

/**
 * commitMonogram — the ONE save on the Monogram Maker.
 *
 * Owner 2026-09-20, drawing the page as four rows: *"the top part is where you
 * make them choose. the next row is where they upload or edit the monogram /
 * next row is the different animation effects / next row is Use Static Image
 * (FREE) and Unlock Animation (500)."* No save button inside either editor: the
 * two buttons in the last row ARE the save. So one write carries the mark, the
 * chosen effect, and whether guests see it move.
 *
 *   source 'studio'  → monogram_custom_svg + the re-editable studio config
 *   source 'upload'  → monogram_uploaded_svg, stamped with whose colours it wears
 *   source 'none'    → the mark already saved stays; only the choice is written
 *
 * `animate: false` stores `anim.off = true` — "Use Static Image". For a couple
 * who has paid it keeps the mark still for guests, and pressing the paid button
 * later clears it again without paying twice (lib/static-means-static.test.ts).
 *
 * RETURNS, never redirects: "Unlock Animation & Apply" saves and then opens the
 * checkout drawer in the same click, and a redirect would navigate away first.
 *
 * ⛔ Never writes `monogram_uploaded_svg: null`. Only "Remove upload" may delete
 * the couple's logo (lib/only-remove-upload-deletes-the-upload.test.ts).
 */

const MAX_SVG_BYTES = 400_000;

export type CommitMonogramInput = {
  eventId: string;
  source: 'studio' | 'upload' | 'none';
  svg?: string;
  /** studio only — the engine's re-editable config (JSON-parsed client-side). */
  config?: unknown;
  /** upload only — whose colours the logo wears. */
  inkMode?: string;
  kind: string;
  tempo: string;
  animate: boolean;
};

export async function commitMonogram(
  input: CommitMonogramInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const eventId = String(input.eventId ?? '').trim();
  if (!eventId) return { ok: false, error: 'Something went wrong — please refresh and try again.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const { data: membership } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) return { ok: false, error: 'This page is for the couple’s account.' };

  const kind: StudioAnimKind = (ANIM_KINDS as readonly string[]).includes(input.kind)
    ? (input.kind as StudioAnimKind)
    : 'handwriting';
  const tempo = input.tempo in ANIM_TEMPO_TIMINGS ? (input.tempo as keyof typeof ANIM_TEMPO_TIMINGS) : 'classic';
  const anim = {
    ...ANIM_TEMPO_TIMINGS[tempo],
    kind,
    preset: tempo,
    ...(input.animate ? {} : { off: true as const }),
  };

  const update: Record<string, unknown> = {};
  let base: ReturnType<typeof sanitizeStudioConfig> = null;

  if (input.source === 'studio' || input.source === 'upload') {
    const raw = String(input.svg ?? '');
    const clean = raw.length <= MAX_SVG_BYTES ? sanitizeStudioSvg(raw) : null;
    if (!clean) return { ok: false, error: 'That mark could not be saved — please adjust it and try again.' };
    if (input.source === 'studio') {
      base = sanitizeStudioConfig(input.config);
      if (!base) return { ok: false, error: 'That design could not be read — please try again.' };
      update.monogram_custom_svg = clean;
      // exactly one source owns monogram_custom_svg
      update.monogram_cipher_config = null;
    } else {
      const ink: MarkInkMode = isMarkInkMode(String(input.inkMode ?? '')) ? (input.inkMode as MarkInkMode) : 'file';
      update.monogram_uploaded_svg = writeMarkInkMode(clean, ink);
    }
  }

  if (!base) {
    const { data: event } = await supabase
      .from('events')
      .select('monogram_text, monogram_studio_config')
      .eq('event_id', eventId)
      .maybeSingle();
    base =
      sanitizeStudioConfig(event?.monogram_studio_config) ??
      // minimal valid config seeded with the couple's names, so a later studio
      // open derives their real initials
      sanitizeStudioConfig({
        text: typeof event?.monogram_text === 'string' ? event.monogram_text : '',
        font: 'cardo',
        ink: '#5C2542',
        outlineColor: '#C5A059',
        bg: '#FBFBFA',
        st: [],
        order: [],
        pstate: {},
        strokes: [],
        syms: [],
      });
  }
  const config = sanitizeStudioConfig(base ? { ...base, anim } : null);
  if (!config) return { ok: false, error: 'That design could not be read — please try again.' };
  update.monogram_studio_config = config;

  /* `.select()` counts the rows: an UPDATE matching none (an RLS refusal, a
   * stale id) returns error:null, and the screen would say "Saved". */
  const { data: updated, error } = await supabase
    .from('events')
    .update(update)
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !updated || updated.length === 0) {
    /* Recorded, not just returned: "Unlock Animation & Apply" opens payment
     * whatever this answers, so the log is the only witness to a couple paying
     * for a mark that never saved. */
    logQueryError(
      'commitMonogram.events.update',
      error ?? { message: 'update matched 0 rows (RLS refusal or unknown event)' },
      { event_id: eventId, source: input.source, kind, animate: input.animate },
      'graceful_degrade',
    );
    return { ok: false, error: 'Something went wrong saving — please try again.' };
  }

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  return { ok: true };
}
