/**
 * A COUPLE MAY WRITE THEIR OWN THREE LEDGER EVENTS, ON THEIR OWN ORDER.
 *
 * Eighth and last finding from the 2026-08-11/12 authority-column sweep. Unlike
 * its siblings this table is browser-writable BY DESIGN — `order_ledger` is
 * append-only evidence and the couple's checkout legitimately writes to it under
 * their own session (checkout/actions.ts:894, 904, 918 — the ONLY RLS-client
 * appendLedger call sites; all fifteen others pass the service-role client).
 *
 * What was missing was any constraint on WHICH row and WHICH event:
 *
 *   order_ledger_authenticated_insert  WITH CHECK (actor_user_id = auth.uid())
 *
 * Measured in this replay before migration 20271135800722, as an ordinary couple:
 *   service_activated / payment_approved / order_refunded on own order → ACCEPTED
 *   actor_role='admin'                                                 → ACCEPTED
 *   any event on SOMEBODY ELSE'S order                                 → ACCEPTED
 *
 * ── WHY A FORGED ROW IS NOT JUST A FALSE AUDIT LINE ────────────────────────
 * The ledger is MACHINE-READ. Four activation paths in lib/sku-activation.ts
 * (~364, ~488, ~584, ~662) each run
 * `.eq('event_type','service_activated') … if (prior) return;` as an idempotency
 * guard. Planting that row against your own order BEFORE paying makes the real
 * activation short-circuit: the couple pays, the admin approves, and the thing
 * they bought silently never switches on. No error for anyone to see — the guard
 * did exactly what it was written to do, on a lie.
 *
 * ── WHY A POLICY AND NOT A GRANT ───────────────────────────────────────────
 * `event_type` is NOT NULL with no default and the couple's client legitimately
 * names it; three of the eight verbs are genuinely theirs, so there is nothing
 * to derive and a revoke would break checkout loudly. Same call as `status` on
 * vendor_verification_applications (20271135231726).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const COUPLE_VERBS = ['order_created', 'voucher_applied', 'payment_uploaded'] as const;
const PRIVILEGED_VERBS = [
  'payment_approved', 'payment_rejected', 'payment_resubmit_requested',
  'service_activated', 'order_refunded',
] as const;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
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
/** Insert as `uid`; return the error message, or null if allowed. */
async function insertAs(
  uid: string,
  orderId: string,
  eventType: string,
  actorRole = 'couple',
): Promise<string | null> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
  try {
    await db.query(
      `INSERT INTO public.order_ledger (order_id, event_type, actor_user_id, actor_role, amount_centavos, metadata)
       VALUES ($1,$2,$3,$4,100,'{}'::jsonb)`,
      [orderId, eventType, uid, actorRole],
    );
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
}

const F = { me: '', other: '', eventId: '', myOrder: '', theirOrder: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const mk = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.me = await mk('ledger-me@test.test');
  F.other = await mk('ledger-other@test.test');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Ledger Test Event','birthday') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id,user_id,member_type) VALUES ($1,$2,'couple')`,
    [F.eventId, F.me],
  );
  const mkOrder = async (uid: string, ref: string) =>
    (
      await db.query<{ order_id: string }>(
        `INSERT INTO public.orders (event_id,user_id,description,requested_total_php,reference_code)
         VALUES ($1,$2,'Ledger test',1000,$3) RETURNING order_id`,
        [F.eventId, uid, ref],
      )
    ).rows[0]!.order_id;
  F.myOrder = await mkOrder(F.me, 'LEDGERMINE');
  F.theirOrder = await mkOrder(F.other, 'LEDGERTHRS');
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: sku-activation still short-circuits on a prior service_activated row', async () => {
  // The fact the severity rests on, asserted against the shipped source. If the
  // idempotency guard is ever removed, a forged row becomes a false audit line
  // rather than a silent non-activation, and this finding should be re-argued.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.resolve(here, '../../lib/sku-activation.ts'), 'utf8');
  const shortCircuits = src.match(/\.eq\('event_type',\s*'service_activated'\)/g) ?? [];
  assert.ok(
    shortCircuits.length >= 4,
    `expected at least 4 service_activated idempotency reads in sku-activation.ts, found ` +
      `${shortCircuits.length} — the consequence described in this suite may no longer hold`,
  );
  assert.match(src, /if\s*\(prior\)\s*return/, 'the `if (prior) return` short-circuit is gone');
});

test('META: the INSERT policy now constrains order, verb and role — not just the actor', async () => {
  const r = await db.query<{ wc: string }>(
    `SELECT coalesce(pg_get_expr(polwithcheck, polrelid),'') AS wc FROM pg_policy
      WHERE polrelid = 'public.order_ledger'::regclass AND polname = 'order_ledger_authenticated_insert'`,
  );
  assert.equal(r.rows.length, 1, 'order_ledger_authenticated_insert is missing');
  const wc = r.rows[0]!.wc;
  assert.match(wc, /actor_user_id\s*=\s*auth\.uid\(\)/, 'the policy stopped pinning the actor');
  assert.match(wc, /actor_role\s*=\s*'couple'/, 'the policy does not pin actor_role');
  assert.match(wc, /order_created/, 'the policy does not restrict event_type');
  assert.match(wc, /orders/, 'the policy does not check that the order belongs to the caller');
});

