/**
 * SEC-2b — the private-column contract for `public.events`.
 *
 * Shared, single-source constants for migration 20271008731642 plus a static
 * auditor over its SQL. Imported by:
 *   • lib/security/events-private-details.test.ts   (text audit + meta-tests)
 *   • tests/db/events-private-details.db.test.ts    (real enforcement, PGlite)
 *
 * ── THE FINDING ────────────────────────────────────────────────────────────
 * A wedding GUEST holds the `authenticated` role and is admitted to the
 * couple's `events` row by public.current_event_ids() (no member_type filter).
 * Until 20271008731642 that meant a guest could GET the couple's birth dates,
 * exact budget, wizard_state and Google account email straight off PostgREST
 * with the public anon key. The dashboard UI hid them; the data layer did not.
 *
 * ── WHY THE FIX IS A GRANT PLUS A VIEW, NOT AN RLS POLICY ──────────────────
 * RLS is ROW-level. It cannot say "this session sees 181 of the 192 columns",
 * and the couple reads these same columns with the SAME `authenticated` role as
 * the guest — so neither a policy nor a plain REVOKE can separate them. The
 * migration does both halves: REVOKE the columns from authenticated + anon
 * (checked before and independently of every policy, so it also closes embeds,
 * `select=*`, and the WHERE / ORDER BY oracles), then hand them back through
 * `public.events_host`, a definer view whose WHERE clause admits only
 * member_type='couple' or an accepted event_moderator.
 *
 * Sibling modules: events-column-privileges.ts (WRITE half, 20271005100000) and
 * events-column-select-privileges.ts (the SEC-2 credential READ half,
 * 20271007100000). This file is the SEC-2b follow-up that migration deferred.
 */

import { stripSqlComments } from './events-column-privileges';

export const PRIVATE_MIGRATION_FILE = '20271008731642_events_private_details_guest_lock.sql';

/** The host-scoped definer view the couple/moderator reads these columns through. */
export const HOST_VIEW = 'events_host';

/**
 * The columns withheld from `authenticated` + `anon` at SELECT time by SEC-2b.
 *
 * INCLUSION RULE — a column belongs here if it is private to the couple AND a
 * plain wedding guest has no product reason to see it. Unlike the SEC-2 set
 * these are NOT credentials: they are personal data the couple genuinely reads,
 * which is exactly why they needed the view rather than a bare revoke.
 *
 * ⚠ ADDING ONE HERE IS NOT ENOUGH. A new private column must also be dropped
 * from the events grant list AND the events_host projection rebuilt — see the
 * maintenance note at the bottom of the migration. tests/db/
 * events-private-details.db.test.ts asserts both against the live catalog.
 */
export const PRIVATE_SELECT_COLUMNS: readonly string[] = [
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
];

/**
 * Each denied column with the concrete harm a leak does. The unit test asserts
 * these individually, so a reviewer who deletes one gets a failure that names
 * what they just re-opened rather than a diff-sized list.
 */
export const CRITICAL_PRIVATE: ReadonlyArray<{ column: string; harm: string }> = [
  {
    column: 'partner_a_birth_date',
    harm: "a partner's date of birth — RA 10173 sensitive personal information, and the single most useful field for identity fraud against a Philippine record",
  },
  {
    column: 'estimated_budget_centavos',
    harm: "the couple's exact budget in centavos — a vendor who is also a guest reads the number they are negotiating against, straight past the share_budget_band opt-in that public.vendor_event_brief honours",
  },
  {
    column: 'wizard_state',
    harm: 'far more than completion flags — the budget figure again, wedding + prenup dates, pax and guest-list counts, monogram initials, the site slug, per-task vendor ids, and an unbounded meta_* passthrough intended for PSA/CENOMAR reference numbers',
  },
  {
    column: 'photo_delivery_account_email',
    harm: "the couple's personal Google account address — a login identifier, on the same row as the Drive OAuth token SEC-2 closed",
  },
];

/**
 * The SEC-2 deny-set (20271007100000). SEC-2b recomputes the events allow-list,
 * so if it ever recomputed from the full catalog instead of from live
 * privileges it would silently RE-GRANT these. Asserted both in the migration's
 * own post-condition (b) and in the DB suite.
 */
export const SEC2_LOCKED_COLUMNS: readonly string[] = [
  'master_qr_token',
  'photo_delivery_oauth_token_encrypted',
  'photo_delivery_oauth_expires_at',
];

