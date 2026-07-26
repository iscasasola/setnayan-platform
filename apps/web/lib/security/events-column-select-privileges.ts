/**
 * Static auditor for the events column-SELECT migration
 * (supabase/migrations/20271007100000_events_column_select_privileges.sql).
 *
 * WHY THIS EXISTS — SEC-2
 * `public.current_event_ids()` has no member_type filter, so `event_member_can_read`
 * (`FOR SELECT TO authenticated USING (event_id IN current_event_ids())`) admits a
 * plain wedding GUEST as a full event member. RLS is ROW-level, so that policy hands
 * the guest the ENTIRE events row — including `master_qr_token` (the crew-pairing
 * credential) and the Google Drive OAuth token. Migration 20270920030000 re-scoped
 * this pattern on seven other tables but deliberately left the events row on it.
 *
 * The fix is a column privilege rather than a policy re-scope for two reasons:
 *   • a guest legitimately reads ~18 columns of this row through the authenticated
 *     client (lib/events.ts fetchUserEvents' PostgREST embed + the account
 *     switcher), and a row policy cannot say "fewer columns";
 *   • a column privilege is checked before and independently of EVERY policy, so
 *     one REVOKE closes the tokens against all three SELECT policies on the table
 *     (member / moderator / community), every future policy, every PostgREST embed,
 *     `select=*`, and the WHERE/ORDER-BY blind-search oracles.
 *
 * Two independent guards protect the migration, because each catches a different
 * failure:
 *
 *   1. THIS module + its unit test — a build-time check on the migration TEXT.
 *      Catches a column quietly dropped from the deny-set in review, and catches
 *      the deny-set and the migration's own post-condition list drifting apart.
 *
 *   2. tests/db/events-guest-read-scope.db.test.ts — the REAL enforcement proof.
 *      Replays every migration into PGlite, seeds a genuine `member_type='guest'`
 *      row, does `SET ROLE authenticated`, and shows the SELECT raises 42501.
 *      Text auditing alone cannot prove a GRANT works.
 *
 * ⚠ A test that talks to Postgres as the table OWNER silently bypasses both RLS
 * and column grants and will pass vacuously — this repo has been bitten by that
 * twice. The db test therefore asserts `current_user = 'authenticated'` (and that
 * the role has no BYPASSRLS and does not own the table) before it asserts anything
 * else, and proves the identical statement SUCCEEDS as service_role.
 *
 * Sibling: events-column-privileges.ts covers the WRITE half (PR #3715). The two
 * deny-sets are deliberately different — see NOT_DENIED_FOR_SELECT below.
 */

import { stripSqlComments } from './events-column-privileges';

export const SELECT_MIGRATION_FILE = '20271007100000_events_column_select_privileges.sql';

/**
 * The columns withheld from `authenticated` + `anon` at SELECT time.
 *
 * INCLUSION RULE — a column belongs here only if BOTH hold:
 *   (a) it is a credential (something an attacker can USE, not merely learn), AND
 *   (b) no authenticated-client READ path in apps/web selects it — verified by
 *       extracting every `.from('events')` call site and resolving its Supabase
 *       client to service-role vs cookie-scoped.
 *
 * `master_qr_token` qualified only after its single authenticated reader
 * (app/dashboard/[eventId]/event-qr/page.tsx) was moved to the service-role client
 * in the same commit as the migration.
 */
export const LOCKED_SELECT_COLUMNS: readonly string[] = [
  'master_qr_token',
  'photo_delivery_oauth_token_encrypted',
  'photo_delivery_oauth_expires_at',
];

/**
 * Each denied column with the concrete capability a leak hands the attacker. The
 * unit test asserts these individually so a reviewer deleting one gets a failure
 * that names the exploit, not a diff-sized list.
 */
export const CRITICAL_LOCKED_SELECT: ReadonlyArray<{ column: string; exploit: string }> = [
  {
    column: 'master_qr_token',
    exploit:
      'the crew-pairing credential — /api/crew/register-device resolves an event BY this value, so a guest holding it can pair rogue capture devices and burn the host 5-device-per-vendor cap',
  },
  {
    column: 'photo_delivery_oauth_token_encrypted',
    exploit:
      "the couple's Google Drive OAuth token — write-denied since 20271005100000, but a guest could still read it straight off the event row",
  },
];

