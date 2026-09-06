/**
 * The RA 10173 subject-export projection for `public.vendor_profiles`.
 *
 * ── WHY THIS FILE EXISTS AT ALL ──────────────────────────────────────────────
 * `app/api/profile/export/route.ts` read this table with `.select('*')`.
 * PostgREST expands `*` to EVERY column, and Postgres checks SELECT privilege
 * per column — so a single wildcard read requires the querying role to hold
 * SELECT on all 93 columns of `vendor_profiles`. That one call is what makes
 * COLUMN-LEVEL grants on this table impossible: the set of columns that could
 * be revoked from `authenticated` without breaking a shipped surface is, with
 * the wildcard in place, exactly EMPTY.
 *
 * Naming the columns is therefore not tidiness. It is the prerequisite that
 * lets a later migration revoke `authenticated`'s SELECT on the columns no
 * logged-in reader legitimately needs (measured: a non-owner can currently read
 * any verified vendor's `tin_number`, `registration_number_raw` and
 * `is_founder`). Nothing about the exposure changes here — this file only
 * un-pins the columns so the revoke becomes expressible.
 *
 * ── WHY THE EXPORT READS THIS TABLE PRIVILEGED ───────────────────────────────
 * Column privileges are ROLE-level, not row-level. The moment `SELECT
 * (tin_number)` is revoked from `authenticated`, the vendor cannot read their
 * OWN tin_number either — PostgREST answers 42501 and, because it fails the
 * whole statement rather than one column, the entire `vendor_profile` section
 * of the subject-access file disappears. A data subject losing their own BIR
 * tax identity from their own RA 10173 export is a worse outcome than the leak
 * being fixed. The export therefore issues this one read through the
 * service-role client, filtered on `user_id = auth.uid()` — see the
 * bounded-bypass block at the top of the route, which this read now joins as a
 * third table.
 *
 * ── THE FAILURE MODE THIS FILE IS SHAPED AGAINST ─────────────────────────────
 * UNDER-EXPORT. A wildcard cannot silently omit a column; a hand-written list
 * can, and the omission is invisible — the export still returns 200, still
 * looks complete, and a column added by a future migration simply never reaches
 * the data subject. That is an incomplete legal disclosure, not a lint nit.
 *
 * So the list is not trusted to be right by inspection. `T12` in
 * `lib/export-coverage-guardrail.test.ts` asserts, against the migration-derived
 * schema, that this projection is EXACTLY the table's column set minus
 * `VENDOR_PROFILE_EXPORT_OMITTED`. Add a column to `vendor_profiles` and forget
 * this file and the unit suite goes red, by name, with the missing column
 * printed. Verified by mutation: deleting `tin_number` from the string below
 * fails T12 and nothing else.
 *
 * ⚠ ONE CONSEQUENCE, STATED PLAINLY: because the route now passes a CONSTANT
 * rather than a string literal to `.select()`, `lib/security/select-column-scan`
 * (the phantom-column guard) skips this call site — it only analyses inline
 * literals. That is a net gain, not a loss: the scanner checks "no named column
 * is unknown to the migrations", and T12 checks that PLUS the direction the
 * scanner cannot see ("no known column is missing"). Both run against the same
 * `readSchema()` parser.
 *
 * The migration-derived column set was cross-checked once against production
 * (`information_schema.columns`, project setnayan-prod, 2026-07-27): 93 columns
 * on both sides, identical names. That matters because a migration-derived
 * schema can disagree with prod — see limit 7 in `lib/security/select-column-scan`.
 */

/**
 * Columns deliberately withheld from the subject's own `vendor_profile` export,
 * each with the reason it is withheld.
 *
 * EMPTY ON PURPOSE. This change is a projection rewrite, not a disclosure
 * decision: the payload it produces is byte-for-byte what `select('*')`
 * produced, so that any behaviour change lands in its own reviewable PR rather
 * than riding along inside a refactor. The map exists so that a future decision
 * to withhold a column is RECORDED with a reason and enforced by T12, instead of
 * being made by quietly deleting a name from the list above.
 *
 * Two candidates are already known and are NOT actioned here:
 * `created_by_admin_user_id` and `experience_verified_by` each hold the uid of a
 * SETNAYAN STAFF member, and the route's own `not_included` copy already argues
 * (for `admin_data_access_log`) that naming the admin who acted is a
 * third-party disclosure pending DPO review. Same argument, same table of
 * facts — raised for the owner/DPO rather than decided in a refactor.
 */
