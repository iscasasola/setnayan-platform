/**
 * RA 10173 subject-export COVERAGE guardrail.
 *
 * The invariant it restores: `app/api/profile/export/route.ts` is the data-subject
 * export, and until now every NEW user-data table silently defaulted to
 * UN-exported. That failure mode recurred three times in a single day
 * (orders/payments · consent receipts · coordinator working notes + broadcasts)
 * because nothing anywhere connected "a migration added a user-identifying
 * table" to "the export must decide what to do about it".
 *
 * This test makes that decision MANDATORY and REVIEWED. Every table in
 * supabase/migrations that carries a subject-identifying column must be in
 * exactly one of three buckets:
 *   • EXPORTED             — derived from the route source, never hand-written.
 *   • DELIBERATE_EXCLUSIONS — the account holder is not the data subject, or
 *                             exporting the row is itself unsafe. One reason each.
 *   • KNOWN_GAPS            — a real RA 10173 shortfall, PINNED and greppable
 *                             (`TODO(RA10173-backlog):`) so it stays countable.
 * A new table lands in NONE of them and the test goes RED. That is the whole
 * point: a silent omission becomes a deliberate, reviewed one.
 *
 * ── HONESTY ABOUT THE HEURISTIC ──────────────────────────────────────────────
 * A guardrail that silently under-detects is WORSE than no guardrail, because it
 * manufactures false confidence. So, plainly:
 *
 *  1. Only regex-visible `CREATE TABLE public.<name>` is seen. A table created
 *     inside a DO block, via dynamic SQL / EXECUTE, in a non-`public` schema, or
 *     outside supabase/migrations (e.g. applied straight to prod) is INVISIBLE
 *     here and will never be flagged.
 *  2. Subject-column detection is TWO signals, not one (widened 2026-07-21 after
 *     adversarial review found the single name-regex under-detecting):
 *       (a) the name matches `SUBJECT_COL` (`user_id` / `*_user_id`), OR
 *       (b) the column carries `REFERENCES public.users(user_id)` under ANY
 *           name — which is how `marketing_share_consents.customer_id` is now
 *           seen. Before this, the guardrail could not see a table the export
 *           itself already reads.
 *     Both are still defeatable: a subject column with neither the name nor an
 *     explicit FK (a bare `UUID` holding a uid, or an FK added later by a
 *     `ADD CONSTRAINT` rather than inline) remains invisible. Measured after
 *     the widening: 344 tables · 36 FK-to-users columns whose names the regex
 *     misses, on 25 tables the regex alone could not see — 22 of which are pure
 *     `*_by` / `*_admin_id` operator stamps filtered by `STAFF_ACTOR_FK`.
 *     Parsing is segment-oriented (top-level comma split), not line-oriented,
 *     so a REFERENCES clause wrapped onto its own line is caught.
 *  3. The SECOND tier is deliberately NOT enforced. Measured on this repo:
 *     344 tables · 107 carry a subject column (the enforced tier) · a further 92
 *     carry `event_id` (personal data reachable through an event) with NO
 *     subject column. Enforcing that tier would flag 199 of 344 tables and
 *     produce a ~180-entry allowlist nobody reads — i.e. exactly the rubber
 *     stamp this test exists to prevent. The numbers are recorded so the
 *     trade-off stays auditable and revisitable, not so it stays permanent.
 *  4. A textual reference in the route proves a table is TOUCHED, not that it is
 *     CORRECTLY SCOPED. Only T6 checks scoping, and only for the two tables this
 *     PR fixed. Every other EXPORTED entry is trusted to be reviewed by a human.
 *  5. Retired tables are not detected. `DROP TABLE` in these migrations is
 *     idempotency scaffolding preceding a CREATE, not retirement — so a
 *     genuinely dropped table would linger as a stale map entry until T3 is
 *     reconciled by hand.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/lib
const MIGRATIONS = path.resolve(HERE, '..', '..', '..', 'supabase', 'migrations');
const ROUTE = path.resolve(HERE, '..', 'app', 'api', 'profile', 'export', 'route.ts');

// ── Parser ───────────────────────────────────────────────────────────────────

/** Trailing table-constraint keywords that look like a column name at line start. */
const NOT_A_COLUMN = /^(constraint|primary|unique|foreign|check|exclude|like)$/i;

export type TableSchema = {
  /** union of every column name seen across ALL migrations */
  cols: Set<string>;
  /** subset of `cols` that carries `REFERENCES public.users(user_id)` */
  userFks: Set<string>;
};

