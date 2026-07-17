'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeStudioConfig, sanitizeStudioSvg } from '@/lib/monogram-studio-shared';

/**
 * Server actions for the Vector Monogram Studio (Phase 5 of the monogram
 * overhaul · /dashboard/[eventId]/monogram).
 *
 * saveStudioAction — the client engine (opentype.js + paper.js) composes the
 *   mark and exports a PURE-PATHS SVG; the action SANITIZES it
 *   (sanitizeStudioSvg: strict reject-don't-repair allowlist — the same
 *   defense the bespoke AI path uses for externally-produced SVG, since the
 *   boolean engine can't be cheaply re-run server-side) and clamps the
 *   re-editable config (sanitizeStudioConfig), then writes BOTH
 *   events.monogram_custom_svg (the canonical mark every surface reads) and
 *   events.monogram_studio_config (the re-editable source). Clears
 *   monogram_cipher_config + monogram_custom_generation_id so exactly one
 *   source owns the mark.
 * clearStudioAction — removes the studio design + the rendered mark.
 *
 * AuthZ mirrors the sibling cipher/bespoke actions: explicit couple-membership
 * check, then RLS-scoped writes. No external APIs, no spend.
 */

const MAX_SVG_BYTES = 400_000;

function backToMaker(eventId: string, params?: Record<string, string>): never {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  redirect(`/dashboard/${eventId}/monogram${qs}#vector-studio`);
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

export async function saveStudioAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const rawSvg = String(formData.get('svg') ?? '');
  if (rawSvg.length > MAX_SVG_BYTES) backToMaker(eventId, { studio_error: 'render' });
  const svg = sanitizeStudioSvg(rawSvg);
  if (!svg) backToMaker(eventId, { studio_error: 'render' });

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get('config') ?? ''));
  } catch {
    backToMaker(eventId, { studio_error: 'invalid' });
  }
  const config = sanitizeStudioConfig(parsed);
  if (!config) backToMaker(eventId, { studio_error: 'invalid' });

  const { error } = await supabase
    .from('events')
    .update({
      monogram_custom_svg: svg,
      monogram_studio_config: config,
      // A studio mark is neither a cipher nor a bespoke-studio generation —
      // drop those pointers so exactly one source owns monogram_custom_svg.
      monogram_cipher_config: null,
      monogram_custom_generation_id: null,
      // Reclaim precedence from any earlier upload (gap audit 2026-07-17):
      // every surface resolves `uploaded ?? custom`, so a leftover
      // monogram_uploaded_svg would make this "Save as my monogram" a silent
      // no-op — the hero/QR/save-the-date would keep the OLD upload while the
      // UI says "your mark everywhere." Hitting Save on a studio design is an
      // unambiguous intent to make THAT the mark, so clear the upload.
      monogram_uploaded_svg: null,
    })
    .eq('event_id', eventId);
  if (error) backToMaker(eventId, { studio_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { studio: 'saved' });
}

export async function clearStudioAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  // If an uploaded mark still exists, it becomes visible again once the studio
  // mark is cleared — and it reads its chosen reveal from monogram_studio_config.anim
  // (upload-actions merges it there). Wiping the whole config would silently
  // drop the upload's reveal back to the default (gap audit 2026-07-17), so
  // preserve a minimal config that keeps only the reveal when an upload is live.
  const { data: ev } = await supabase
    .from('events')
    .select('monogram_uploaded_svg, monogram_text, monogram_studio_config')
    .eq('event_id', eventId)
    .maybeSingle();
  const hasUpload = typeof ev?.monogram_uploaded_svg === 'string' && Boolean(ev.monogram_uploaded_svg);
  const existing = hasUpload ? sanitizeStudioConfig(ev?.monogram_studio_config) : null;
  const preservedConfig =
    hasUpload && existing?.anim
      ? sanitizeStudioConfig({
          text: typeof ev?.monogram_text === 'string' ? ev.monogram_text : '',
          font: 'cardo',
          ink: '#5C2542',
          outlineColor: '#C5A059',
          bg: '#FBFBFA',
          st: [],
          order: [],
          pstate: {},
          strokes: [],
          syms: [],
          anim: existing.anim,
        })
      : null;

  const { error } = await supabase
    .from('events')
    .update({
      monogram_custom_svg: null,
      monogram_studio_config: preservedConfig,
    })
    .eq('event_id', eventId);
  if (error) backToMaker(eventId, { studio_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { studio: 'cleared' });
}
