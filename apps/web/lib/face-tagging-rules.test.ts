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
/** What the stubbed gate / admin client answer (set per test). */
const GATE: { mode: 'mode_a' | 'mode_b' } = { mode: 'mode_a' };
const CURRENT: { db: unknown } = { db: null };
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    // The matcher's own reads, pinned for the rescan tests below: the DPO
    // control on, the gate saying mode_a, the admin client = the current fake.
    if (request === '@/lib/data-privacy-controls') return { isDataPrivacyControlActive: async () => true };
    if (request === '@/lib/face-tagging-gate') return { resolveFaceTagging: async () => ({ mode: GATE.mode, askable: true, available: true, declined: false }) };
    if (request === '@/lib/supabase/admin') return { createAdminClient: () => CURRENT.db };
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

/** A fake table's rows — asserted to exist, so a renamed table fails loudly instead of reading as empty. */
function rows(db: { tables: Record<string, Row[]> }, name: string): Row[] {
  const t = db.tables[name];
  assert.ok(Array.isArray(t), `the fake has no "${name}" table — the test is looking at nothing`);
  return t;
}

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
      if (verb === 'insert') {
        const added = (Array.isArray(patch) ? patch : [patch]).map((r) => ({ ...(r as Row) }));
        tables[table] = [...(tables[table] ?? []), ...added];
        return { data: added, error: null };
      }
      return { data: hit.map((r) => ({ ...r })), error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b,
      update: (p: Row) => ((verb = 'update'), (patch = p), b),
      delete: () => ((verb = 'delete'), b),
      insert: (p: Row) => ((verb = 'insert'), (patch = p), b),
      eq: (c: string, v: unknown) => (filters.push(`eq:${c}`), preds.push((r) => r[c] === v), b),
      gt: (c: string, v: unknown) => (filters.push(`gt:${c}`), preds.push((r) => (r[c] as number | string) > (v as number | string)), b),
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
      upsert: (p: Row | Row[]) => ((verb = 'insert'), (patch = p as Row), b),
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
  assert.equal(rows(db, 'guest_face_enrollments').filter((x) => x.guest_id === G).length, 0);
  assert.equal(rows(db, 'guest_face_enrollments').filter((x) => x.guest_id === OTHER).length, 1, 'another guest’s face was erased');
  assert.equal(rows(db, 'guests').find((x) => x.guest_id === OTHER)?.photo_source, 'selfie', 'another guest’s avatar was cleared');
  // 🔒 A tag is not face data; the account's face lives on the account.
  assert.ok(!db.ops.some((o) => o.table === 'photo_tags'), 'the logout erase touched photo tags — tags already made must stay');
  assert.ok(!db.ops.some((o) => o.table === 'user_face_profiles'), 'the logout erase touched the account face');
  assert.equal(rows(db, 'photo_tags')[0]?.removed_at, null);
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
  const onGate = body.indexOf("if (!faceTagging.askable) return { ok: false, reason: 'not_on' };");
  const onWish = body.indexOf("if (guestRow.face_tagging_wanted !== true) return { ok: false, reason: 'not_wanted' };");
  assert.ok(onGate > -1, 'the enrol no longer checks the gate (Papic active + open, mode_a + the couple’s switch) — or no longer says why');
  assert.ok(onWish > -1, 'the enrol no longer checks the guest’s Yes — or no longer says why');
  const refusal = Math.max(onGate, onWish);
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

// ═══ AUTOMATIC — Papic active turns face tagging on (owner 2026-09-30, "1. automatic") ═

test('AUTO · Papic active → mode_a with no admin step, on EVERY event type; the couple’s "off" still wins', async () => {
  // 2026-10-01, DECISION_LOG "ELEVEN OWNER ANSWERS" #8: christening and debut
  // included — "on by default but they can always turn it off".
  const { resolveFaceMode } = await import('./papic-face-mode');
  assert.equal(resolveFaceMode(null, 'wedding', false, true), 'mode_a', 'Papic is active and face tagging did not turn on by itself');
  assert.equal(resolveFaceMode('mode_b', 'birthday', null, true), 'mode_a', 'an untouched mode_b column still blocks the automatic default');
  assert.equal(resolveFaceMode(null, 'wedding', false, false), 'mode_b', 'face tagging runs without Papic');
  assert.equal(resolveFaceMode(null, 'wedding', true, true), 'mode_b', 'the couple’s "off" no longer wins over the automatic default');
  for (const type of ['christening', 'debut']) {
    assert.equal(resolveFaceMode(null, type, false, true), 'mode_a', `${type} is still held off until an admin acts (retired 2026-10-01 #8)`);
    assert.equal(resolveFaceMode(null, type, true, true), 'mode_b', `the host’s "off" no longer wins on a ${type}`);
  }
  assert.equal(resolveFaceMode('mode_a', 'christening', false, false), 'mode_a', 'the admin override was lost');
});

test('AUTO · the gate hands Papic-active to the resolver, and no app code asks the admin-only resolver any more', () => {
  const gate = code('lib/face-tagging-gate.ts');
  assert.match(gate, /resolveFaceMode\(row\.papic_face_mode, row\.event_type, row\.face_tagging_declined_by_couple, papicActive\)/, 'the gate no longer turns face tagging on from Papic');
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const hits = execSync("git grep -l 'resolvePapicFaceMode(' -- 'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' ':!*.test.ts' ':!lib/papic-face-mode.ts' || true", { cwd: WEB, encoding: 'utf8' }).trim();
  assert.equal(hits, '', `these still ask the admin-only mode and miss the automatic default:\n${hits}`);
  // Every surface that decides the capture embedder follows the automatic default.
  assert.match(code('app/papic/guest/page.tsx'), /coupleDeclinedFaceTagging,\s*access === 'on',/);
  assert.match(code('app/papic/seat/[token]/page.tsx'), /resolveFaceTagging\(admin, seat\.event_id as string\)\)\.mode/);
  assert.match(code('app/dashboard/[eventId]/studio/patiktok/booth/page.tsx'), /resolveFaceTagging\(await eventEntitlementClient\(eventId\), eventId\)\)\.mode/);
  assert.match(code('lib/face-match.ts'), /\(await resolveFaceTagging\(admin, eventId\)\)\.mode !== 'mode_a'/);
  // The couple's card shows wherever tagging would run — not only where an admin chose mode_a.
  assert.match(code('app/dashboard/[eventId]/studio/papic/_components/face-tagging-choice.tsx'), /if \(!tagging\.available\) return null;/);
});