/** Split a CREATE TABLE body on top-level commas — one entry per column/constraint. */
function splitTopLevel(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const USER_FK = /REFERENCES\s+public\.users\s*\(\s*user_id/i;

/**
 * table -> columns + which of them FK to public.users(user_id). Union (not
 * last-write) because several migrations DROP+CREATE the same table for
 * idempotency, and later ALTERs add columns.
 *
 * Segment-oriented, NOT line-oriented: a column declaration is frequently
 * wrapped across lines with its REFERENCES clause on the next one, e.g.
 *   customer_id    UUID NOT NULL
 *                  REFERENCES public.users(user_id) ON DELETE CASCADE,
 * (marketing_share_consents, 20261203000000_social_sharing_program.sql:72-73).
 * A line-oriented parser sees the name but never the FK.
 */
function readSchema(): Map<string, TableSchema> {
  const schema = new Map<string, TableSchema>();
  const files = fs
    .readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');

    const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z0-9_]+)\s*\(/gi;
    let m: RegExpExecArray | null;
    while ((m = createRe.exec(sql))) {
      const table = m[1] ?? '';
      if (!table) continue;
      // Walk forward from the opening paren, balancing parens, to find the
      // matching close — the column body can contain nested parens (CHECK,
      // numeric(10,2), …) so a lazy regex would truncate it.
      let depth = 0;
      let end = -1;
      for (let i = createRe.lastIndex - 1; i < sql.length; i++) {
        if (sql[i] === '(') depth++;
        else if (sql[i] === ')') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end < 0) continue;

      const entry = schema.get(table) ?? { cols: new Set<string>(), userFks: new Set<string>() };
      const body = sql
        .slice(createRe.lastIndex, end)
        .split('\n')
        .filter((l) => !l.trim().startsWith('--'))
        .join('\n');
      for (const seg of splitTopLevel(body)) {
        const s = seg.trim();
        const col = /^([a-z0-9_]+)\s+[A-Za-z]/.exec(s)?.[1];
        if (!col || NOT_A_COLUMN.test(col)) continue;
        entry.cols.add(col);
        if (USER_FK.test(s)) entry.userFks.add(col);
      }
      schema.set(table, entry);
    }

    const alterRe = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?public\.([a-z0-9_]+)([\s\S]*?);/gi;
    while ((m = alterRe.exec(sql))) {
      const entry = schema.get(m[1] ?? '');
      if (!entry) continue;
      const addRe = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z0-9_]+)([^,;]*)/gi;
      let a: RegExpExecArray | null;
      while ((a = addRe.exec(m[2] ?? ''))) {
        if (!a[1]) continue;
        entry.cols.add(a[1]);
        if (USER_FK.test(a[2] ?? '')) entry.userFks.add(a[1]);
      }
    }
  }
  return schema;
}

/** `user_id` or anything ending `_user_id` — the account holder's own handle. */
const SUBJECT_COL = /^([a-z0-9_]*_)?user_id$/;

/**
 * Setnayan-STAFF action stamps. These identify an operator acting in role, not
 * the account holder whose export this is — an admin's uid on a review row does
 * not make that row the admin's personal data.
 *
 * ⚠ `accessed_user_id` and `target_user_id` were WRONGLY listed here until
 * 2026-07-21. On those two names the subject IS the target, not the operator:
 * admin_data_access_log.accessed_user_id is the account that was LOOKED AT, and
 * admin_approval_requests / vendor_admin_motions .target_user_id is the account
 * the motion is ABOUT. Excluding them hid three tables from the guardrail
 * entirely. The docblock rationale was true for the `*_by_user_id` names and
 * simply false for those two; both are now in scope and classified below. T7
 * pins that they stay in scope.
 */
const STAFF_ACTOR =
  /^(admin_user_id|reviewed_by_user_id|approved_by_user_id|decided_by_user_id|handled_by_user_id|moderated_by_user_id|resolved_by_user_id|actor_user_id)$/;

/**
 * Second, name-independent detector: any column with an explicit
 * `REFERENCES public.users(user_id)` FK points at a person, whatever it is
 * called. This is what catches `marketing_share_consents.customer_id` — a
 * table the export already reads but which the name regex could not see, i.e.
 * the guardrail was blind to a table it was supposedly guarding.
 *
 * The staff-actor exclusion still applies by NAME on top of the FK signal, and
 * these `*_by` / `*_admin_id` stamps are almost all pure operator stamps —
 * which is why most of the tables this widening pulls in land in
 * DELIBERATE_EXCLUSIONS rather than the backlog.
 */
