#!/usr/bin/env node
/**
 * lint-vendor-profiles-column-grants.mjs
 *
 * Every column added to `public.vendor_profiles` AFTER migration
 * 20271217955839 must carry its own `GRANT SELECT (col) ... TO authenticated`,
 * AND its migration must rebuild `public.vendor_profiles_self`.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * 20271217955839 took table-level SELECT off `authenticated` and re-granted a
 * computed COLUMN ALLOWLIST, because RLS filters rows and can never hide a
 * column — every signed-in account could otherwise read every verified shop's
 * BIR tax identity, DTI/SEC registration number and owner's legal name.
 *
 * The cost of that shape, stated plainly: a column added afterwards is born
 * UNREADABLE to every signed-in caller, and PostgREST refuses the WHOLE query
 * that names it rather than blanking the one field. `public.events` is already
 * in this shape, and it cost that table a real month-long outage
 * (`site_art_direction`) plus a near-miss (`recur_cadence`).
 *
 * ── 🚨 THE DB TESTS STRUCTURALLY CANNOT CATCH THIS ──────────────────────────
 * Same reason as `lint-events-column-grants.mjs`, which this guard is modelled
 * on: the allowlist is COMPUTED from information_schema at apply time, and the
 * PGlite replay applies in FILENAME order. Replaying recomputes the allowlist
 * over whatever columns exist at that moment — including a brand-new one — so
 * the column looks granted in the test and holds nothing in production.
 *
 * This guard reads the MIGRATION TEXT, which no harness can re-derive, so it
 * cannot be fooled the same way.
 *
 * ── NO PREFIX CUTOFF, DELIBERATELY ──────────────────────────────────────────
 * Prefix order is NOT apply order — prod pushes with `--include-all`, so a file
 * dated below the lockdown can apply above it. Keying on where a file SORTS is
 * exactly the hole that let `events.site_art_direction` through. EVERY migration
 * is read, at any prefix; a column is acceptable only if it (a) carries its own
 * grant, (b) is in DENIED_IDENTITY_COLUMNS, or (c) is GRANDFATHERED.
 *
 * ⚠ It judges only what it can be sure of: an `ADD COLUMN` (or a `CREATE TABLE`
 * column) on `public.vendor_profiles`. A guard that cries wolf teaches you to
 * skim past the one time it is right.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DIR = join(ROOT, 'supabase', 'migrations');

/** The migration that revoked table-level SELECT and introduced the allowlist. */
const LOCKDOWN = '20271217955839';

/**
 * The eleven identity columns 20271217955839 deliberately withholds from
 * `authenticated`. Each is read by the shop itself through
 * `public.vendor_profiles_self`, and by admins through the service-role client.
 *
 * ⚠ ADDING A NAME HERE IS A DECISION that no signed-in person may read that
 * column off the table — only ever with a reason, and only alongside the
 * migration that revokes it.
 */
const DENIED_IDENTITY_COLUMNS = new Set([
  'tin_number',
  'tin_type',
  'registered_business_name',
  'registered_address',
  'registered_zip',
  'bir_service_category',
  'registration_number_raw',
  'registration_number_normalized',
  'registration_number_submitted_at',
  'registration_number_needs_review',
  'business_owner_name',
]);

/**
 * Columns that already existed when the lockdown landed.
 *
 * GENERATED, never hand-typed: every `CREATE TABLE` column and every
 * `ADD COLUMN` clause naming `public.vendor_profiles` across all migrations at
 * that commit.
 *
 * 🔑 CROSS-CHECKED AGAINST PRODUCTION, not merely produced. The generator found
 * 106 names; `information_schema.columns` in prod reports 106 for this table,
 * and the two sets are IDENTICAL in both directions — zero names the scanner
 * invented, zero it could not see. That is what makes grandfathering these
 * honest rather than a way of going green: they are the columns that exist, all
 * of them, and the lockdown's own computed re-GRANT covers every one.
 *
 * ⚠ DO NOT ADD TO THIS SET. A new name here is a column somebody decided a
 * signed-in person may not read, without saying so. Grant it, or put it in
 * DENIED_IDENTITY_COLUMNS with a reason.
 */
