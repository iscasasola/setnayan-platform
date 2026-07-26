/**
 * Static auditor for the events column-privilege migration
 * (supabase/migrations/20271005100000_events_column_update_privileges.sql).
 *
 * WHY THIS EXISTS
 * `couple_can_update_event` is a ROW-level UPDATE grant, and the Supabase anon
 * key is public — so before that migration an authenticated host could PATCH ANY
 * column of their own events row straight through PostgREST, bypassing every
 * server action. The migration revokes table-level UPDATE/INSERT from
 * authenticated + anon and grants back everything EXCEPT a deny-set.
 *
 * Two independent guards protect that migration, because each catches a
 * different failure:
 *
 *   1. THIS module + its unit test — a build-time check on the migration TEXT.
 *      Catches a column being quietly dropped from the deny-set in review, and
 *      catches the deny-set and the migration's own post-condition list drifting
 *      apart (a column removed from the ARRAY but left in the assert list would
 *      make the migration fail at apply time; the reverse — left in the ARRAY
 *      but dropped from the asserts — would silently stop being verified).
 *
 *   2. tests/db/events-column-privileges.db.test.ts — the REAL enforcement
 *      proof. Replays every migration into PGlite, does `SET ROLE authenticated`,
 *      and shows the UPDATE actually raises 42501. Text auditing alone cannot
 *      prove a GRANT works.
 *
 * ⚠ A test that talks to Postgres as the table OWNER silently bypasses both RLS
 * and column grants and will pass vacuously. The db test therefore asserts
 * `current_user = 'authenticated'` before it asserts anything else, and proves
 * the identical statement SUCCEEDS as service_role — so a passing "denied" case
 * can never be a broken statement rather than an enforced grant.
 */

/**
 * The columns withheld from `authenticated` + `anon`.
 *
 * INCLUSION RULE — a column belongs here only if BOTH hold:
 *   (a) no authenticated-client write path in apps/web touches it (verified by
 *       extracting every `.from('events').update|insert|upsert(` call site and
 *       resolving its Supabase client), AND
 *   (b) a concrete exploit exists for a forged value.
 *
 * Sensitive columns that ARE legitimately host-written (estimated_pax,
 * master_qr_token, panood_watch_url, std_media, std_background, our_photos,
 * monogram_custom_svg, site_bg_music_r2_key, …) are deliberately absent — a
 * grant cannot close those without breaking the product, and they need their own
 * fixes. See the PR body.
 */
export const LOCKED_COLUMNS: readonly string[] = [
  // paid entitlement / paywall
  'kwento_free_grandfathered',
  'setnayan_ai_active',
  'setnayan_ai_active_until',
  'setnayan_ai_intro_used',
  // money integrity
  'papic_cost_cap_php',
  'papic_ltd_cap_php',
  'papic_unli_cap_php',
  'papic_mini_cap_php',
  'adaptive_pricing_mode',
  'guest_count_locked_at',
  'final_pax',
  'cleared_at',
  'cleared_by_user_id',
  // trust / curation
  'is_sample',
  'showcase_featured_at',
  'showcase_feature_rank',
  // privacy / consent / biometrics
  'papic_face_mode',
  'bazi_birthdata_consent_at',
  'pool_gallery_open',
  'live_media_public',
  // credentials + delivery pipeline
  'photo_delivery_oauth_token_encrypted',
  'photo_delivery_oauth_expires_at',
  'photo_delivery_provider',
  'photo_delivery_folder_id',
  'photo_delivery_folder_name',
  'photo_delivery_account_email',
  'photo_delivery_status',
  'photo_delivery_progress_pct',
  'photo_delivery_started_at',
  'photo_delivery_completed_at',
  'photo_delivery_failed_count',
  'photo_delivery_sync_mode',
  'photos_released_at',
  // non-host-written R2 key columns (lib/uploads.ts presigns keys unchecked)
  'pakanta_song_r2_key',
  'pakanta_song_status',
  'pakanta_song_filename',
  'pakanta_song_delivered_at',
  'pakanta_song_adopted_as_site_music',
  'photo_wall_photos',
  // cross-tenant read expander
  'community_id',
  // live studio
  'live_studio_roam_manifest',
  // identity / system
  'id',
  'event_id',
  'public_id',
  'created_at',
];

