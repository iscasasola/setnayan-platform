/**
 * A SUPPLIER CANNOT MARK THEIR OWN PAYOUT DESTINATION "CHECKED BY SETNAYAN".
 *
 * Fifth instance of the shape (chat sender · broadcast sender · self-promotion
 * to admin · self-awarded experience mark). `vendor_payment_methods` has two
 * PERMISSIVE FOR ALL policies keyed on owning the vendor profile, ZERO triggers,
 * and nothing constraining `moderation_status`.
 *
 * ── WHAT THE COLUMN DECIDES ────────────────────────────────────────────────
 * `lib/vendor-payment-methods.server.ts:64,128` filter
 * `.eq('moderation_status','approved')` — it gates whether a couple SEES the
 * destination they are about to send money to. `lib/admin/queue-counts.ts:117`
 * counts `pending_review|held` — so it also decides whether the row ever reaches
 * the reviewer. Forging it did both: shown to couples, invisible to review.
 *
 * ── 🚨 THE TRAP, AND WHY THIS SUITE IS SHAPED AROUND IT ───────────────────
 * The column DEFAULT was **'approved'**. So the obvious fix — "revoke the column
 * from the browser", the shape the two sender migrations used — would have
 * shipped SILENT UNIVERSAL AUTO-APPROVAL: every destination anyone adds,
 * instantly in front of couples and never queued. No error, nothing logged.
 * Worse than the bug it fixes.
 *
 * So "the forgery is refused" is NOT a sufficient assertion here — it is equally
 * true of that broken state. The load-bearing test is the one that inserts
 * WITHOUT naming the column and asserts the row is `pending_review`. A
 * neutralisation test restores the old default to show the silent lie appear.
 *
 * ── WHAT IS NOT A BUG AND MUST KEEP WORKING ───────────────────────────────
 * Instant approval for the safe lanes (bank, decoding QR, allowlisted link) is a
 * deliberate product decision. It survives — but as a service-role write the
 * server makes after the insert, not a value the browser is trusted to send.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const TABLE = 'public.vendor_payment_methods';
const PINNED = ['moderation_status', 'moderation_note'] as const;
/** Columns a vendor legitimately writes. */
const VENDOR_COLUMNS = ['vendor_profile_id', 'method_type', 'label', 'account_number', 'is_shown', 'is_primary'] as const;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asVendor(): Promise<void> {
  await setAuthUid(db, F.uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setAuthRole(null).catch(() => {});
}
async function rollbackAndReset(): Promise<void> {
  await db.exec(`ROLLBACK`).catch(() => {});
  await reset();
}
async function vendorTry(sql: string, params: unknown[] = []): Promise<string | null> {
  await asVendor();
  try {
    await db.query(sql, params);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
}
async function statusOf(label: string): Promise<string | null> {
  await reset();
  const r = await db.query<{ s: string }>(
    `SELECT moderation_status AS s FROM ${TABLE} WHERE label = $1`,
    [label],
  );
  return r.rows.length ? r.rows[0]!.s : null;
}
async function colPriv(role: string, col: string, priv: 'INSERT' | 'UPDATE'): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege($1, $2, $3, $4) AS ok`,
    [role, TABLE, col, priv],
  );
  return r.rows[0]!.ok;
}

const F = { uid: '', vid: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('pay-vendor@test.test', jsonb_build_object('account_type','vendor')) RETURNING id`,
  );
  F.uid = u.rows[0]!.id;
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Payment Test Studio')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [F.uid],
  );
  F.vid = vp.rows[0]!.vendor_profile_id;
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: 🚨 the column DEFAULT is pending_review — the single assertion that kills the worst trap', async () => {
  // It was 'approved'. If it ever goes back, every un-pinned insert silently
  // self-approves and the rest of this suite still passes.
  const r = await db.query<{ dflt: string | null; notnull: boolean }>(
    `SELECT pg_get_expr(d.adbin, d.adrelid) AS dflt, a.attnotnull AS notnull
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = $1::regclass AND a.attname = 'moderation_status'`,
    [TABLE],
  );
  assert.equal(r.rows.length, 1, 'moderation_status is gone');
  assert.match(
    r.rows[0]!.dflt ?? '',
    /'pending_review'/,
    "moderation_status DEFAULT is not 'pending_review'. If it is 'approved' again, every insert " +
      'that does not name the column is silently approved — shown to couples, never queued for ' +
      'review. That is worse than the bug this migration fixed.',
  );
  assert.equal(r.rows[0]!.notnull, true, 'moderation_status stopped being NOT NULL');
});

