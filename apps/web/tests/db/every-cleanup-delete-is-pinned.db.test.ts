/**
 * A BROWSER CAN NO LONGER CHOOSE A STORAGE KEY THAT A CLEANUP JOB WILL DELETE
 * — migration 20271219262486_every_cleanup_delete_is_pinned, exercised as a
 * REAL `authenticated` session (SET ROLE + JWT claims), never as the superuser
 * the replay otherwise runs as.
 *
 * The class: a non-admin writes `r2://<bucket>/<key>` into a column of a row they
 * own; a job running with the ADMIN client later deletes whatever that string
 * names. The delete side is pinned in the app (lib/cleanup-delete-scope.ts);
 * this file proves the WRITE side:
 *
 *   papic_photos                    UPDATE on the five service-written keys is
 *                                   REVOKED; clip_web_r2_key (a real session
 *                                   writer) is held to the row's own event.
 *   vendor_papic_captures           every key held to papic/vendor-<v>/event-<e>/
 *                                   on INSERT and UPDATE (restrictive policies —
 *                                   its grants are TABLE-level, so a column revoke
 *                                   would be inert).
 *   vendor_verification_applications every string in doc_uploads that LOOKS LIKE
 *                                   a storage ref (padded, BOM-led, upper-cased
 *                                   included) must be a canonical ref under the
 *                                   vendor's own folder, INSERT and UPDATE — the
 *                                   path #5401 believed SEC-1 already pinned.
 *
 * 🔑 EVERY REFUSAL HAS A POSITIVE CONTROL beside it — the same session, the
 * same row, a key in the RIGHT folder, ACCEPTED. Without that, a refusal could
 * be "permission denied" for an unrelated reason (a grant the replay never had)
 * and prove nothing about the rule. `has_table_privilege` is never used to
 * judge a grant here: it answers FALSE while column grants stand.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { referenceCandidateForms } from '../../lib/verification-docs';
import { buildSlotValue } from '../../lib/vendor-verification-slots';

let replay: ReplayResult;
let db: PGlite;

const F = {
  couple: '',
  claimer: '',
  vendorUid: '',
  victimUid: '',
  eventId: '',
  otherEventId: '',
  seatId: '',
  photoId: '',
  vendorId: '',
  victimVendorId: '',
  captureId: '',
  applicationId: '',
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
/** Run one statement as `uid`; returns the error message, or null when it succeeded AND touched a row. */
async function tryAs(uid: string, sql: string, params: unknown[] = []): Promise<string | null> {
  await asUser(uid);
  try {
    const r = await db.query(sql, params);
    // An RLS USING miss is zero rows, not an error — treat it as a refusal so a
    // "success" can never be a silent no-op.
    if ((r.affectedRows ?? 0) === 0) return 'matched 0 rows';
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
}

const VICTIM_GOV_ID = () => `r2://setnayan-vendor-verification/vendors/${F.victimVendorId}/verification/gov.png`;
const VICTIM_LOGO = () => `r2://setnayan-media/vendors/${F.victimVendorId}/logo/logo.png`;
const OTHER_COUPLES_PHOTO = () => `r2://setnayan-media/papic/event-${F.otherEventId}/seat-x/a.jpg`;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  const mk = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.couple = await mk('pin-couple@test.test', 'customer');
  F.claimer = await mk('pin-claimer@test.test', 'customer');
  F.vendorUid = await mk('pin-vendor@test.test', 'vendor');
  F.victimUid = await mk('pin-victim@test.test', 'vendor');

  const ev = async (name: string) =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
  F.eventId = await ev('Pinned Delete Event');
  F.otherEventId = await ev('Somebody Else’s Event');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [F.eventId, F.couple],
  );

  F.seatId = (
    await db.query<{ seat_id: string }>(
      `INSERT INTO public.paparazzi_seats (event_id, claimer_user_id, seat_index, sku_code, claim_qr_token)
       VALUES ($1, $2, 1, 'PAPIC_CAMERA_FREE', 'tok-pinned-delete') RETURNING seat_id`,
      [F.eventId, F.claimer],
    )
  ).rows[0]!.seat_id;
  F.photoId = (
    await db.query<{ photo_id: string }>(
      `INSERT INTO public.papic_photos (event_id, paparazzi_seat_id, r2_object_key, photo_type)
       VALUES ($1, $2, $3, 'clip') RETURNING photo_id`,
      [F.eventId, F.seatId, `r2://setnayan-media/papic/event-${F.eventId}/seat-${F.seatId}/u-papic-1.mp4`],
    )
  ).rows[0]!.photo_id;

  const vp = async (uid: string, name: string) =>
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
         RETURNING vendor_profile_id`,
        [uid, name],
      )
    ).rows[0]!.vendor_profile_id;
  F.vendorId = await vp(F.vendorUid, 'Pinned Studio');
  F.victimVendorId = await vp(F.victimUid, 'Victim Studio');

  // A booking needs a verified shop (the vendor_not_verified trigger).
  await db.query(
    `UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = now()
      WHERE vendor_profile_id = $1`,
    [F.vendorId],
  );
  // The supplier is BOOKED at the event — the insert policy's own gate.
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Pinned Studio', 'contracted', $2)`,
    [F.eventId, F.vendorId],
  );
  F.captureId = (
    await db.query<{ capture_id: string }>(
      `INSERT INTO public.vendor_papic_captures (vendor_profile_id, event_id, r2_object_key, media_type)
       VALUES ($1, $2, $3, 'photo') RETURNING capture_id`,
      [F.vendorId, F.eventId, `r2://setnayan-media/papic/vendor-${F.vendorId}/event-${F.eventId}/cap-1.jpg`],
    )
  ).rows[0]!.capture_id;

  F.applicationId = (
    await db.query<{ application_id: string }>(
      `INSERT INTO public.vendor_verification_applications (vendor_profile_id, application_type, status, doc_uploads)
       VALUES ($1, 'initial', 'draft', '{}'::jsonb) RETURNING application_id`,
      [F.vendorId],
    )
  ).rows[0]!.application_id;

  /*
    ⚖ PRODUCTION'S GRANT SHAPE ON vendor_papic_captures IS TABLE-LEVEL INSERT +
    UPDATE to `authenticated` (exposure baseline: `tpriv … SIUD`) — Supabase's
    platform default privilege, which the replay does not necessarily emulate.
    Restated here so the refusals below are the POLICY's and not a missing
    grant's; the positive controls prove the grant is in effect.
  */
  await db.exec(`GRANT SELECT, INSERT, UPDATE ON public.vendor_papic_captures TO authenticated`);
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
    assert.equal(r.rows[0]!.sup, false, 'RLS does not bind a superuser — every refusal below would be meaningless');
    assert.equal(r.rows[0]!.uid, F.couple);
  } finally {
    await reset();
  }
});