test('META: UPDATE and DELETE are still revoked — append-only is intact', async () => {
  for (const p of ['UPDATE', 'DELETE'] as const) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege('authenticated','public.order_ledger',$1) AS ok`,
      [p],
    );
    assert.equal(r.rows[0]!.ok, false, `authenticated regained ${p} on order_ledger`);
  }
});

test('META: the CHECK still admits all eight verbs — the policy is what narrows them', async () => {
  // If the CHECK itself were narrowed instead, the service-role paths that write
  // the privileged verbs would break, and these tests would pass for the wrong
  // reason.
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid='public.order_ledger'::regclass AND conname='order_ledger_event_type_check'`,
  );
  assert.equal(r.rows.length, 1, 'the event_type CHECK is missing');
  for (const v of [...COUPLE_VERBS, ...PRIVILEGED_VERBS]) {
    assert.ok(r.rows[0]!.def.includes(`'${v}'`), `the CHECK no longer admits '${v}'`);
  }
});

test('META: the probing role is authenticated, is not the owner, and has no BYPASSRLS', async () => {
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ me: string; owner: string; bypass: boolean }>(
    `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass
       FROM pg_class c WHERE c.oid='public.order_ledger'::regclass`,
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated');
  assert.notEqual(r.rows[0]!.owner, 'authenticated');
  assert.equal(r.rows[0]!.bypass, false);
});

/* ── 1 · BEHAVIOURAL ──────────────────────────────────────────────────────── */

test('BEHAVIOURAL: the three checkout verbs still land on the couple’s own order', async () => {
  // Exactly what checkout/actions.ts:894,904,918 send. If this breaks, ordering
  // breaks — and the ledger helper swallows its errors, so it would break
  // silently.
  for (const v of COUPLE_VERBS) {
    assert.equal(await insertAs(F.me, F.myOrder, v), null, `the couple can no longer write '${v}'`);
  }
});

test('BEHAVIOURAL: none of the five privileged verbs is writable by the couple', async () => {
  const accepted: string[] = [];
  for (const v of PRIVILEGED_VERBS) {
    if ((await insertAs(F.me, F.myOrder, v)) === null) accepted.push(v);
  }
  assert.deepEqual(
    accepted,
    [],
    `a couple session wrote ${accepted.join(', ')}. 'service_activated' is the one that makes ` +
      'sku-activation short-circuit, so the thing they paid for never switches on.',
  );
});

test('BEHAVIOURAL: a couple cannot write onto somebody else’s order', async () => {
  // The original policy never asked whose order it was — an order id seen in a
  // receipt, a URL or a support thread was enough.
  const msg = await insertAs(F.me, F.theirOrder, 'order_created');
  assert.ok(msg, 'a couple wrote a ledger line onto a stranger’s order');
  assert.match(msg, /row-level security/i, `expected the policy to refuse, got: ${msg}`);
});

test('BEHAVIOURAL: a couple cannot sign a line as admin or system', async () => {
  for (const role of ['admin', 'system']) {
    const msg = await insertAs(F.me, F.myOrder, 'order_created', role);
    assert.ok(msg, `a couple wrote a ledger line as actor_role='${role}'`);
    assert.match(msg, /row-level security/i);
  }
});

test('BEHAVIOURAL: service-role still writes every verb — activation and refunds must work', async () => {
  await reset();
  for (const v of PRIVILEGED_VERBS) {
    await db.query(
      `INSERT INTO public.order_ledger (order_id,event_type,actor_user_id,actor_role,amount_centavos,metadata)
       VALUES ($1,$2,NULL,'system',0,'{}'::jsonb)`,
      [F.myOrder, v],
    );
  }
  const n = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.order_ledger WHERE order_id=$1 AND actor_role='system'`,
    [F.myOrder],
  );
  assert.equal(n.rows[0]!.n, PRIVILEGED_VERBS.length, 'the service-role writer lost a verb');
});

/* ── 2 · NEUTRALISATION ───────────────────────────────────────────────────── */

test('NEUTRALISATION: restoring the old policy re-opens all four holes at once', async () => {
  await db.exec(`BEGIN`);
  try {
    await db.exec(`DROP POLICY order_ledger_authenticated_insert ON public.order_ledger`);
    await db.exec(`
      CREATE POLICY order_ledger_authenticated_insert ON public.order_ledger
        FOR INSERT TO authenticated
        WITH CHECK (actor_user_id = auth.uid())`);
    const results = {
      service_activated: await insertAs(F.me, F.myOrder, 'service_activated'),
      order_refunded: await insertAs(F.me, F.myOrder, 'order_refunded'),
      as_admin: await insertAs(F.me, F.myOrder, 'order_created', 'admin'),
      other_order: await insertAs(F.me, F.theirOrder, 'order_created'),
    };
    const stillRefused = Object.entries(results)
      .filter(([, v]) => v !== null)
      .map(([k]) => k);
    assert.deepEqual(
      stillRefused,
      [],
      `restoring the pre-fix policy did not restore ${stillRefused.join(', ')} — this suite is ` +
        'not reproducing the defect it claims to prevent, so its green means nothing',
    );
  } finally {
    await rollbackAndReset();
  }
});