/**
 * Sensitive columns that are DELIBERATELY still guest-readable, because the couple
 * reads them with the authenticated client and a role-level grant cannot tell a
 * couple from a guest (both are the `authenticated` role). Closing these needs the
 * ROW-level follow-up (re-scope event_member_can_read + a narrow guest surface).
 *
 * The unit test asserts none of these ever lands in the SELECT deny-set — adding
 * one here would break a real host surface in production, silently, for everyone.
 */
export const NOT_DENIED_FOR_SELECT: ReadonlyArray<{ column: string; reader: string }> = [
  { column: 'partner_a_birth_date', reader: 'app/dashboard/[eventId]/details/page.tsx:68' },
  { column: 'partner_a_birth_time', reader: 'app/dashboard/[eventId]/details/page.tsx:68' },
  { column: 'partner_b_birth_date', reader: 'app/dashboard/[eventId]/details/page.tsx:68' },
  { column: 'partner_b_birth_time', reader: 'app/dashboard/[eventId]/details/page.tsx:69' },
  { column: 'bazi_birthdata_consent_at', reader: 'app/dashboard/[eventId]/details/page.tsx:69' },
  { column: 'estimated_budget_centavos', reader: 'app/dashboard/[eventId]/checklist-actions.ts:200' },
  { column: 'wizard_state', reader: 'app/dashboard/[eventId]/wizard-actions.ts:235' },
  { column: 'photo_delivery_folder_id', reader: 'app/dashboard/[eventId]/studio/photo-delivery/page.tsx:58' },
  { column: 'photo_delivery_account_email', reader: 'app/dashboard/[eventId]/studio/photo-delivery/page.tsx:58' },
];

/**
 * The columns a plain GUEST legitimately reads through the authenticated client.
 * Union of the PostgREST embed in lib/events.ts `fetchUserEvents` (called without a
 * member_type filter by app/dashboard/(account)/library/_data/editorials.ts) and the
 * slice in app/_components/account-switcher/get-switcher-data.ts.
 *
 * If the migration's allow-list ever stops covering one of these, the guest's event
 * switcher and library go blank — the exact "do not break the guest experience"
 * regression this fix must not cause.
 */
export const GUEST_READABLE_SAMPLE: readonly string[] = [
  'event_id',
  'public_id',
  'event_type',
  'display_name',
  'event_date',
  'is_primary',
  'archived',
  'venue_name',
  'venue_address',
  'monogram_text',
  'monogram_color',
  'monogram_frame_key',
  'monogram_font_key',
  'monogram_style',
  'monogram_custom_svg',
  'monogram_uploaded_svg',
  'concierge_status',
  'slug',
];

/**
 * Extract the deny-set from the migration's `locked_select_columns TEXT[] := ARRAY[…]`
 * declaration. Returns null when the declaration is absent — itself a failure the
 * test asserts on (a migration that no longer declares a deny-set cannot enforce one).
 */
export function extractLockedSelectColumns(sql: string): string[] | null {
  const clean = stripSqlComments(sql);
  const start = clean.indexOf('locked_select_columns');
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
  return [...clean.slice(open + 'ARRAY['.length, end).matchAll(/'([^']+)'/g)].map(
    (m) => m[1] as string,
  );
}

/**
 * Extract the column names the migration's own post-condition DO block asserts
 * UN-readable (the `still-readable:` loop).
 */
export function extractAssertedDeniedColumns(sql: string): string[] | null {
  const clean = stripSqlComments(sql);
  const marker = clean.indexOf('still-readable:');
  if (marker === -1) return null;
  const head = clean.slice(0, marker);
  const open = head.lastIndexOf('ARRAY[');
  if (open === -1) return null;
  const close = clean.indexOf(']', open);
  if (close === -1) return null;
  return [...clean.slice(open + 'ARRAY['.length, close).matchAll(/'([^']+)'/g)].map(
    (m) => m[1] as string,
  );
}