test('META: the migration’s policies exist and are RESTRICTIVE (a permissive one would WIDEN)', async () => {
  const r = await db.query<{ tablename: string; policyname: string; permissive: string }>(
    `SELECT tablename, policyname, permissive FROM pg_policies
      WHERE schemaname = 'public'
        AND policyname IN ('papic_photos_keys_stay_in_their_event',
                           'vendor_papic_captures_keys_stay_in_their_folder_insert',
                           'vendor_papic_captures_keys_stay_in_their_folder_update',
                           'vendor_verification_applications_refs_are_own_insert',
                           'vendor_verification_applications_refs_are_own_update')`,
  );
  assert.equal(r.rows.length, 5);
  for (const row of r.rows) assert.equal(row.permissive, 'RESTRICTIVE', row.policyname);
});

/* ── 1 · papic_photos ─────────────────────────────────────────────────────── */

test('papic_photos: UPDATE on the five service-written keys is gone from every browser role — per column', async () => {
  for (const role of ['authenticated', 'anon']) {
    for (const col of ['r2_object_key', 'display_r2_key', 'poster_r2_key', 'thumb_r2_key', 'wall_safe_r2_key']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege($1, 'public.papic_photos', $2, 'UPDATE') AS ok`,
        [role, col],
      );
      assert.equal(r.rows[0]!.ok, false, `${role} can still UPDATE papic_photos.${col}`);
    }
  }
  // …and the one a session legitimately writes is still granted.
  const keep = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege('authenticated', 'public.papic_photos', 'clip_web_r2_key', 'UPDATE') AS ok`,
  );
  assert.equal(keep.rows[0]!.ok, true, 'persistSeatClipWebCopy writes clip_web_r2_key through the claimer’s session');
});

test('THE REVIEW’S EXPLOIT: a couple PATCHing their own photo’s key to a supplier’s ID is REFUSED', async () => {
  const err = await tryAs(
    F.couple,
    `UPDATE public.papic_photos SET r2_object_key = $2 WHERE photo_id = $1`,
    [F.photoId, VICTIM_GOV_ID()],
  );
  assert.ok(err, 'the couple re-pointed their own photo at another tenant’s object');
  assert.match(err!, /permission denied/i);
});

test('papic_photos.clip_web_r2_key: own event folder ACCEPTED, anywhere else REFUSED — couple and claimer', async () => {
  const own = `r2://setnayan-media/papic/event-${F.eventId}/seat-${F.seatId}/u-papic-1-web.mp4`;
  for (const uid of [F.couple, F.claimer]) {
    for (const foreign of [VICTIM_GOV_ID(), VICTIM_LOGO(), OTHER_COUPLES_PHOTO(),
      `r2://setnayan-media/papic/event-${F.eventId}/../vendors/${F.victimVendorId}/logo.png`]) {
      const err = await tryAs(uid, `UPDATE public.papic_photos SET clip_web_r2_key = $2 WHERE photo_id = $1`, [F.photoId, foreign]);
      assert.ok(err, `${uid === F.couple ? 'couple' : 'claimer'} stored ${foreign}`);
      assert.match(err!, /row-level security|violates/i);
    }
    // POSITIVE CONTROL — same session, same row, the right folder.
    assert.equal(
      await tryAs(uid, `UPDATE public.papic_photos SET clip_web_r2_key = $2 WHERE photo_id = $1`, [F.photoId, own]),
      null,
      'a legitimate web copy was refused — the seat capture flow is broken',
    );
    await db.query(`UPDATE public.papic_photos SET clip_web_r2_key = NULL WHERE photo_id = $1`, [F.photoId]);
  }
});

/* ── 2 · vendor_papic_captures ────────────────────────────────────────────── */

test('vendor_papic_captures INSERT: a key outside papic/vendor-<v>/event-<e>/ is REFUSED; the route’s own shape is ACCEPTED', async () => {
  const insert = `INSERT INTO public.vendor_papic_captures
                    (vendor_profile_id, event_id, r2_object_key, poster_r2_key, media_type)
                  VALUES ($1, $2, $3, $4, 'photo')`;
  for (const [key, poster] of [
    [VICTIM_GOV_ID(), null],
    [VICTIM_LOGO(), null],
    [OTHER_COUPLES_PHOTO(), null],
    [`r2://setnayan-media/papic/vendor-${F.vendorId}/event-${F.otherEventId}/cap-2.jpg`, null],
    [`r2://setnayan-media/papic/vendor-${F.victimVendorId}/event-${F.eventId}/cap-2.jpg`, null],
    [`r2://setnayan-media/papic/vendor-${F.vendorId}/event-${F.eventId}/cap-2.jpg`, VICTIM_LOGO()],
  ] as const) {
    const err = await tryAs(F.vendorUid, insert, [F.vendorId, F.eventId, key, poster]);
    assert.ok(err, `a booked supplier inserted a capture naming ${key} / ${poster}`);
    assert.match(err!, /row-level security|violates/i);
  }
  // POSITIVE CONTROL — exactly what app/api/vendor/papic-capture/route.ts mints.
  const base = `r2://setnayan-media/papic/vendor-${F.vendorId}/event-${F.eventId}/cap-3`;
  assert.equal(
    await tryAs(F.vendorUid, insert, [F.vendorId, F.eventId, `${base}.mp4`, `${base}-poster.jpg`]),
    null,
    'the supplier route’s own capture shape was refused — on-the-day capture is broken',
  );
});

test('vendor_papic_captures UPDATE: re-pointing an existing capture at a stranger’s object is REFUSED', async () => {
  const upd = `UPDATE public.vendor_papic_captures SET r2_object_key = $2 WHERE capture_id = $1`;
  const err = await tryAs(F.vendorUid, upd, [F.captureId, VICTIM_GOV_ID()]);
  assert.ok(err, 'the supplier re-pointed their own capture at another tenant’s object');
  assert.match(err!, /row-level security|violates/i);
  // POSITIVE CONTROL — the same UPDATE to a key in their own folder goes through.
  assert.equal(
    await tryAs(F.vendorUid, upd, [F.captureId, `r2://setnayan-media/papic/vendor-${F.vendorId}/event-${F.eventId}/cap-1b.jpg`]),
    null,
  );
});

/* ── 3 · vendor_verification_applications ─────────────────────────────────── */

test('THE REVIEW’S APPLICATION EXPLOIT: a draft naming another shop’s permit or a stranger’s logo is REFUSED', async () => {
  const upd = `UPDATE public.vendor_verification_applications SET doc_uploads = $2::jsonb WHERE application_id = $1`;
  for (const doc of [
    { government_id: { r2_key: VICTIM_GOV_ID() } },
    { portfolio_samples: [{ r2_key: `r2://setnayan-media/vendors/${F.vendorId}/p1.jpg` }, { r2_key: VICTIM_LOGO() }] },
    { bank_account_proof: { r2_key: `r2://setnayan-vendor-verification/vendors/${F.vendorId}/other/x.pdf` } },
    { nested: { deeper: ['r2://setnayan-thread-files/chat/t/a.pdf'] } },
  ]) {
    const err = await tryAs(F.vendorUid, upd, [F.applicationId, JSON.stringify(doc)]);
    assert.ok(err, `a vendor stored ${JSON.stringify(doc)} on its own draft`);
    assert.match(err!, /row-level security|violates/i);
  }
  // POSITIVE CONTROL — both places the intake's own gate accepts.
  assert.equal(
    await tryAs(F.vendorUid, upd, [
      F.applicationId,
      JSON.stringify({
        government_id: { r2_key: `r2://setnayan-vendor-verification/vendors/${F.vendorId}/verification/gov.png` },
        portfolio_samples: [{ r2_key: `r2://setnayan-media/vendors/${F.vendorId}/portfolio/p1.jpg` }],
        social_media: { instagram: 'https://instagram.com/pinned' },
      }),
    ]),
    null,
    'a legitimate draft was refused — no vendor could submit verification',
  );
});

test('…and the draft cannot be SUBMITTED carrying a foreign ref either (the move to pending_review)', async () => {
  await db.query(
    `UPDATE public.vendor_verification_applications SET status = 'draft', doc_uploads = '{}'::jsonb WHERE application_id = $1`,
    [F.applicationId],
  );
  const err = await tryAs(
    F.vendorUid,
    `UPDATE public.vendor_verification_applications
        SET status = 'pending_review', doc_uploads = $2::jsonb WHERE application_id = $1`,
    [F.applicationId, JSON.stringify({ government_id: { r2_key: VICTIM_GOV_ID() } })],
  );
  assert.ok(err);
  assert.match(err!, /row-level security|violates/i);
});

test('a NEW application cannot be born carrying a foreign ref', async () => {
  const ins = `INSERT INTO public.vendor_verification_applications (vendor_profile_id, application_type, status, doc_uploads)
               VALUES ($1, 'initial', 'draft', $2::jsonb)`;
  const err = await tryAs(F.vendorUid, ins, [F.vendorId, JSON.stringify({ government_id: { r2_key: VICTIM_LOGO() } })]);
  assert.ok(err);
  assert.match(err!, /row-level security|violates/i);
  assert.equal(
    await tryAs(F.vendorUid, ins, [F.vendorId, JSON.stringify({ government_id: { r2_key: `r2://setnayan-vendor-verification/vendors/${F.vendorId}/verification/g.png` } })]),
    null,
  );
});

/* ── 4 · doc_uploads is an ALLOW-LIST, not a deny-list (review of #5414) ──────
 *
 * The first cut refused only strings that BEGAN `r2://`. The shipped readers
 * normalise before they test the scheme — parseStoredAsset / parseClientRef /
 * planCleanupDelete `trim()` (whitespace, NBSP, BOM, line separators), and
 * referenceCandidateForms also lower-cases it — so a foreign ref with a leading
 * space, or spelled `R2://`, was ACCEPTED on write and then resolved to the
 * victim's object by the admin review screen. Every variant below is first
 * shown to be resolved to the victim's object by a SHIPPED reader (so the test
 * cannot be passing on a string nothing would ever read), then refused on
 * INSERT, on UPDATE and nested inside the portfolio array. */

const VICTIM_GOV_KEY = () => `vendors/${F.victimVendorId}/verification/gov.png`;

/** Strings a shipped reader resolves to the victim's government ID. */
const READER_RESOLVED_VARIANTS = (): Array<[string, string]> => {
  const g = VICTIM_GOV_ID();
  const upper = `R2${g.slice(2)}`;
  return [
    ['leading space', ` ${g}`],
    ['leading tab', `\t${g}`],
    ['leading newline', `\n${g}`],
    ['leading CRLF', `\r\n${g}`],
    ['leading NBSP', `\u00a0${g}`],
    ['leading BOM', `\ufeff${g}`],
    ['leading line separator', `\u2028${g}`],
    ['leading ideographic space', `\u3000${g}`],
    ['upper-case scheme', upper],
    ['padding + upper-case scheme', ` \t\u00a0${upper}`],
    ['trailing whitespace', `${g} \n`],
  ];
};

/** Strings no reader resolves today — refused anyway, because the rule is an allow-list. */
const STRICTER_VARIANTS = (): Array<[string, string]> => {
  const g = VICTIM_GOV_ID();
  return [
    ['leading zero-width space', `\u200b${g}`],
    ['leading control character', `\u0001${g}`],
    ['leading punctuation', `"${g}`],
    ['single-slash scheme', `r2:/${g.slice('r2://'.length)}`],
  ];
};

test('META: every READER_RESOLVED variant really is read as the victim’s file by a shipped reader', () => {
  const variants = READER_RESOLVED_VARIANTS();
  assert.equal(variants.length, 11);
  for (const [label, v] of variants) {
    assert.ok(
      referenceCandidateForms(v).includes(VICTIM_GOV_KEY()),
      `${label}: no shipped reader resolves this to the victim's object — the refusal below would prove nothing`,
    );
  }
});

test('FIX 1: a foreign ref behind padding, a BOM or an upper-case scheme is REFUSED on UPDATE — top level and nested', async () => {
  await db.query(
    `UPDATE public.vendor_verification_applications SET status = 'draft', doc_uploads = '{}'::jsonb WHERE application_id = $1`,
    [F.applicationId],
  );
  const upd = `UPDATE public.vendor_verification_applications SET doc_uploads = $2::jsonb WHERE application_id = $1`;
  let refused = 0;
  for (const [label, v] of [...READER_RESOLVED_VARIANTS(), ...STRICTER_VARIANTS()]) {
    for (const doc of [
      { government_id: { r2_key: v, uploaded_at: '2026-09-10T00:00:00.000Z' } },
      { portfolio_samples: [{ r2_key: `r2://setnayan-media/vendors/${F.vendorId}/portfolio/p1.jpg` }, { r2_key: v }] },
    ]) {
      const err = await tryAs(F.vendorUid, upd, [F.applicationId, JSON.stringify(doc)]);
      assert.ok(err, `${label}: a vendor stored ${JSON.stringify(v)} on its own draft`);
      assert.match(err!, /row-level security|violates/i, `${label}: refused for the wrong reason — ${err}`);
      refused += 1;
    }
  }
  assert.equal(refused, 30, 'not every variant was exercised');
});

test('FIX 1: …and on INSERT, and on the move to pending_review', async () => {
  const ins = `INSERT INTO public.vendor_verification_applications (vendor_profile_id, application_type, status, doc_uploads)
               VALUES ($1, 'initial', 'draft', $2::jsonb)`;
  const submit = `UPDATE public.vendor_verification_applications
                     SET status = 'pending_review', doc_uploads = $2::jsonb WHERE application_id = $1`;
  let refused = 0;
  for (const [label, v] of [...READER_RESOLVED_VARIANTS(), ...STRICTER_VARIANTS()]) {
    const doc = JSON.stringify({ dti_certificate: { r2_key: v } });
    const insErr = await tryAs(F.vendorUid, ins, [F.vendorId, doc]);
    assert.ok(insErr, `${label}: a new application was born carrying ${JSON.stringify(v)}`);
    assert.match(insErr!, /row-level security|violates/i);
    const subErr = await tryAs(F.vendorUid, submit, [F.applicationId, doc]);
    assert.ok(subErr, `${label}: a draft was submitted carrying ${JSON.stringify(v)}`);
    assert.match(subErr!, /row-level security|violates/i);
    refused += 2;
  }
  assert.equal(refused, 30);
});

test('FIX 1 POSITIVE CONTROL: the intake’s own writer output still saves — refs, dates, links, referees, a legacy URL', async () => {
  await db.query(
    `UPDATE public.vendor_verification_applications SET status = 'draft', doc_uploads = '{}'::jsonb WHERE application_id = $1`,
    [F.applicationId],
  );
  // Built by the SHIPPED slot writer (lib/vendor-verification-slots.ts), not by hand.
  const own = (slot: string) => `r2://setnayan-vendor-verification/vendors/${F.vendorId}/verification/${slot}.pdf`;
  const doc = {
    government_id: buildSlotValue('government_id', { r2Ref: own('gov'), url: null, scheduledAt: null }),
    dti_certificate: buildSlotValue('dti_certificate', { r2Ref: own('dti'), url: null, scheduledAt: null }),
    bank_account_proof: buildSlotValue('bank_account_proof', {
      // A legacy public URL is a legal stored shape (file-upload.tsx) and is not a storage ref.
      r2Ref: 'https://media.setnayan.com/legacy/bank.jpg', url: null, scheduledAt: null,
    }),
    portfolio_samples: buildSlotValue('portfolio_samples', {
      r2Ref: null, url: null, scheduledAt: null,
      portfolioRefs: [
        `r2://setnayan-media/vendors/${F.vendorId}/portfolio/p1.jpg`,
        `  r2://setnayan-vendor-verification/vendors/${F.vendorId}/verification/p2.jpg  `,
      ],
    }),
    social_media: buildSlotValue('social_media', {
      r2Ref: null, url: null, scheduledAt: null,
      social: { instagram: 'https://instagram.com/r2d2studio', website: 'https://r2-studio.example' },
    }),
    client_references: buildSlotValue('client_references', {
      r2Ref: null, url: null, scheduledAt: null,
      references: [{ name: 'R2 Events Manila', contact_number: '0917 000 0000', event: 'Wedding', date: '2026-01-01' }],
    }),
    google_meet: buildSlotValue('google_meet', { r2Ref: null, url: null, scheduledAt: '2026-09-11T02:00:00.000Z' }),
  };
  const upd = `UPDATE public.vendor_verification_applications SET doc_uploads = $2::jsonb WHERE application_id = $1`;
  assert.equal(
    await tryAs(F.vendorUid, upd, [F.applicationId, JSON.stringify(doc)]),
    null,
    'a legitimate draft built by the shipped writer was refused — no vendor could save verification',
  );
  const ins = `INSERT INTO public.vendor_verification_applications (vendor_profile_id, application_type, status, doc_uploads)
               VALUES ($1, 'initial', 'draft', $2::jsonb)`;
  assert.equal(await tryAs(F.vendorUid, ins, [F.vendorId, JSON.stringify(doc)]), null, 'a legitimate new application was refused');
  // …and the move to pending_review with that same document goes through.
  assert.equal(
    await tryAs(
      F.vendorUid,
      `UPDATE public.vendor_verification_applications SET status = 'pending_review', doc_uploads = $2::jsonb WHERE application_id = $1`,
      [F.applicationId, JSON.stringify(doc)],
    ),
    null,
    'a legitimate application could not be submitted',
  );
});

test('FIX 1: the vendor’s OWN ref, padded or upper-cased, is refused too — only the canonical form a writer mints is accepted', async () => {
  await db.query(
    `UPDATE public.vendor_verification_applications SET status = 'draft', doc_uploads = '{}'::jsonb WHERE application_id = $1`,
    [F.applicationId],
  );
  const own = `r2://setnayan-vendor-verification/vendors/${F.vendorId}/verification/gov.png`;
  const upd = `UPDATE public.vendor_verification_applications SET doc_uploads = $2::jsonb WHERE application_id = $1`;
  for (const v of [` ${own}`, `\ufeff${own}`, `R2${own.slice(2)}`]) {
    const err = await tryAs(F.vendorUid, upd, [F.applicationId, JSON.stringify({ government_id: { r2_key: v } })]);
    assert.ok(err, `a non-canonical own ref ${JSON.stringify(v)} was stored`);
    assert.match(err!, /row-level security|violates/i);
  }
});

test('the service role is untouched — the sweeps, the derivative writer and the recording RPC still write', async () => {
  await reset();
  // As the replay's owner (standing in for service_role, which bypasses RLS):
  // a derivative key and a scrubbed doc_uploads both land.
  await db.query(
    `UPDATE public.papic_photos SET display_r2_key = $2 WHERE photo_id = $1`,
    [F.photoId, `r2://setnayan-media/derivatives/papic/event-${F.eventId}/seat-${F.seatId}/u.jpg.display.avif`],
  );
  await db.query(
    `UPDATE public.vendor_verification_applications SET doc_uploads = '{}'::jsonb WHERE application_id = $1`,
    [F.applicationId],
  );
  const r = await db.query<{ has_bypass: boolean }>(
    `SELECT rolbypassrls AS has_bypass FROM pg_roles WHERE rolname = 'service_role'`,
  );
  if (r.rows.length > 0) assert.equal(r.rows[0]!.has_bypass, true);
});
