'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveMonogramMotion } from '@/lib/monogram-motion';

/**
 * saveMonogram — persists the couple's monogram from the standalone Monogram
 * Maker (`/dashboard/[eventId]/monogram`).
 *
 * Mirrors EXACTLY the columns the wedding onboarding writes
 * (app/onboarding/wedding/actions.ts → monogram_style + monogram_font_key +
 * monogram_frame_key) plus monogram_text + monogram_color, so the maker and
 * onboarding stay one coherent model and resolveMonogramDesign()/EventMonogram
 * round-trip the design everywhere (chrome switcher, QR center, landing hero).
 *
 * The couple picks ONE of the 5 curated lockups (bar · script · duo · framed ·
 * infinity); font/frame/ink are derived from that style (single source below =
 * the mirror of MONO_DESIGNS in lib/monogram.ts). No new schema — these columns
 * already exist on `events` (origin/main onboarding reads + writes them).
 *
 * The paid ANIMATED_MONOGRAM SKU (the draw-on / future animation styles) is
 * SEPARATE — gated via the orders table, not touched here.
 */

type MonoStyle = 'bar' | 'script' | 'duo' | 'framed' | 'infinity';
const STYLES: MonoStyle[] = ['bar', 'script', 'duo', 'framed', 'infinity'];
const DESIGNS: Record<
  MonoStyle,
  { font: string; frame: string | null; ink: string }
> = {
  bar: { font: 'cormorant', frame: null, ink: '#5C2542' },
  script: { font: 'script', frame: null, ink: '#5C2542' },
  duo: { font: 'playfair', frame: null, ink: '#5C2542' },
  framed: { font: 'cinzel', frame: 'filigree', ink: '#A88340' },
  infinity: { font: 'cormorant', frame: null, ink: '#5C2542' },
};

export async function saveMonogram(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Initials → monogram_text. Keep up to 2 letters → "A & B" (dual) or "A".
  const rawInitials = String(formData.get('initials') ?? '');
  const letters = (rawInitials.match(/\p{L}/gu) ?? []).slice(0, 2).join('').toUpperCase();
  const monogramText =
    letters.length >= 2 ? `${letters[0]} & ${letters[1]}` : letters || 'S';

  const styleRaw = String(formData.get('style') ?? 'bar');
  const style: MonoStyle = (STYLES as readonly string[]).includes(styleRaw)
    ? (styleRaw as MonoStyle)
    : 'bar';
  const design = DESIGNS[style];

  // Motion-library signature (lib/monogram-motion.ts). Unknown/missing values
  // resolve to 'draw' so the column never stores an off-registry key.
  const motion = resolveMonogramMotion(String(formData.get('motion') ?? ''));

  const { error } = await supabase
    .from('events')
    .update({
      monogram_text: monogramText,
      monogram_color: design.ink,
      monogram_style: style,
      monogram_font_key: design.font,
      monogram_frame_key: design.frame,
      monogram_motion_key: motion,
    })
    .eq('event_id', eventId);

  if (error) throw new Error(error.message);

  // 'layout' so the dashboard chrome monogram (EventMonogram in the layout
  // header) refreshes, mirroring the onboarding/updateEventDate convention.
  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
}
