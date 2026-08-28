#!/usr/bin/env node
/**
 * lint-events-column-grants.mjs
 *
 * Every column added to `public.events` AFTER the lockdown must carry its own
 * `GRANT SELECT (col)` — and, if the app writes it, `GRANT UPDATE (col)`.
 *
 * ── WHY A SOURCE-LEVEL GUARD, WHEN THREE DB TESTS ALREADY "COVER" THIS ──────
 * 🚨 THOSE THREE TRIPWIRES CANNOT FIRE FOR A NEW COLUMN, AND IT IS NOT A BUG IN
 * THEM. `public.events` REVOKES table-level SELECT and re-grants a COLUMN
 * ALLOWLIST computed from `information_schema` at apply time (20271007100000 /
 * 20271025120000). The PGlite replay harness then runs a blanket
 * `GRANT ALL ON ALL TABLES` to emulate Supabase defaults, so the coverage tests
 * RE-APPLY the lockdown migration in `before()` to get back to the real shape —
 * a deliberate, mutation-checked decision documented in
 * `events-private-details.db.test.ts`.
 *
 * But re-applying RECOMPUTES the allowlist over every column present at that
 * moment, **including the brand-new one**. So the column looks granted in the
 * test and holds nothing in production. Measured 2026-08-15: adding a fresh
 * column to `events` in a rolled-back transaction against prod returned
 * **0 UPDATE grants and 0 SELECT grants** for `authenticated`, while the db
 * suite stayed green.
 *
 * That gap shipped a real defect in this very change — `recur_cadence` was
 * granted UPDATE/INSERT and not SELECT, which would have blanked **every**
 * signed-in person's Year view, and it was the adversarial review that caught
 * it, not CI. This guard reads the MIGRATION TEXT, which no harness can
 * re-derive, so it cannot be fooled the same way.
 *
 * ⚠ It judges only what it can be sure of: an `ADD COLUMN` on `public.events`.
 * A guard that cries wolf teaches you to skim past the one time it is right.
 *
 * ── 🚨 THE PREFIX CUTOFF WAS THE HOLE — REMOVED 2026-08-29 ──────────────────
 * This guard used to examine only migrations whose PREFIX sorts above the
 * lockdown (`f.slice(0,14) > LOCKDOWN`). **Prefix order is not apply order.**
 * `20271003190000_events_site_art_direction.sql` carries a prefix six days
 * BELOW the lockdown and was committed 5h47m AFTER it; production applies such
 * files with `db push --include-all`, so the column landed after the allow-list
 * had been computed and was born unreadable. The guard could not see the file
 * at all, and `site_art_direction` was refused to every signed-in person for
 * over a month — bouncing the couple out of their own website editor.
 *
 * So the cutoff is gone. EVERY migration is read, at any prefix, and a column
 * is acceptable only if it (a) carries its own grant, (b) is deny-listed, or
 * (c) is in GRANDFATHERED below. A future out-of-order file adds a column name
 * that is in none of the three, so it fails wherever its prefix sorts.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DIR = join(ROOT, 'supabase', 'migrations');

/** The migration that revoked table-level SELECT and introduced the allowlist. */
const LOCKDOWN = '20271007100000';

/** Columns added after the lockdown that legitimately hold NO grant. Each line
 *  is a decision that the app cannot read or write that column through a user
 *  session — add one only with a reason. */