/**
 * The columns a plain GUEST must keep reading on `public.events`. Union of the
 * PostgREST embed in lib/events.ts `fetchUserEvents` and the account switcher's
 * slice — plus `event_date`, which the owner explicitly wants guests to keep
 * ("guests cannot see budget and birthdate. just event date.").
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
 * Every authenticated-client call site moved onto `public.events_host` by this
 * change. Recorded so the reader list is reviewable in one place and so a
 * future reader that goes back to `.from('events')` is an obvious regression.
 * `wizard-actions.ts` is one entry covering all 17 read-modify-write cycles.
 */
export const MIGRATED_HOST_READERS: readonly string[] = [
  'app/dashboard/[eventId]/details/page.tsx',
  'app/dashboard/[eventId]/budget/page.tsx',
  'app/dashboard/[eventId]/date-selection/page.tsx',
  'app/dashboard/[eventId]/vendors/page.tsx',
  'app/dashboard/[eventId]/vendors/build-3state-actions.ts',
  'app/dashboard/[eventId]/studio/photo-delivery/page.tsx',
  'app/dashboard/[eventId]/_components/event-dashboard.tsx',
  'app/dashboard/[eventId]/wizard-actions.ts',
  'app/dashboard/(account)/create-event/actions.ts',
  'app/api/profile/export/route.ts',
  'lib/checklist-budget.ts',
  'lib/budget-allocation-data.ts',
  'lib/wedding-roadmap-signals.ts',
];

/**
 * Extract the deny-set from the migration's `private_columns TEXT[] := ARRAY[…]`
 * declaration (the first one — section 1). Returns null when absent, itself a
 * failure the test asserts on: a migration that no longer declares a deny-set
 * cannot enforce one.
 */
export function extractPrivateColumns(sql: string): string[] | null {
  const clean = stripSqlComments(sql);
  const start = clean.indexOf('private_columns');
  if (start === -1) return null;
  const open = clean.indexOf('ARRAY[', start);
  if (open === -1) return null;
  const close = clean.indexOf(']', open);
  if (close === -1) return null;
  const body = clean.slice(open + 'ARRAY['.length, close);
  const found = body.match(/'([a-z0-9_]+)'/g);
  if (!found) return null;
  return found.map((s) => s.slice(1, -1));
}

/** Extract a post-condition assert list by the sentinel string it appends. */
export function extractAssertedColumns(sql: string, marker: string): string[] | null {
  const clean = stripSqlComments(sql);
  const at = clean.indexOf(marker);
  if (at === -1) return null;
  // Walk BACKWARDS to the FOREACH…ARRAY[ that this marker's loop iterates.
  const head = clean.slice(0, at);
  const open = head.lastIndexOf('ARRAY[');
  if (open === -1) return null;
  const close = clean.indexOf(']', open);
  if (close === -1 || close > at) return null;
  const found = clean.slice(open + 'ARRAY['.length, close).match(/'([a-z0-9_]+)'/g);
  return found ? found.map((s) => s.slice(1, -1)) : null;
}

export type PrivateAuditFinding = { kind: string; detail: string };

/**
 * Static audit of the migration text. Deliberately checks the SHAPE of the SQL
 * — the things a well-meaning edit breaks silently:
 *   • the table-level REVOKE must cover BOTH authenticated and anon;
 *   • service_role must never be revoked;
 *   • the allow-list must be COMPUTED (has_column_privilege), never typed out;
 *   • the host view must be a definer view, SELECT-only, closed to anon;
 *   • every declared private column must also be asserted in post-condition (a);
 *   • nothing the guest surface needs may be denied.
 *
 * The DB suite proves ENFORCEMENT; this proves the migration cannot be quietly
 * hollowed out while still looking like it does the job.
 */
