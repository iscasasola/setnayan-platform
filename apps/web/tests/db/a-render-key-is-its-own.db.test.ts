/**
 * A ROW CANNOT BE USED TO HAVE THE SERVER SIGN SOMEBODY ELSE'S PRIVATE FILE —
 * migration 20271220579615_a_render_key_is_its_own, exercised as a REAL
 * `authenticated` session (SET ROLE + JWT claims), never as the superuser the
 * replay otherwise runs as.
 *
 *   event_renders.image_key          moodboard_finish_render refuses (FALSE) any
 *   event_renders.gallery_image_key  key but the render's own, and so does
 *                                    moodboard_attach_gallery_copy; a named
 *                                    CHECK on each column refuses every other
 *                                    writer (service role included).
 *   events website media             hero photo, hero film, site music,
 *                                    our_photos, the Save-the-Date upload
 *                                    background: a direct PATCH (the PostgREST
 *                                    path that bypasses every server action)
 *                                    may name only the PUBLIC media bucket.
 *
 * And the SERVE half, fed real rows: a forged key planted under the constraint
 * (in a rolled-back transaction — the only way one can exist) is read back
 * through the real pool RPC / the couple's own RLS read, and the app's pure
 * gates (shapeRenderPoolPage, isOwnRenderImageKey, siteMediaServeRef) refuse it
 * before any signer is called.
 *
 * 🔑 EVERY REFUSAL HAS A POSITIVE CONTROL beside it — the same session, the same
 * row, the row's OWN key, ACCEPTED. Without that, a FALSE could be the
 * membership gate or a missing grant and would prove nothing about the key rule.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { shapeRenderPoolPage, type RawPoolRow } from '../../lib/moodboard-render-pool';
import { isOwnRenderImageKey } from '../../lib/moodboard-render-keys';
import { siteMediaServeRef, siteMediaServeRefs } from '../../lib/site-media-ref';

let replay: ReplayResult;
let db: PGlite;

const F = {
  couple: '',
  guest: '',
  stranger: '',
  otherCouple: '',
  eventId: '',
  otherEventId: '',
};

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setAuthRole(null).catch(() => {});
}

/** One boolean RPC as `uid`, a real `authenticated` session. */
async function rpcAs(uid: string, sql: string, params: unknown[]): Promise<boolean | null> {
  await asUser(uid);
  try {
    const r = await db.query<{ ok: boolean | null }>(sql, params);
    return r.rows[0]!.ok;
  } finally {
    await reset();
  }
}

