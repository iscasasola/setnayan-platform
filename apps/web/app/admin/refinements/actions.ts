'use server';

/**
 * Admin server actions for the onboarding refinements editor (owner 2026-06-09).
 * Writes `onboarding_refinements` + `onboarding_refinement_options` (migration
 * 20260927000000). Defense-in-depth admin gate (the /admin layout already 404s
 * non-admins; RLS `is_admin()` also gates the write). Photos: a field carries
 * its CURRENT raw value (`*_current`, a /public path or r2:// ref) + an optional
 * fresh `<FileUpload>` r2:// ref — we keep the current unless a new one uploaded,
 * so an unchanged save never wipes a seeded photo. getOnboardingRefinements
 * resolves r2:// refs to display URLs at render.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BASE = '/admin/refinements';

/** Projectable leaves whose option KEYS feed projectRefinementsToPrefs (the cuisine_ /
 *  pv_ / ceremony_ keys). New options can't be added through the UI — a label-derived key
 *  would silently fail the projection — so addOption rejects them (review 2026-06-09). */
const PROJECTABLE_LEAVES = new Set(['ceremony', 'catering', 'photo_video']);

/** A photo must be a /public image path or an r2:// ref — never arbitrary text. Blocks
 *  CSS-injection via the carried-current value, which renders as a `url(…)` background on
 *  the anonymous onboarding (review 2026-06-09). */
const VALID_PHOTO = /^(\/[\w./-]+\.(?:webp|jpe?g|png)|r2:\/\/[\w./-]+)$/i;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return user;
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}
/** Keep a freshly-uploaded r2:// ref, else fall back to the carried current value
 *  (a /public path or an older r2:// ref). Both are VALIDATED so a tampered POST can't
 *  inject CSS into the onboarding render; an invalid value drops to null (emoji fallback). */
function resolvePhoto(uploaded: FormDataEntryValue | null, current: FormDataEntryValue | null): string | null {
  const u = typeof uploaded === 'string' && uploaded.startsWith('r2://') ? uploaded : '';
  if (u && VALID_PHOTO.test(u)) return u;
  const c = str(current);
  return c && VALID_PHOTO.test(c) ? c : null;
}
function done(msg: string) {
  redirect(`${BASE}?saved=${encodeURIComponent(msg)}`);
}
function fail(msg: string) {
  redirect(`${BASE}?error=${encodeURIComponent(msg)}`);
}

/** Update a leaf's label / description / status / main photo. */
export async function updateLeaf(leafKey: string, formData: FormData) {
  await requireAdmin();
  const label = str(formData.get('label_en'));
  if (!label) return fail('Label is required.');
  const admin = createAdminClient();
  const { error } = await admin
    .from('onboarding_refinements')
    .update({
      label_en: label,
      description_en: str(formData.get('description_en')),
      main_photo: resolvePhoto(formData.get('main_photo_url'), formData.get('main_photo_current')),
      status: formData.get('status') === 'retired' ? 'retired' : 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('leaf_key', leafKey);
  if (error) return fail(error.message);
  revalidatePath(BASE);
  revalidatePath('/onboarding/wedding');
  done(`Saved “${label}”.`);
}

/** Update an existing option's emoji / label / status / photo. */
export async function updateOption(leafKey: string, optionKey: string, formData: FormData) {
  await requireAdmin();
  const label = str(formData.get('label_en'));
  if (!label) return fail('Option label is required.');
  const admin = createAdminClient();
  const { error } = await admin
    .from('onboarding_refinement_options')
    .update({
      emoji: str(formData.get('emoji')) || null,
      label_en: label,
      photo: resolvePhoto(formData.get('photo_url'), formData.get('photo_current')),
      status: formData.get('status') === 'retired' ? 'retired' : 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('leaf_key', leafKey)
    .eq('option_key', optionKey);
  if (error) return fail(error.message);
  revalidatePath(BASE);
  revalidatePath('/onboarding/wedding');
  done(`Saved option “${label}”.`);
}

/** Add a new option to a leaf. option_key === label (the non-projectable convention). */
export async function addOption(leafKey: string, formData: FormData) {
  await requireAdmin();
  if (PROJECTABLE_LEAVES.has(leafKey)) {
    return fail('This service’s options are reserved (they drive vendor matching) and can’t be added here — edit the existing ones instead.');
  }
  const label = str(formData.get('label_en'));
  if (!label) return fail('New option needs a label.');
  const optionKey = label; // matches the seeded non-projectable key===label convention
  const admin = createAdminClient();
  // place new option last
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
    emoji: str(formData.get('emoji')) || null,
    label_en: label,
    photo: resolvePhoto(formData.get('photo_url'), null),
    sort_order: nextSort,
    status: 'active',
  });
  if (error) {
    return fail(error.message.includes('duplicate') ? `An option named “${label}” already exists here.` : error.message);
  }
  revalidatePath(BASE);
  revalidatePath('/onboarding/wedding');
  done(`Added “${label}”.`);
}

/** Permanently remove an option. */
export async function removeOption(leafKey: string, optionKey: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from('onboarding_refinement_options')
    .delete()
    .eq('leaf_key', leafKey)
    .eq('option_key', optionKey);
  if (error) return fail(error.message);
  revalidatePath(BASE);
  revalidatePath('/onboarding/wedding');
  done('Option removed.');
}
