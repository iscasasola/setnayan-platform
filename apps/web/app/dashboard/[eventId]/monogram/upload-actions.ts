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
  const svg = sanitizeStudioSvg(rawSvg);
  if (!svg) backToMaker(eventId, { upload_error: 'render' });

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

  const { error } = await supabase
    .from('events')
    .update({
      monogram_uploaded_svg: svg,
      monogram_studio_config: config,
    })
    .eq('event_id', eventId);
  if (error) backToMaker(eventId, { upload_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { studio: 'upload-saved' });
}

export async function clearUploadedMarkAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const { error } = await supabase
    .from('events')
    .update({ monogram_uploaded_svg: null })
    .eq('event_id', eventId);
  if (error) backToMaker(eventId, { upload_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { studio: 'upload-cleared' });
}
