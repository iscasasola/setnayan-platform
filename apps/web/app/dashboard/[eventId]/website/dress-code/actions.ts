'use server';

/**
 * Server action for the dress-code editor (CLAUDE.md 2026-05-22).
 *
 * Reads the host's form submission, validates it against the same shape the
 * landing-page renderer expects (`apps/web/app/[slug]/page.tsx` DressCodeWidget),
 * stamps `events.dress_code_config`, and revalidates both the dashboard hub +
 * the public slug URL so the change shows up on the guest-facing page without
 * waiting for a redeploy.
 *
 * Validation lives server-side here (NOT just client-side) because the form
 * fields are simple HTML inputs — anyone POSTing a longer-than-80-char title
 * or a 100-item dos[] would otherwise blow the JSONB column up. Limits match
 * the migration comment in 20260605030000_events_dress_code_config.sql.
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// Hard caps — keep in sync with the migration comment AND the editor UI hints.
const TITLE_MAX = 80;
const DESCRIPTION_MAX = 600;
const LIST_ITEM_MAX = 80;
const LIST_LENGTH_MAX = 8;
const PALETTE_LENGTH_MAX = 6;
const SWATCH_NAME_MAX = 32;
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export type DressCodeConfig = {
  title: string;
  description: string;
  dos: string[];
  donts: string[];
  palette: { name: string; hex: string }[];
};

/**
 * Coerce a FormData value to a string + trim. Empty string is the
 * canonical "absent" — the landing-page renderer's empty-state branch
 * triggers when every field is empty/zero-length.
 */
function asString(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Read repeated form fields (e.g. `dos[]`) into a string array,
 * dropping blanks and clamping each entry's length + the list length.
 *
 * The editor renders N rows for dos / donts / palette and submits the
 * values via repeated form fields. This helper survives both arrays
 * (`getAll('dos')`) and missing-entirely (returns empty array).
 */
function readList(formData: FormData, name: string, maxItem: number, maxLen: number): string[] {
  return formData
    .getAll(name)
    .map((v) => (typeof v === 'string' ? v.trim().slice(0, maxItem) : ''))
    .filter((s) => s.length > 0)
    .slice(0, maxLen);
}

/**
 * Update the host's dress-code config. Auth + RLS enforce that only event
 * members (couple / host moderators) can write — the server action runs
 * with the host's JWT, not the admin client.
 *
 * Errors redirect back to the editor with `?error=...`; success redirects
 * back with `?saved=1` so the page can show a polite confirmation chip.
 */
export async function updateDressCode(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // ----- Parse + validate ------------------------------------------------
  const title = asString(formData.get('title')).slice(0, TITLE_MAX);
  const description = asString(formData.get('description')).slice(0, DESCRIPTION_MAX);
  const dos = readList(formData, 'dos', LIST_ITEM_MAX, LIST_LENGTH_MAX);
  const donts = readList(formData, 'donts', LIST_ITEM_MAX, LIST_LENGTH_MAX);

  // Palette comes in as two parallel arrays — palette_name[] and palette_hex[]
  // submitted by the editor's dynamic swatch rows. Zip them, drop empty pairs,
  // reject malformed hex (the rest of the row would still save).
  const paletteNames = formData
    .getAll('palette_name')
    .map((v) => (typeof v === 'string' ? v.trim().slice(0, SWATCH_NAME_MAX) : ''));
  const paletteHexes = formData
    .getAll('palette_hex')
    .map((v) => (typeof v === 'string' ? v.trim() : ''));

  const palette: { name: string; hex: string }[] = [];
  for (let i = 0; i < Math.min(paletteNames.length, paletteHexes.length); i += 1) {
    const name = paletteNames[i] ?? '';
    const hex = paletteHexes[i] ?? '';
    if (!name && !hex) continue; // empty row — skip
    if (!HEX_PATTERN.test(hex)) {
      redirect(
        `/dashboard/${eventId}/website/dress-code?error=${encodeURIComponent(`Palette swatch ${i + 1}: hex must look like #RRGGBB.`)}`,
      );
    }
    palette.push({ name: name || hex.toUpperCase(), hex: hex.toUpperCase() });
    if (palette.length >= PALETTE_LENGTH_MAX) break;
  }

  const config: DressCodeConfig = {
    title,
    description,
    dos,
    donts,
    palette,
  };

  // ----- Persist ----------------------------------------------------------
  const supabase = await createClient();
  const { error } = await supabase
    .from('events')
    .update({
      dress_code_config: config,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);

  if (error) {
    redirect(
      `/dashboard/${eventId}/website/dress-code?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Revalidate the dashboard hub so its preview iframe + the public slug
  // page both reflect the new dress code on the next render.
  revalidatePath(`/dashboard/${eventId}/website`);
  revalidatePath(`/dashboard/${eventId}/website/dress-code`);

  // Pull the slug so we can revalidate the public landing page too.
  const { data: event } = await supabase
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (event?.slug) {
    revalidatePath(`/${event.slug}`);
  }

  redirect(`/dashboard/${eventId}/website/dress-code?saved=1`);
}