// ═══ R5 · THE ONE RESCAN — registered faces only, nothing about a bystander ═

const EV2 = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const REG = 'aaaaaaaa-0000-0000-0000-000000000001';
const NEVER = 'aaaaaaaa-0000-0000-0000-000000000002';
const v = (x: number) => Array.from({ length: 128 }, (_, i) => (i === 0 ? x : 0));

function rescanWorld() {
  return fakeDb({
    guest_face_enrollments: [
      { id: 1, event_id: EV2, guest_id: REG, face_vector: v(0), revoked_at: null, consent_at: 'x', created_at: '2026-12-20T10:00:00Z', events: { event_date: '2026-12-20', event_end_date: null, papic_window_end: null } },
      // An enrollment from before the question existed — never answered Yes.
      { id: 2, event_id: EV2, guest_id: NEVER, face_vector: v(5), revoked_at: null, consent_at: 'x', created_at: '2026-12-20T10:00:00Z', events: { event_date: '2026-12-20', event_end_date: null, papic_window_end: null } },
    ],
    guests: [
      { event_id: EV2, guest_id: REG, face_tagging_wanted: true },
      { event_id: EV2, guest_id: NEVER, face_tagging_wanted: null },
    ],
    papic_photos: [1, 2, 3].map((i) => ({ id: i, photo_id: `p${i}`, event_id: EV2, photo_type: 'photo', display_r2_key: `r2://setnayan-media/p${i}.jpg`, hidden_at: null, superseded_at: null })),
    papic_guest_captures: [{ id: 7, capture_id: 'c7', event_id: EV2, media_type: 'photo', display_r2_key: 'r2://setnayan-media/c7.jpg', hidden_at: null }],
    photo_tags: [],
    papic_face_rescan_progress: [],
  });
}
// Every photo holds the registered guest AND the never-answered guest's face —
// who must NOT be found (they never said "Yes, tag me") — and nothing else.
const deps = {
  embed: async () => [v(0.01), v(5.01)],
  readBytes: async () => new Uint8Array([1]),
  ready: async () => true,
  privacyOn: async () => true,
};
const AFTER_END = Date.parse('2026-12-21T02:00:00+08:00');