/**
 * The highest-impact entries — the ones whose absence would re-open a concrete,
 * named exploit. The unit test asserts each of these individually so a reviewer
 * deleting one gets a failure that names the exploit, not a diff-sized list.
 */
export const CRITICAL_LOCKED: ReadonlyArray<{ column: string; exploit: string }> = [
  {
    column: 'kwento_free_grandfathered',
    exploit:
      'lib/kwento-access.ts returns true and skips the eventSkuActive(KWENTO) check entirely — one boolean grants the paid SKU free',
  },
  {
    column: 'setnayan_ai_active_until',
    exploit:
      'lib/setnayan-ai.ts treats a NULL/unparseable window as a permanent unlock — turns one paid cycle into forever',
  },
  {
    column: 'is_sample',
    exploit:
      'lib/showcase-db.ts admits samples to /realstories bypassing the consent + grace gates, and into the sitemap',
  },
  {
    column: 'papic_face_mode',
    exploit:
      "'mode_a' enables 128-d face embedding for every guest with no per-guest opt-in roster (RA 10173 / DPIA)",
  },
  {
    column: 'live_studio_roam_manifest',
    exploit: 'the Wave 3 hole — free multi-cam publish; only a render-time read gate stood in the way',
  },
  {
    column: 'photo_delivery_oauth_token_encrypted',
    exploit: "a Google Drive OAuth token living on the host's own writable row",
  },
  {
    column: 'community_id',
    exploit:
      'community_member_can_read_events grants FULL-ROW SELECT on events to every member of the pointed-at community',
  },
  {
    column: 'public_id',
    exploit: 'the canonical S89E- identity of the event',
  },
];

/**
 * A slice of columns that MUST remain writable by `authenticated`. These are
 * written by real server actions using the cookie-scoped (authenticated)
 * Supabase client; if the migration's allow-list ever stops covering one, that
 * feature breaks in production.
 */
export const HOST_EDITABLE_SAMPLE: readonly string[] = [
  'display_name',
  'event_date',
  'venue_name',
  'slug',
  'landing_page_visibility',
  'std_launched_at',
  'scheduled_launch_at',
  'std_reveal_template',
  'std_theme',
  'std_media',
  'std_background',
  'site_bg_music_r2_key',
  'landing_page_hero_image_url',
  'monogram_text',
  'monogram_custom_svg',
  'love_story',
  'our_photos',
  'wizard_state',
  'estimated_pax',
  'master_qr_token',
  'panood_watch_url',
  'website_open_browse',
  'role_palette',
  'updated_at',
];

/** Strip `--` line comments so commented-out entries never count as present. */
export function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      let inSingle = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === "'") inSingle = !inSingle;
        if (!inSingle && ch === '-' && line[i + 1] === '-') return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}

/**
 * Extract the deny-set from the migration's `locked_columns TEXT[] := ARRAY[…]`
 * declaration. Returns null when the declaration is absent — which is itself a
 * failure the test asserts on (a migration that no longer declares a deny-set
 * cannot be enforcing one).
 */
