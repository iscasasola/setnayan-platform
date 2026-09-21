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
 *
 * ⚠ `std_media_nsfw` (SEC-6, migration 20271010090000) is ALSO absent, and that
 * is deliberate rather than an oversight: this list is the deny-set the
 * 20271005100000 baseline subtracts, and that baseline recomputes its allow-list
 * from the LIVE catalog. Adding the verdict column here without re-ordering that
 * migration to land AFTER the SEC-6 one would break every fresh replay (its typo
 * guard RAISEs on a name that does not yet exist at that point in the tree). The
 * verdict is instead locked by its own explicit REVOKE plus
 * `guard_events_std_media_nsfw_trg`, a trigger no GRANT can undo — see
 * tests/db/std-media-nsfw-verdict.db.test.ts, which restores the grant on
 * purpose and proves the write still fails.
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

/**
 * Strip SQL comments so a name that only appears in prose can never read as a
 * real reference. This is the ONE SQL comment stripper shared by every
 * SQL-text-scanning module in this family — events-column-select-privileges.ts,
 * events-private-details.ts, lib/ugat/both-ends.ts (its `sqlWords()`, which
 * decides whether an RPC or table "has a caller"), and the db tests that
 * import them.
 *
 * ── THE BUG THIS REPLACED ────────────────────────────────────────────────────
 * The previous version only blanked `--` line comments; `/* … *​/` block
 * comments passed straight through untouched. `sqlWords()` treats every
 * identifier-shaped word left standing as "this SQL body references that
 * name" — so a function whose ONLY mention of `orphan_fn` sat inside
 * `/* legacy note: used to call orphan_fn() *​/` read as calling it. The
 * both-ends checker's whole job is "does anything on the other side name
 * this?", and a name in a comment answered yes when the true answer was no —
 * exactly the miss that lets a real orphan hide. Reproduced directly against
 * `sqlWords()` before this fix landed; see both-ends.test.ts.
 *
 * ── WHY NOT A SECOND REGEX ───────────────────────────────────────────────────
 * `src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '')` is the
 * well-documented wrong shape (lib/strip-comments.ts's docblock has the full
 * post-mortem for the TS/JS case): it strips block comments FIRST, so a `--`
 * line that happens to contain `/*`-shaped text — this codebase writes
 * `-- apps/web/app/dashboard/[eventId]/date-selection/*` and
 * `-- (apps/web/lib/vendor-autoreply/*)` in real migration headers — opens a
 * "comment" that runs to the next REAL `*​/`, silently eating everything
 * between. Deciding whether `/*` starts a real comment requires knowing
 * whether you are inside a string or a dollar-quoted body first; that is
 * lexing, not matching, so this is a small single-pass scanner instead.
 *
 * Characters are replaced with SPACES (newlines kept as newlines), never
 * deleted, so a caller that ever wants line numbers from the cleaned text
 * gets true ones — same convention as lib/strip-comments.ts.
 *
 * ── WHAT IT HANDLES ──────────────────────────────────────────────────────────
 *   • `--` line comments, ended by a real newline.
 *   • `/* … *​/` block comments — WITH NESTING. Postgres block comments nest
 *     (`/* outer /* inner *​/ still outer *​/` is ONE comment, ending at the
 *     SECOND `*​/` — unlike C), so this tracks a depth counter rather than
 *     jumping to the first `*​/`.
 *   • single-quoted strings, with the SQL `''` escape (`event''s`) — so a
 *     `--`, `/*` or `*​/` sitting inside a string's TEXT is left alone: it
 *     neither starts nor ends a comment. (The migration this module audits
 *     has exactly this case: `events_master_qr_token_key IS 'Prevents a host
 *     from pointing their own event''s master_qr_token …'`.)
 *   • dollar-quoted bodies (`$$ … $$`, `$tag$ … $tag$`) — every `DO $$ … $$`
 *     block and `CREATE FUNCTION … AS $$ … $$` in this repo's migrations is
 *     one. The boundary is found the way Postgres itself finds it: a LITERAL
 *     search for the same tag reappearing — no comment or quote inside is
 *     consulted while looking for it, so one mismatched apostrophe inside a
 *     function body (a comment reading `-- don't do this`, which this
 *     codebase writes constantly) can never desync tracking for the REST OF
 *     THE FILE the way a single running quote-toggle would. A positional
 *     parameter (`$1`, `$2`) is never mistaken for a tag: a real tag's first
 *     character after `$` must be a letter or underscore, never a digit.
 *     Once the span is found, its INTERIOR is recursively run through this
 *     same function — a `--`/`/* *​/` inside a function body is a real
 *     comment for that body's own execution, and a name sitting only inside
 *     one must not count as "referenced" either.
 *
 * ── WHAT IT DELIBERATELY DOES NOT HANDLE, ALL IN THE SAFE DIRECTION ─────────
 * (never eats real code; at worst leaves a comment's text un-blanked, which
 * is the pre-existing miss this file shrinks, not a new one):
 *   • an UNTERMINATED block comment or dollar-quote body is NOT treated as
 *     one — mirrors lib/strip-comments.ts's "never closed ⇒ not a comment".
 *     A migration that actually applied had to parse, so an opener with no
 *     closer in the text handed to this function is a sign of a truncated
 *     input, not a license to blank to EOF.
 *   • Postgres's `E'…'` backslash-escaped strings are scanned as plain
 *     `'…'` strings (only the standard `''` doubling is honoured). A `\'`
 *     inside one would end the string a character early here — which can
 *     only make the safe mistake of scanning the remainder as ordinary code,
 *     never dropping it.
 */