/** Run one statement as `uid`; the error message, or null when it succeeded AND touched a row. */
async function tryAs(uid: string, sql: string, params: unknown[] = []): Promise<string | null> {
  await asUser(uid);
  try {
    const r = await db.query(sql, params);
    if ((r.affectedRows ?? 0) === 0) return 'matched 0 rows';
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
}

async function beginAs(uid: string, eventId: string, credits: number): Promise<string> {
  await asUser(uid);
  try {
    const r = await db.query<{ id: string | null }>(
      `SELECT public.moodboard_begin_render(
         $1, 'room:ceiling', 'a stylist brief',
         jsonb_build_object('role_palette', jsonb_build_object('reception', '["#a83f2b","#f2e6d8"]'::jsonb)),
         'v1:abc', $2, NULL, '{}'::uuid[]
       ) AS id`,
      [eventId, credits],
    );
    const id = r.rows[0]!.id;
    assert.ok(id, 'begin_render must hand back a render id for a member who can pay');
    return id;
  } finally {
    await reset();
  }
}

const own = (eventId: string, renderId: string, ext = 'png') => `renders/${eventId}/${renderId}.${ext}`;
const ownGallery = (eventId: string, renderId: string) => `render-gallery/${eventId}/${renderId}.jpg`;
const FINISH = `SELECT public.moodboard_finish_render($1,$2) AS ok`;
const ATTACH = `SELECT public.moodboard_attach_gallery_copy($1,$2) AS ok`;

async function keysOf(renderId: string) {
  const r = await db.query<{ image_key: string | null; gallery_image_key: string | null }>(
    `SELECT image_key, gallery_image_key FROM public.event_renders WHERE render_id = $1`,
    [renderId],
  );
  return r.rows[0]!;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  const mk = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.couple = await mk('key-couple@test.test');
  F.guest = await mk('key-guest@test.test');
  F.stranger = await mk('key-stranger@test.test');
  F.otherCouple = await mk('key-other-couple@test.test');

  const ev = async (name: string) =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'celebration') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
  F.eventId = await ev('Pinned Key Wedding');
  F.otherEventId = await ev('Somebody Else’s Wedding');
  const member = (e: string, u: string, t: string) =>
    db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, $3)`, [e, u, t]);
  await member(F.eventId, F.couple, 'couple');
  await member(F.eventId, F.guest, 'guest');
  await member(F.otherEventId, F.otherCouple, 'couple');

  await db.query(
    `INSERT INTO public.event_render_credit_grants (event_id, credits, source) VALUES ($1, 50, 'admin'), ($2, 50, 'admin')`,
    [F.eventId, F.otherEventId],
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: the session under test is a real, non-superuser `authenticated` role', async () => {
  await asUser(F.couple);
  try {
    const r = await db.query<{ u: string; sup: boolean; uid: string }>(
      `SELECT current_user AS u,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS sup,
              auth.uid()::text AS uid`,
    );
    assert.equal(r.rows[0]!.u, 'authenticated');
    assert.equal(r.rows[0]!.sup, false, 'a superuser session would make every refusal below meaningless');
    assert.equal(r.rows[0]!.uid, F.couple);
  } finally {
    await reset();
  }
});

/* ── 1 · finish_render: the unmarked image ───────────────────────────────── */

test('finish_render REFUSES every key that is not the render’s own — and accepts its own', async () => {
  const id = await beginAs(F.couple, F.eventId, 1);
  const sibling = await beginAs(F.couple, F.eventId, 1);
  const upper = (s: string) => s.toUpperCase();

  const forged: Array<[string, string]> = [
    ['a stranger’s payment proof', `payment-proof/events/${F.otherEventId}/proof.png`],
    ['a chat attachment', `chat/00000000-0000-4000-8000-000000000000/receipt.png`],
    ['another event’s render folder', own(F.otherEventId, id)],
    ['another render of the SAME event', own(F.eventId, sibling)],
    ['a leading space', ` ${own(F.eventId, id)}`],
    ['a trailing space', `${own(F.eventId, id)} `],
    ['an upper-case extension', own(F.eventId, id, 'PNG')],
    ['an upper-case event id', own(upper(F.eventId), id)],
    ['a dot-dot escape', `renders/${F.eventId}/../${F.otherEventId}/${id}.png`],
    ['an extension the writer never mints', own(F.eventId, id, 'gif')],
    ['a scheme-qualified ref to the right key', `r2://setnayan-thread-files/${own(F.eventId, id)}`],
  ];
  for (const [why, key] of forged) {
    assert.equal(await rpcAs(F.couple, FINISH, [id, key]), false, `finish must refuse ${why}`);
    assert.equal((await keysOf(id)).image_key, null, `…and store nothing (${why})`);
  }

  // POSITIVE CONTROL — same session, same row, its OWN key: accepted.
  assert.equal(await rpcAs(F.couple, FINISH, [id, own(F.eventId, id)]), true);
  assert.equal((await keysOf(id)).image_key, own(F.eventId, id));
  // …and every extension the writer mints is admitted (the SQL list and the TS
  // list agree — lib/moodboard-render-keys.test.ts pins the text).
  assert.equal(await rpcAs(F.couple, FINISH, [sibling, own(F.eventId, sibling, 'webp')]), true);
});

test('a zero-credit GUEST — the finding’s own attacker — can no longer even begin, nor stamp any key on the couple’s render', async () => {
  // Was pinned OPEN here on purpose ("so a change to it is a visible decision").
  // It is now decided: owner ruling 2026-09-11 — only the couple (and admins)
  // start a render (20271221631865; proven member-type by member-type in
  // only-the-couple-spends-render-credits.db.test.ts). The guest's begin is
  // refused, so the key rule is proven against the couple's OWN render instead.
  await asUser(F.guest);
  try {
    const g = await db.query<{ id: string | null }>(
      `SELECT public.moodboard_begin_render($1, 'room:ceiling', 'a stylist brief', '{}'::jsonb, 'v1:abc', 0, NULL, '{}'::uuid[]) AS id`,
      [F.eventId],
    );
    assert.equal(g.rows[0]!.id, null, 'a guest began a render on the couple’s event');
  } finally {
    await reset();
  }
  const id = await beginAs(F.couple, F.eventId, 0);
  assert.equal(
    await rpcAs(F.guest, FINISH, [id, `payment-proof/events/${F.otherEventId}/proof.png`]),
    false,
  );
  assert.equal(await rpcAs(F.guest, ATTACH, [id, `payment-proof/events/${F.otherEventId}/p.jpg`]), false);
  // Even the render's OWN key is refused to the guest now — the gate, not the key.
  assert.equal(await rpcAs(F.guest, FINISH, [id, own(F.eventId, id)]), false);
  assert.equal((await keysOf(id)).image_key, null);
  // Positive control: the couple's forged key is refused by the KEY rule, and
  // the right key lands — so the two refusals above are not the key rule alone.
  assert.equal(await rpcAs(F.couple, FINISH, [id, `payment-proof/events/${F.otherEventId}/proof.png`]), false);
  assert.equal(await rpcAs(F.couple, FINISH, [id, own(F.eventId, id)]), true);
});