const STAFF_ACTOR_FK =
  /^(.*_by|.*_by_admin|.*_by_admin_id|.*_admin_id|.*_admin|override_admin_id)$/;

function isSubjectColumn(col: string, userFks: Set<string>): boolean {
  if (STAFF_ACTOR.test(col)) return false;
  if (SUBJECT_COL.test(col)) return true;
  return userFks.has(col) && !STAFF_ACTOR_FK.test(col);
}

function inScopeTables(schema: Map<string, TableSchema>): string[] {
  return [...schema.entries()]
    .filter(([, s]) => [...s.cols].some((col) => isSubjectColumn(col, s.userFks)))
    .map(([t]) => t)
    .sort();
}

/**
 * Tables the export route references. Two call shapes are both real:
 *   • `.from('table')`
 *   • PostgREST embeds inside a select string — `events(...)`, `communities(...)`
 *     — which never appear as from() literals.
 */
function exportedTables(routeSrc: string): Set<string> {
  const out = new Set<string>();
  for (const m of routeSrc.matchAll(/\bfrom\(\s*'([a-z0-9_]+)'\s*\)/g)) {
    if (m[1]) out.add(m[1]);
  }
  for (const lit of routeSrc.matchAll(/'([^'\\\n]*)'/g)) {
    for (const e of (lit[1] ?? '').matchAll(/([a-z0-9_]+)\(/g)) {
      if (e[1]) out.add(e[1]);
    }
  }
  return out;
}

// ── The two reviewed buckets ─────────────────────────────────────────────────
// Per-table only. NO wildcards, NO prefix rules — a pattern rule would
// re-create the silent default this test exists to kill.

/**
 * Tables where the account holder is genuinely NOT the data subject, or where
 * exporting the row is itself unsafe. These are answers, not debt.
 */
const DELIBERATE_EXCLUSIONS: Record<string, string> = {
  api_keys:
    '0033 gateway credential material — a key hash is a bearer secret, never exported (same rule as the alaga claim_token).',
  vendor_locked_qr_tokens: 'Live bearer tokens — exporting one hands over a redeemable secret.',
  seating_editor_locks: 'Ephemeral advisory lock; holds no durable personal data.',
  blacklisted_emails:
    'Anti-abuse investigation record — disclosure defeats detection (NPC investigation carve-out; counsel-reviewed).',
  concierge_abuse_flags:
    'Anti-abuse investigation record — disclosure defeats detection (NPC investigation carve-out; counsel-reviewed).',
  concierge_brain_chunks:
    'Setnayan-authored planning content; the *_by stamp is an internal editor, not a data subject.',
  concierge_plan_templates:
    'Setnayan-authored planning content; the *_by stamp is an internal editor, not a data subject.',
  concierge_response_cache:
    'Setnayan-authored cached content; the *_by stamp is an internal editor, not a data subject.',
  setnayan_pay_methods: 'Platform payment configuration — Setnayan’s own rails, not subject data.',
  platform_settings:
    'Platform configuration; platform_settings.ig_user_id is Setnayan’s OWN IG account, not a user’s.',
  vendor_verifications: 'Admin decision record — the uid on it is a staff actor, not the subject.',
  vendor_admin_motion_votes: 'Admin decision record — the uid on it is a staff actor, not the subject.',
};

/**
 * PINNED RA 10173 backlog. These are NOT excuses — each is a table whose rows
 * plausibly ARE the subject's personal data and which the export does not yet
 * ship. Prefixed `TODO(RA10173-backlog):` so they are greppable and countable.
 * This PR closes 2 of ~99 in-scope tables; the honest size of the remainder is
 * exactly what this map exists to make visible.
 */