/** Extract the columns asserted still-readable by a named post-condition loop. */
export function extractAssertedReadableColumns(sql: string, marker: string): string[] | null {
  const clean = stripSqlComments(sql);
  const idx = clean.indexOf(marker);
  if (idx === -1) return null;
  const open = clean.slice(0, idx).lastIndexOf('ARRAY[');
  if (open === -1) return null;
  return [...clean.slice(open, idx).matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
}

export type SelectAuditFinding = { kind: string; detail: string };

/**
 * Audit the migration text. An empty result means the migration is coherent.
 *
 * Checks, in order of what they catch:
 *   • the table-level REVOKE happens at all (without it the column GRANTs are a
 *     no-op — Postgres cannot subtract a column from a table-level grant, so a
 *     migration that only GRANTs would pass review and enforce nothing);
 *   • anon is revoked too, not just authenticated (the anon key is the public one);
 *   • service_role / postgres are never revoked (they become the ONLY readers);
 *   • the allow-list is computed from the catalog, not hand-enumerated;
 *   • the write grants are not collaterally revoked (this is a READ-only change);
 *   • the deny-set and the post-condition assert list agree;
 *   • no column a host legitimately reads is in the deny-set.
 */
export function auditSelectMigrationSql(
  sql: string,
  expectedLocked: readonly string[] = LOCKED_SELECT_COLUMNS,
): SelectAuditFinding[] {
  const findings: SelectAuditFinding[] = [];
  const clean = stripSqlComments(sql);

  if (!/REVOKE\s+SELECT\s+ON\s+public\.events\s+FROM\s+authenticated\s*,\s*anon/i.test(clean)) {
    findings.push({
      kind: 'missing-table-revoke',
      detail:
        'no `REVOKE SELECT ON public.events FROM authenticated, anon` — without it the column GRANTs are inert',
    });
  }

  if (!/GRANT\s+SELECT\s*\(/i.test(clean)) {
    findings.push({ kind: 'missing-column-grant', detail: 'no column-scoped GRANT SELECT' });
  }

  if (/REVOKE[^;]*\bFROM\b[^;]*\b(service_role|postgres)\b/i.test(clean)) {
    findings.push({
      kind: 'revokes-privileged-role',
      detail:
        'must never revoke from service_role/postgres — after this migration they are the ONLY paths that can read the tokens',
    });
  }

  if (/REVOKE\s+[^;]*\b(UPDATE|INSERT|DELETE)\b[^;]*ON\s+public\.events/i.test(clean)) {
    findings.push({
      kind: 'revokes-write',
      detail:
        'this migration must touch SELECT only — revoking UPDATE/INSERT here would fight 20271005100000 instead of extending it',
    });
  }

  if (
    !/information_schema\.columns/i.test(clean) ||
    !/<>\s*ALL\s*\(\s*locked_select_columns\s*\)/i.test(clean)
  ) {
    findings.push({
      kind: 'allowlist-not-computed',
      detail:
        'the allow-list must be derived as "all columns MINUS locked_select_columns" from information_schema, never hand-enumerated',
    });
  }

  const declared = extractLockedSelectColumns(sql);
  if (declared === null) {
    findings.push({
      kind: 'no-locked-array',
      detail: 'could not find the locked_select_columns ARRAY[…] declaration',
    });
    return findings;
  }

  for (const col of expectedLocked) {
    if (!declared.includes(col)) {
      findings.push({ kind: 'unlocked-column', detail: `${col} is no longer in locked_select_columns` });
    }
  }

  for (const col of GUEST_READABLE_SAMPLE) {
    if (declared.includes(col)) {
      findings.push({
        kind: 'denies-guest-surface',
        detail: `${col} is read by the guest's own event switcher / library — denying it breaks the guest experience`,
      });
    }
  }

  for (const { column, reader } of NOT_DENIED_FOR_SELECT) {
    if (declared.includes(column)) {
      findings.push({
        kind: 'denies-host-read',
        detail: `${column} is read with the AUTHENTICATED client by ${reader} — a role-level grant cannot close it without breaking that surface`,
      });
    }
  }

  const asserted = extractAssertedDeniedColumns(sql);
  if (asserted === null) {
    findings.push({
      kind: 'no-postcondition',
      detail:
        'the migration has no `still-readable:` post-condition loop — nothing verifies the revoke took effect',
    });
  } else {
    for (const col of declared) {
      if (!asserted.includes(col)) {
        findings.push({
          kind: 'unasserted-column',
          detail: `${col} is denied but not covered by the post-condition assert list`,
        });
      }
    }
  }

  return findings;
}