test('a non-member is refused even with the right key (the gate still stands)', async () => {
  const id = await beginAs(F.couple, F.eventId, 1);
  assert.equal(await rpcAs(F.stranger, FINISH, [id, own(F.eventId, id)]), false);
  assert.equal((await keysOf(id)).image_key, null);
});

/* ── 2 · attach_gallery_copy: the watermarked copy other couples see ─────── */

test('attach_gallery_copy REFUSES every key but the render’s own marked copy', async () => {
  const id = await beginAs(F.couple, F.eventId, 1);
  assert.equal(await rpcAs(F.couple, FINISH, [id, own(F.eventId, id)]), true);

  const forged: Array<[string, string]> = [
    ['a stranger’s payment proof', `payment-proof/events/${F.otherEventId}/proof.jpg`],
    ['the UNMARKED copy', own(F.eventId, id, 'jpg')],
    ['another event’s gallery folder', ownGallery(F.otherEventId, id)],
    ['a flat key with no event', `render-gallery/${id}.jpg`],
    ['a leading space', ` ${ownGallery(F.eventId, id)}`],
    ['a png extension', `render-gallery/${F.eventId}/${id}.png`],
  ];
  for (const [why, key] of forged) {
    assert.equal(await rpcAs(F.couple, ATTACH, [id, key]), false, `attach must refuse ${why}`);
    assert.equal((await keysOf(id)).gallery_image_key, null, `…and store nothing (${why})`);
  }
  assert.equal(await rpcAs(F.couple, ATTACH, [id, ownGallery(F.eventId, id)]), true);
  assert.equal((await keysOf(id)).gallery_image_key, ownGallery(F.eventId, id));
});

/* ── 3 · the CHECKs: no other writer can store one either ────────────────── */

test('the table itself refuses a forged key from ANY writer — service role / superuser included', async () => {
  const id = await beginAs(F.couple, F.eventId, 1);
  await assert.rejects(
    () => db.query(`UPDATE public.event_renders SET image_key = 'payment-proof/x.png' WHERE render_id = $1`, [id]),
    /event_renders_image_key_is_its_own/,
  );
  await assert.rejects(
    () =>
      db.query(`UPDATE public.event_renders SET gallery_image_key = 'payment-proof/x.jpg' WHERE render_id = $1`, [
        id,
      ]),
    /event_renders_gallery_image_key_is_its_own/,
  );
  // Positive control through the same door: the row's own key is accepted.
  await db.query(`UPDATE public.event_renders SET image_key = $2 WHERE render_id = $1`, [id, own(F.eventId, id)]);
  assert.equal((await keysOf(id)).image_key, own(F.eventId, id));
});

/* ── 4 · SERVE: a forged row that somehow exists is refused before signing ── */

