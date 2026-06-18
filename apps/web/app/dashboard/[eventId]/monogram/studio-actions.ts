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

  const { error } = await supabase
    .from('events')
    .update({
      monogram_custom_svg: null,
      monogram_studio_config: null,
    })
    .eq('event_id', eventId);
  if (error) backToMaker(eventId, { studio_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { studio: 'cleared' });
}
