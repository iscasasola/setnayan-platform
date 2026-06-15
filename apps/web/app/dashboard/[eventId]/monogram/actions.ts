'use server';

import sharp from 'sharp';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveMonogramMotion } from '@/lib/monogram-motion';
import { sanitizeBespokeSvg } from '@/lib/bespoke-monogram-engine';

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

// The typeface picker's valid keys — MUST mirror MonoFontKey/MONO_FONT_STACK in
// lib/monogram.ts (each is a loaded next/font face). Unknown/missing values
// fall back to the chosen lockup's default font.
const FONT_KEYS = [
  'cormorant',
  'playfair',
  'cinzel',
  'script',
  'libre_caslon',
  'tangerine',
  'luxurious',
  'vidaloka',
] as const;

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

  // Typeface override (2026-06-11 expansion) — the couple may pick any registry
  // face independent of the lockup; off-registry values fall back to the
  // lockup's default so the column never stores an unknown key.
  const fontRaw = String(formData.get('font') ?? '');
  const fontKey = (FONT_KEYS as readonly string[]).includes(fontRaw)
    ? fontRaw
    : design.font;

  // Motion-library signature (lib/monogram-motion.ts). Unknown/missing values
  // resolve to 'draw' so the column never stores an off-registry key.
  const motion = resolveMonogramMotion(String(formData.get('motion') ?? ''));

  const { error } = await supabase
    .from('events')
    .update({
      monogram_text: monogramText,
      monogram_color: design.ink,
      monogram_style: style,
      monogram_font_key: fontKey,
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

/* ── Upload your own monogram (owner rule 2026-06-15) ─────────────────────────
   A couple uploads THEIR OWN mark; it OVERRULES every Setnayan mark (the
   Cipher/Bespoke `monogram_custom_svg` AND the lettered lockup). Stored on
   `events.monogram_uploaded_svg` as render-ready, inert SVG markup so it shows
   inline everywhere the custom mark already does (chrome icon, website hero,
   maker preview) — the app resolves precedence as
   `monogram_uploaded_svg ?? monogram_custom_svg`, so there is never a second
   monogram, only one active mark.

   • SVG upload → sanitizeBespokeSvg() (the bespoke allowlist: no
     scripts/handlers/foreignObject/href/data:). Rejected (not repaired) → error.
   • Raster (PNG/JPG/WEBP) → sharp downscale to a 512px transparent webp, wrapped
     in `<svg><image href="data:image/webp;base64,…"/></svg>`. Machine-built from
     sharp output (trusted), inert (it renders via a data-URI <img> everywhere). */
const MAX_MONOGRAM_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB raw file cap
const ACCEPTED_MONOGRAM_TYPES = new Set([
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
]);
// Final stored markup cap — a 512px webp base64 is comfortably under this; the
// SVG path already self-caps at 400 KB inside sanitizeBespokeSvg.
const MAX_STORED_MARK_BYTES = 380_000;

export async function uploadMonogram(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/dashboard/${eventId}/monogram?upload=empty`);
  }
  if (file.size > MAX_MONOGRAM_UPLOAD_BYTES) {
    redirect(`/dashboard/${eventId}/monogram?upload=too_big`);
  }
  const type = file.type || '';
  if (!ACCEPTED_MONOGRAM_TYPES.has(type)) {
    redirect(`/dashboard/${eventId}/monogram?upload=bad_type`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let markSvg: string | null = null;
  if (type === 'image/svg+xml') {
    markSvg = sanitizeBespokeSvg(await file.text());
    if (!markSvg) redirect(`/dashboard/${eventId}/monogram?upload=bad_svg`);
  } else {
    let webp: Buffer;
    try {
      webp = await sharp(Buffer.from(await file.arrayBuffer()))
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      redirect(`/dashboard/${eventId}/monogram?upload=bad_image`);
    }
    markSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
      `<image width="512" height="512" href="data:image/webp;base64,${webp.toString('base64')}"/></svg>`;
  }

  if (!markSvg || markSvg.length > MAX_STORED_MARK_BYTES) {
    redirect(`/dashboard/${eventId}/monogram?upload=too_big`);
  }

  const { error } = await supabase
    .from('events')
    .update({ monogram_uploaded_svg: markSvg })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  redirect(`/dashboard/${eventId}/monogram?upload=ok`);
}

export async function removeUploadedMonogram(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Clearing the upload falls back to the bespoke/cipher mark, then the lettered
  // lockup — one active mark, never a duplicate.
  const { error } = await supabase
    .from('events')
    .update({ monogram_uploaded_svg: null })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  redirect(`/dashboard/${eventId}/monogram?upload=removed`);
}