test('SERVE: a forged pooled key reaches another couple’s shaper and is withheld — never signed', async () => {
  const id = await beginAs(F.couple, F.eventId, 1);
  assert.equal(await rpcAs(F.couple, FINISH, [id, own(F.eventId, id)]), true);
  assert.equal(await rpcAs(F.couple, ATTACH, [id, ownGallery(F.eventId, id)]), true);
  await db.query(
    `INSERT INTO public.event_render_share_consent (event_id, consented, consented_at)
     VALUES ($1, TRUE, NOW()) ON CONFLICT (event_id) DO UPDATE SET consented = TRUE, consented_at = NOW()`,
    [F.eventId],
  );

  const readPoolAsOtherCouple = async (): Promise<RawPoolRow[]> => {
    await asUser(F.otherCouple);
    try {
      const r = await db.query<RawPoolRow>(
        `SELECT * FROM public.moodboard_inspiration_pool($1, NULL, 24, 0, $2)`,
        [F.otherEventId, id],
      );
      return r.rows;
    } finally {
      await reset();
    }
  };

  // Positive control: the honest row is in the pool and IS signed.
  const signed: string[] = [];
  const spy = async (key: string) => {
    signed.push(key);
    return `https://signed/${key}`;
  };
  const honest = await shapeRenderPoolPage(await readPoolAsOtherCouple(), spy);
  assert.equal(honest.renders.length, 1);
  assert.deepEqual(signed, [ownGallery(F.eventId, id)]);

  // Plant a forged key the only way one can exist — around the constraint, in
  // a transaction that is rolled back — and read it through the real RPC.
  signed.length = 0;
  await db.exec('BEGIN');
  try {
    await db.exec(`ALTER TABLE public.event_renders DROP CONSTRAINT event_renders_gallery_image_key_is_its_own`);
    await db.query(`UPDATE public.event_renders SET gallery_image_key = $2 WHERE render_id = $1`, [
      id,
      `payment-proof/events/${F.otherEventId}/proof.jpg`,
    ]);
    const rows = await readPoolAsOtherCouple();
    assert.equal(rows.length, 1, 'the RPC does return the planted row — the app gate is what stops it');
    assert.equal(rows[0]!.gallery_image_key, `payment-proof/events/${F.otherEventId}/proof.jpg`);
    const forged = await shapeRenderPoolPage(rows, spy);
    assert.equal(forged.renders.length, 0);
    assert.equal(forged.withheld, 1);
    assert.deepEqual(signed, [], 'the forged key must never reach the signer');
  } finally {
    await db.exec('ROLLBACK');
    await reset();
  }
  assert.equal((await keysOf(id)).gallery_image_key, ownGallery(F.eventId, id), 'rolled back');
});

test('SERVE: a forged image key read back by the couple through RLS is refused before signing', async () => {
  const id = await beginAs(F.couple, F.eventId, 1);
  await db.exec('BEGIN');
  try {
    await db.exec(`ALTER TABLE public.event_renders DROP CONSTRAINT event_renders_image_key_is_its_own`);
    await db.query(`UPDATE public.event_renders SET image_key = $2 WHERE render_id = $1`, [
      id,
      `payment-proof/events/${F.otherEventId}/proof.png`,
    ]);
    await asUser(F.couple);
    const r = await db.query<{ render_id: string; image_key: string }>(
      `SELECT render_id, image_key FROM public.event_renders WHERE render_id = $1`,
      [id],
    );
    assert.equal(r.rows.length, 1, 'the couple can read the row (Pattern B) — so the gate must be in the app');
    const row = r.rows[0]!;
    assert.equal(isOwnRenderImageKey(row.image_key, { eventId: F.eventId, renderId: row.render_id }), false);
    // Positive control on the same row id: its own key passes the same gate.
    assert.equal(isOwnRenderImageKey(own(F.eventId, id), { eventId: F.eventId, renderId: row.render_id }), true);
  } finally {
    await db.exec('ROLLBACK');
    await reset();
  }
});

/* ── 5 · event website media: the PATCH path ─────────────────────────────── */

const PRIVATE = [
  'r2://setnayan-thread-files/payment-proof/events/x/proof.png',
  'r2://setnayan-vendor-verification/vendors/x/verification/gov.png',
  'r2://setnayan-vendor-contracts/x/contract.pdf',
  ' r2://setnayan-thread-files/chat/x/receipt.png', // a leading space
  '\u00a0r2://setnayan-thread-files/chat/x/receipt.png', // a no-break space: Postgres btrim keeps it, JS trim() drops it
  '\ufeffr2://setnayan-thread-files/chat/x/receipt.png', // a byte-order mark: the same trap
  '\tr2://setnayan-vendor-verification/vendors/x/verification/gov.png',
  'R2://setnayan-thread-files/chat/x/receipt.png',
  'r2://setnayan-samples/x.png',
  'r2://some-unknown-bucket/x.png',
];
const PUBLIC_OK = [
  () => `r2://setnayan-media/events/${F.eventId}/landing-page-hero/a.jpg`,
  () => 'r2://setnayan-media/living-heroes/0000-hero.jpg',
  () => '/demo/hero.jpg',
  () => 'https://example.com/hero.jpg',
];