test('META: the pin trigger exists and fires BEFORE both verbs', async () => {
  const r = await db.query<{ before: boolean; ins: boolean; upd: boolean }>(
    `SELECT (t.tgtype & 2) = 2 AS before, (t.tgtype & 4) > 0 AS ins, (t.tgtype & 16) > 0 AS upd
       FROM pg_trigger t
      WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal
        AND t.tgname = 'vendor_payment_methods_pin_moderation'`,
    [TABLE],
  );
  assert.equal(r.rows.length, 1, 'vendor_payment_methods_pin_moderation is missing');
  assert.deepEqual(r.rows[0], { before: true, ins: true, upd: true });
});

test('META: the owner policies are still FOR ALL — the reason a policy cannot save us', async () => {
  const r = await db.query<{ polname: string; cmd: string }>(
    `SELECT polname, polcmd::text AS cmd FROM pg_policy WHERE polrelid = $1::regclass`,
    [TABLE],
  );
  assert.ok(r.rows.length >= 2, 'the owner policies are missing');
  assert.ok(
    r.rows.every((p) => p.cmd === '*'),
    'a policy is no longer FOR ALL — re-read this suite rather than inheriting it',
  );
});

test('META: the probing role is authenticated, is not the owner, and has no BYPASSRLS', async () => {
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ me: string; owner: string; bypass: boolean }>(
    `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass
       FROM pg_class c WHERE c.oid = $1::regclass`,
    [TABLE],
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated');
  assert.notEqual(r.rows[0]!.owner, 'authenticated', 'the probing role OWNS the table');
  assert.equal(r.rows[0]!.bypass, false);
});

test('META: service_role keeps everything — a narrowing, not a demolition', async () => {
  const denied: string[] = [];
  for (const c of PINNED) {
    for (const p of ['INSERT', 'UPDATE'] as const) {
      if (!(await colPriv('service_role', c, p))) denied.push(`${c}.${p}`);
    }
  }
  assert.deepEqual(denied, [], `service_role lost ${denied.join(', ')} — the admin console breaks`);
});

/* ── 1 · THE CLOSURE ──────────────────────────────────────────────────────── */

test('authenticated and anon hold no INSERT or UPDATE on the moderation columns', async () => {
  const open: string[] = [];
  for (const role of ['anon', 'authenticated']) {
    for (const c of PINNED) {
      for (const p of ['INSERT', 'UPDATE'] as const) {
        if (await colPriv(role, c, p)) open.push(`${role}.${c}.${p}`);
      }
    }
  }
  assert.deepEqual(open, [], `${open.join(', ')} is writable by the browser`);
});

test('authenticated CAN still write every column a real payment option needs', async () => {
  // The grant was re-issued from a COMPUTED all-minus-deny list precisely so a
  // hand-typed keep-list could not silently drop one of these.
  const denied: string[] = [];
  for (const c of VENDOR_COLUMNS) {
    if (!(await colPriv('authenticated', c, 'INSERT'))) denied.push(c);
  }
  assert.deepEqual(denied, [], `authenticated cannot insert ${denied.join(', ')} — vendors cannot add a payment option`);
});

/* ── 2 · BEHAVIOURAL ──────────────────────────────────────────────────────── */

test('BEHAVIOURAL: a vendor cannot force approved at insert', async () => {
  const msg = await vendorTry(
    `INSERT INTO ${TABLE} (vendor_profile_id, method_type, label, account_number, moderation_status)
     VALUES ($1,'bank','Forged','123','approved')`,
    [F.vid],
  );
  assert.ok(msg, 'a vendor inserted a self-approved payment method');
  assert.match(msg, /permission denied/i, `expected a permission failure, got: ${msg}`);
  assert.equal(await statusOf('Forged'), null, 'the row landed anyway');
});

test('BEHAVIOURAL: 🚨 an insert that never NAMES the column lands pending_review, not approved', async () => {
  // The load-bearing test. This is exactly what the server action now sends, and
  // exactly the shape that would silently self-approve if the DEFAULT regressed.
  const msg = await vendorTry(
    `INSERT INTO ${TABLE} (vendor_profile_id, method_type, label, account_number)
     VALUES ($1,'bank','Defaulted','456')`,
    [F.vid],
  );
  assert.equal(msg, null, `the ordinary insert was refused: ${msg}`);
  assert.equal(
    await statusOf('Defaulted'),
    'pending_review',
    'a payment destination nobody approved came out APPROVED — it is in front of couples and ' +
      'absent from the review queue',
  );
});

test('BEHAVIOURAL: a vendor cannot flip an existing row to approved', async () => {
  await reset();
  await db.query(
    `INSERT INTO ${TABLE} (vendor_profile_id, method_type, label, account_number, moderation_status)
     VALUES ($1,'bank','Pending','789','pending_review')`,
    [F.vid],
  );
  const msg = await vendorTry(`UPDATE ${TABLE} SET moderation_status='approved' WHERE label='Pending'`);
  assert.ok(msg, 'a vendor approved their own payment method');
  assert.match(msg, /permission denied/i);
  assert.equal(await statusOf('Pending'), 'pending_review', 'the flip landed anyway');
});