test('R5 · the rescan tags the REGISTERED guest in every photo — and writes nothing about the bystander', async () => {
  const { runFaceRescan } = await import('./face-rescan');
  const { autoTagCapture } = await import('./face-match');
  GATE.mode = 'mode_a';
  const w = rescanWorld();
  CURRENT.db = w.client;
  const looked = await runFaceRescan({ nowMs: AFTER_END, admin: w.client, deps: { ...deps, match: autoTagCapture } });
  assert.equal(looked, 4, 'the rescan did not look at every photo of the event');
  const tagged = rows(w, 'photo_tags').map((t) => `${t.source_id}:${t.guest_id}`).sort();
  assert.deepEqual(tagged, ['c7:' + REG, 'p1:' + REG, 'p2:' + REG, 'p3:' + REG], 'the registered guest was not found in the earlier photos');
  assert.ok(!rows(w, 'photo_tags').some((t) => t.guest_id === NEVER), 'a guest who never said "Yes, tag me" was searched for');
  // 🔒 Nothing about the bystander (or any face) is written anywhere.
  const writes = w.ops.filter((o) => o.verb !== 'select').map((o) => o.table);
  assert.deepEqual([...new Set(writes)].sort(), ['papic_face_rescan_progress', 'photo_tags'], `the rescan wrote to ${[...new Set(writes)].join(', ')}`);
  const progress = rows(w, 'papic_face_rescan_progress')[0] ?? {};
  assert.deepEqual(Object.keys(progress).filter((k) => /vector|descriptor|box|face/i.test(k)), [], 'the progress row holds something about a face');
  assert.ok(progress.finished_at, 'the pass never recorded that it finished');
});

test('R5 · bounded and resumable: one photo per run walks on from its cursor, then finishes', async () => {
  const { runFaceRescan } = await import('./face-rescan');
  const w = rescanWorld();
  const seen: string[] = [];
  const match = async (a: { photoId: string }) => (seen.push(a.photoId), { autoTagged: 0 });
  for (let i = 0; i < 6; i++) await runFaceRescan({ nowMs: AFTER_END, admin: w.client, maxPhotos: 1, deps: { ...deps, match: match as never } });
  assert.deepEqual(seen, ['p1', 'p2', 'p3', 'c7'], 'a sliced rescan skipped or repeated photos');
  assert.ok(rows(w, 'papic_face_rescan_progress')[0]?.finished_at, 'the sliced pass never finished');
});

