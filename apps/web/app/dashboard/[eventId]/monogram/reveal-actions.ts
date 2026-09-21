'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
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

  /* ONE write path. This used to carry its own copy of the auth check, the
   * membership test and the merge-not-replace config write; saveRevealChoice
   * (below) needed the same logic without the redirect, and two copies of the
   * rule that decides whether a couple's design is preserved is two chances to
   * delete it. This is now saveRevealChoice plus a destination. */
  const res = await saveRevealChoice({
    eventId,
    kind: String(formData.get('kind') ?? ''),
    tempo: String(formData.get('tempo') ?? ''),
  });
  if (!res.ok) redirect(`/dashboard/${eventId}/monogram?studio_error=save`);
  redirect(`/dashboard/${eventId}/monogram?studio=reveal-saved#reveal`);
}

/**
 * saveRevealChoice — the same write as setRevealAction, but RETURNING instead of
 * redirecting, so "Unlock & Apply" can record the reveal and then open the
 * checkout drawer in the same click.
 *
 * A redirect here would navigate away before the drawer could open. It returns
 * `{ ok }` and never throws for an expected refusal; the caller swallows even an
 * unexpected throw (see InlineCheckoutDrawer.onBeforeOpen), because failing to
 * save a preference must never stop a couple from paying.
 *
 * ⚠ It does NOT skip the checks setRevealAction makes — same auth, same
 * couple-membership test, same merge-not-replace of the config, same row count.
 * Only the ending differs.
 */
export async function saveRevealChoice(input: {
  eventId: string;
  kind: string;
  tempo: string;
}): Promise<{ ok: boolean }> {
  const eventId = String(input.eventId ?? '').trim();
  if (!eventId) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: membership } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) return { ok: false };

  const kind: StudioAnimKind = (ANIM_KINDS as readonly string[]).includes(input.kind)
    ? (input.kind as StudioAnimKind)
    : 'handwriting';
  const tempo = input.tempo in ANIM_TEMPO_TIMINGS ? (input.tempo as keyof typeof ANIM_TEMPO_TIMINGS) : 'classic';
  const timing = ANIM_TEMPO_TIMINGS[tempo];

  const { data: event } = await supabase
    .from('events')
    .select('monogram_text, monogram_studio_config')
    .eq('event_id', eventId)
    .maybeSingle();

  const existing = sanitizeStudioConfig(event?.monogram_studio_config);
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
  if (!config) return { ok: false };

  const { data: updated, error } = await supabase
    .from('events')
    .update({ monogram_studio_config: config })
    .eq('event_id', eventId)
    .select('event_id');
  /* ⚠ THIS FAILURE MUST BE RECORDED, NOT JUST RETURNED. "Unlock & Apply" calls
   * this and then opens payment REGARDLESS of the answer — deliberately, since a
   * preference must never block someone paying. That makes a silent failure the
   * worst kind: the couple pays, the reveal they chose never saves, and the
   * animation they bought plays a different one. The UI cannot surface it (the
   * checkout is already open), so the log is the only witness. The
   * `ugat-both-ends` guard caught the bare `return { ok: false }` this was. */
  if (error || !updated || updated.length === 0) {
    logQueryError(
      'saveRevealChoice.events.update',
      error ?? { message: 'update matched 0 rows (RLS refusal or unknown event)' },
      { event_id: eventId, kind, tempo },
      'graceful_degrade',
    );
    return { ok: false };
  }

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  return { ok: true };
}