test('a couple’s direct PATCH may not point website media at a private bucket — each column', async () => {
  const cols = ['landing_page_hero_image_url', 'landing_page_hero_video_r2_key', 'site_bg_music_r2_key'];
  for (const col of cols) {
    for (const bad of PRIVATE) {
      const err = await tryAs(F.couple, `UPDATE public.events SET ${col} = $2 WHERE event_id = $1`, [F.eventId, bad]);
      assert.match(
        err ?? 'ACCEPTED',
        /events_site_media_names_only_the_public_bucket/,
        `${col} must refuse ${JSON.stringify(bad)}`,
      );
    }
    // POSITIVE CONTROLS — same session, same row, the public bucket / a URL.
    for (const good of PUBLIC_OK) {
      assert.equal(
        await tryAs(F.couple, `UPDATE public.events SET ${col} = $2 WHERE event_id = $1`, [F.eventId, good()]),
        null,
        `${col} must accept ${good()}`,
      );
    }
    assert.equal(await tryAs(F.couple, `UPDATE public.events SET ${col} = NULL WHERE event_id = $1`, [F.eventId]), null);
  }
});

test('our_photos and the Save-the-Date upload background are held the same way', async () => {
  for (const bad of PRIVATE) {
    const gallery = JSON.stringify([`r2://setnayan-media/events/${F.eventId}/our-photos/a.jpg`, bad]);
    assert.match(
      (await tryAs(F.couple, `UPDATE public.events SET our_photos = $2::jsonb WHERE event_id = $1`, [
        F.eventId,
        gallery,
      ])) ?? 'ACCEPTED',
      /events_site_media_names_only_the_public_bucket/,
      `our_photos must refuse a gallery holding ${JSON.stringify(bad)}`,
    );
    assert.match(
      (await tryAs(F.couple, `UPDATE public.events SET std_background = $2::jsonb WHERE event_id = $1`, [
        F.eventId,
        JSON.stringify({ kind: 'upload', value: bad }),
      ])) ?? 'ACCEPTED',
      /events_site_media_names_only_the_public_bucket/,
      `std_background must refuse an upload of ${JSON.stringify(bad)}`,
    );
  }
  // Positive controls.
  const okGallery = JSON.stringify(PUBLIC_OK.map((f) => f()));
  assert.equal(
    await tryAs(F.couple, `UPDATE public.events SET our_photos = $2::jsonb WHERE event_id = $1`, [F.eventId, okGallery]),
    null,
  );
  for (const bg of [
    { kind: 'upload', value: `r2://setnayan-media/events/${F.eventId}/std-background/a.jpg` },
    { kind: 'plain', value: '#f2e6d8' },
    { kind: 'realistic', value: 'garden' },
  ]) {
    assert.equal(
      await tryAs(F.couple, `UPDATE public.events SET std_background = $2::jsonb WHERE event_id = $1`, [
        F.eventId,
        JSON.stringify(bg),
      ]),
      null,
      `std_background must accept ${JSON.stringify(bg)}`,
    );
  }
});

test('SERVE: a private-bucket website ref that somehow exists resolves to NOTHING before signing', async () => {
  await db.exec('BEGIN');
  try {
    await db.exec(`ALTER TABLE public.events DROP CONSTRAINT events_site_media_names_only_the_public_bucket`);
    await db.query(
      `UPDATE public.events
          SET landing_page_hero_image_url = $2, site_bg_music_r2_key = $3, our_photos = $4::jsonb
        WHERE event_id = $1`,
      [
        F.eventId,
        PRIVATE[0],
        PRIVATE[5],
        JSON.stringify([PRIVATE[1], `r2://setnayan-media/events/${F.eventId}/our-photos/a.jpg`]),
      ],
    );
    const r = await db.query<{ h: string; m: string; p: unknown }>(
      `SELECT landing_page_hero_image_url AS h, site_bg_music_r2_key AS m, our_photos AS p
         FROM public.events WHERE event_id = $1`,
      [F.eventId],
    );
    const row = r.rows[0]!;
    assert.equal(siteMediaServeRef(row.h), null);
    assert.equal(siteMediaServeRef(row.m), null, 'a BOM-led private ref must not survive the trim');
    assert.deepEqual(siteMediaServeRefs(row.p), [`r2://setnayan-media/events/${F.eventId}/our-photos/a.jpg`]);
  } finally {
    await db.exec('ROLLBACK');
    await reset();
  }
});
