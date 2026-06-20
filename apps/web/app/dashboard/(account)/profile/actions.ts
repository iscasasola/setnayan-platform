'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { insertFaultLog } from '@/lib/telemetry/fault-log';

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
  const birthDateRaw = formData.get('birth_date');
  const publicGreetingRaw = formData.get('public_greeting_opt_in');

  const display_name =
    typeof displayNameRaw === 'string' ? displayNameRaw.trim().slice(0, 128) || null : null;
  const phone =
    typeof phoneRaw === 'string' ? phoneRaw.trim().slice(0, 32) || null : null;
  const profile_photo_url = nullIfBlank(photoRaw);
  const marketing_opt_in = marketingRaw === 'on';
  // Social Sharing Program (migration 20261203000000): optional birthday +
  // the SEPARATE public-greeting opt-in (Facebook birthday/anniversary posts;
  // email greetings never need it). Empty string → NULL; anything that isn't
  // a clean YYYY-MM-DD is rejected rather than half-saved.
  const birthDateStr = typeof birthDateRaw === 'string' ? birthDateRaw.trim() : '';
  if (birthDateStr && !/^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) {
    return redirect(
      `/dashboard/profile?error=${encodeURIComponent('Birthday must be a valid date (YYYY-MM-DD).')}`,
    );
  }
  const birth_date = birthDateStr || null;
  const public_greeting_opt_in = publicGreetingRaw === 'on';

  const { error } = await supabase
    .from('users')
    .update({
      display_name,
      phone,
      profile_photo_url,
      marketing_opt_in,
      birth_date,
      public_greeting_opt_in,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  if (error) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Save personal info',
      file_path: 'app/dashboard/profile/actions.ts',
      error_message: error.message,
      payload_snapshot: { userId: user.id, marketing_opt_in, hasPhone: phone !== null, hasPhoto: profile_photo_url !== null },
    });
    return redirect(`/dashboard/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/dashboard', 'layout');
  redirect('/dashboard/profile?saved=1');
}

/**
 * File a self-serve account-deletion REQUEST (App Store guideline 5.1.1(v) +
 * Google Play data-deletion requirement — a user must be able to *initiate*
 * deletion from inside the app).
 *
 * Owner-locked design "Request + admin review ≤24h": this does NOT delete the
 * account. It queues a `pending` row in account_deletion_requests; an admin
 * approves (running the existing hard-delete / blacklist logic in
 * app/admin/users/actions.ts) or rejects within 24h. Keeping a human in the
 * loop preserves the business guard on active events / bookings / outstanding
 * balances — the admin sees those before approving.
 *
 * A partial unique index (`...one_pending_per_user_idx`) blocks a second
 * pending request; we surface that as a friendly message rather than a raw
 * constraint error.
 */
export async function requestAccountDeletion(formData: FormData) {
  const confirm = formData.get('confirm');
  if (typeof confirm !== 'string' || confirm !== 'DELETE') {
    return redirect('/dashboard/profile?error=Type+DELETE+to+confirm');
  }

  const reasonRaw = formData.get('reason');
  const reason =
    typeof reasonRaw === 'string' && reasonRaw.trim().length > 0
      ? reasonRaw.trim().slice(0, 1000)
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  // Anon-draft: an anonymous user has no permanent account to delete — filing a
  // deletion request would just add admin-queue noise for a throwaway. To
  // discard an unsecured plan they simply abandon it; route them to secure
  // instead so the deletion flow only ever runs for real accounts.
  if (user.is_anonymous) redirect('/signup?next=%2Fdashboard%2Fprofile');

  // Insert under the user's own session — RLS policy `adr_user_insert_own`
  // enforces user_id = auth.uid(), so the request is provably self-filed.
  const { error } = await supabase.from('account_deletion_requests').insert({
    user_id: user.id,
    reason,
  });

  if (error) {
    // Partial-unique-index violation = a pending request already exists. Treat
    // it as a no-op success so re-submitting just shows the existing pending state.
    if (
      error.code === '23505' ||
      error.message.toLowerCase().includes('duplicate') ||
      error.message.includes('one_pending_per_user')
    ) {
      revalidatePath('/dashboard/profile');
      return redirect('/dashboard/profile?deletion_requested=1#settings');
    }
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Request account deletion',
      file_path: 'app/dashboard/profile/actions.ts',
      error_message: error.message,
      payload_snapshot: { userId: user.id, hasReason: reason !== null },
    });
    return redirect(`/dashboard/profile?error=${encodeURIComponent(error.message)}#settings`);
  }

  revalidatePath('/dashboard/profile');
  redirect('/dashboard/profile?deletion_requested=1#settings');
}

/**
 * Cancel the current user's OWN pending account-deletion request. RLS policy
 * `adr_user_cancel_own` only lets a user move their own still-pending row to
 * status='cancelled', so this is safe under the user's session.
 */
export async function cancelAccountDeletionRequest(formData: FormData) {
  const requestId = formData.get('request_id');
  if (typeof requestId !== 'string' || requestId.length === 0) {
    return redirect('/dashboard/profile?error=Invalid+request#settings');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('account_deletion_requests')
    .update({ status: 'cancelled' })
    .eq('request_id', requestId)
    .eq('user_id', user.id)
    .eq('status', 'pending');

  if (error) {
    return redirect(`/dashboard/profile?error=${encodeURIComponent(error.message)}#settings`);
  }

  revalidatePath('/dashboard/profile');
  redirect('/dashboard/profile?deletion_cancelled=1#settings');
}

// changePassword moved to lib/account-security-actions.ts (2026-06-11
// account-security suite) — now shared by the customer + admin profile at
// /dashboard/profile AND the vendor profile at /vendor-dashboard/profile,
// and hardened to verify the CURRENT password before updating.

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

// Couple-side "Planning reminders" on/off (2026-06-03). Toggles
// users.reminders_enabled, which gates the free recommended-deadline
// reminders on the Home "Upcoming" stream (lib/upcoming-items.ts source
// `recommended_deadline`). Default on; this is the quiet opt-out.
export async function updateRemindersEnabled(formData: FormData) {
  const raw = formData.get('reminders_enabled');
  if (raw !== 'true' && raw !== 'false') {
    throw new Error('Invalid reminders preference');
  }
  const enabled = raw === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('users')
    .update({ reminders_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard', 'layout');
}