const KNOWN_GAPS: Record<string, string> = {
  // ── Newly VISIBLE 2026-07-21, not newly created ──────────────────────────
  // These three were always gaps. They were invisible because STAFF_ACTOR
  // wrongly claimed `accessed_user_id` / `target_user_id` name an operator; on
  // these tables they name the SUBJECT. See the STAFF_ACTOR docblock.
  admin_data_access_log:
    'TODO(RA10173-backlog): accessed_user_id is the SUBJECT (the account an admin viewed), not the operator. The export currently discloses the table’s existence in `not_included` and routes the subject to the DPO, because each row also names the admin who looked — the disclosure shape is pending DPO review.',
  admin_approval_requests:
    'TODO(RA10173-backlog): target_user_id is the SUBJECT the two-admin motion is ABOUT — a decision record concerning them, which they are entitled to know exists.',
  vendor_admin_motions:
    'TODO(RA10173-backlog): target_user_id is the SUBJECT the vendor motion is ABOUT — same reasoning as admin_approval_requests.',
  account_deletion_requests:
    'TODO(RA10173-backlog): the subject’s own erasure requests — arguably the most export-worthy audit trail we hold.',
  blocked_users: 'TODO(RA10173-backlog): the subject’s own block list — their stated preference.',
  chat_thread_reads: 'TODO(RA10173-backlog): read receipts — behavioural data about the subject.',
  chat_threads:
    'TODO(RA10173-backlog): thread metadata (counterparty, timestamps); message BODIES are already exported.',
  comp_grants: 'TODO(RA10173-backlog): comps issued to the subject — a commercial record about them.',
  coordinator_feature_recommendations:
    'TODO(RA10173-backlog): recommendations the subject authored as coordinator.',
  couple_event_type_notify_signups:
    'TODO(RA10173-backlog): the subject’s waitlist signup — a marketing-contact record.',
  couple_wedding_type_notify_signups:
    'TODO(RA10173-backlog): the subject’s waitlist signup — a marketing-contact record.',
  creator_applications: 'TODO(RA10173-backlog): the subject’s own creator-program application.',
  creator_chapters: 'TODO(RA10173-backlog): creator content the subject authored.',
  discount_code_eligible_users:
    'TODO(RA10173-backlog): targeting-list membership — the subject is the target.',
  discount_code_redemptions: 'TODO(RA10173-backlog): the subject’s own redemption history.',
  event_action_log:
    'TODO(RA10173-backlog): actor-stamped activity log — export shape pending (mixes several actors per event).',
  event_appointments: 'TODO(RA10173-backlog): appointments the subject booked or was booked into.',
  event_blocked_users: 'TODO(RA10173-backlog): per-event block entries naming the subject.',
  event_delegates: 'TODO(RA10173-backlog): delegate grants the subject holds or issued.',
  event_egift_methods: 'TODO(RA10173-backlog): the subject’s own e-gift payout handles (financial identifiers).',
  event_inspiration_assets: 'TODO(RA10173-backlog): uploads the subject contributed.',
  event_manual_vendors: 'TODO(RA10173-backlog): vendor contact details the subject typed in themselves.',
  event_meaningful_dates: 'TODO(RA10173-backlog): personal dates the subject recorded.',
  event_moderators: 'TODO(RA10173-backlog): coordinator/moderator grants naming the subject.',
  event_playlist_picks: 'TODO(RA10173-backlog): music picks the subject made — taste data.',
  event_schedule_suggestions: 'TODO(RA10173-backlog): suggestions the subject authored.',
  event_sponsors: 'TODO(RA10173-backlog): sponsor rows naming the subject.',
  event_walkthrough_zones: 'TODO(RA10173-backlog): walkthrough notes the subject authored.',
  feature_reviews: 'TODO(RA10173-backlog): the subject’s own feature feedback.',
  force_majeure_flags: 'TODO(RA10173-backlog): flags raised by or about the subject.',
  founder_seats: 'TODO(RA10173-backlog): the subject’s founder-seat grant — an entitlement record.',
  founder_time_log: 'TODO(RA10173-backlog): the subject’s own logged hours.',
  guest_checkins: 'TODO(RA10173-backlog): the subject’s own check-in events (time + place).',
  guest_claims: 'TODO(RA10173-backlog): the subject’s claim of a guest identity.',
  guest_saved_vendors:
    'TODO(RA10173-backlog): the subject’s saved vendors — cross-event taste data (see the privacy memo on this table).',
  guest_souvenir_claims: 'TODO(RA10173-backlog): the subject’s souvenir claims.',
  guests:
    'TODO(RA10173-backlog): the guest row for the subject themselves — export shape pending (a guest row is also the HOST’s stored data about them).',
  help_messages: 'TODO(RA10173-backlog): support correspondence the subject wrote.',
  kwento_assignments: 'TODO(RA10173-backlog): assignments naming the subject.',
  lead_token_holds: 'TODO(RA10173-backlog): token holds tied to the subject’s vendor account.',
  manpower_gigs: 'TODO(RA10173-backlog): gigs the subject posted or accepted.',
  manual_payment_logs:
    'TODO(RA10173-backlog): manual reconciliation entries about the subject’s payments (staff-authored fields need stripping first).',
  notifications: 'TODO(RA10173-backlog): the subject’s notification history — a real omission.',
  panood_camera_operators: 'TODO(RA10173-backlog): operator assignments naming the subject.',
  paparazzi_seats: 'TODO(RA10173-backlog): seats claimed by the subject.',
  people: 'TODO(RA10173-backlog): person records the subject stewards — overlaps the alaga export; shape pending.',
  person_connections: 'TODO(RA10173-backlog): relationship edges the subject created.',
  person_stewardships: 'TODO(RA10173-backlog): stewardship grants held by the subject.',
  photo_delivery_jobs: 'TODO(RA10173-backlog): delivery jobs the subject requested.',
  push_subscriptions:
    'TODO(RA10173-backlog): the subject’s own push endpoints — export shape pending (device tokens are credentials, so metadata-only like face_enrollments).',
  receipts: 'TODO(RA10173-backlog): the subject’s BIR receipts — orders/payments ship, receipts do not.',
  referral_codes: 'TODO(RA10173-backlog): the subject’s own referral code.',
  referral_redemptions: 'TODO(RA10173-backlog): redemptions by or crediting the subject.',
  scan_events: 'TODO(RA10173-backlog): QR scans involving the subject — time + place behavioural data.',
  stewardship_transfers: 'TODO(RA10173-backlog): hand-over history involving the subject.',
  supplies_orders: 'TODO(RA10173-backlog): the subject’s own supplies orders.',
  thread_calls:
    'TODO(RA10173-backlog): call metadata (never content — calls are locked never-recorded); metadata is still personal data.',
  user_ai_subscription: 'TODO(RA10173-backlog): the subject’s own AI subscription record.',
  user_devices: 'TODO(RA10173-backlog): the subject’s devices — same credential caveat as push_subscriptions.',
  user_face_profiles:
    'TODO(RA10173-backlog): account-level face profile — must ship METADATA ONLY, mirroring guest_face_enrollments.',
  user_follows: 'TODO(RA10173-backlog): who the subject follows — social graph.',
  user_reports: 'TODO(RA10173-backlog): reports the subject FILED (reports filed ABOUT them are a separate call).',
  vendor_ad_subscriptions: 'TODO(RA10173-backlog): the subject’s vendor ad subscriptions.',
  vendor_change_orders: 'TODO(RA10173-backlog): change orders on the subject’s bookings.',
  vendor_client_notes:
    'TODO(RA10173-backlog): vendor-authored notes — must be AUTHOR-scoped for the same reason as working notes.',
  vendor_contract_signatures: 'TODO(RA10173-backlog): the subject’s own e-signatures (RA 8792 evidence).',
  vendor_contracts: 'TODO(RA10173-backlog): contracts the subject is a party to.',
  vendor_creator_offers: 'TODO(RA10173-backlog): offers the subject made or received.',
  vendor_date_waitlist: 'TODO(RA10173-backlog): waitlist entries naming the subject.',
  vendor_disputes: 'TODO(RA10173-backlog): disputes the subject raised (staff fields need stripping first).',
  vendor_event_access_grants: 'TODO(RA10173-backlog): access grants the subject issued or holds.',
  vendor_feature_recommendations: 'TODO(RA10173-backlog): recommendations the subject authored.',
  vendor_follows: 'TODO(RA10173-backlog): vendors the subject follows — taste data.',
  vendor_ig_connections: 'TODO(RA10173-backlog): the subject’s linked IG account (OAuth material needs stripping).',
  vendor_invites: 'TODO(RA10173-backlog): invites the subject sent or received.',
  vendor_lock_proposals: 'TODO(RA10173-backlog): proposals the subject authored.',
  vendor_meetings: 'TODO(RA10173-backlog): meetings the subject attended.',
  vendor_member_token_wallets: 'TODO(RA10173-backlog): the subject’s vendor token balance.',
  vendor_recommendations: 'TODO(RA10173-backlog): recommendations naming the subject.',
  vendor_release_history: 'TODO(RA10173-backlog): release actions the subject took.',
  vendor_review_appeals: 'TODO(RA10173-backlog): appeals the subject filed.',
  vendor_reviews: 'TODO(RA10173-backlog): reviews the subject wrote — clearly their own words.',
  vendor_subscriptions: 'TODO(RA10173-backlog): the subject’s vendor subscription history.',
  vendor_team_members: 'TODO(RA10173-backlog): team membership naming the subject.',
  vendor_token_purchases: 'TODO(RA10173-backlog): the subject’s token purchases — a commercial record.',
};