test('BEHAVIOURAL: the admin review queue actually sees the un-approved row', async () => {
  // The exploit was queue INVISIBILITY as much as couple visibility, so the
  // queue's own predicate is the assertion rather than the column value alone.
  await reset();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${TABLE}
      WHERE vendor_profile_id = $1 AND moderation_status IN ('pending_review','held')`,
    [F.vid],
  );
  assert.ok(r.rows[0]!.n >= 2, `expected the un-approved rows in the review queue, found ${r.rows[0]!.n}`);
});

test('BEHAVIOURAL: ordinary vendor edits and deletes still work', async () => {
  assert.equal(await vendorTry(`UPDATE ${TABLE} SET is_shown=false WHERE label='Pending'`), null, 'is_shown toggle broke');
  assert.equal(await vendorTry(`UPDATE ${TABLE} SET is_primary=true WHERE label='Pending'`), null, 'is_primary toggle broke');
  assert.equal(await vendorTry(`DELETE FROM ${TABLE} WHERE label='Defaulted'`), null, 'delete broke');
});

test('BEHAVIOURAL: the service-role approve still lands — instant publish survives', async () => {
  // Both the admin console and addPaymentMethod's auto-approve follow-up.
  await reset();
  await db.query(`UPDATE ${TABLE} SET moderation_status='approved' WHERE label='Pending'`);
  assert.equal(
    await statusOf('Pending'),
    'approved',
    'service-role can no longer approve — the admin console and the bank/QR instant-publish lanes are broken',
  );
});

/* ── 3 · NEUTRALISATION ───────────────────────────────────────────────────── */

test('NEUTRALISATION: re-granting the column re-opens the INSERT — but the trigger still pins it', async () => {
  await db.exec(`BEGIN`);
  try {
    await db.exec(`GRANT INSERT (moderation_status) ON ${TABLE} TO authenticated`);
    const msg = await vendorTry(
      `INSERT INTO ${TABLE} (vendor_profile_id, method_type, label, account_number, moderation_status)
       VALUES ($1,'bank','Regranted','111','approved')`,
      [F.vid],
    );
    assert.equal(msg, null, `the re-grant did not restore the INSERT — the refusal is not the ACL's doing: ${msg}`);
    assert.equal(
      await statusOf('Regranted'),
      'pending_review',
      'with the grant restored the forged value SURVIVED — the trigger is not pinning it, so the ' +
        'GRANT is carrying the whole fix alone',
    );
  } finally {
    await rollbackAndReset();
  }
});

test('NEUTRALISATION: 🚨 restoring the old DEFAULT reproduces the silent auto-approval', async () => {
  // The trap, executed. Drop the trigger and put the default back to what it
  // was, and an ordinary insert — naming nothing — is approved with no error.
  // This is what a revoke-only fix would have shipped.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`DROP TRIGGER vendor_payment_methods_pin_moderation ON ${TABLE}`);
    await db.exec(`ALTER TABLE ${TABLE} ALTER COLUMN moderation_status SET DEFAULT 'approved'`);
    const msg = await vendorTry(
      `INSERT INTO ${TABLE} (vendor_profile_id, method_type, label, account_number)
       VALUES ($1,'bank','SilentlyApproved','222')`,
      [F.vid],
    );
    assert.equal(msg, null, `the insert was refused: ${msg}`);
    assert.equal(
      await statusOf('SilentlyApproved'),
      'approved',
      'expected the old DEFAULT to silently approve an un-named insert. It did not, so the ' +
        'DEFAULT flip in the migration is not what the behavioural test above is measuring.',
    );
  } finally {
    await rollbackAndReset();
  }
});

test('NEUTRALISATION: with both halves removed the original forgery succeeds again', async () => {
  await db.exec(`BEGIN`);
  try {
    await db.exec(`DROP TRIGGER vendor_payment_methods_pin_moderation ON ${TABLE}`);
    await db.exec(`GRANT INSERT (moderation_status), UPDATE (moderation_status) ON ${TABLE} TO authenticated`);
    const msg = await vendorTry(
      `INSERT INTO ${TABLE} (vendor_profile_id, method_type, label, account_number, moderation_status)
       VALUES ($1,'bank','FullRepro','333','approved')`,
      [F.vid],
    );
    assert.equal(msg, null, `removing both halves did not restore the forgery: ${msg}`);
    assert.equal(
      await statusOf('FullRepro'),
      'approved',
      'this suite is no longer reproducing the defect it claims to prevent',
    );
  } finally {
    await rollbackAndReset();
  }
});
