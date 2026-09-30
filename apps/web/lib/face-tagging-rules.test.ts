/**
 * FACE TAGGING — THE 2026-09-30 RULES, EACH ABLE TO FAIL ON ITS OWN.
 *
 * Owner, DECISION_LOG rows dated 2026-09-30 (read together):
 *   R1 · "FACE TAGGING IS OFFERED ONLY WHEN THE EVENT HAS PAPIC ACTIVE" —
 *        *"but only register face tagging when papic service is active."*
 *   R2 · the invitation asks the QUESTION (the-selfie-waits-for-a-yes.test.ts).
 *   R3 · no reply card takes a selfie (the-selfie-waits-for-a-yes.test.ts,
 *        the-arrival-says-what-opens.test.ts).
 *   R4 · "THE FACE-TAGGING SELFIE IS ERASED WHEN THE GUEST LOGS OUT" + "…ALSO
 *        ENDS WHEN THE EVENT'S PAPIC SERVICE CLOSES" (12 h after the event) —
 *        tags stay; the selfie-as-avatar goes too; said before sign-out.
 *   R6 · "FACE DATA: THREE OWNER ANSWERS": server-side enrol checks the Yes,
 *        Papic and the couple's switch; the couple's "off" ERASES.
 *   R7 · the account's face is reused per event only, OFF until switched on.
 *
 * (R5 — the one end-of-event rescan — needs a server-side face embedder this
 * repo does not have; see the PR body. Nothing here pretends it exists.)
 *
 * 🪤 Behaviour is EXECUTED wherever it can be (the lifetime arithmetic, the
 * erase against a recording fake, the matcher's seed query); only the wiring
 * into routes and pages is read as source, comments stripped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

/** Every R2 delete the erase asks for — the real one is never reached. */
const DELETED: string[] = [];
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === '@/lib/cleanup-delete' || /\/cleanup-delete(\.ts)?$/.test(request)) {
      const target = (t: { key: string }) => {
        DELETED.push(t.key);
        return Promise.resolve();
      };
      return { executeCleanupDelete: target, cleanupDelete: target };
    }
    return load.call(this, request, ...rest);
  };
}

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ─── A recording fake of the Supabase query builder ─────────────────────────
type Row = Record<string, unknown>;
type Op = { table: string; verb: 'select' | 'update' | 'delete' | 'insert'; filters: string[]; patch?: Row };