/**
 * Ratchet. This number may only ever go DOWN — every decrement is a table that
 * moved into the export (or was consciously reclassified as a deliberate
 * exclusion). Raising it means shipping a new RA 10173 gap, which must be an
 * explicit, argued decision, never a drive-by edit.
 *
 * 82 → 85 on 2026-07-21. This is the ONE argued exception the docblock above
 * allows, and it is not a regression: no new gap was created. Correcting the
 * STAFF_ACTOR mistake (see its docblock) made three PRE-EXISTING gaps visible
 * to the counter for the first time — admin_data_access_log,
 * admin_approval_requests, vendor_admin_motions. The honest number went up
 * because the measurement got honest, not because coverage got worse. Refusing
 * the raise would have meant keeping the heuristic wrong to protect a number,
 * which is precisely the false confidence this file exists to prevent.
 * Every future movement must be downward.
 */
const KNOWN_GAP_CEILING = 85;

// ── Tests ────────────────────────────────────────────────────────────────────

test('fixture paths resolve (a moved file must fail loudly, not silently pass)', () => {
  assert.ok(fs.existsSync(MIGRATIONS), `migrations dir not found at ${MIGRATIONS}`);
  assert.ok(fs.existsSync(ROUTE), `export route not found at ${ROUTE}`);
});