export const VENDOR_PROFILE_EXPORT_OMITTED: Record<string, string> = {};

/**
 * The PostgREST select list, alphabetical. This string is the single source of
 * truth: `VENDOR_PROFILE_EXPORT_COLUMNS` below is DERIVED from it, so the list
 * the guardrail checks and the list that goes on the wire cannot drift apart.
 */
export const VENDOR_PROFILE_EXPORT_SELECT =
  'absorbs_convenience_fee, ai_addon_expires_at, ai_addon_level, ai_addon_trial_used_at, ' +
  'bir_service_category, booth_addon_expires_at, booth_addon_trial_used_at, business_name, ' +
  'business_owner_name, business_owner_position, business_slug, capacity_max, capacity_min, ' +
  'compatible_ceremony_types, compatible_venue_settings, contact_email, contact_phone, ' +
  'created_at, created_by_admin_user_id, demo_batch_id, demotion_count, event_types, ' +
  'experience_verified_at, experience_verified_by, extra_agent_seats, fraud_banned_at, ' +
  'fraud_suspended_at, fraud_tombstoned, gallery_video_links, hq_address, hq_country, hq_latitude, ' +
  'hq_longitude, hq_region, in_business_since_date, in_business_since_year, ' +
  'venue_width_m, venue_length_m, ' +
  'inner_radius_km, is_demo, is_founder, is_published, is_supplier_vendor, ' +
  'last_demoted_at, last_verified_at, location_city, logo_url, max_soft_holds_per_date, ' +
  'max_waitlist_acceptances, microsite_about, microsite_accent, ' +
  'microsite_featured_editorial_ids, microsite_featured_service_ids, ' +
  'microsite_hero_photo_key, microsite_pinned_review_id, microsite_sections, ' +
  'microsite_video_ids, name_revealed_at, next_renewal_due_at, outer_radius_km, ' +
  // A scheduled plan change, and money the shop is holding against a future
  // bill. Exported, never withheld: this is the shop's own commercial record —
  // what they are on, what it becomes, and what we still owe them. A
  // subject-access response that omitted a BALANCE WE HOLD would be incomplete
  // in exactly the way that matters.
  // papic_challenge_expires_at — the Papic Challenges 28-day window (owner
  // 2026-08-28). A paid entitlement the subject holds, so it belongs in their
  // own export for the same reason the AI and booth windows above do.
  'papic_challenge_expires_at, pending_tier, pending_tier_billing_cycle, ' +
  'pending_tier_period_days, ' +
  'pending_tier_purchase_id, pending_tier_scheduled_at, pending_tier_sku_code, ' +
  'portfolio_r2_keys, presentation_pattern, public_id, public_visibility, ' +
  'real_name_unlocked_at, registered_address, registered_business_name, registered_zip, ' +
  'registration_number_needs_review, registration_number_normalized, ' +
  'registration_number_raw, registration_number_submitted_at, same_day_available, ' +
  'screen_name, screen_name_id, screen_name_slug, screen_name_taxonomy, services, ' +
  'show_team_bookings_in_backend_count, social_feature_opt_out, social_featured_at, ' +
  'social_post_url, subscription_credit_php, supplier_categories, tagline, ' +
  'tier_billing_cycle, tier_expires_at, ' +
  // tier_source (migration 20271209332066) — HOW the subject reached their
  // tier ('admin_comp' vs the future 'self_serve'). Exported alongside
  // tier_state/tier_expires_at for the same reason: it is a fact about their
  // own account, not internal-only bookkeeping.
  'tier_source, ' +
  'tier_state, tin_number, tin_type, updated_at, user_id, vendor_profile_id, venue_type, ' +
  'verification_state, waitlist_enabled, website, weddings_done_approx';

/** Derived — never hand-maintained. See the note on the string above. */
export const VENDOR_PROFILE_EXPORT_COLUMNS: readonly string[] = VENDOR_PROFILE_EXPORT_SELECT.split(
  ',',
)
  .map((c) => c.trim())
  .filter((c) => c.length > 0);