const NO_GRANT_NEEDED = new Set([
  // ── ⚖ DELIBERATE: named in a lockdown deny-set, withheld on purpose ───────
  // The event master QR token and the two Google Drive OAuth token columns.
  // 20271007100000 names all three and explains each. Read only through the
  // admin client (verified 2026-08-29: app/api/crew/register-device/route.ts
  // resolves `supabase` from createAdminClient() on line 150, NOT the session
  // client declared on line 120 — a scan that reads the nearest identifier
  // backwards calls that a defect and is wrong).
  'master_qr_token',
  'photo_delivery_oauth_token_encrypted',
  'photo_delivery_oauth_expires_at',

  // ── ⚖ DELIBERATE: guest-lock deny-sets (20271008731642, 20271025120000) ───
  // Private details kept off the guest surface. Each is read through the admin
  // client or via events_host.
  'partner_a_birth_date',
  'partner_a_birth_time',
  'partner_b_birth_date',
  'partner_b_birth_time',
  'bazi_birthdata_consent_at',
  'estimated_budget_centavos',
  'budget_band',
  'wizard_state',
  'photo_delivery_folder_id',
  'photo_delivery_folder_name',
  'photo_delivery_account_email',
  'setnayan_ai_tier_at_purchase',
  'signature_details',
  'honoree_label',
  'honoree_dependent_id',

  // ── ✅ THE 2026-08-15 BILL IS PAID — every line below was CHECKED ──────────
  // That list said: "Whether each is a live defect depends on whether its
  // feature reads it through the cookie-scoped client or only through
  // service_role — that is six separate investigations… **Each line is a
  // promise that somebody will check it.**"
  //
  // Checked 2026-08-29, by resolving the client at every `.from('events')`
  // select naming each column across app/ and lib/ (21 such reads; 17 admin):
  //
  //   date_forced_by_lock_of           → LIVE DEFECT. Fixed — granted.
  //   papic_guest_capture_early        → LIVE DEFECT. Fixed — granted.
  //   kwento_flash_auto_wall           → admin-only (live/page.tsx:123,
  //                                      live/actions.ts:85, papic/kwento:134)
  //   last_kwento_notify_at            → admin-only (papic/kwento:165,215)
  //   panood_manual_on_air_at          → admin-only (panood/control:537,
  //                                      control/actions.ts:835,854)
  //   papic_vendor_challenges_enabled  → no user-session reader at all
  //   setnayan_ai_tier_at_purchase     → deny-listed above; admin-only
  //
  // The four below are omissions rather than decisions — nothing denied them,
  // they simply never carried a grant — but every reader is the admin client,
  // so granting them would widen a read that nothing needs. Left withheld ON
  // PURPOSE, which is a decision now and not a debt.
  'kwento_flash_auto_wall',
  'last_kwento_notify_at',
  'panood_manual_on_air_at',
  'papic_vendor_challenges_enabled',

  // ⚠ HAS ITS GRANT, BUT IS ABSENT FROM events_host — verified in production
  // (auth SELECT = 1, in_host_view = 0). Nothing has rebuilt the view since it
  // was added, so any code reading it through the host view gets a phantom
  // column. Whether that is live depends on whether anything reads it that way;
  // that is its own investigation, not this change's. Listed so a NEW column
  // cannot hide behind it.
  'face_tagging_declined_by_couple',
]);

/**
 * Columns that already existed when the prefix cutoff was removed (2026-08-29).
 *
 * GENERATED, never hand-typed: every `ADD COLUMN` on `public.events` across all
 * migrations at that commit, minus the three this change grants. They are
 * grandfathered because re-litigating 120 historical columns is not this
 * guard's job — its job is that the NEXT one cannot go missing.
 *
 * 🔑 A NEW COLUMN CANNOT HIDE HERE. This is a set of NAMES, so a future
 * migration adding a column at ANY prefix — above the lockdown or below it —
 * introduces a name absent from this set, absent from NO_GRANT_NEEDED, and
 * therefore checked. That is the whole point of replacing the prefix cutoff:
 * the old rule keyed on where a file SORTS, this one keys on whether a column
 * is NEW.
 *
 * ⚠ DO NOT ADD TO THIS SET. A new name here is a column somebody decided a
 * signed-in person may not read, without saying so — put it in NO_GRANT_NEEDED
 * with a reason, or grant it.
 */