test('T1 · every user-identifying table is classified', () => {
  const schema = readSchema();
  const routeSrc = fs.readFileSync(ROUTE, 'utf8');
  const exported = exportedTables(routeSrc);

  const unclassified = inScopeTables(schema).filter(
    (t) => !exported.has(t) && !(t in DELIBERATE_EXCLUSIONS) && !(t in KNOWN_GAPS),
  );

  assert.deepEqual(
    unclassified,
    [],
    `Unclassified user-identifying table(s): ${unclassified.join(', ')}\n` +
      'Each carries a subject-identifying *_user_id column, so the RA 10173 export must make a DECISION about it. Do one of:\n' +
      '  1. reference it from apps/web/app/api/profile/export/route.ts (preferred — and scope it to the AUTHOR/owner, not the event), or\n' +
      '  2. add a DELIBERATE_EXCLUSIONS entry here with a one-line reason why the account holder is not its data subject, or\n' +
      '  3. add a KNOWN_GAPS entry here (TODO(RA10173-backlog): …) and raise KNOWN_GAP_CEILING deliberately.',
  );
});

test('T2 · pinned gaps stay honest (a gap that got exported must be deleted)', () => {
  const exported = exportedTables(fs.readFileSync(ROUTE, 'utf8'));
  for (const table of Object.keys(KNOWN_GAPS)) {
    assert.ok(
      !exported.has(table),
      `${table} is now referenced by the export route but is still listed in KNOWN_GAPS. ` +
        'Delete its KNOWN_GAPS line and lower KNOWN_GAP_CEILING — the backlog must never rot into a rubber stamp.',
    );
  }
});

test('T3 · no stale map entries (every classified table still exists)', () => {
  const schema = readSchema();
  for (const table of [...Object.keys(DELIBERATE_EXCLUSIONS), ...Object.keys(KNOWN_GAPS)]) {
    assert.ok(
      schema.has(table),
      `${table} is classified here but no CREATE TABLE public.${table} exists in supabase/migrations. ` +
        'If the table was retired, delete its entry.',
    );
  }
});

test('T4 · backlog ratchet (KNOWN_GAPS may only shrink)', () => {
  assert.ok(
    Object.keys(KNOWN_GAPS).length <= KNOWN_GAP_CEILING,
    `KNOWN_GAPS has ${Object.keys(KNOWN_GAPS).length} entries, ceiling is ${KNOWN_GAP_CEILING}. ` +
      'This number may only ever go DOWN.',
  );
});

