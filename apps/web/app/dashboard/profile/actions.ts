'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 2026-05-22 brand pivot (CLAUDE.md decision-log). 5-theme list retired —
// replaced with 3-mode (Light · Dark · Auto). Owner directive: "make our
// default color be like facebook white and blue. and remove the personalization
// of colors. It will be light, dark, auto. just like ios". The Postgres ENUM
// `theme_preference` is migrated to the 3 new values via
// `supabase/migrations/20260606000000_users_theme_preference_three_mode.sql` —
// legacy rows remap to 'light' (setnayan_default / victorian / classy /
// forest_champagne) or 'auto' (ios). See CLAUDE.md row for full rationale.
const VALID_THEMES = ['light', 'dark', 'auto'] as const;
type ThemePreference = (typeof VALID_THEMES)[number];

function isValidTheme(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (VALID_THEMES as readonly string[]).includes(value);
}

const VALID_PLANNER_MODES = ['guided', 'diy'] as const;
type PlannerMode = (typeof VALID_PLANNER_MODES)[number];

function isValidPlannerMode(value: unknown): value is PlannerMode {
  return typeof value === 'string' && (VALID_PLANNER_MODES as readonly string[]).includes(value);
}

// Iteration 0025 — runtime EN/TL toggle. 'ceb' stays in the DB enum for a
// future Cebuano dictionary; the UI only exposes EN/TL today.
const VALID_LOCALES = ['en', 'tl'] as const;
type LocalePref = (typeof VALID_LOCALES)[number];

function isValidLocale(value: unknown): value is LocalePref {
  return typeof value === 'string' && (VALID_LOCALES as readonly string[]).includes(value);
}

export async function updateThemePreference(formData: FormData) {
  const raw = formData.get('theme');
  if (!isValidTheme(raw)) {
    throw new Error('Invalid theme');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('users')
    .update({ theme_preference: raw, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard', 'layout');
}

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export async function updatePersonalInfo(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const displayNameRaw = formData.get('display_name');
  const phoneRaw = formData.get('phone');
  const photoRaw = formData.get('profile_photo_url');
  const marketingRaw = formData.get('marketing_opt_in');

  const display_name =
    typeof displayNameRaw === 'string' ? displayNameRaw.trim().slice(0, 128) || null : null;
  const phone =
    typeof phoneRaw === 'string' ? phoneRaw.trim().slice(0, 32) || null : null;
  const profile_photo_url = nullIfBlank(photoRaw);
  const marketing_opt_in = marketingRaw === 'on';

  const { error } = await supabase
    .from('users')
    .update({
      display_name,
      phone,
      profile_photo_url,
      marketing_opt_in,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  if (error) {
    return redirect(`/dashboard/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/dashboard', 'layout');
  redirect('/dashboard/profile?saved=1');
}

/**
 * Soft-delete the current account (RA 10173 §16 right-to-erasure, V1 slice).
 * Sets users.deleted_at, signs the user out. Internal admins can un-delete
 * via Supabase dashboard until the admin console gains the action.
 */
export async function softDeleteAccount(formData: FormData) {
  const confirm = formData.get('confirm');
  if (typeof confirm !== 'string' || confirm !== 'DELETE') {
    return redirect('/dashboard/profile?error=Type+DELETE+to+confirm');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Use admin client so the update bypasses any user-row RLS edge cases.
  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) {
    return redirect(`/dashboard/profile?error=${encodeURIComponent(error.message)}`);
  }

  // Best-effort sign-out — sessions may still be valid until expiry, but the
  // layout gate (added in this iteration) rejects deleted accounts on every
  // request regardless of cookie state.
  await supabase.auth.signOut();
  redirect('/login?error=Account+deleted');
}

export async function changePassword(formData: FormData) {
  const newPassword = formData.get('new_password');
  const confirmPassword = formData.get('confirm_password');

  if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
    return redirect(
      `/dashboard/profile?error=${encodeURIComponent('Invalid input')}`,
    );
  }
  if (newPassword.length < 8) {
    return redirect(
      `/dashboard/profile?error=${encodeURIComponent('Password must be at least 8 characters')}`,
    );
  }
  if (newPassword !== confirmPassword) {
    return redirect(
      `/dashboard/profile?error=${encodeURIComponent('Passwords do not match')}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // supabase.auth.updateUser works for the signed-in user to set their own
  // password — no admin client needed, the session token authorizes the call.
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return redirect(
      `/dashboard/profile?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/dashboard/profile');
  redirect('/dashboard/profile?password_changed=1');
}

export async function updateLocalePreference(formData: FormData) {
  const raw = formData.get('locale');
  if (!isValidLocale(raw)) {
    throw new Error('Invalid locale');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('users')
    .update({ locale: raw, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard', 'layout');
}

export async function updatePlannerMode(formData: FormData) {
  const raw = formData.get('planner_mode');
  if (!isValidPlannerMode(raw)) {
    throw new Error('Invalid planner mode');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('users')
    .update({ planner_mode: raw, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard', 'layout');
}
