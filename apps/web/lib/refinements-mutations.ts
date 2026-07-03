/**
 * refinements-mutations.ts — the shared, redirect-free core behind editing the
 * onboarding "what kind of X?" refinements (`onboarding_refinements` +
 * `onboarding_refinement_options`). Extracted so BOTH callers run the exact same
 * validation + write path instead of forking it:
 *
 *   • the Taxonomy Studio inspector's Refinements tab (JSON-returning actions +
 *     redirect-back CRUD forms in app/admin/taxonomy/actions.ts), and
 *   • (historically) the legacy /admin/refinements editor — now retired to a
 *     redirect, but the core stays reusable.
 *
 * Nothing here imports Next (no redirect / revalidate) or checks auth — the
 * caller owns the admin gate + the revalidate/redirect. Each function takes an
 * already-constructed admin Supabase client and returns a plain
 * `{ ok } | { error }` so the caller can turn it into a redirect OR a JSON
 * result. Photo values are validated against VALID_PHOTO (a /public path or an
 * r2:// ref) so a tampered POST can't inject a `url(…)` background into the
 * anonymous onboarding render; an invalid value degrades to null (emoji
 * fallback), never a broken url.
 *
 * IMMUTABLE-KEY LOCK: leaf_key + (leaf_key, option_key) are the couple-pick keys
 * stored in events.style_preferences.refinements — these functions NEVER rename
 * or regenerate a key. Label / description / photo / status / sort_order only.
 * addOption is the only insert, and its option_key === label is the seeded
 * non-projectable convention (projectable leaves are blocked upstream).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type MutationResult = { ok: true } | { ok: false; error: string };

/** Projectable leaves whose option KEYS feed projectRefinementsToPrefs (the
 *  cuisine_ / pv_ / ceremony_ keys). New options can't be added through the UI —
 *  a label-derived key would silently fail the projection — so addOption rejects
 *  them (review 2026-06-09). Kept in sync with the /admin/refinements set. */
export const PROJECTABLE_LEAVES = new Set(['ceremony', 'catering', 'photo_video']);

/** A photo must be a /public image path or an r2:// ref — never arbitrary text. */
export const VALID_PHOTO = /^(\/[\w./-]+\.(?:webp|jpe?g|png)|r2:\/\/[\w./-]+)$/i;

function trimStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Keep a freshly-uploaded r2:// ref if present + valid, else fall back to the
 *  carried current value (a /public path or older r2:// ref). Both validated; an
 *  invalid value drops to null so the render falls back to the emoji. */
export function resolvePhoto(uploaded: unknown, current: unknown): string | null {
  const u = typeof uploaded === 'string' && uploaded.startsWith('r2://') ? uploaded : '';
  if (u && VALID_PHOTO.test(u)) return u;
  const c = trimStr(current);
  return c && VALID_PHOTO.test(c) ? c : null;
}

/** Update a leaf's label / description / status / main photo. Keys untouched. */
export async function updateLeafCore(
  admin: SupabaseClient,
  leafKey: string,
  input: { label: string; description: string; mainPhotoUploaded: unknown; mainPhotoCurrent: unknown; retired: boolean },
): Promise<MutationResult> {
  const label = trimStr(input.label);
  if (!label) return { ok: false, error: 'Label is required.' };
  const { error } = await admin
    .from('onboarding_refinements')
    .update({
      label_en: label,
      description_en: trimStr(input.description),
      main_photo: resolvePhoto(input.mainPhotoUploaded, input.mainPhotoCurrent),
      status: input.retired ? 'retired' : 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('leaf_key', leafKey);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Update an existing option's emoji / label / status / photo. Keys untouched. */
export async function updateOptionCore(
  admin: SupabaseClient,
  leafKey: string,
  optionKey: string,
  input: { emoji: string; label: string; photoUploaded: unknown; photoCurrent: unknown; retired: boolean },
): Promise<MutationResult> {
  const label = trimStr(input.label);
  if (!label) return { ok: false, error: 'Option label is required.' };
  const { error } = await admin
    .from('onboarding_refinement_options')
    .update({
      emoji: trimStr(input.emoji) || null,
      label_en: label,
      photo: resolvePhoto(input.photoUploaded, input.photoCurrent),
      status: input.retired ? 'retired' : 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('leaf_key', leafKey)
    .eq('option_key', optionKey);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Add a new option to a leaf. option_key === label (the non-projectable
 * convention). PROJECTABLE leaves are refused (their keys drive vendor
 * matching). A photo is REQUIRED on every new option (owner-ratified 2026-06-10:
 * every new refinement carries a photo) — a missing / invalid upload is
 * rejected. Existing options are untouched by this rule.
 */
export async function addOptionCore(
  admin: SupabaseClient,
  leafKey: string,
  input: { emoji: string; label: string; photoUploaded: unknown },
): Promise<MutationResult> {
  if (PROJECTABLE_LEAVES.has(leafKey)) {
    return {
      ok: false,
      error:
        'This service’s options are reserved (they drive vendor matching) and can’t be added here — edit the existing ones instead.',
    };
  }
  const label = trimStr(input.label);
  if (!label) return { ok: false, error: 'New option needs a label.' };
  const photo = resolvePhoto(input.photoUploaded, null);
  if (!photo) return { ok: false, error: 'Every new option needs a photo — upload one before adding.' };

  const optionKey = label; // matches the seeded non-projectable key===label convention
  const { data: rows } = await admin
    .from('onboarding_refinement_options')
    .select('sort_order')
    .eq('leaf_key', leafKey)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextSort = ((rows?.[0]?.sort_order as number | undefined) ?? -1) + 1;
  const { error } = await admin.from('onboarding_refinement_options').insert({
    leaf_key: leafKey,
    option_key: optionKey,
    emoji: trimStr(input.emoji) || null,
    label_en: label,
    photo,
    sort_order: nextSort,
    status: 'active',
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes('duplicate')
        ? `An option named “${label}” already exists here.`
        : error.message,
    };
  }
  return { ok: true };
}

/** Permanently remove an option. Blocked on projectable leaves upstream. */
export async function removeOptionCore(
  admin: SupabaseClient,
  leafKey: string,
  optionKey: string,
): Promise<MutationResult> {
  if (PROJECTABLE_LEAVES.has(leafKey)) {
    return { ok: false, error: 'Reserved options can’t be removed — they drive vendor matching.' };
  }
  const { error } = await admin
    .from('onboarding_refinement_options')
    .delete()
    .eq('leaf_key', leafKey)
    .eq('option_key', optionKey);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
