'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RESERVED_SLUGS } from '@/lib/reserved-slugs';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import {
  normalizeReligion,
  normalizeCivilStatus,
  normalizeSex,
  consentPatch,
} from '@/lib/profile-personalization';

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

  // Optional, REFERENCE-ONLY sensitive-PI personalization (date-anchor model,
  // owner 2026-07-12): religion + civil status. Unknown/empty → null (the
  // "prefer not to say" / withdrawal state). Consent is stamped per field on
  // the transition to a value, cleared on withdrawal (RA 10173 §3(l)).
  const religion = normalizeReligion(formData.get('religion'));
  const civil_status = normalizeCivilStatus(formData.get('civil_status'));
  const sex = normalizeSex(formData.get('sex'));

  // RA 10173 durable proof-of-consent (migration 20270705000000). Read the
  // current opt-in state so we only STAMP marketing_consent_at on an actual
  // transition — opting in sets now(), opting out clears it to NULL, and an
  // unrelated profile save while already opted-in leaves the original consent
  // timestamp untouched (unlike updated_at, which every save overwrites).
  const { data: existing } = await supabase
    .from('users')
    .select('marketing_opt_in, religion, civil_status, sex')
    .eq('user_id', user.id)
    .maybeSingle();
  const wasOptedIn = existing?.marketing_opt_in === true;

  const nowIso = new Date().toISOString();
  const marketingConsent: { marketing_consent_at?: string | null } = {};
  if (marketing_opt_in && !wasOptedIn) {
    marketingConsent.marketing_consent_at = nowIso;
  } else if (!marketing_opt_in && wasOptedIn) {
    marketingConsent.marketing_consent_at = null;
  }

  // Per-field sensitive-PI consent transitions (stamp on first value, clear on
  // withdrawal, untouched when unchanged).
  const religionConsent = consentPatch(religion, existing?.religion ?? null, nowIso);
  const civilConsent = consentPatch(civil_status, existing?.civil_status ?? null, nowIso);
  const sexConsent = consentPatch(sex, existing?.sex ?? null, nowIso);

  const { error } = await supabase
    .from('users')
    .update({
      display_name,
      phone,
      profile_photo_url,
      marketing_opt_in,
      ...marketingConsent,
      birth_date,
      public_greeting_opt_in,
      religion,
      ...(religionConsent.consent_at !== undefined
        ? { religion_consent_at: religionConsent.consent_at }
        : {}),
      civil_status,
      ...(civilConsent.consent_at !== undefined
        ? { civil_status_consent_at: civilConsent.consent_at }
        : {}),
      sex,
      ...(sexConsent.consent_at !== undefined
        ? { sex_consent_at: sexConsent.consent_at }
        : {}),
      updated_at: nowIso,
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

// ---------------------------------------------------------------------------
// Social-sharing follow-through #7a — vanity slug editor.
//
// The public account handle at /u/[slug] was auto-backfilled from the real
// display name with NO rename UI (migration 20270424889744). Deriving a public
// identifier from a person's name without giving them control over it is an
// RA-10173 exposure; this action makes the handle user-controllable.
//
// The `users.slug` column mirrors the events.slug contract: 3–32 chars of
// lowercase / digit / hyphen, unique case-insensitively. RLS `user_owns_row`
// (FOR ALL, USING/WITH CHECK user_id = auth.uid()) already permits an account
// to set its OWN slug, so the UPDATE runs under the user's session — no admin
// escalation for the write. The admin client is used only for the
// cross-account uniqueness probe (must see rows the caller's RLS hides) and to
// append the slug_change_log redirect ledger row (admin-write only), matching
// the event-slug rename in app/dashboard/[eventId]/invitation/actions.ts.
// ---------------------------------------------------------------------------

// Durable rename cap: at most this many successful renames per rolling window,
// counted from the slug_change_log ledger (survives serverless cold starts,
// unlike the in-memory lib/rate-limit). A handle is a stable public identifier;
// a few corrections are fine, a churn loop is not.
const SLUG_RENAME_LIMIT = 5;
const SLUG_RENAME_WINDOW_MS = 24 * 60 * 60 * 1000;

const SLUG_PATTERN = /^[a-z0-9-]{3,32}$/;

export async function updateUserSlug(formData: FormData) {
  const requested = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase();

  if (!SLUG_PATTERN.test(requested)) {
    return redirect(
      `/dashboard/profile?slug_error=${encodeURIComponent(
        'Use 3–32 characters: lowercase letters, numbers, and hyphens only.',
      )}#url-slug`,
    );
  }
  if (RESERVED_SLUGS.has(requested)) {
    return redirect(
      `/dashboard/profile?slug_error=${encodeURIComponent(
        'That handle is reserved. Please pick another.',
      )}#url-slug`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  // Read the caller's current slug (via their own session — RLS-scoped).
  const { data: mine } = await supabase
    .from('users')
    .select('slug')
    .eq('user_id', user.id)
    .maybeSingle();
  const currentSlug = (mine?.slug as string | null) ?? null;

  // No-op: same handle (case-insensitive) — nothing to change or log.
  if (currentSlug && currentSlug.toLowerCase() === requested) {
    return redirect('/dashboard/profile?slug_saved=1#url-slug');
  }

  // Durable rename rate-limit from the ledger.
  const windowStart = new Date(Date.now() - SLUG_RENAME_WINDOW_MS).toISOString();
  const { count: recentRenames } = await admin
    .from('slug_change_log')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', 'user')
    .eq('entity_id', user.id)
    .gte('changed_at', windowStart);
  if ((recentRenames ?? 0) >= SLUG_RENAME_LIMIT) {
    return redirect(
      `/dashboard/profile?slug_error=${encodeURIComponent(
        'You’ve changed your handle a few times today. Please try again tomorrow.',
      )}#url-slug`,
    );
  }

  // Case-insensitive uniqueness across ALL accounts (admin client so the probe
  // sees rows the caller's RLS would hide).
  const { data: clash } = await admin
    .from('users')
    .select('user_id')
    .ilike('slug', requested)
    .neq('user_id', user.id)
    .maybeSingle();
  if (clash) {
    return redirect(
      `/dashboard/profile?slug_error=${encodeURIComponent(
        'That handle is already taken. Please pick another.',
      )}#url-slug`,
    );
  }

  // Self-set under the user's own session (RLS user_owns_row permits it).
  const { error: updateErr } = await supabase
    .from('users')
    .update({ slug: requested, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);
  if (updateErr) {
    // A concurrent claimant can still lose the unique-index race (23505) —
    // surface it as "taken" rather than a raw constraint error.
    if (updateErr.code === '23505') {
      return redirect(
        `/dashboard/profile?slug_error=${encodeURIComponent(
          'That handle was just taken. Please pick another.',
        )}#url-slug`,
      );
    }
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Update account slug',
      file_path: 'app/dashboard/(account)/profile/actions.ts',
      error_message: updateErr.message,
      payload_snapshot: { userId: user.id },
    });
    return redirect(
      `/dashboard/profile?slug_error=${encodeURIComponent(updateErr.message)}#url-slug`,
    );
  }

  // Append the 90-day redirect ledger row so the old handle keeps resolving
  // (entity_type 'user' is permitted by migration 20270424889744). Best-effort:
  // a ledger hiccup must not fail an already-committed rename.
  if (currentSlug) {
    await admin.from('slug_change_log').insert({
      entity_type: 'user',
      entity_id: user.id,
      old_slug: currentSlug,
      new_slug: requested,
      changed_by: user.id,
    });
  }

  revalidatePath('/dashboard', 'layout');
  redirect('/dashboard/profile?slug_saved=1#url-slug');
}

// Social-sharing follow-through #7b — per-account public-profile toggle.
// DORMANT by default (`public_profile_enabled` DEFAULT FALSE): the owner opts
// IN to a shareable/indexable /u/[slug] showcase. Distinct from per-event
// `landing_page_visibility` (the /u page still only ever lists public events);
// this governs whether the /u shell itself is reachable by strangers at all.
export async function updatePublicProfileEnabled(formData: FormData) {
  const raw = formData.get('public_profile_enabled');
  if (raw !== 'true' && raw !== 'false') {
    throw new Error('Invalid public-profile preference');
  }
  const enabled = raw === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('users')
    .update({ public_profile_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard', 'layout');
  revalidatePath('/u', 'layout');
  redirect('/dashboard/profile?public_profile_saved=1#url-slug');
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