export function extractLockedColumns(sql: string): string[] | null {
  const clean = stripSqlComments(sql);
  const start = clean.indexOf('locked_columns');
  if (start === -1) return null;
  const open = clean.indexOf('ARRAY[', start);
  if (open === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = open + 'ARRAY'.length; i < clean.length; i += 1) {
    if (clean[i] === '[') depth += 1;
    else if (clean[i] === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;
  const body = clean.slice(open + 'ARRAY['.length, end);
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
}

/**
 * Extract the column names asserted UN-writable by the migration's own
 * post-condition DO block (the `still-writable:` loop).
 */
export function extractAssertedLockedColumns(sql: string): string[] | null {
  const clean = stripSqlComments(sql);
  const marker = clean.indexOf('still-writable:');
  if (marker === -1) return null;
  // The FOREACH ... IN ARRAY ARRAY[ … ] LOOP that precedes the marker.
  const head = clean.slice(0, marker);
  const open = head.lastIndexOf('ARRAY[');
  if (open === -1) return null;
  const close = clean.indexOf(']', open);
  if (close === -1) return null;
  const body = clean.slice(open + 'ARRAY['.length, close);
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
}

export type PrivilegeAuditFinding = { kind: string; detail: string };

/**
 * Audit the migration text. An empty result means the migration is coherent.
 *
 * Checks, in order of what they catch:
 *   • the table-level REVOKE happens at all (without it, column GRANTs are a
 *     no-op — Postgres cannot subtract a column from a table-level grant, so a
 *     migration that only GRANTs would pass review and enforce nothing);
 *   • both UPDATE and INSERT are constrained (an UPDATE-only fix is defeated by
 *     POSTing a new event with the flag already set);
 *   • service_role / postgres are never revoked;
 *   • the deny-set is not hand-enumerated as an allow-list;
 *   • the ARRAY and the post-condition assert list agree.
 */
export function auditMigrationSql(
  sql: string,
  expectedLocked: readonly string[] = LOCKED_COLUMNS,
): PrivilegeAuditFinding[] {
  const findings: PrivilegeAuditFinding[] = [];
  const clean = stripSqlComments(sql);

  const revoke = /REVOKE\s+UPDATE\s*,\s*INSERT\s+ON\s+public\.events\s+FROM\s+authenticated\s*,\s*anon/i;
  if (!revoke.test(clean)) {
    findings.push({
      kind: 'missing-table-revoke',
      detail:
        'no `REVOKE UPDATE, INSERT ON public.events FROM authenticated, anon` — without it the column GRANTs are inert',
    });
  }

  if (!/GRANT\s+UPDATE\s*\(/i.test(clean)) {
    findings.push({ kind: 'missing-column-grant-update', detail: 'no column-scoped GRANT UPDATE' });
  }
  if (!/GRANT\s+INSERT\s*\(/i.test(clean)) {
    findings.push({
      kind: 'missing-column-grant-insert',
      detail: 'no column-scoped GRANT INSERT — the INSERT self-grant vector stays open',
    });
  }

  if (/REVOKE[^;]*\bFROM\b[^;]*\b(service_role|postgres)\b/i.test(clean)) {
    findings.push({
      kind: 'revokes-privileged-role',
      detail: 'must never revoke from service_role/postgres — the activation + admin paths run there',
    });
  }

  // The allow-list must be computed from the catalog, not typed out.
  if (!/information_schema\.columns/i.test(clean) || !/<>\s*ALL\s*\(\s*locked_columns\s*\)/i.test(clean)) {
    findings.push({
      kind: 'allowlist-not-computed',
      detail:
        'the allow-list must be derived as "all columns MINUS locked_columns" from information_schema, never hand-enumerated',
    });
  }

  const declared = extractLockedColumns(sql);
  if (declared === null) {
    findings.push({ kind: 'no-locked-array', detail: 'could not find the locked_columns ARRAY[…] declaration' });
    return findings;
  }

  for (const col of expectedLocked) {
    if (!declared.includes(col)) {
      findings.push({ kind: 'unlocked-column', detail: `${col} is no longer in locked_columns` });
    }
  }

  const asserted = extractAssertedLockedColumns(sql);
  if (asserted === null) {
    findings.push({
      kind: 'no-postcondition',
      detail: 'the migration has no `still-writable:` post-condition loop — nothing verifies the grant took effect',
    });
  } else {
    for (const col of declared) {
      if (!asserted.includes(col)) {
        findings.push({
          kind: 'unasserted-column',
          detail: `${col} is locked but not covered by the post-condition assert list`,
        });
      }
    }
  }

  return findings;
}