test('T5 · the two tables this PR fixed are exported (regression pin)', () => {
  const exported = exportedTables(fs.readFileSync(ROUTE, 'utf8'));
  assert.ok(exported.has('event_vendor_working_notes'), 'event_vendor_working_notes dropped from the export');
  assert.ok(exported.has('coordinator_broadcasts'), 'coordinator_broadcasts dropped from the export');
});

test('T7 · the heuristic sees subject columns that are not named *_user_id', () => {
  const inScope = new Set(inScopeTables(readSchema()));

  // FK-to-users under a different NAME. The export already reads this table,
  // so before the 2026-07-21 widening the guardrail was blind to a table it
  // was supposedly guarding — the clearest possible proof of under-detection.
  assert.ok(
    inScope.has('marketing_share_consents'),
    'marketing_share_consents.customer_id REFERENCES public.users(user_id) — a subject column under a non-standard name. ' +
      'If this is out of scope the FK detector regressed (likely: the parser went back to line-oriented, so the wrapped REFERENCES clause is invisible again).',
  );

  // Names STAFF_ACTOR wrongly claimed were operator stamps. On these tables the
  // subject IS the target — see the STAFF_ACTOR docblock.
  assert.ok(
    inScope.has('admin_data_access_log'),
    'admin_data_access_log.accessed_user_id is the account that was VIEWED — the subject, not the operator.',
  );
  assert.ok(
    inScope.has('admin_approval_requests'),
    'admin_approval_requests.target_user_id is the account the motion is ABOUT — the subject, not the operator.',
  );
  assert.ok(
    inScope.has('vendor_admin_motions'),
    'vendor_admin_motions.target_user_id is the account the motion is ABOUT — the subject, not the operator.',
  );

  // The complement still holds: a pure operator stamp must NOT drag a
  // platform-config table into scope, or the widening degenerates into
  // "every table", and the map becomes the rubber stamp T1 exists to prevent.
  assert.ok(
    !inScope.has('homepage_hero_config'),
    'homepage_hero_config carries only updated_by_admin_id — an operator stamp on Setnayan’s own marketing config, not subject data.',
  );
});

test('T8 · the false not_included claim about the access log stays corrected', () => {
  const src = fs.readFileSync(ROUTE, 'utf8');
  // The route asserted "no user-scoped access-log table in V1" while
  // supabase/migrations/20270212405352 creates admin_data_access_log with an
  // accessed_user_id column and an index its own comment labels
  // "(subject-access)". Telling a data subject a false fact about what we hold
  // is the same category of harm as the silent empty this PR fixes.
  assert.doesNotMatch(
    src,
    /no user-scoped access-log table/,
    'The export must not claim there is no user-scoped access-log table — admin_data_access_log is one.',
  );
  assert.match(
    src,
    /admin_data_access_log/,
    'The export must name admin_data_access_log in not_included so the subject knows it exists and can request it.',
  );
});

test('T9 · no read on the export route is unwrapped with a bare `?? []`', () => {
  const src = fs.readFileSync(ROUTE, 'utf8');
  // `res.data ?? []` is exactly how the silent empty got shipped: a failed read
  // and a genuinely empty one become the same JSON. Every read now goes through
  // lib/export-integrity, which names failures in `not_included`.
  const offenders = [...src.matchAll(/\w+Res(?:\.data)?\s*\?\?\s*\[\]/g)].map((m) => m[0]);
  assert.deepEqual(
    offenders,
    [],
    `Bare \`?? []\` unwrap(s) reintroduced on the export route: ${offenders.join(', ')}. ` +
      'Use listOutcome()/singleOutcome() from lib/export-integrity so a failed read is DISCLOSED, not silently rendered as "you have no such records".',
  );
  assert.match(src, /export_complete/, 'the export must carry a machine-readable completeness flag');
});

test('T6 · those two stay AUTHOR-scoped, never event-scoped', () => {
  const src = fs.readFileSync(ROUTE, 'utf8');
  // Coarse but real: a refactor that flips either filter to .eq('event_id', …)
  // would leak a third party's prose into a subject-access file — private
  // coordinator notes the couple cannot even read, and broadcasts every event
  // member receives but only one person wrote.
  assert.match(
    src,
    /event_vendor_working_notes[\s\S]{0,400}?author_user_id/,
    'event_vendor_working_notes must be filtered by author_user_id, not by event_id.',
  );
  assert.match(
    src,
    /coordinator_broadcasts[\s\S]{0,400}?sender_user_id/,
    'coordinator_broadcasts must be filtered by sender_user_id, not by event_id.',
  );
});
