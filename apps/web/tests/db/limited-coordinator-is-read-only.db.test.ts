/**
 * A COORDINATOR THE HOSTS SET TO LIMITED — AND A LIMITED HELPER — CANNOT WRITE THROUGH POSTGREST
 * (event-dashboard audit 2026-11-02 #19, the database half; migration 20271302707661).
 *
 * Owner 2026-10-29: LIMITED = "can see your event; changes only what you allow". It lives on the coordinator's own
 * seat as `permissions_json.access_level = 'limited'`. `is_limited_helper` asked only `role_subtype = 'viewer'`, so the
 * RESTRICTIVE lh_ro_* refusals never fired for her; and fourteen tables admitted a writer by `current_event_ids()` or
 * any accepted seat without asking the level at all, so even a 'viewer' helper wrote there.
 *
 * PER TABLE the migration touched, five people try INSERT · UPDATE · DELETE (whichever the table grants), each on an
 * event of their own:
 *   · the host (the creator)                         → succeeds
 *   · a coordinator with Full access (co-host seat)   → succeeds
 *   · a hired planner the hosts have not answered for → succeeds — THE CONTROL: the same seat kind and the same
 *     permissive arms as the Limited coordinator, so her refusal is the LEVEL, never a broken fixture
 *   · a coordinator set to Limited                    → refused (INSERT raises; UPDATE / DELETE touch 0 rows)
 *   · a limited helper ('viewer')                     → refused
 * and `is_limited_helper` itself answers for each seat.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let db: ReplayResult['db'];

before(async () => {
  db = (await createReplayedDb()).db;
});
after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

type Actor = 'host' | 'full' | 'planner' | 'limited' | 'viewer';
const ACTORS: Actor[] = ['host', 'full', 'planner', 'limited', 'viewer'];
const REFUSED: ReadonlySet<Actor> = new Set(['limited', 'viewer']);

let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

async function newUser(label: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer'::text)) RETURNING id`,
    [`${label}-${uniq()}@limited.test`],
  );
  return u.rows[0]!.id;
}

const AREAS_VIEW = `jsonb_build_object('guest_list','view','seat_plan','view','schedule','view','vendors','view',
  'invitations','view','mood_board','view','budget','view','photos','view')`;

/** One event whose only non-creator seat is `actor`'s. Returns the event, the creator and the person who acts. */
async function eventFor(actor: Actor): Promise<{ ev: string; creator: string; uid: string; guest: string }> {
  const creator = await newUser('creator');
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ($1, 'birthday', '2027-06-06'::date, 'day', 'NCR') RETURNING event_id`,
    [`Limited ${actor}`],
  );
  const ev = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`,
    [ev, creator],
  );
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role)
     VALUES ($1, 'Lola', 'Test', 'both', 'family', 'guest') RETURNING guest_id`,
    [ev],
  );
  const guest = g.rows[0]!.guest_id;
  if (actor === 'host') return { ev, creator, uid: creator, guest };

  const uid = await newUser(actor);
  const [kind, perms] =
    actor === 'full'
      ? ['co_host', `jsonb_build_object('edit_all', true, 'access_level', 'full')`]
      : actor === 'planner'
        ? ['wedding_planner_external', `jsonb_build_object('edit_all', true)`]
        : actor === 'limited'
          ? ['wedding_planner_external', `jsonb_build_object('edit_all', false, 'checkout', false, 'areas', ${AREAS_VIEW}, 'access_level', 'limited')`]
          : ['viewer', `jsonb_build_object('areas', ${AREAS_VIEW})`];
  await db.query(
    `INSERT INTO public.event_moderators (event_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, $2, ${perms}, $3, $4, now())`,
    [ev, kind, creator, uid],
  );
  return { ev, creator, uid, guest };
}

type Ctx = { ev: string; uid: string; guest: string; job: string; clip: string; amendment: string };
type Spec = {
  t: string;
  cmds: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
  /** The row `who` writes; `n` keeps rows unique. */
  ins: (c: Ctx, who: string, n: string) => [string, unknown[]];
  /** Which rows of this event the UPDATE / DELETE aim at. */
  where?: (c: Ctx) => [string, unknown[]];
  /** The host has no permissive arm here (a coordinator-only feature). */
  hostCannot?: true;
  /** Seed again for the INSERT (a junction row is unique per job+clip). */
  freshClip?: true;
};

const byEvent = (c: Ctx): [string, unknown[]] => ['event_id = $1', [c.ev]];

const SPECS: Spec[] = [
  { t: 'coordinator_feature_recommendations', cmds: ['INSERT'], hostCannot: true,
    ins: (c, who, n) => [`INSERT INTO public.coordinator_feature_recommendations (event_id, recommended_by_user_id, addon_key) VALUES ($1, $2, $3)`, [c.ev, who, `addon_${n}`]] },
  { t: 'event_category_decisions', cmds: ['INSERT', 'UPDATE', 'DELETE'],
    ins: (c, _w, n) => [`INSERT INTO public.event_category_decisions (event_id, decision, tile) VALUES ($1, 'deferred', $2)`, [c.ev, `tile_${n}`]] },
  { t: 'event_egift_methods', cmds: ['INSERT', 'UPDATE', 'DELETE'],
    ins: (c, _w, n) => [`INSERT INTO public.event_egift_methods (event_id, method_kind, label) VALUES ($1, 'other', $2)`, [c.ev, `Way ${n}`]] },
  { t: 'event_gift_records', cmds: ['INSERT', 'UPDATE', 'DELETE'],
    ins: (c, _w, n) => [`INSERT INTO public.event_gift_records (event_id, amount_php, giver_name) VALUES ($1, 500, $2)`, [c.ev, `Tita ${n}`]] },
  { t: 'event_manual_vendors', cmds: ['INSERT', 'UPDATE', 'DELETE'],
    ins: (c, _w, n) => [`INSERT INTO public.event_manual_vendors (event_id, business_name) VALUES ($1, $2)`, [c.ev, `Shop ${n}`]] },
  { t: 'event_sponsors', cmds: ['INSERT', 'UPDATE', 'DELETE'],
    ins: (c, _w, n) => [`INSERT INTO public.event_sponsors (event_id, sponsor_tier, side, full_name) VALUES ($1, 'principal', 'bride', $2)`, [c.ev, `Ninang ${n}`]] },
  { t: 'event_wish_items', cmds: ['INSERT', 'UPDATE', 'DELETE'],
    ins: (c, _w, n) => [`INSERT INTO public.event_wish_items (event_id, name) VALUES ($1, $2)`, [c.ev, `Toaster ${n}`]] },
  { t: 'event_site_drafts', cmds: ['INSERT', 'UPDATE', 'DELETE'],
    ins: (c) => [`INSERT INTO public.event_site_drafts (event_id, draft_json) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING`, [c.ev]] },
  { t: 'kwento_assignments', cmds: ['INSERT', 'UPDATE', 'DELETE'],
    ins: (c, _w, n) => [`INSERT INTO public.kwento_assignments (event_id, moment_key, assigned_guest_id) VALUES ($1, $2, $3)`, [c.ev, `m_${n}`, c.guest]] },
  { t: 'patiktok_source_clips', cmds: ['INSERT', 'UPDATE'],
    ins: (c, _w, n) => [`INSERT INTO public.patiktok_source_clips (event_id, r2_object_key) VALUES ($1, $2)`, [c.ev, `patiktok/clips/${n}.webm`]] },
  { t: 'patiktok_render_job_clips', cmds: ['INSERT'], freshClip: true,
    ins: (c) => [`INSERT INTO public.patiktok_render_job_clips (job_id, clip_id) VALUES ($1, $2)`, [c.job, c.clip]],
    where: (c) => ['job_id = $1', [c.job]] },
  { t: 'proposal_amendments', cmds: ['INSERT', 'UPDATE'],
    ins: (c, who) => [`INSERT INTO public.proposal_amendments (event_id, raised_by, proposed_by_user_id) VALUES ($1, 'couple', $2)`, [c.ev, who]] },
  { t: 'proposal_amendment_items', cmds: ['INSERT', 'UPDATE'],
    ins: (c, _w, n) => [`INSERT INTO public.proposal_amendment_items (amendment_id, event_id, item_kind, label) VALUES ($1, $2, 'request', $3)`, [c.amendment, c.ev, `Ask ${n}`]] },
];

async function newClip(ev: string): Promise<string> {
  const r = await db.query<{ clip_id: string }>(
    `INSERT INTO public.patiktok_source_clips (event_id, r2_object_key) VALUES ($1, $2) RETURNING clip_id`,
    [ev, `seed/${uniq()}.webm`],
  );
  return r.rows[0]!.clip_id;
}

/** The fixtures every spec leans on, made as the database owner (RLS does not apply). */
async function ctxFor(ev: string, creator: string, guest: string): Promise<Ctx> {
  const job = await db.query<{ job_id: string }>(
    `INSERT INTO public.patiktok_render_jobs (event_id, template_slug, requested_by, duration_sec) VALUES ($1, 'classic', $2, 10) RETURNING job_id`,
    [ev, creator],
  );
  const am = await db.query<{ amendment_id: string }>(
    `INSERT INTO public.proposal_amendments (event_id, raised_by, proposed_by_user_id) VALUES ($1, 'couple', $2) RETURNING amendment_id`,
    [ev, creator],
  );
  return { ev, uid: creator, guest, job: job.rows[0]!.job_id, clip: await newClip(ev), amendment: am.rows[0]!.amendment_id };
}

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, uid);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
}

type Outcome = { insert?: 'ok' | 'refused' | 'no-grant'; update?: number | 'no-grant'; del?: number | 'no-grant' };

/** Does `authenticated` hold the table privilege at all? Without it PostgREST cannot write for ANYONE (service role only). */
async function granted(t: string, cmd: 'INSERT' | 'UPDATE' | 'DELETE'): Promise<boolean> {
  const r = await db.query<{ g: boolean }>(`SELECT has_table_privilege('authenticated', $1, $2) AS g`, [`public.${t}`, cmd]);
  return r.rows[0]!.g;
}

async function attempt(spec: Spec, actor: Actor): Promise<Outcome> {
  const { ev, creator, uid, guest } = await eventFor(actor);
  const c = await ctxFor(ev, creator, guest);
  const where = (spec.where ?? byEvent)(c);
  const out: Outcome = {};
  // A row to aim UPDATE / DELETE at, seeded as the owner (the singleton draft included).
  const [seedSql, seedArgs] = spec.ins(c, creator, uniq());
  if (spec.t !== 'patiktok_render_job_clips') await db.query(seedSql, seedArgs);
  if (spec.cmds.includes('INSERT') && !(await granted(spec.t, 'INSERT'))) out.insert = 'no-grant';
  else if (spec.cmds.includes('INSERT')) {
    const cc = spec.freshClip ? { ...c, clip: await newClip(ev) } : c;
    const [sql, args] =
      spec.t === 'event_site_drafts'
        ? [`INSERT INTO public.event_site_drafts (event_id, draft_json) VALUES ($1, '{}'::jsonb)`, [ev]]
        : spec.ins(cc, uid, uniq());
    if (spec.t === 'event_site_drafts') await db.query(`DELETE FROM public.event_site_drafts WHERE event_id = $1`, [ev]);
    out.insert = await as(uid, () => db.query(sql, args).then(() => 'ok' as const, (e: Error) => {
      assert.match(e.message, /row-level security/, `${spec.t} INSERT by ${actor} failed for another reason: ${e.message}`);
      return 'refused' as const;
    }));
    if (spec.t === 'event_site_drafts') await db.query(seedSql, seedArgs);
  }
  if (spec.cmds.includes('UPDATE') && !(await granted(spec.t, 'UPDATE'))) out.update = 'no-grant';
  else if (spec.cmds.includes('UPDATE')) {
    const r = await as(uid, () => db.query(`UPDATE public.${spec.t} SET event_id = event_id WHERE ${where[0]}`, where[1]));
    out.update = r.affectedRows ?? 0;
  }
  if (spec.cmds.includes('DELETE') && !(await granted(spec.t, 'DELETE'))) out.del = 'no-grant';
  else if (spec.cmds.includes('DELETE')) {
    const r = await as(uid, () => db.query(`DELETE FROM public.${spec.t} WHERE ${where[0]}`, where[1]));
    out.del = r.affectedRows ?? 0;
  }
  return out;
}

for (const spec of SPECS) {
  test(`${spec.t}: Limited coordinator and limited helper refused; host, Full access and an unasked planner write`, async () => {
    for (const actor of ACTORS) {
      if (actor === 'host' && spec.hostCannot) continue;
      const o = await attempt(spec, actor);
      const refused = REFUSED.has(actor);
      // A command `authenticated` holds no privilege for is closed to PostgREST for everyone — written by the server
      // alone, behind its own gate. Nothing to prove per person there; the refusal still stands for the day a grant lands.
      if (spec.cmds.includes('INSERT') && o.insert !== 'no-grant') assert.equal(o.insert, refused ? 'refused' : 'ok', `${spec.t} INSERT · ${actor}`);
      if (spec.cmds.includes('UPDATE') && o.update !== 'no-grant') {
        if (refused) assert.equal(o.update, 0, `${spec.t} UPDATE · ${actor} changed a row`);
        else assert.ok(Number(o.update ?? 0) >= 1, `${spec.t} UPDATE · ${actor} changed nothing — the fixture is broken`);
      }
      if (spec.cmds.includes('DELETE') && o.del !== 'no-grant') {
        if (refused) assert.equal(o.del, 0, `${spec.t} DELETE · ${actor} removed a row`);
        else assert.ok(Number(o.del ?? 0) >= 1, `${spec.t} DELETE · ${actor} removed nothing — the fixture is broken`);
      }
    }
  });
}

test('is_limited_helper answers for a Limited coordinator and a viewer — never Full access, a host or an unasked planner', async () => {
  for (const actor of ACTORS) {
    const { ev, uid } = await eventFor(actor);
    const r = await as(uid, () => db.query<{ v: boolean }>(`SELECT public.is_limited_helper($1) AS v`, [ev]));
    assert.equal(r.rows[0]!.v, REFUSED.has(actor), actor);
  }
});

test('Limited follows the AREAS: a Limited coordinator the hosts set to Suppliers = Edit adds a supplier of her own', async () => {
  const { ev, uid } = await eventFor('limited');
  await db.query(
    `UPDATE public.event_moderators SET permissions_json = jsonb_set(permissions_json, '{areas,vendors}', '"edit"') WHERE event_id = $1 AND user_id = $2`,
    [ev, uid],
  );
  await as(uid, () => db.query(`INSERT INTO public.event_manual_vendors (event_id, business_name) VALUES ($1, 'Her shop')`, [ev]));
  await assert.rejects(
    () => as(uid, () => db.query(`INSERT INTO public.event_wish_items (event_id, name) VALUES ($1, 'Not hers')`, [ev])),
    /row-level security/,
  );
});