test('R5 · only between the event’s end and Papic’s close, and only where face tagging runs', async () => {
  const { runFaceRescan } = await import('./face-rescan');
  const match = async () => ({ autoTagged: 1 });
  for (const [label, nowMs] of [
    ['during the event', Date.parse('2026-12-20T20:00:00+08:00')],
    ['after Papic closed', Date.parse('2026-12-21T12:00:01+08:00')],
  ] as const) {
    const w = rescanWorld();
    assert.equal(await runFaceRescan({ nowMs, admin: w.client, deps: { ...deps, match } }), 0, `the rescan ran ${label}`);
  }
  GATE.mode = 'mode_b';
  try {
    const w = rescanWorld();
    assert.equal(await runFaceRescan({ nowMs: AFTER_END, admin: w.client, deps: { ...deps, match } }), 0, 'the rescan ran where face tagging is off (the couple’s "off", or no Papic)');
  } finally {
    GATE.mode = 'mode_a';
  }
});

test('R5 · the wiring: a registered job on admin + public traffic; the server embedder stays out of every client bundle', async () => {
  const { PERIODIC_JOBS } = await import('./periodic-job-registry');
  assert.ok(PERIODIC_JOBS.some((j) => j.key === 'face-rescan-after-event'), 'the rescan is not a registered job');
  for (const rel of ['app/admin/layout.tsx', 'app/page.tsx']) {
    assert.match(code(rel), /after\(\(\) => maybeRunFaceRescan\(\)/, `${rel} no longer carries the rescan`);
  }
  for (const rel of ['lib/face-embed-server.ts', 'lib/face-rescan.ts']) {
    assert.match(readFileSync(join(WEB, rel), 'utf8'), /^import 'server-only';/, `${rel} could reach a client bundle`);
  }
  const cfg = code('next.config.ts');
  assert.match(cfg, /'@vladmandic\/face-api',/, 'face-api is no longer a server external — webpack would inline it');
  const pkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
  assert.equal(pkg.dependencies['@vladmandic/face-api'], '1.7.15', 'face-api is not pinned to the phones’ version');
  assert.equal(pkg.dependencies['@tensorflow/tfjs-backend-wasm'], '4.22.0', 'the wasm backend is not pinned to tfjs 4.22.0');
  // The progress table can hold no face data, by its column list.
  const mig = readFileSync(join(WEB, '..', '..', 'supabase', 'migrations', '20271257688801_papic_face_rescan_progress.sql'), 'utf8');
  const at = mig.indexOf('CREATE TABLE IF NOT EXISTS public.papic_face_rescan_progress');
  assert.ok(at > -1, 'the progress table is gone — read the migration');
  // The column list only — from the opening parenthesis, SQL comments removed.
  const cols = mig.slice(mig.indexOf('(', at), mig.indexOf(');', at)).replace(/--.*$/gm, '');
  assert.doesNotMatch(cols, /vector|descriptor|jsonb|box|faces?_/i, 'the rescan progress table can now hold face data');
  assert.doesNotMatch(code('lib/face-rescan.ts'), /console\.[a-z]+\([^)]*vectors/, 'the rescan logs descriptors');
});

// ═══ THE FACE SCREEN — the approved design (face_registration_2026-09-30_fable) ═

test('SCREEN A · never pre-ticked; "Take selfie" is grey and says why; nothing is posted without the tick', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SelfieCapture } = await import('../app/[slug]/_components/selfie-capture');
  const html = renderToStaticMarkup(
    React.createElement(SelfieCapture, { faceMode: 'mode_a', onShot: () => {}, onFail: () => {}, onClose: () => {} }),
  );
  const tick = html.match(/<input[^>]*name="face_step_agree"[^>]*>/)?.[0] ?? '';
  assert.notEqual(tick, '', 'the one tick is gone');
  assert.doesNotMatch(tick, /checked/, 'the consent arrives pre-ticked');
  assert.match(html, /I’m 18\+ and agree to face tagging/);
  const button = html.match(/<button[^>]*>(?:(?!<\/button>).)*Take selfie<\/button>/)?.[0] ?? '';
  assert.notEqual(button, '', 'the "Take selfie" button is gone');
  assert.match(button, /\sdisabled=""/, '"Take selfie" works without the tick');
  assert.match(html, /Tick to continue/, 'a grey button with no reason is a silent nothing');
  assert.doesNotMatch(html, /name="biometric_consent"|name="age_affirmation"/, 'a consent is posted without the tick');
  // ONE SCREEN, NO SCROLL: the camera fills a fixed, clipped screen; the sheet sits over it.
  assert.match(html, /data-face-screen="true" class="fixed inset-0[^"]*overflow-hidden/, 'the face screen can scroll');
  assert.doesNotMatch(html, /aria-label="Face tagging"/, 'the ⓘ sheet is open before the guest asked for it');
});