export function stripSqlComments(sql: string): string {
  const len = sql.length;
  const out: string[] = new Array(len);
  let i = 0;
  while (i < len) {
    const ch = sql[i] as string;

    // ── line comment: `--` to the next real newline ──────────────────────
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < len && sql[i] !== '\n') {
        out[i] = ' ';
        i += 1;
      }
      continue;
    }

    // ── block comment: `/* … */`, with Postgres's own nesting rule ────────
    if (ch === '/' && sql[i + 1] === '*') {
      const openAt = i;
      let depth = 1;
      let j = i + 2;
      while (j < len && depth > 0) {
        if (sql[j] === '/' && sql[j + 1] === '*') {
          depth += 1;
          j += 2;
        } else if (sql[j] === '*' && sql[j + 1] === '/') {
          depth -= 1;
          j += 2;
        } else {
          j += 1;
        }
      }
      if (depth === 0) {
        for (let k = openAt; k < j; k += 1) out[k] = sql[k] === '\n' ? '\n' : ' ';
        i = j;
        continue;
      }
      // Never closed at this nesting depth ⇒ not a comment. Treat the `/` as
      // an ordinary character (e.g. `content-type video/*`) rather than
      // blanking to end of file.
      out[i] = ch;
      i += 1;
      continue;
    }

    // ── single-quoted string, with the SQL '' escape ──────────────────────
    if (ch === "'") {
      out[i] = ch;
      i += 1;
      while (i < len) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          out[i] = "'";
          out[i + 1] = "'";
          i += 2;
          continue;
        }
        out[i] = sql[i] as string;
        const closed = sql[i] === "'";
        i += 1;
        if (closed) break;
      }
      continue;
    }

    // ── dollar-quoted body: `$$ … $$` / `$tag$ … $tag$` ────────────────────
    if (ch === '$') {
      const m = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i, i + 66));
      if (m) {
        const tag = m[0];
        const bodyStart = i + tag.length;
        // A literal search — exactly how Postgres itself finds the terminator.
        // Nothing inside is consulted while looking for it.
        const closeAt = sql.indexOf(tag, bodyStart);
        if (closeAt !== -1) {
          for (let k = 0; k < tag.length; k += 1) out[i + k] = tag[k] as string;
          // The interior is real code with its own comments and strings —
          // strip it in a fresh, isolated pass so nothing it contains can
          // desync the scan that resumes after the closing tag.
          const inner = stripSqlComments(sql.slice(bodyStart, closeAt));
          for (let k = 0; k < inner.length; k += 1) out[bodyStart + k] = inner[k] as string;
          // The CLOSING tag is a delimiter, not comment text — write it too,
          // or it silently vanishes (an empty `out` slot joins as '', not a
          // space), corrupting every downstream `indexOf` for the tag.
          for (let k = 0; k < tag.length; k += 1) out[closeAt + k] = tag[k] as string;
          i = closeAt + tag.length;
          continue;
        }
        // No closing tag found ⇒ not a dollar-quote (e.g. a `$1` positional
        // parameter never matches: the char after `$` must be a letter or
        // underscore). Fall through and treat `$` as an ordinary character.
      }
    }

    out[i] = ch;
    i += 1;
  }
  return out.join('');
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