const GRANDFATHERED = new Set([
  'anchor_kind',
  'attire_guide_palette',
  'auspicious_reasons',
  'auto_seat_last_used_at',
  'bride_name',
  'budget_band',
  'celebrant_shape',
  'ceremony_type',
  'ceremony_type_locked_at',
  'ceremony_type_locked_by',
  'cleared_at',
  'community_id',
  'concierge_status',
  'concierge_trial_used_at',
  'concierge_unlock_source',
  'concierge_unlock_via_vendor_profile_id',
  'date_mode',
  'date_status',
  'dress_code_config',
  'estimated_budget_centavos',
  'estimated_pax',
  'event_date_precision',
  'event_end_date',
  'experience_for_whom',
  'face_tagging_declined_by_couple',
  'final_pax',
  'full_res_drop_warned_at',
  'headcount_basis',
  'honoree_label',
  'is_sample',
  'is_surprise',
  'kwento_flash_auto_wall',
  'kwento_free_grandfathered',
  'landing_page_hero_image_url',
  'landing_page_visibility',
  'last_kwento_notify_at',
  'launch_mode',
  'live_media_public',
  'live_studio_guest_pick_enabled',
  'live_studio_roam_manifest',
  'mahr_description',
  'master_qr_token',
  'master_qr_token_rotated_at',
  'monogram_cipher_config',
  'monogram_custom_generation_id',
  'monogram_custom_svg',
  'monogram_frame_key',
  'monogram_motion_key',
  'monogram_studio_config',
  'monogram_style',
  'monogram_text',
  'monogram_uploaded_svg',
  'mood_feel_key',
  'our_photos',
  'pakanta_song_r2_key',
  'panood_manual_on_air_at',
  'panood_roam_manifest',
  'panood_watch_url',
  'panood_watch_url_facebook',
  'papic_cost_cap_php',
  'papic_face_mode',
  'papic_ltd_cap_php',
  'papic_mini_cap_php',
  'papic_pool_token',
  'papic_quality_tier',
  'papic_storage_target',
  'papic_style',
  'papic_uploads_open',
  'papic_vendor_challenges_enabled',
  'papic_window_start',
  'partner_a_birth_date',
  'photo_delivery_provider',
  'photo_delivery_sync_mode',
  'photo_moments_config',
  'photo_wall_photos',
  'planning_mode',
  'pool_gallery_open',
  'recap_social_optout_at',
  'reception_design',
  'recur_cadence',
  'region',
  'roadmap_completed',
  'role_palette',
  'rsvp_backdrop',
  'scheduled_launch_at',
  'sde_video_r2_key',
  'seating_autoplace_enabled',
  'seating_group_adjacency',
  'setnayan_ai_active',
  'setnayan_ai_active_until',
  'setnayan_ai_intro_used',
  'setnayan_ai_tier_at_purchase',
  'share_budget_band',
  'showcase_featured_at',
  'signature_details',
  'site_bg_color',
  'site_bg_music_source',
  'slug',
  'std_background',
  'std_film_accent_hex',
  'std_film_ceremony_name',
  'std_film_date',
  'std_launched_at',
  'std_media',
  'std_media_nsfw',
  'std_reveal_effects',
  'std_reveal_template',
  'std_theme',
  'style_preferences',
  'timezone',
  'tracked_categories',
  'venue_entrance_x',
  'venue_latitude',
  'venue_longitude',
  'venue_name',
  'wall_photo_count',
  'wax_seal_config',
  'website_open_browse',
  'what_to_bring',
  'wizard_state',
]);

// EVERY migration, at any prefix — see "THE PREFIX CUTOFF WAS THE HOLE" above.
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

// column -> the migration that added it
const added = new Map();
const granted = new Set();
/** Migrations that rebuild the events_host projection. */
const rebuildsHostView = new Set();

for (const f of files) {
  const sql = readFileSync(join(DIR, f), 'utf8');
  // Strip line comments so prose about a column is not mistaken for DDL.
  const code = sql.replace(/^\s*--.*$/gm, '');

  for (const m of code.matchAll(
    /ALTER\s+TABLE\s+(?:public\.)?events\s+(?:\s|\n)*ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi,
  )) {
    if (!added.has(m[1])) added.set(m[1], f);
  }
  for (const m of code.matchAll(/GRANT\s+SELECT\s*\(\s*([a-z_][a-z0-9_]*)\s*\)\s+ON\s+(?:public\.)?events/gi)) {
    granted.add(m[1]);
  }
  // The other half of the same obligation — see the HOST VIEW block below.
  // 🪤 `\b` IS LOAD-BEARING. Without it this matched `events_hostX`, so the
  // mutation that renamed the view away left the guard GREEN — the same prefix
  // trap as `f.event_dateX`, hit for the third time in this repo today.
  if (/CREATE\s+VIEW\s+(?:public\.)?events_host\b/i.test(code)) rebuildsHostView.add(f);
  // ── 🚨 THE BLANKET-GRANT CREDIT IS GONE, AND REMOVING IT IS THE WHOLE FIX ──
  // This used to say: a migration that re-grants the WHOLE computed allow-list
  // (`GRANT SELECT (%s) ON public.events`) covers every column added before it,
  // so `for (const [col] of added) granted.add(col)`.
  //
  // That is true only in FILENAME order — which is the replay's order, and NOT
  // production's. `20271003190000_events_site_art_direction.sql` sorts below the
  // lock-down and applied ABOVE it, so the credit excused a column the lock-down
  // could not possibly have granted.
  //
  // 🪤 MEASURED, NOT REASONED: with the credit still in place, deleting the real
  // `GRANT SELECT (site_art_direction)` from this change's migration (occurrence
  // count 1 → 0) left this guard GREEN — decoration for its own headline case,
  // in the very commit written to fix it. Caught by mutating it.
  //
  // History no longer needs the credit: GRANDFATHERED excuses every column that
  // already existed, as a set of NAMES, which no ordering can distort. So every
  // NEW column must carry its own explicit `GRANT SELECT (col)`, wherever its
  // file sorts.
}