test('SCREEN C · "Got it" only closes the sheet — it never ticks for them', () => {
  const src = code('app/[slug]/_components/selfie-capture.tsx');
  const got = src.slice(src.lastIndexOf('<button', src.indexOf('Got it')), src.indexOf('Got it'));
  assert.match(got, /onClick=\{\(\) => setDetails\(false\)\}/, '"Got it" does something other than close');
  assert.doesNotMatch(got, /setAgreed/, '"Got it" ticks the consent for the guest');
  // The sheet carries the design's promises, including the erase.
  assert.match(src, /when you sign out, or when Papic closes — \{PAPIC_CAPTURE_GRACE_HOURS\} hours after the event\./);
});

test('SCREEN E · a failure stays on the camera, tick kept, and NAMES the reason — including the server’s', async () => {
  const { faceStepFailureLine, faceStepFailureWords } = await import('./face-enroll-refusal');
  assert.equal(faceStepFailureLine('no_face'), 'Couldn’t save — no face found.');
  assert.equal(faceStepFailureWords('many_faces'), 'more than one face');
  assert.equal(faceStepFailureWords('too_dark'), 'too dark');
  assert.equal(faceStepFailureWords('upload'), 'connection lost');
  // Claire's night: a mode_b (now: tagging off) refusal must read as a reason, not as nothing.
  assert.equal(faceStepFailureWords('not_on'), 'face tagging is off here');
  for (const code of ['session', 'consent', 'not_wanted', 'excluded', 'minor', 'bad_photo', 'save', 'something-new']) {
    assert.ok(faceStepFailureWords(code).length > 0, `${code} renders no reason`);
  }
  const step = code('app/[slug]/_components/day-of-face-enroll.tsx');
  assert.match(step, /if \(!res\.ok\) \{\s*fail\(faceStepFailureWords\(res\.reason\)\);\s*return;\s*\}/, 'a refused save is not shown with its reason');
  assert.ok(step.indexOf('fail(faceStepFailureWords(res.reason))') < step.indexOf('setDone(true)'), 'a refused save can look like success');
  // Still on the camera: the failure toast rides INTO the same screen.
  assert.match(step, /<SelfieCapture[\s\S]*toast=\{failureToast\}/, 'a failure leaves the camera');
});

test('SCREEN D/F · saved → the toast and Me’s "Face tagging" row; no Papic → no row', () => {
  const step = code('app/[slug]/_components/day-of-face-enroll.tsx');
  assert.match(step, /\{FACE_STEP_SAVED\}/);
  const page = code('app/[slug]/page.tsx');
  assert.match(page, /faceTaggingAskable \|\| guest\.photo_source === 'selfie'\s*\?/, 'Me shows the face row where face tagging is not on offer');
  assert.match(code('app/[slug]/_components/guest-me.tsx'), /\{faceTagging \? <FaceTaggingRow \{\.\.\.faceTagging\} \/> : null\}/);
  // The row opens the face screen only on the day (the selfie is taken on the day).
  const row = code('app/[slug]/_components/face-tagging-row.tsx');
  assert.match(row, /if \(!on && \(wish === false \|\| \(!open && wish !== true\)\)\) return null;/);
  assert.match(row, /onClick=\{\(\) => \(on \? setMenu\(\(m\) => !m\) : setCamera\(true\)\)\}/);
  assert.match(row, /disabled=\{!tappable\}/);
});
