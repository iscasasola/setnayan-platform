/**
 * ONLY THE COUPLE (AND SETNAYAN ADMINS) SPEND THE COUPLE'S RENDER CREDITS OR
 * GIVE SHARE CONSENT — migration 20271221631865, proven as a REAL
 * `authenticated` non-superuser session (SET ROLE + JWT claims) for every
 * member type the enum has: couple, guest, vendor, coordinator.
 *
 * Owner ruling 2026-09-11 (DECISION_LOG): "Only the couple (Recommended)" — and
 * admins. And, from the same brief: "keep every other member's READ access as
 * it is" — so every refusal below sits beside a READ that the same member still
 * gets, and the READ half is asserted as hard as the refusal.
 *
 * 🔑 NEUTRALISATION: inside a rolled-back transaction the gate is put back to
 * the OLD member rule and the same guest's begin LANDS — so the refusals are the
 * ruling, not some unrelated failure.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { randomUUID } from 'node:crypto';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = {
  couple: '',
  guest: '',
  vendor: '',
  coordinator: '',
  admin: '',
  stranger: '',
  otherCouple: '',
  eventId: '',
  otherEventId: '',
  coupleRender: '',
  pooledRender: '',
};
const NON_COUPLE = ['guest', 'vendor', 'coordinator'] as const;

async function setRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole(null).catch(() => {});
}
/** Run one statement as `uid` inside a rolled-back transaction; return rows or the error. */
async function asRolledBack<T>(uid: string, sql: string, params: unknown[] = [], pre = ''): Promise<{ rows: T[]; err: string | null }> {
  await db.exec('BEGIN');
  try {
    if (pre) await db.exec(pre);
    await asUser(uid);
    const r = await db.query<T>(sql, params);
    return { rows: r.rows, err: null };
  } catch (e) {
    return { rows: [], err: (e as Error).message };
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
}
async function scalar<T>(uid: string, sql: string, params: unknown[] = [], pre = ''): Promise<T | null> {
  const r = await asRolledBack<{ v: T }>(uid, sql, params, pre);
  assert.equal(r.err, null, `unexpected error: ${r.err}`);
  return r.rows[0]?.v ?? null;
}
const BEGIN_SQL = `SELECT public.moodboard_begin_render($1, 'room:ceiling', 'a brief', '{}'::jsonb, 'v1:abc', $2, NULL, '{}'::uuid[]) AS v`;

async function used(eventId: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT COALESCE((SELECT credits_used FROM public.event_render_credit_usage WHERE event_id = $1), 0)::int AS n`,
    [eventId],
  );
  return r.rows[0]!.n;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mk = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.couple = await mk('only-couple@render.test');
  F.guest = await mk('only-guest@render.test');
  F.vendor = await mk('only-vendor@render.test');
  F.coordinator = await mk('only-coord@render.test');
  F.admin = await mk('only-admin@render.test');
  F.stranger = await mk('only-stranger@render.test');
  F.otherCouple = await mk('only-other-couple@render.test');
  // is_admin() reads users.account_type — not is_internal (see a-render-and-its-debit…).
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [F.admin]);

  const ev = async (name: string) =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type) VALUES ($1,'celebration') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
  F.eventId = await ev('Only The Couple Wedding');
  F.otherEventId = await ev('A Couple Who Shared');
  const member = (e: string, u: string, t: string) =>
    db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,$3::member_type)`, [e, u, t]);
  await member(F.eventId, F.couple, 'couple');
  await member(F.eventId, F.guest, 'guest');
  await member(F.eventId, F.vendor, 'vendor');
  await member(F.eventId, F.coordinator, 'coordinator');
  await member(F.otherEventId, F.otherCouple, 'couple');

  await db.query(
    `INSERT INTO public.event_render_credit_grants (event_id, credits, source) VALUES ($1, 10, 'admin'), ($2, 10, 'admin')`,
    [F.eventId, F.otherEventId],
  );

  // One render of the couple's own, and one DELIVERED + CONSENTED + WATERMARKED
  // render of another couple's, so the pool has something a member can browse.
  const seedRender = async (eventId: string, withGallery: boolean) => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO public.event_renders
         (render_id, event_id, part_id, image_key, gallery_image_key, design_snapshot, prompt, config_digest)
       VALUES ($1,$2,'room:ceiling',$3,$4,
               jsonb_build_object('role_palette', jsonb_build_object('reception', '["#a83f2b","#f2e6d8"]'::jsonb)),
               'a brief','v1:abc')`,
      [id, eventId, `renders/${eventId}/${id}.png`, withGallery ? `render-gallery/${eventId}/${id}.jpg` : null],
    );
    return id;
  };
  F.coupleRender = await seedRender(F.eventId, false);
  F.pooledRender = await seedRender(F.otherEventId, true);
  await db.query(
    `INSERT INTO public.event_render_share_consent (event_id, consented, consented_at) VALUES ($1, TRUE, NOW())`,
    [F.otherEventId],
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · META ─────────────────────────────────────────────────────────────── */

test('META: the probing session is `authenticated`, not super, no BYPASSRLS, and auth.uid() is the member', async () => {
  const r = await asRolledBack<{ me: string; sup: boolean; bypass: boolean; uid: string }>(
    F.guest,
    `SELECT current_user AS me,
            (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS sup,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            auth.uid()::text AS uid`,
  );
  assert.equal(r.err, null, r.err ?? '');
  assert.equal(r.rows[0]!.me, 'authenticated');
  assert.equal(r.rows[0]!.sup, false);
  assert.equal(r.rows[0]!.bypass, false);
  assert.equal(r.rows[0]!.uid, F.guest, 'auth.uid() is not the member — the NULL-uid server arm would be what answered');
});

test('META: every member type the enum has is covered', async () => {
  const r = await db.query<{ v: string }>(`SELECT unnest(enum_range(NULL::member_type))::text AS v`);
  const all = r.rows.map((x) => x.v).sort();
  assert.deepEqual(all, ['coordinator', 'couple', 'guest', 'vendor'], 'a new member type exists — decide which side of the ruling it is on');
});

/* ── 1 · THE REFUSALS ─────────────────────────────────────────────────────── */

test('a guest, a booked supplier and a coordinator cannot START a render — not for credits, not for zero', async () => {
  const before = await used(F.eventId);
  let refused = 0;
  for (const who of NON_COUPLE) {
    for (const credits of [1, 0]) {
      const id = await scalar<string>(F[who], BEGIN_SQL, [F.eventId, credits]);
      assert.equal(id, null, `${who} began a ${credits}-credit render on the couple's credits`);
      refused += 1;
    }
    assert.equal(await scalar<boolean>(F[who], `SELECT public.moodboard_render_caller_may_act($1) AS v`, [F.eventId]), false);
    assert.equal(await scalar<boolean>(F[who], `SELECT public.moodboard_reserve_render_credits($1, 1) AS v`, [F.eventId]), false, `${who} reserved credits`);
    assert.equal(await scalar<boolean>(F[who], `SELECT public.moodboard_release_render_credits($1, 1) AS v`, [F.eventId]), false, `${who} released credits`);
  }
  assert.equal(await used(F.eventId), before, 'the couple’s ledger moved');
  console.log(`# non-couple render starts refused: ${refused}/6`);
  assert.equal(refused, 6);
});