export function auditPrivateDetailsMigrationSql(
  sql: string,
  opts: {
    privateColumns?: readonly string[];
    guestReadable?: readonly string[];
  } = {},
): PrivateAuditFinding[] {
  const findings: PrivateAuditFinding[] = [];
  const clean = stripSqlComments(sql);
  const expectedPrivate = opts.privateColumns ?? PRIVATE_SELECT_COLUMNS;
  const guestReadable = opts.guestReadable ?? GUEST_READABLE_SAMPLE;

  const declared = extractPrivateColumns(sql);
  if (!declared || declared.length === 0) {
    findings.push({ kind: 'no-deny-set', detail: 'private_columns ARRAY[…] not found or empty' });
  }

  // The revoke must be a REVOKE SELECT executed for both roles. The migration
  // loops over ARRAY['authenticated','anon'] and EXECUTE format()s it.
  if (!/REVOKE SELECT ON public\.events FROM/i.test(clean)) {
    findings.push({ kind: 'no-revoke', detail: 'no table-level REVOKE SELECT ON public.events' });
  }
  for (const role of ['authenticated', 'anon']) {
    if (!new RegExp(`'${role}'`).test(clean)) {
      findings.push({ kind: 'role-spared', detail: `${role} never named — the revoke may not reach it` });
    }
  }
  if (/REVOKE[^;]*\bservice_role\b/i.test(clean)) {
    findings.push({ kind: 'revokes-service-role', detail: 'service_role must keep its full read' });
  }

  // The allow-list and the view projection must both be computed from the live
  // catalog. A hand-typed list is how a legitimate read gets silently broken.
  if (!/has_column_privilege\(\s*role_name/.test(clean)) {
    findings.push({
      kind: 'hand-enumerated-grant',
      detail: 'the events allow-list is not computed from has_column_privilege(role_name, …)',
    });
  }
  if (!/GRANT SELECT \(%s\) ON public\.events/i.test(clean)) {
    findings.push({ kind: 'hand-enumerated-grant', detail: 'the GRANT is not a computed format()' });
  }

  // The host read path.
  if (!/CREATE VIEW public\.events_host/i.test(clean)) {
    findings.push({ kind: 'no-host-view', detail: 'public.events_host is not created' });
  }
  if (!/security_invoker\s*=\s*false/i.test(clean)) {
    findings.push({
      kind: 'view-not-definer',
      detail: 'events_host must be security_invoker=false or it hits the grants just revoked',
    });
  }
  if (!/current_couple_event_ids\(\)/.test(clean) || !/current_moderator_event_ids\(\)/.test(clean)) {
    findings.push({
      kind: 'view-unscoped',
      detail: 'events_host must be scoped by current_couple_event_ids + current_moderator_event_ids',
    });
  }
  if (!/GRANT SELECT ON public\.events_host TO authenticated/i.test(clean)) {
    findings.push({ kind: 'view-ungranted', detail: 'authenticated cannot SELECT events_host' });
  }
  if (/GRANT\s+(ALL|UPDATE|INSERT|DELETE)[^;]*ON public\.events_host/i.test(clean)) {
    findings.push({
      kind: 'view-writable',
      detail: 'events_host is auto-updatable and definer — granting a write bypasses couple_can_update_event',
    });
  }
  if (!/REVOKE ALL ON public\.events_host FROM anon/i.test(clean)) {
    findings.push({ kind: 'view-open-to-anon', detail: 'anon is not explicitly revoked on events_host' });
  }

  // Every declared private column must also be asserted denied in (a).
  const asserted = extractAssertedColumns(sql, 'still-readable:');
  for (const col of expectedPrivate) {
    if (declared && !declared.includes(col)) {
      findings.push({ kind: 'missing-denial', detail: `${col} is not in private_columns` });
    }
    if (asserted && !asserted.includes(col)) {
      findings.push({ kind: 'unasserted-denial', detail: `${col} is denied but not post-condition asserted` });
    }
  }
  if (declared) {
    for (const col of declared) {
      if (guestReadable.includes(col)) {
        findings.push({
          kind: 'denies-guest-read',
          detail: `${col} is on the guest surface — denying it blanks the guest switcher/library`,
        });
      }
      // Symmetry with the check above: a column can be denied by the DECLARED
      // set without ever reaching post-condition (a), in which case the
      // migration "succeeds" while enforcing nothing for it. Drive this off
      // `declared`, not off the TS constant, or a newly-added column slips
      // through unasserted.
      if (asserted && !asserted.includes(col)) {
        findings.push({
          kind: 'unasserted-denial',
          detail: `${col} is denied but not covered by post-condition (a)`,
        });
      }
    }
  }

  // The SEC-2 deny-set must be re-asserted, or a recompute could undo it.
  for (const col of SEC2_LOCKED_COLUMNS) {
    if (!clean.includes(`'${col}'`)) {
      findings.push({
        kind: 'sec2-union-unasserted',
        detail: `${col} (SEC-2) is not re-asserted — a recomputed allow-list could re-grant it`,
      });
    }
  }

  return findings;
}
