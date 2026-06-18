'use server';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  cipherFont,
  cipherFontDataUrl,
  sanitizeCipherConfig,
} from '@/lib/cipher-shared';
import { renderCipher, type CipherFontData } from '@/lib/cipher-render';

/**
 * Server actions for the Cipher Monogram editor (Phase 3 of the monogram
 * overhaul · /dashboard/[eventId]/monogram).
 *
 * saveCipherAction — validates the client's editor config
 *   (sanitizeCipherConfig: clamps + mode/kind coherence), re-renders the SVG
 *   SERVER-SIDE from the same prebuilt geometry the preview used (never
 *   trusting client-rendered markup), and writes BOTH
 *   events.monogram_custom_svg (the rendered mark — already consumed by the
 *   landing hero / maker preview) and events.monogram_cipher_config (the
 *   re-editable source). Clears monogram_custom_generation_id so bespoke-
 *   studio provenance never points at a cipher mark.
 * clearCipherAction — removes the cipher design + rendered mark.
 *
 * AuthZ matches the sibling bespoke actions: explicit couple-membership check
 * (events-read alone admits any member type), then RLS-scoped writes.
 * No external APIs, no spend — the whole pipeline is deterministic + local.
 */

const MAX_SVG_BYTES = 400_000;

function backToMaker(eventId: string, params?: Record<string, string>): never {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  redirect(`/dashboard/${eventId}/monogram${qs}#cipher-studio`);
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
  if (!membership) backToMaker(eventId, { cipher_error: 'not-found' });
  return supabase;
}

/** Load a font's prebuilt geometry from the app's own public dir. */
function loadFontData(fontKey: string): CipherFontData | null {
  const font = cipherFont(fontKey);
  if (!font) return null;
  try {
    const rel = cipherFontDataUrl(font); // "/cipher/strokes/x.json"
    const abs = join(process.cwd(), 'public', rel);
    return JSON.parse(readFileSync(abs, 'utf8')) as CipherFontData;
  } catch {
    return null;
  }
}

export async function saveCipherAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get('config') ?? ''));
  } catch {
    backToMaker(eventId, { cipher_error: 'invalid' });
  }
  const config = sanitizeCipherConfig(parsed);
  if (!config) backToMaker(eventId, { cipher_error: 'invalid' });

  const fontData = loadFontData(config.fontKey);
  if (!fontData) backToMaker(eventId, { cipher_error: 'invalid' });

  // Render server-side — the client never supplies markup, only the config.
  const rendered = renderCipher(config, fontData);
  if (!rendered || rendered.svg.length > MAX_SVG_BYTES) {
    backToMaker(eventId, { cipher_error: 'render' });
  }

  const { error } = await supabase
    .from('events')
    .update({
      monogram_custom_svg: rendered.svg,
      monogram_cipher_config: config,
      // A cipher mark is neither a bespoke-studio generation nor a vector-studio
      // composition — drop those pointers so exactly one source owns the mark.
      monogram_custom_generation_id: null,
      monogram_studio_config: null,
    })
    .eq('event_id', eventId);
  if (error) backToMaker(eventId, { cipher_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { cipher: 'saved' });
}

export async function clearCipherAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const { error } = await supabase
    .from('events')
    .update({
      monogram_custom_svg: null,
      monogram_cipher_config: null,
      monogram_custom_generation_id: null,
    })
    .eq('event_id', eventId);
  if (error) backToMaker(eventId, { cipher_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { cipher: 'cleared' });
}
