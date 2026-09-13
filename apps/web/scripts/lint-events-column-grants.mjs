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
 * migrations at that commit. They are grandfathered because re-litigating the
 * historical columns is not this guard's job — its job is that the NEXT one
 * cannot go missing.
 *
 * ── 🚨 IT WAS GENERATED BY THE NARROW REGEX, SO IT WAS SHORT BY 67 NAMES ─────
 * Grown 120 → 182 on 2026-09-09, when the scanner above was widened to see every
 * `ADD COLUMN` clause in a multi-column `ALTER TABLE` instead of only the first.
 * This set was produced by the OLD scanner, so it inherited exactly the same
 * blind spot: 67 historical columns were never enumerated here because they were
 * never seen at all.
 *
 * ⚖ THE 62 ADDED HERE WERE CHECKED ONE BY ONE AGAINST PRODUCTION, NOT ASSUMED —
 * that is the difference between grandfathering and covering something up. Every
 * one of them is READABLE by `authenticated` in prod today (they predate the
 * lockdown, whose blanket re-grant covered them), so none is a latent outage and
 * none belongs in NO_GRANT_NEEDED, which means "deliberately unreadable" and
 * would have been a lie for all 62. The remaining 5 were dropped from the table
 * altogether and sit in DROPPED_SINCE_ADDED below.
 *
 * 🔑 A NEW COLUMN STILL CANNOT HIDE HERE, and widening the scanner made that
 * MORE true, not less: the set grew by names that already existed, while the
 * scanner that feeds it now sees columns it previously could not. Before this
 * change, adding a second column in one statement was an unchecked column.
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
 * with a reason, or grant it. The 2026-09-09 growth was a ONE-TIME COMPLETION of
 * a set that was already meant to contain those names, every one verified in
 * production first; it is not a precedent for adding a name to go green.
 */
const GRANDFATHERED = new Set([
  'adaptive_pricing_mode',
  'anchor_date',
  'anchor_kind',
  'anchor_origin',
  'attire_guide_palette',
  'auspicious_reasons',
  'auto_seat_last_used_at',
  'bride_name',
  'budget_band',
  'celebrant_shape',
  'ceremony_sub_type',
  'ceremony_type',
  'ceremony_type_locked_at',
  'ceremony_type_locked_by',
  'cleared_at',
  'cleared_by_user_id',
  'community_id',
  'concierge_activated_at',
  'concierge_expires_at',
  'concierge_long_engagement_advised_at',
  'concierge_status',
  'concierge_tier',
  'concierge_trial_started_by_user_id',
  'concierge_trial_used_at',
  'concierge_unlock_source',
  'concierge_unlock_via_vendor_profile_id',
  'date_candidates',
  'date_mode',
  'date_status',
  'date_window_end',
  'date_window_start',
  'dress_code_config',
  'estimated_budget_centavos',
  'estimated_pax',
  'event_date_precision',
  'event_end_date',
  'experience_axes',
  'experience_for_whom',
  'experience_persona',
  'face_tagging_declined_by_couple',
  'final_pax',
  'full_res_drop_warned_at',
  'gender_separation',
  'groom_name',
  'guest_count_locked_at',
  'guest_list_edit_deadline',
  'headcount_basis',
  'honoree_label',
  'is_mixed_ceremony',
  'is_sample',
  'is_surprise',
  'kwento_flash_auto_wall',
  'kwento_free_grandfathered',
  'landing_page_hero_image_uploaded_at',
  'landing_page_hero_image_uploaded_by_user_id',
  'landing_page_hero_image_url',
  'landing_page_hero_video_r2_key',
  'landing_page_visibility',
  'last_kwento_notify_at',
  'launch_mode',
  'live_media_public',
  'live_mode_override',
  'live_photo_wall_visibility',
  'live_studio_guest_pick_enabled',
  'live_studio_roam_manifest',
  'love_story',
  'mahr_description',
  'mahr_prompt_deferred',
  'manual_phase',
  'master_qr_token',
  'master_qr_token_rotated_at',
  'monogram_cipher_config',
  'monogram_color',
  'monogram_custom_generation_id',
  'monogram_custom_svg',
  'monogram_font_key',
  'monogram_frame_key',
  'monogram_motion_key',
  'monogram_studio_config',
  'monogram_style',
  'monogram_text',
  'monogram_updated_at',
  'monogram_uploaded_svg',
  'mood_board_updated_at',
  'mood_feel_key',
  'music_playlist_seed',
  'our_photos',
  'pakanta_song_adopted_as_site_music',
  'pakanta_song_delivered_at',
  'pakanta_song_filename',
  'pakanta_song_r2_key',
  'pakanta_song_status',
  'palette_finalized_at',
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
  'papic_unli_cap_php',
  'papic_uploads_open',
  'papic_vendor_challenges_enabled',
  'papic_window_end',
  'papic_window_start',
  'partner_a_birth_date',
  'photo_delivery_completed_at',
  'photo_delivery_failed_count',
  'photo_delivery_progress_pct',
  'photo_delivery_provider',
  'photo_delivery_started_at',
  'photo_delivery_status',
  'photo_delivery_sync_mode',
  'photo_moments_config',
  'photo_wall_photos',
  'photos_released_at',
  'planning_mode',
  'pool_gallery_open',
  'recap_social_optout_at',
  'reception_design',
  'recur_cadence',
  'recurs',
  'region',
  'roadmap_completed',
  'role_palette',
  'rsvp_backdrop',
  'scheduled_launch_at',
  'sde_video_r2_key',
  'seating_autoplace_enabled',
  'seating_group_adjacency',
  'secondary_ceremony_type',
  'setnayan_ai_active',
  'setnayan_ai_active_until',
  'setnayan_ai_intro_used',
  'setnayan_ai_tier_at_purchase',
  'share_budget_band',
  'showcase_feature_rank',
  'showcase_featured_at',
  'signature_details',
  'site_bg_color',
  'site_bg_music_enabled',
  'site_bg_music_r2_key',
  'site_bg_music_source',
  'site_button_color',
  'slug',
  'special_message',
  'std_background',
  'std_film_accent_hex',
  'std_film_ceremony_name',
  'std_film_date',
  'std_film_story',
  'std_film_venue_city',
  'std_film_venue_name',
  'std_invitation_launch_date',
  'std_launched_at',
  'std_media',
  'std_media_nsfw',
  'std_reveal_effects',
  'std_reveal_template',
  'std_theme',
  'style_preferences',
  'timezone',
  'together_since',
  'tracked_categories',
  'venue_address',
  'venue_entrance_x',
  'venue_entrance_y',
  'venue_latitude',
  'venue_longitude',
  'venue_name',
  'venue_setting',
  'wall_photo_count',
  'wall_tile_layout',
  'wax_seal_config',
  'website_open_browse',
  'what_to_bring',
  'wizard_state',
]);