const GRANDFATHERED = new Set([
  'absorbs_convenience_fee',
  'ai_addon_expires_at',
  'ai_addon_level',
  'ai_addon_trial_used_at',
  'bir_service_category',
  'booth_addon_expires_at',
  'booth_addon_trial_used_at',
  'business_name',
  'business_owner_name',
  'business_owner_position',
  'business_slug',
  'capacity_max',
  'capacity_min',
  'compatible_ceremony_types',
  'compatible_venue_settings',
  'contact_email',
  'contact_phone',
  'created_at',
  'created_by_admin_user_id',
  'demo_batch_id',
  'demotion_count',
  'event_types',
  'experience_verified_at',
  'experience_verified_by',
  'extra_agent_seats',
  'fraud_banned_at',
  'fraud_suspended_at',
  'fraud_tombstoned',
  'gallery_video_links',
  'hq_address',
  'hq_country',
  'hq_latitude',
  'hq_longitude',
  'hq_region',
  'in_business_since_date',
  'in_business_since_year',
  'inner_radius_km',
  'is_demo',
  'is_founder',
  'is_published',
  'is_supplier_vendor',
  'last_demoted_at',
  'last_verified_at',
  'location_city',
  'logo_url',
  'max_soft_holds_per_date',
  'max_waitlist_acceptances',
  'microsite_about',
  'microsite_accent',
  'microsite_featured_editorial_ids',
  'microsite_featured_service_ids',
  'microsite_hero_photo_key',
  'microsite_pinned_review_id',
  'microsite_sections',
  'microsite_video_ids',
  'name_revealed_at',
  'next_renewal_due_at',
  'outer_radius_km',
  'papic_challenge_expires_at',
  'pending_tier',
  'pending_tier_billing_cycle',
  'pending_tier_period_days',
  'pending_tier_purchase_id',
  'pending_tier_scheduled_at',
  'pending_tier_sku_code',
  'portfolio_r2_keys',
  'presentation_pattern',
  'public_id',
  'public_visibility',
  'real_name_unlocked_at',
  'registered_address',
  'registered_business_name',
  'registered_zip',
  'registration_number_needs_review',
  'registration_number_normalized',
  'registration_number_raw',
  'registration_number_submitted_at',
  'same_day_available',
  'screen_name',
  'screen_name_id',
  'screen_name_slug',
  'screen_name_taxonomy',
  'services',
  'show_team_bookings_in_backend_count',
  'social_feature_opt_out',
  'social_featured_at',
  'social_post_url',
  'subscription_credit_php',
  'supplier_categories',
  'tagline',
  'tier_billing_cycle',
  'tier_expires_at',
  'tier_source',
  'tier_state',
  'tin_number',
  'tin_type',
  'updated_at',
  'user_id',
  'vendor_profile_id',
  'venue_length_m',
  'venue_type',
  'venue_width_m',
  'verification_state',
  'waitlist_enabled',
  'website',
  'weddings_done_approx',
]);

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

/** column -> the migration that added it */
const added = new Map();
const granted = new Set();
/** Migrations that rebuild the vendor_profiles_self projection. */
const rebuildsSelfView = new Set();