test('…nor finish, fail (refund) or attach a copy to the COUPLE’s IN-FLIGHT render — which the couple then finishes', async () => {
  // A fresh in-flight render (image_key NULL), so a refusal cannot be "it was
  // already delivered" — the couple's own finish at the end is the control.
  await db.exec('BEGIN');
  try {
    await asUser(F.couple);
    const id = (await db.query<{ v: string | null }>(BEGIN_SQL, [F.eventId, 1])).rows[0]!.v;
    assert.ok(id, 'the couple could not begin — the control is broken');
    await reset();
    const own = `renders/${F.eventId}/${id}.png`;
    let refused = 0;
    for (const who of NON_COUPLE) {
      await asUser(F[who]);
      const fin = (await db.query<{ v: boolean }>(`SELECT public.moodboard_finish_render($1, $2) AS v`, [id, own])).rows[0]!.v;
      const fail = (await db.query<{ v: boolean }>(`SELECT public.moodboard_fail_render($1, 'x') AS v`, [id])).rows[0]!.v;
      const att = (
        await db.query<{ v: boolean }>(`SELECT public.moodboard_attach_gallery_copy($1, $2) AS v`, [id, `render-gallery/${F.eventId}/${id}.jpg`])
      ).rows[0]!.v;
      await reset();
      assert.equal(fin, false, `${who} finished the couple’s render`);
      assert.equal(fail, false, `${who} failed (refunded) the couple’s render`);
      assert.equal(att, false, `${who} attached a gallery copy`);
      refused += 3;
    }
    const still = await db.query<{ image_key: string | null; failed_at: string | null }>(
      `SELECT image_key, failed_at FROM public.event_renders WHERE render_id = $1`,
      [id],
    );
    assert.equal(still.rows[0]!.image_key, null);
    assert.equal(still.rows[0]!.failed_at, null);
    await asUser(F.couple);
    const done = (await db.query<{ v: boolean }>(`SELECT public.moodboard_finish_render($1, $2) AS v`, [id, own])).rows[0]!.v;
    await reset();
    assert.equal(done, true, 'the couple could not finish its own render — the refusals above prove nothing');
    console.log(`# non-couple finish/fail/attach refused: ${refused}/9`);
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
});

test('a guest, a booked supplier and a coordinator cannot give (or withdraw) SHARE CONSENT', async () => {
  let refused = 0;
  for (const who of NON_COUPLE) {
    for (const consented of [true, false]) {
      const r = await asRolledBack<{ v: boolean; n: number; bonus: number }>(
        F[who],
        `SELECT public.moodboard_set_share_consent($1, $2) AS v`,
        [F.eventId, consented],
      );
      assert.equal(r.err, null, r.err ?? '');
      assert.equal(r.rows[0]!.v, false, `${who} set consent=${consented}`);
      refused += 1;
    }
  }
  const row = await db.query(`SELECT 1 FROM public.event_render_share_consent WHERE event_id = $1`, [F.eventId]);
  assert.equal(row.rows.length, 0, 'a consent row exists for the couple’s event');
  console.log(`# non-couple consent calls refused: ${refused}/6`);
  assert.equal(refused, 6);
});

test('NEUTRALISATION: put the OLD member rule back (rolled back) and the same guest’s begin LANDS', async () => {
  const oldGate = `CREATE OR REPLACE FUNCTION public.moodboard_render_caller_may_act(p_event_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
    BEGIN
      IF p_event_id IS NULL THEN RETURN FALSE; END IF;
      IF auth.uid() IS NULL THEN RETURN TRUE; END IF;
      RETURN public.is_admin() OR EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = p_event_id AND em.user_id = auth.uid());
    END $f$;`;
  const id = await scalar<string>(F.guest, BEGIN_SQL, [F.eventId, 0], oldGate);
  assert.ok(id, 'even under the old rule the guest could not begin — the refusals above prove nothing about the gate');
  // …and the rollback really restored the narrowed gate.
  assert.equal(await scalar<string>(F.guest, BEGIN_SQL, [F.eventId, 0]), null, 'the neutralisation leaked past its ROLLBACK');
});

/* ── 2 · WHAT THE COUPLE AND ADMINS KEEP ──────────────────────────────────── */

test('the COUPLE starts a render (debited once) and gives consent (+ the bonus render)', async () => {
  await db.exec('BEGIN');
  try {
    await asUser(F.couple);
    const id = (await db.query<{ v: string | null }>(BEGIN_SQL, [F.eventId, 1])).rows[0]!.v;
    assert.ok(id, 'the couple could not start a render');
    const ok = (await db.query<{ v: boolean }>(`SELECT public.moodboard_set_share_consent($1, TRUE) AS v`, [F.eventId])).rows[0]!.v;
    assert.equal(ok, true, 'the couple could not give consent');
    await db.exec('RESET ROLE');
    const bonus = await db.query(`SELECT 1 FROM public.event_render_credit_grants WHERE event_id = $1 AND source = 'consent_bonus'`, [F.eventId]);
    assert.equal(bonus.rows.length, 1, 'consent did not grant the promised bonus render');
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
});

test('a Setnayan ADMIN (not a member) may act for the couple — the ruling’s second half', async () => {
  assert.equal(await scalar<boolean>(F.admin, `SELECT public.moodboard_render_caller_may_act($1) AS v`, [F.eventId]), true);
  assert.ok(await scalar<string>(F.admin, BEGIN_SQL, [F.eventId, 0]), 'an admin could not begin a render');
  assert.equal(await scalar<boolean>(F.admin, `SELECT public.moodboard_set_share_consent($1, TRUE) AS v`, [F.eventId]), true);
});

test('the trusted SERVER context (no auth.uid()) is unchanged', async () => {
  const r = await db.query<{ v: boolean }>(`SELECT public.moodboard_render_caller_may_act($1) AS v`, [F.eventId]);
  assert.equal(r.rows[0]!.v, true);
});

/* ── 3 · READ ACCESS IS KEPT, MEMBER FOR MEMBER ───────────────────────────── */

test('every non-couple member still READS the balance, the couple’s renders and the pool', async () => {
  for (const who of NON_COUPLE) {
    const bal = await asRolledBack<{ credits_granted: number; credits_left: number }>(
      F[who],
      `SELECT credits_granted, credits_left FROM public.moodboard_render_balance($1)`,
      [F.eventId],
    );
    assert.equal(bal.err, null, bal.err ?? '');
    assert.equal(bal.rows.length, 1, `${who} lost the balance (zero rows = "not permitted")`);
    assert.equal(Number(bal.rows[0]!.credits_granted), 10);

    const pool = await asRolledBack<{ render_id: string }>(
      F[who],
      `SELECT render_id FROM public.moodboard_inspiration_pool($1, NULL, 6, 0, NULL)`,
      [F.eventId],
    );
    assert.equal(pool.err, null, pool.err ?? '');
    assert.deepEqual(pool.rows.map((r) => r.render_id), [F.pooledRender], `${who} lost the inspiration pool`);

    const renders = await asRolledBack<{ render_id: string }>(
      F[who],
      `SELECT render_id FROM public.event_renders WHERE event_id = $1`,
      [F.eventId],
    );
    assert.equal(renders.err, null, renders.err ?? '');
    assert.equal(renders.rows.length, 1, `${who} can no longer see the couple’s renders`);
  }
});

test('a STRANGER (no membership) still reads nothing — the read gate did not widen', async () => {
  const bal = await asRolledBack(F.stranger, `SELECT * FROM public.moodboard_render_balance($1)`, [F.eventId]);
  const pool = await asRolledBack(F.stranger, `SELECT * FROM public.moodboard_inspiration_pool($1, NULL, 6, 0, NULL)`, [F.eventId]);
  assert.equal(bal.rows.length, 0);
  assert.equal(pool.rows.length, 0);
  assert.equal(await scalar<boolean>(F.stranger, `SELECT public.moodboard_render_caller_may_act($1) AS v`, [F.eventId]), false);
});

test('the read gate is not an RPC: no browser role can call moodboard_render_caller_may_view', async () => {
  const r = await db.query<{ a: boolean; b: boolean; secdef: boolean }>(
    `SELECT has_function_privilege('anon', 'public.moodboard_render_caller_may_view(uuid)', 'EXECUTE') AS a,
            has_function_privilege('authenticated', 'public.moodboard_render_caller_may_view(uuid)', 'EXECUTE') AS b,
            (SELECT prosecdef FROM pg_proc WHERE oid = 'public.moodboard_render_caller_may_view(uuid)'::regprocedure) AS secdef`,
  );
  assert.equal(r.rows[0]!.a, false);
  assert.equal(r.rows[0]!.b, false);
  assert.equal(r.rows[0]!.secdef, true);
});