const missing = [...added.entries()].filter(
  ([col]) => !granted.has(col) && !NO_GRANT_NEEDED.has(col) && !GRANDFATHERED.has(col),
);

/**
 * ── THE HOST VIEW IS THE OTHER HALF, AND IT IS THE HALF THAT 500s A PAGE ────
 * `public.events_host` is a VIEW with an EXPLICIT column projection, not
 * `SELECT *`. A column added to the base table is a PHANTOM COLUMN on the view,
 * and `/dashboard/[eventId]/details` throws on a query error — so the whole
 * Personalization surface dies for every host, on every event type.
 *
 * 🪤 THE FIRST CUT OF THIS GUARD CHECKED ONLY THE GRANT. Deleting the view
 * rebuild while keeping the grant left the lint GREEN, 53 unit tests green, and
 * the exposure baseline untouched (it holds one whole-view fact, no per-column
 * facts) — while the page was dead. The guard's own error text said "rebuild
 * public.events_host", which is **a sentence, not a mechanism**. This is that
 * mechanism.
 *
 * A migration that adds a column must rebuild the view IN THE SAME FILE, because
 * the projection is computed from the grants as they stand when it runs.
 */
// ⚠ A LATER MIGRATION THAT REBUILDS THE VIEW ALSO COVERS THE COLUMN — the
// projection is recomputed over everything that exists at that moment. The
// first cut demanded the rebuild in the SAME file and cried wolf on
// `std_media_nsfw`, which prod confirms IS in the view (a later rebuild picked
// it up). Verified before loosening: `std_media_nsfw` in_host_view=1,
// `face_tagging_declined_by_couple` in_host_view=0.
//
// ⚠ AND THIS HALF STILL REASONS IN FILENAME ORDER — named, not fixed. `r >= f`
// asks whether a rebuild file SORTS after the adding file, which is the exact
// assumption the SELECT-grant half above was just stripped of: a rebuild that
// sorts later may have APPLIED earlier, and then it never saw the column. It is
// not biting today — the three columns this change grants are absent from
// events_host (verified in production) and nothing reads them through that view;
// every reader uses `.from('events')` directly. Fixing it properly needs the
// same treatment (a grandfathered set of names), and that is its own change with
// its own measurement, not a rider on this one.
const rebuildAfter = [...rebuildsHostView].sort();
const missingRebuild = [...added.entries()].filter(
  ([col, f]) => !NO_GRANT_NEEDED.has(col) && !rebuildAfter.some((r) => r >= f),
);

if (missing.length === 0 && missingRebuild.length === 0) {
  console.log(
    `✓ every events column carries its SELECT grant and its events_host rebuild — every migration read, at any prefix (${added.size} checked, ${GRANDFATHERED.size} grandfathered)`,
  );
  process.exit(0);
}

if (missing.length > 0) {
  console.error(
    `✗ ${missing.length} column(s) added to public.events with NO \`GRANT SELECT (col)\`.\n` +
      '  events revokes table-level SELECT and re-grants a per-column allowlist, so an\n' +
      '  ungranted column is unreadable through a user session — PostgREST refuses the\n' +
      '  WHOLE query and the surface reading it goes silently empty. The db coverage\n' +
      '  tests CANNOT catch this: their before() re-applies the lockdown, which\n' +
      '  recomputes the allowlist over the new column.\n',
  );
  for (const [col, f] of missing) console.error(`  ${col.padEnd(34)} added in ${f}`);
  console.error('');
}

if (missingRebuild.length > 0) {
  console.error(
    `✗ ${missingRebuild.length} column(s) added to public.events WITHOUT rebuilding public.events_host.\n` +
      '  That view has an EXPLICIT column projection, so the new column is a phantom\n' +
      '  column on it — and /dashboard/[eventId]/details THROWS on a query error, which\n' +
      '  kills Personalization for every host on every event type.\n' +
      '  Add the DROP VIEW + CREATE VIEW block (copy it from 20271025120000) to the SAME\n' +
      '  migration, AFTER the GRANT — the projection is computed from the grants.\n',
  );
  for (const [col, f] of missingRebuild) console.error(`  ${col.padEnd(34)} added in ${f}`);
}
process.exit(1);