for (const f of files) {
  const sql = readFileSync(join(DIR, f), 'utf8');
  // Strip line comments — including TRAILING ones — so prose about a column is
  // not read as DDL. This is load-bearing for the statement-span scan below:
  // the span ends at the first `;`, so a trailing `-- see foo; bar` would end it
  // EARLY and hide every `ADD COLUMN` after it, silently.
  const code = sql.replace(/--[^\n]*/g, '');

  // EVERY `ADD COLUMN` clause, not just the first. A comma-separated
  // `ALTER TABLE … ADD COLUMN a, ADD COLUMN b;` hid `b` from the events guard
  // for months — 81 columns were invisible there. Two steps: take the whole
  // statement up to its `;`, then read every clause inside it.
  //
  // 🪤 `vendor_profiles\b` is load-bearing and correct: `_` is a word
  // character, so there is no boundary in `vendor_profiles_self` — the view
  // this guard also protects can never be mistaken for the table.
  for (const stmt of code.matchAll(
    /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?vendor_profiles\b([^;]*)/gi,
  )) {
    for (const m of stmt[1].matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
      if (!added.has(m[1])) added.set(m[1], f);
    }
  }

  // The original CREATE TABLE, so the guard is not blind to the founding columns.
  for (const stmt of code.matchAll(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?vendor_profiles\s*\(([\s\S]*?)\n\);/gi,
  )) {
    for (const line of stmt[1].split('\n')) {
      const m = line.match(/^\s*([a-z_][a-z0-9_]*)\s+[A-Za-z]/);
      if (m && !/^(constraint|primary|unique|foreign|check|like|exclude)$/i.test(m[1]) && !added.has(m[1])) {
        added.set(m[1], f);
      }
    }
  }

  for (const m of code.matchAll(
    /GRANT\s+SELECT\s*\(\s*([a-z_][a-z0-9_]*)\s*\)\s+ON\s+(?:TABLE\s+)?(?:public\.)?vendor_profiles\b/gi,
  )) {
    granted.add(m[1]);
  }

  // 🪤 `\b` IS LOAD-BEARING. Without it this matches `vendor_profiles_selfX`,
  // so a mutation renaming the view away leaves the guard GREEN — the same
  // prefix trap as `f.event_dateX`, paid for three times in this repo.
  if (/CREATE\s+VIEW\s+(?:public\.)?vendor_profiles_self\b/i.test(code)) rebuildsSelfView.add(f);
}

// ── ANTI-VACUITY ────────────────────────────────────────────────────────────
// A regex that silently matches nothing reports a clean pass. If the scanner
// cannot see the columns it is meant to police, say so and FAIL.
const problems = [];
if (added.size < GRANDFATHERED.size) {
  problems.push(
    `SCANNER BLIND: found only ${added.size} vendor_profiles columns in the migration tree, ` +
      `fewer than the ${GRANDFATHERED.size} known to exist at the lockdown. ` +
      `The regexes above matched less than they used to — this guard is not measuring anything.`,
  );
}
if (!files.some((f) => f.startsWith(LOCKDOWN))) {
  problems.push(
    `SCANNER BLIND: the lockdown migration ${LOCKDOWN} is not in supabase/migrations. ` +
      `Either it was renamed (update LOCKDOWN) or deleted (restore it) — without it, ` +
      `authenticated holds table-level SELECT and every rule below is moot.`,
  );
}

for (const [col, file] of added) {
  if (GRANDFATHERED.has(col)) continue;
  if (DENIED_IDENTITY_COLUMNS.has(col)) continue;
  if (!granted.has(col)) {
    problems.push(
      `${file}: adds public.vendor_profiles.${col} with no ` +
        `\`GRANT SELECT (${col}) ON public.vendor_profiles TO authenticated\`.\n` +
        `    Since ${LOCKDOWN}, \`authenticated\` holds NO table-level SELECT here, so this column\n` +
        `    is born unreadable and PostgREST will refuse the WHOLE query that names it —\n` +
        `    not blank the field. Fix by adding the grant in that same migration, or, if a\n` +
        `    signed-in person genuinely must never read it, add it to DENIED_IDENTITY_COLUMNS\n` +
        `    in this file WITH A REASON and revoke it there.`,
    );
  }
  if (!rebuildsSelfView.has(file)) {
    problems.push(
      `${file}: adds public.vendor_profiles.${col} without rebuilding ` +
        `public.vendor_profiles_self.\n` +
        `    That view's projection is frozen at CREATE time, so the shop's OWN dashboard\n` +
        `    cannot read the new column — and the reads that go through it swallow their\n` +
        `    errors, so the symptom is a field that is quietly always empty. Add a\n` +
        `    \`DROP VIEW IF EXISTS public.vendor_profiles_self;\` + \`CREATE VIEW …\` to that\n` +
        `    migration (copy the computed block from ${LOCKDOWN}).`,
    );
  }
}

if (problems.length > 0) {
  console.error('lint-vendor-profiles-column-grants: FAIL\n');
  for (const p of problems) console.error('  • ' + p + '\n');
  process.exit(1);
}
console.log(
  `lint-vendor-profiles-column-grants: OK — ${added.size} columns seen, ` +
    `${granted.size} explicitly granted, ${DENIED_IDENTITY_COLUMNS.size} deliberately denied, ` +
    `${rebuildsSelfView.size} migration(s) build vendor_profiles_self.`,
);
