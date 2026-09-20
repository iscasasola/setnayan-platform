'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  sanitizeStudioConfig,
  sanitizeStudioSvg,
  ANIM_KINDS,
  type StudioAnimKind,
} from '@/lib/monogram-studio-shared';
import { isMarkInkMode, writeMarkInkMode, type MarkInkMode } from '@/lib/monogram-ink';

/**
 * Server actions for "upload your own mark" (owner 2026-07-17 — overriding the
 * benchmark council's §9 upload deferral).
 *
 * saveUploadedMarkAction — the client decodes/traces the file into pure paths
 *   (lib/monogram-studio/upload.ts); this action re-sanitizes the SVG with the
 *   same reject-don't-repair allowlist and writes events.monogram_uploaded_svg
 *   — the LONG-DORMANT column that already OUTRANKS every other mark on the
 *   live hero (lib/events.ts, hero-monogram-data.ts). The chosen reveal merges
 *   into monogram_studio_config.anim (created minimal when absent, seeded with
 *   the event's names so a later studio open derives the right initials), so
 *   the uploaded mark animates through the exact same player as studio marks.
 * clearUploadedMarkAction — removes the upload; the studio/auto mark resumes.
 *
 * AuthZ mirrors studio-actions.ts: couple-membership check, RLS-scoped writes.
 */

const MAX_SVG_BYTES = 400_000;

function backToMaker(eventId: string, params?: Record<string, string>): never {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  redirect(`/dashboard/${eventId}/monogram${qs}#upload-mark`);
}

async function requireCouple(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) backToMaker(eventId, { studio_error: 'not-found' });
  return supabase;
}

export async function saveUploadedMarkAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const rawSvg = String(formData.get('svg') ?? '');
  if (rawSvg.length > MAX_SVG_BYTES) backToMaker(eventId, { upload_error: 'render' });
  const sanitized = sanitizeStudioSvg(rawSvg);
  if (!sanitized) backToMaker(eventId, { upload_error: 'render' });

  /* WHOSE COLOURS (owner 2026-09-20) — stamped onto the mark's root tag, never
   * into a column. The stored bytes keep the couple's ORIGINAL colours either
   * way; `palette` only tells every read site to paint the mark in the surface's
   * own ink. That is what makes the choice reversible: switching back is a
   * re-stamp, not a re-upload. An absent/unknown value is `file`, so nothing
   * about a mark saved before today changes. See lib/monogram-ink.ts. */
  const inkRaw = String(formData.get('ink_mode') ?? '');
  const inkMode: MarkInkMode = isMarkInkMode(inkRaw) ? inkRaw : 'file';
  const svg = writeMarkInkMode(sanitized, inkMode);

  const animRaw = String(formData.get('anim_kind') ?? '');
  const animKind: StudioAnimKind = (ANIM_KINDS as readonly string[]).includes(animRaw)
    ? (animRaw as StudioAnimKind)
    : 'handwriting';

  // Merge the reveal pick into the studio config (the hero reads
  // monogram_studio_config.anim for EVERY custom mark, uploaded included).
  const { data: event } = await supabase
    .from('events')
    .select('monogram_text, monogram_studio_config')
    .eq('event_id', eventId)
    .maybeSingle();
  const existing = sanitizeStudioConfig(event?.monogram_studio_config);
  const config =
    existing != null
      ? { ...existing, anim: { dur: 6, smooth: 0.9, delay: 0.3, ...(existing.anim ?? {}), kind: animKind } }
      : sanitizeStudioConfig({
          // minimal valid config seeded with the couple's names, so a later
          // Vector Studio open derives their real initials, not "Maria & Juan"
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
          anim: { kind: animKind, dur: 6, smooth: 0.9, delay: 0.3 },
        });
  if (!config) backToMaker(eventId, { upload_error: 'invalid' });

  /* `.select()` IS LOAD-BEARING, not a convenience. Without it a PostgREST
   * UPDATE that matches NO row — an RLS refusal, a stale event id — returns
   * `error: null`, and the redirect below then tells the couple their mark is
   * live while the column is untouched. Count the rows; a zero-row success is
   * a failure wearing a success's clothes. */
  const { data: updated, error } = await supabase
    .from('events')
    .update({
      monogram_uploaded_svg: svg,
      monogram_studio_config: config,
    })
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !updated || updated.length === 0) backToMaker(eventId, { upload_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { studio: 'upload-saved' });
}

export async function clearUploadedMarkAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const { data: cleared, error } = await supabase
    .from('events')
    .update({ monogram_uploaded_svg: null })
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !cleared || cleared.length === 0) backToMaker(eventId, { upload_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { studio: 'upload-cleared' });
}

/**
 * setUploadedMarkInkAction — change WHOSE COLOURS the live uploaded mark wears,
 * without re-uploading it.
 *
 * The compare screen writes this. It re-stamps `data-ink` on the stored SVG and
 * nothing else: the original colours stay in the bytes, so a couple can flip
 * between their designer's palette and their mood board as many times as they
 * like. That reversibility is the reason the policy is a stamp rather than a
 * destructive recolour at save time.
 *
 * No-upload case: there is nothing to stamp (the studio mark carries its own
 * colours, chosen in the studio), so this returns the couple to the maker with
 * the same not-found notice the other actions use rather than writing a policy
 * onto a mark that cannot honour it.
 */
export async function setUploadedMarkInkAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const inkRaw = String(formData.get('ink_mode') ?? '');
  if (!isMarkInkMode(inkRaw)) backToMaker(eventId, { upload_error: 'invalid' });

  const { data: event } = await supabase
    .from('events')
    .select('monogram_uploaded_svg')
    .eq('event_id', eventId)
    .maybeSingle();

  const current = typeof event?.monogram_uploaded_svg === 'string' ? event.monogram_uploaded_svg : '';
  if (!current) backToMaker(eventId, { upload_error: 'not-found' });

  const { data: updated, error } = await supabase
    .from('events')
    .update({ monogram_uploaded_svg: writeMarkInkMode(current, inkRaw as MarkInkMode) })
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !updated || updated.length === 0) backToMaker(eventId, { upload_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { studio: 'ink-saved' });
}