function fakeDb(tables: Record<string, Row[]>) {
  const ops: Op[] = [];
  const from = (table: string) => {
    const preds: Array<(r: Row) => boolean> = [];
    const filters: string[] = [];
    let verb: Op['verb'] = 'select';
    let patch: Row | undefined;
    const rows = () => (tables[table] ?? []).filter((r) => preds.every((p) => p(r)));
    const run = () => {
      const hit = rows();
      ops.push({ table, verb, filters: [...filters], patch });
      if (verb === 'update') for (const r of hit) Object.assign(r, patch);
      if (verb === 'delete') tables[table] = (tables[table] ?? []).filter((r) => !hit.includes(r));
      return { data: hit.map((r) => ({ ...r })), error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b,
      update: (p: Row) => ((verb = 'update'), (patch = p), b),
      delete: () => ((verb = 'delete'), b),
      insert: (p: Row) => ((verb = 'insert'), (patch = p), b),
      eq: (c: string, v: unknown) => (filters.push(`eq:${c}`), preds.push((r) => r[c] === v), b),
      in: (c: string, v: unknown[]) => (filters.push(`in:${c}`), preds.push((r) => v.includes(r[c])), b),
      is: (c: string, v: unknown) => (filters.push(`is:${c}`), preds.push((r) => (r[c] ?? null) === v), b),
      not: (c: string, _op: string, v: unknown) => (filters.push(`not:${c}`), preds.push((r) => (r[c] ?? null) !== v), b),
      contains: (c: string, v: unknown[]) => (
        filters.push(`contains:${c}`),
        preds.push((r) => Array.isArray(r[c]) && v.every((x) => (r[c] as unknown[]).includes(x))),
        b
      ),
      order: () => b,
      limit: () => b,
      maybeSingle: () => {
        const res = run();
        return Promise.resolve({ data: res.data[0] ?? null, error: null });
      },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
    };
    return b;
  };
  return { client: { from } as never, ops, tables };
}

const EV = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const G = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-2222-3333-4444-555555555555';
const selfieRef = (guest: string, name = 'a.jpg') => `r2://setnayan-media/events/${EV}/guest-selfies/${guest}/${name}`;

// ═══ R1 · asked only when Papic is active — and open, and face tagging runs ═

test('R1 · faceTaggingAskable: Papic active AND mode_a AND not closed — each alone says no', async () => {
  const { faceTaggingAskable } = await import('./face-selfie-lifetime');
  assert.equal(faceTaggingAskable({ papicActive: true, mode: 'mode_a', papicClosed: false }), true);
  assert.equal(faceTaggingAskable({ papicActive: false, mode: 'mode_a', papicClosed: false }), false, 'no Papic, and the guest is still asked for a face');
  assert.equal(faceTaggingAskable({ papicActive: true, mode: 'mode_b', papicClosed: false }), false, 'mode_b (or the couple declined) and a selfie is still asked for');
  assert.equal(faceTaggingAskable({ papicActive: true, mode: 'mode_a', papicClosed: true }), false, 'Papic closed and a selfie is still asked for');
});

test('R1 · the one gate asks eventPapicGuestActive, and every asking surface reads that gate', () => {
  const gate = code('lib/face-tagging-gate.ts');
  assert.match(gate, /eventPapicGuestActive\(client, eventId\)/, 'the gate no longer asks whether Papic is active');
  assert.match(gate, /askable: faceTaggingAskable\(\{ papicActive, mode, papicClosed \}\)/);
  for (const rel of ['app/[slug]/_lib/loaders.ts', 'app/[slug]/invite/reply/page.tsx', 'app/papic/face-enroll-actions.ts', 'app/join/[eventId]/connect/confirm/page.tsx']) {
    assert.match(code(rel), /from '@\/lib\/face-tagging-gate'/, `${rel} decides face tagging without the gate`);
  }
  // The isomorphic module no longer carries a second, Papic-blind answer.
  assert.doesNotMatch(code('lib/papic-face-mode.ts'), /askable/, 'papic-face-mode.ts answers "askable" again, without Papic');
});

// ═══ R4 · the selfie's lifetime ════════════════════════════════════════════

test('R4 · Papic closes 12 h after the last Manila day — or at a later stored window end', async () => {
  const { papicCloseMs, papicHasClosed } = await import('./face-selfie-lifetime');
  const close = Date.parse('2026-12-21T11:59:59+08:00');
  assert.equal(papicCloseMs({ eventDate: '2026-12-20', eventEndDate: null }), close);
  assert.equal(papicHasClosed({ eventDate: '2026-12-20', eventEndDate: null }, close - 1000), false, 'erased before Papic closed');
  assert.equal(papicHasClosed({ eventDate: '2026-12-20', eventEndDate: null }, close + 1000), true, 'still held after Papic closed');
  // A multi-day celebration closes after its LAST day.
  assert.equal(papicCloseMs({ eventDate: '2026-12-20', eventEndDate: '2026-12-22' }), Date.parse('2026-12-23T11:59:59+08:00'));
  // A host-opened longer window wins — the selfie never dies while a camera can shoot.
  const later = '2026-12-25T11:59:59+08:00';
  assert.equal(papicCloseMs({ eventDate: '2026-12-20', eventEndDate: null, windowEnd: later }), Date.parse(later));
  // No clock → "we cannot say" → never erased by the close sweep.
  assert.equal(papicCloseMs({ eventDate: null, eventEndDate: null }), null);
  assert.equal(papicHasClosed({ eventDate: null, eventEndDate: null }, Date.parse('2099-01-01')), false);
});

test('R4 · the narrow erase takes the image, the vector and the avatar — and KEEPS every tag', async () => {
  const { eraseFaceTaggingSelfie } = await import('./face-selfie-erase');
  DELETED.length = 0;
  const db = fakeDb({
    guest_face_enrollments: [
      { id: 1, event_id: EV, guest_id: G, asset_url: selfieRef(G), face_vector: [0.1], revoked_at: null },
      { id: 2, event_id: EV, guest_id: G, asset_url: selfieRef(G, 'old.jpg'), face_vector: null, revoked_at: '2026-01-01' },
      { id: 3, event_id: EV, guest_id: OTHER, asset_url: selfieRef(OTHER), face_vector: [0.2], revoked_at: null },
    ],
    guests: [
      { event_id: EV, guest_id: G, photo_url: selfieRef(G), photo_source: 'selfie' },
      { event_id: EV, guest_id: OTHER, photo_url: selfieRef(OTHER), photo_source: 'selfie' },
    ],
    photo_tags: [{ event_id: EV, guest_id: G, source: 'auto_face', removed_at: null }],
  });
  const r = await eraseFaceTaggingSelfie(db.client, EV, G);
  assert.equal(r.enrollments, 2, 'the enrollment rows (vector + pointer) were not erased');
  assert.equal(r.avatarCleared, true, 'the selfie-as-avatar survived — the guest should fall back to initials');
  assert.deepEqual(DELETED.sort(), [`events/${EV}/guest-selfies/${G}/a.jpg`, `events/${EV}/guest-selfies/${G}/old.jpg`].sort(), 'the wrong selfie objects were deleted');
  assert.equal(db.tables.guest_face_enrollments.filter((x) => x.guest_id === G).length, 0);
  assert.equal(db.tables.guest_face_enrollments.filter((x) => x.guest_id === OTHER).length, 1, 'another guest’s face was erased');
  assert.equal(db.tables.guests.find((x) => x.guest_id === OTHER)?.photo_source, 'selfie', 'another guest’s avatar was cleared');
  // 🔒 A tag is not face data; the account's face lives on the account.
  assert.ok(!db.ops.some((o) => o.table === 'photo_tags'), 'the logout erase touched photo tags — tags already made must stay');
  assert.ok(!db.ops.some((o) => o.table === 'user_face_profiles'), 'the logout erase touched the account face');
  assert.equal(db.tables.photo_tags[0]?.removed_at, null);
  assert.doesNotMatch(code('lib/face-selfie-erase.ts'), /photo_tags|user_face_profiles'\)/, 'the erase module can reach tags or the account face');
});

test('R4 · a selfie ref outside the guest’s own folder is refused, never deleted', async () => {
  const { eraseFaceTaggingSelfie } = await import('./face-selfie-erase');
  DELETED.length = 0;
  const db = fakeDb({
    guest_face_enrollments: [{ id: 1, event_id: EV, guest_id: G, asset_url: selfieRef(OTHER) }],
    guests: [],
  });
  const r = await eraseFaceTaggingSelfie(db.client, EV, G);
  assert.equal(DELETED.length, 0, 'the erase deleted another guest’s file');
  assert.equal(r.refused, 1);
});

test('R4 · both sign-outs erase the selfie BEFORE the session that names it is gone', () => {
  const inv = code('app/[slug]/sign-out/route.ts');
  const e = inv.indexOf('eraseFaceTaggingSelfie(');
  assert.ok(e > -1 && e < inv.indexOf('await clearGuestSession();'), 'signing out of the invitation no longer erases the selfie first');
  const acct = code('app/auth/sign-out/route.ts');
  const u = acct.indexOf('eraseFaceTaggingSelfiesForUser(');
  const p = acct.indexOf('eraseFaceTaggingSelfie(admin, pass.event_id, pass.guest_id)');
  const out = acct.indexOf('await supabase.auth.signOut();');
  assert.ok(u > -1 && p > -1 && u < out && p < out, 'the account sign-out no longer erases the selfie before the session ends');
});

test('R4 · the Papic-close erase is a registered job, carried by admin AND public traffic', async () => {
  const { PERIODIC_JOBS } = await import('./periodic-job-registry');
  const job = PERIODIC_JOBS.find((j) => j.key === 'face-selfie-papic-close');
  assert.ok(job, 'the Papic-close erase is not in the job registry — nothing records whether it ran');
  assert.equal(job?.kind, 'retention');
  assert.ok((job?.gapMs ?? Infinity) <= 60 * 60 * 1000, 'the close erase may trail the promised instant by more than an hour');
  for (const rel of ['app/admin/layout.tsx', 'app/page.tsx']) {
    assert.match(code(rel), /after\(\(\) => maybeRunPapicCloseSelfieErase\(\)/, `${rel} no longer carries the Papic-close erase`);
  }
});

test('R4 · the sign-out controls say it BEFORE the tap — in the owner’s words, only to a guest with a selfie', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { NotYouSwitch } = await import('../app/[slug]/_components/not-you-switch');
  const { SIGN_OUT_ERASES_SELFIE, SELFIE_LIFETIME_LINE } = await import('./face-selfie-lifetime');
  assert.equal(SIGN_OUT_ERASES_SELFIE, 'Signing out also erases your face-tagging selfie. Photos already tagged stay tagged.');
  assert.equal(SELFIE_LIFETIME_LINE, "Your selfie is erased when you log out or when the event's Papic closes. Photos already tagged stay tagged.");
  const withSelfie = renderToStaticMarkup(React.createElement(NotYouSwitch, { slug: 'ana', erasesSelfie: true }));
  const form = withSelfie.slice(withSelfie.indexOf('<form'), withSelfie.indexOf('</form>'));
  assert.ok(form.includes('Signing out also erases your face-tagging selfie.'), '"Not you? Switch" erases the selfie without saying so');
  const without = renderToStaticMarkup(React.createElement(NotYouSwitch, { slug: 'ana' }));
  assert.ok(!without.includes('face-tagging selfie'), 'a guest with no selfie is told one will be erased');
  const body = code('app/[slug]/_components/site-body.tsx');
  const foot = body.slice(body.indexOf('action={`/${event.slug}/sign-out`}'), body.indexOf('Sign out of this invitation'));
  assert.match(foot, /\{SIGN_OUT_ERASES_SELFIE\}/, 'the footer sign-out erases the selfie without saying so');
  assert.match(body, /selfieLine=\{guest\.photo_source === 'selfie' \? SELFIE_LIFETIME_LINE : null\}/, '"Photos of you" lost the selfie-lifetime line');
  assert.match(code('app/[slug]/page.tsx'), /hasFaceSelfie=\{guest\.photo_source === 'selfie'\}/, 'Me’s "Not you? Switch" is not told the guest has a selfie');
});

// ═══ R6 · the server-side enrol, and the couple's "off" ═════════════════════

test('R6 · enrollGuestFace refuses without a stored Yes and an askable event — before ANY write', () => {
  const src = code('app/papic/face-enroll-actions.ts');
  const body = src.slice(src.indexOf('export async function enrollGuestFace('), src.indexOf('export async function recordFaceTaggingWish('));
  const refusal = body.indexOf("if (guestRow.face_tagging_wanted !== true || !faceTagging.askable) {");
  assert.ok(refusal > -1, 'the enrol no longer checks the guest’s Yes and the gate (Papic active + open, mode_a + the couple’s switch)');
  const firstWrite = Math.min(...['.update(', '.insert('].map((w) => body.indexOf(w)).filter((i) => i > -1));
  assert.ok(refusal < firstWrite, 'a selfie is written before the Yes / Papic / couple checks run');
  assert.match(body, /select\('face_recognition_excluded, face_tagging_wanted'\)/, 'the wish is not read with the host exclusion');
});

test('R6 · the couple turning face tagging OFF erases every selfie — after the switch is stored', () => {
  const src = code('app/dashboard/[eventId]/studio/papic/face-tagging-actions.ts');
  const erase = src.indexOf('if (declined) await eraseEventFaceTaggingSelfies(admin, eventId);');
  assert.ok(erase > -1, 'turning face tagging off only pauses it — the owner said it erases');
  assert.ok(erase > src.indexOf('face_tagging_declined_by_couple: declined'), 'the erase runs before the switch is stored — an enrol could land in between');
});

// ═══ R7 · the account's face, per event, off until turned on ═══════════════

test('R7 · the matcher seeds an account face ONLY at an event its owner switched on', async () => {
  const prev = process.env.NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED;
  process.env.NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED = 'true';
  try {
    const { accountSeedsForEvent } = await import('./account-face-profile');
    const members = [{ event_id: EV, user_id: 'u-on', guest_id: 'g-on' }, { event_id: EV, user_id: 'u-off', guest_id: 'g-off' }];
    const profiles = [
      { user_id: 'u-on', face_vector: [0.1], vectors: null, revoked_at: null, consent_granted_at: 'x', reuse_event_ids: [EV] },
      { user_id: 'u-off', face_vector: [0.2], vectors: null, revoked_at: null, consent_granted_at: 'x', reuse_event_ids: ['another-event'] },
    ];
    const seeds = await accountSeedsForEvent(fakeDb({ event_members: members, user_face_profiles: profiles }).client, EV);
    assert.deepEqual(seeds.map((s) => s.guestId), ['g-on'], 'an account face is reused at an event its owner never switched on');
    const none = await accountSeedsForEvent(
      fakeDb({ event_members: members, user_face_profiles: profiles.map((p) => ({ ...p, reuse_event_ids: null })) }).client,
      EV,
    );
    assert.deepEqual(none, [], 'an account-wide opt-in alone reuses the face — the switch is per event and OFF by default');
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED;
    else process.env.NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED = prev;
  }
});

test('R7 · "Save it to your account" draws the switch only for a face to reuse, OFF unless already on', () => {
  const page = code('app/join/[eventId]/connect/confirm/page.tsx');
  assert.match(page, /const offerReuse = faceTagging\.askable && reuse\.hasFace;/, 'the reuse switch shows where there is no face, or no face tagging');
  assert.match(page, /defaultChecked=\{reuse\.reusing\}/, 'the reuse switch arrives ON for an event its owner never turned on');
  assert.match(page, /Reuse the face on my account for this event/);
  const act = code('app/join/[eventId]/connect/confirm/actions.ts');
  assert.match(act, /if \(formData\?\.has\(`\$\{REUSE_FACE_FIELD\}_shown`\)\)/, 'a sheet without the switch can change the reuse');
  assert.match(act, /setAccountFaceReuse\(supabase, user\.id, eventId, formData\.get\(REUSE_FACE_FIELD\) === '1'\)/, 'the switch is written through something other than the owner’s own client');
});
