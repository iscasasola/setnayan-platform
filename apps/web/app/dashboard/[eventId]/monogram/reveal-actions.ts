'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  sanitizeStudioConfig,
  ANIM_KINDS,
  ANIM_TEMPO_TIMINGS,
  type StudioAnimKind,
} from '@/lib/monogram-studio-shared';

/**
 * setRevealAction — the ONE place a couple's reveal is chosen.
 *
 * Owner 2026-09-20, overruling the 2026-06-23 lock that put the picker inside
 * the Vector Studio ("improve THIS animate the reveal … not a separate
 * feature"): *"it should be one reveal for both only."* That lock made sense
 * while letters were the only source. Now a mark can come from letters OR an
 * uploaded logo, and a picker that lives inside the letters editor cannot serve
 * both — so the reveal moves OUT to a step of its own, after the mark exists,
 * whichever way it was made.
 *
 * It writes `monogram_studio_config.anim`, the same field the studio panel
 * wrote, so every surface that already reads the reveal keeps reading it and
 * nothing downstream changes.
 */
export async function setRevealAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');

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
  if (!membership) redirect(`/dashboard/${eventId}/monogram`);

  const kindRaw = String(formData.get('kind') ?? '');
  const kind: StudioAnimKind = (ANIM_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as StudioAnimKind)
    : 'handwriting';

  const tempoRaw = String(formData.get('tempo') ?? '');
  const tempo = tempoRaw in ANIM_TEMPO_TIMINGS ? (tempoRaw as keyof typeof ANIM_TEMPO_TIMINGS) : 'classic';
  const timing = ANIM_TEMPO_TIMINGS[tempo];

  const { data: event } = await supabase
    .from('events')
    .select('monogram_text, monogram_studio_config')
    .eq('event_id', eventId)
    .maybeSingle();

  const existing = sanitizeStudioConfig(event?.monogram_studio_config);
  /* Merge, never replace: the config also carries the letters, their per-piece
   * transforms and the frame. Writing a fresh config here would silently delete
   * the couple's whole design to record which reveal they picked. */
  const config = existing
    ? { ...existing, anim: { ...timing, kind, preset: tempo } }
    : sanitizeStudioConfig({
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
        anim: { ...timing, kind, preset: tempo },
      });
  if (!config) redirect(`/dashboard/${eventId}/monogram?studio_error=invalid`);

  // `.select()` counts rows: a PostgREST UPDATE matching none returns
  // error:null, and the redirect below would report a saved reveal that was
  // never written.
  const { data: updated, error } = await supabase
    .from('events')
    .update({ monogram_studio_config: config })
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !updated || updated.length === 0) {
    redirect(`/dashboard/${eventId}/monogram?studio_error=save`);
  }

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  redirect(`/dashboard/${eventId}/monogram?studio=reveal-saved#reveal`);
}