/**
 * Columns that were added by a migration and have SINCE BEEN DROPPED.
 *
 * They are separated from GRANDFATHERED rather than buried in it because the
 * risk they carry is different and worth being able to grep for. The guard reads
 * MIGRATION TEXT, and migrations are never edited, so an `ADD COLUMN` for a
 * long-dead column is still there to be found — but there is no column in
 * production to grant, so demanding a grant would be demanding the impossible.
 *
 * ⚠ THE RESIDUAL RISK, SAID OUT LOUD: if a future migration RE-ADDS one of these
 * names, this set silently excuses it and the new column ships ungranted. That is
 * the one way a genuinely new column can hide here. Verified dropped in production
 * 2026-09-09; if you are re-adding one of these, delete it from this set in the
 * same migration and grant it properly.
 */
const DROPPED_SINCE_ADDED = new Set([
  'editorial_language',
  'editorial_tone',
  'papic_pool_token_rotated_at',
  'sde_poster_r2_key',
  'sde_published_at',
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
  //
  // ⚠ TRAILING comments are stripped too, not just whole-line ones, and that is
  // load-bearing for the statement-span scan below. The span ends at the first
  // `;`, so a trailing `-- see foo; bar` would END IT EARLY and hide every
  // `ADD COLUMN` after it — silently, which is the exact failure this guard
  // exists to prevent. Measured 2026-09-09: 243 spans in the tree, 0 currently
  // truncated that way, so this is closing the hole before it opens rather than
  // fixing a live miss.
  //
  // `[^\n]*` cannot run past the end of its line, so the worst case is losing the
  // remainder of one line that had `--` inside a string literal — never a
  // following statement. ⚠ SQL BLOCK comments (/* … */) are still not handled;
  // that is pre-existing and out of scope here, and no migration in the tree
  // uses one inside an `ALTER TABLE events` statement.
  const code = sql.replace(/--[^\n]*/g, '');

  // ── 🚨 EVERY `ADD COLUMN` CLAUSE, NOT JUST THE FIRST ONE ──────────────────
  // This used to be ONE regex requiring `ADD COLUMN` to follow `ALTER TABLE
  // events` IMMEDIATELY:
  //
  //   /ALTER\s+TABLE\s+(?:public\.)?events\s+(?:\s|\n)*ADD\s+COLUMN\s+…/
  //
  // In a comma-separated statement that captures ONLY THE FIRST COLUMN:
  //
  //   ALTER TABLE public.events
  //     ADD COLUMN IF NOT EXISTS a TEXT,   -- seen
  //     ADD COLUMN IF NOT EXISTS b TEXT;   -- INVISIBLE
  //
  // 🪤 MEASURED, NOT REASONED (2026-09-09, PR #5330): two columns were added in
  // one statement and the SECOND one's `GRANT SELECT` line was deleted — this
  // guard still exited 0. It was decoration for exactly the failure it exists to
  // stop, in the same way the blanket-grant credit below was. That PR worked
  // around it by splitting into one `ALTER TABLE` per column; a workaround that
  // protects one migration and nothing else.
  //
  // Measured blast radius at that commit: the old regex saw 129 columns, this one
  // sees 210 — **81 columns across 37 multi-clause statements were invisible**.
  // Cross-checked against production first: of those that still exist, NONE was
  // accidentally unreadable, so this was a latent trap and not a live outage.
  // That is why the newly-visible historical names could be grandfathered rather
  // than re-litigated — see GRANDFATHERED, which was itself generated with the
  // narrow regex and was therefore short by exactly these names.
  //
  // Two steps, deliberately: take the whole `ALTER TABLE … events …` statement
  // (up to its terminating `;`, or end of file), then read EVERY `ADD COLUMN`
  // clause inside it. `events\b` still refuses `events_host` and `event_vendors`,
  // because `_` is a word character and so there is no boundary there.
  for (const stmt of code.matchAll(/ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?events\b([^;]*)/gi)) {
    for (const m of stmt[1].matchAll(
      /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi,
    )) {
      if (!added.has(m[1])) added.set(m[1], f);
    }
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
  ([col]) =>
    !granted.has(col) &&
    !NO_GRANT_NEEDED.has(col) &&
    !GRANDFATHERED.has(col) &&
    !DROPPED_SINCE_ADDED.has(col),
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
