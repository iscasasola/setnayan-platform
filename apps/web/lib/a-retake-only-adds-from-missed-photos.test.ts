/**
 * ⚖ A SELFIE RETAKE ONLY ADDS FROM THE PHOTOS THAT MISSED — IT NEVER RE-CHECKS A TAGGED ONE, NEVER RE-ADDS A REMOVED ONE.
 *
 * Owner 2026-10-31, DECISION_LOG "SEVEN OWNER ANSWERS" (2): *"no. if they are already tagged that's it. we just add
 * more from other photos that missed."*
 *
 * What runs after a retake (Me › Face tagging › Retake selfie → `enrollGuestFace`): the old enrolment is retired and
 * a new live one inserted — nothing else. The look-back is the one end-of-event rescan (`lib/face-rescan.ts`), which
 * a selfie newer than the last finished pass restarts. This file EXECUTES that restart against a recording fake and
 * proves, for the guest who retook:
 *   · a photo already carrying their LIVE tag is not looked at again for them ("that's it");
 *   · a photo carrying their TOMBSTONE — "Not me" (guest), the hosts' Tag removal (couple), an admin's — is never
 *     re-tagged, and the tombstone row is left exactly as it was;
 *   · a photo in which every searched guest already has a row is not even opened (no read, no embed);
 *   · the photos that missed them get the new tag.
 * Plus: the retake itself never touches `photo_tags`, and an unread tag list in the matcher writes nothing.
 *
 * 🪤 The fake's upsert does NOT dedupe on the unique pair (the real database's `ON CONFLICT DO NOTHING` would hide a
 * matcher that forgot a tombstone) — so a resurrection shows up here as a second row for the pair.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const CURRENT: { db: unknown } = { db: null };
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === '@/lib/data-privacy-controls') return { isDataPrivacyControlActive: async () => true };
    if (request === '@/lib/face-tagging-gate') return { resolveFaceTagging: async () => ({ mode: 'mode_a', askable: true, available: true, declined: false }) };
    if (request === '@/lib/supabase/admin') return { createAdminClient: () => CURRENT.db };
    return load.call(this, request, ...rest);
  };
}

type Row = Record<string, unknown>;

/** A recording fake of the query builder. `failTable` answers every read of that table with an error. */
function fakeDb(tables: Record<string, Row[]>, failTable?: string) {
  const writes: Array<{ table: string; verb: string }> = [];
  const from = (table: string) => {
    const preds: Array<(r: Row) => boolean> = [];
    let verb: 'select' | 'update' | 'insert' = 'select';
    let patch: Row | Row[] | undefined;
    let counted = false;
    const run = () => {
      if (verb === 'select' && failTable === table) return { data: null, error: { message: 'boom' } };
      const hit = (tables[table] ?? []).filter((r) => preds.every((p) => p(r)));
      if (verb !== 'select') writes.push({ table, verb });
      if (verb === 'update') for (const r of hit) Object.assign(r, patch);
      if (verb === 'insert') {
        const added = (Array.isArray(patch) ? patch : [patch]).map((r) => ({ ...(r as Row) }));
        tables[table] = [...(tables[table] ?? []), ...added];
        return { data: added, error: null };
      }
      return { data: hit.map((r) => ({ ...r })), error: null, ...(counted ? { count: hit.length } : {}) };
    };
    const b: Record<string, unknown> = {
      // `select('id', { count: 'exact', head: true })` — the rescan's "was a selfie registered after this pass?"
      select: (_cols?: string, opts?: { count?: string }) => ((counted = Boolean(opts?.count)), b),
      update: (p: Row) => ((verb = 'update'), (patch = p), b),
      insert: (p: Row | Row[]) => ((verb = 'insert'), (patch = p), b),
      upsert: (p: Row | Row[]) => ((verb = 'insert'), (patch = p), b),
      eq: (c: string, v: unknown) => (preds.push((r) => r[c] === v), b),
      gt: (c: string, v: unknown) => (preds.push((r) => (r[c] as number | string) > (v as number | string)), b),
      in: (c: string, v: unknown[]) => (preds.push((r) => v.includes(r[c])), b),
      is: (c: string, v: unknown) => (preds.push((r) => (r[c] ?? null) === v), b),
      not: (c: string, _op: string, v: unknown) => (preds.push((r) => (r[c] ?? null) !== v), b),
      order: () => b,
      limit: () => b,
      maybeSingle: () => {
        const res = run();
        return Promise.resolve({ data: res.data?.[0] ?? null, error: res.error ?? null });
      },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
    };
    return b;
  };
  return { client: { from } as never, tables, writes };
}

const EV = 'eeeeeeee-0000-0000-0000-00000000aaaa';
const RETOOK = 'aaaaaaaa-0000-0000-0000-000000000001'; // the guest who retook her selfie
const OTHER = 'aaaaaaaa-0000-0000-0000-000000000002'; // another registered guest
const v = (x: number) => Array.from({ length: 128 }, (_, i) => (i === 0 ? x : 0));
const EVENTS = { event_date: '2026-12-20', event_end_date: null, papic_window_end: null };
const AFTER_END = Date.parse('2026-12-21T02:00:00+08:00');
const PASS_STARTED = '2026-12-20T15:00:00.000Z';

const tag = (source_id: string, guest_id: string, extra: Row = {}): Row => ({
  event_id: EV,
  source_table: source_id.startsWith('c') ? 'papic_guest_captures' : 'papic_photos',
  source_id,
  guest_id,
  source: 'auto_face',
  removed_at: null,
  removed_by: null,
  ...extra,
});

/** The world just after the retake: the first pass had finished; her new selfie is newer than it. */
function worldAfterRetake() {
  return fakeDb({
    guest_face_enrollments: [
      // Her OLD selfie — retired by the retake.
      { id: 1, event_id: EV, guest_id: RETOOK, face_vector: v(0.3), revoked_at: '2026-12-21T00:59:00Z', consent_at: 'x', created_at: '2026-12-20T09:00:00Z', events: EVENTS },
      // Her retake — live, newer than the finished pass: this is what restarts it.
      { id: 2, event_id: EV, guest_id: RETOOK, face_vector: v(0), revoked_at: null, consent_at: 'x', created_at: '2026-12-21T01:00:00Z', events: EVENTS },
      { id: 3, event_id: EV, guest_id: OTHER, face_vector: v(9), revoked_at: null, consent_at: 'x', created_at: '2026-12-20T09:00:00Z', events: EVENTS },
    ],
    guests: [
      { event_id: EV, guest_id: RETOOK, face_tagging_wanted: true },
      { event_id: EV, guest_id: OTHER, face_tagging_wanted: true },
    ],
    papic_photos: [1, 2, 3, 4, 6].map((i) => ({ id: i, photo_id: `p${i}`, event_id: EV, photo_type: 'photo', display_r2_key: `r2://setnayan-media/p${i}.jpg`, hidden_at: null, superseded_at: null })),
    papic_guest_captures: [{ id: 5, capture_id: 'c5', event_id: EV, media_type: 'photo', display_r2_key: 'r2://setnayan-media/c5.jpg', hidden_at: null }],
    photo_tags: [
      tag('p1', RETOOK), // already tagged — "that's it"
      tag('p1', OTHER),
      tag('p2', RETOOK, { removed_at: '2026-12-20T12:00:00Z', removed_by: 'guest' }), // her own "Not me"
      tag('p2', OTHER),
      tag('p3', RETOOK, { removed_at: '2026-12-20T12:00:00Z', removed_by: 'couple' }), // the hosts' Tag removal
      tag('p3', OTHER),
      tag('p4', OTHER), // missed her
      tag('p6', RETOOK, { removed_at: '2026-12-20T12:00:00Z', removed_by: 'admin' }), // an admin's removal — OTHER missed here
      // c5: nobody tagged yet — missed her
    ],
    papic_face_rescan_progress: [
      { event_id: EV, last_photo_id: 6, last_capture_id: 5, photos_scanned: 6, tags_written: 4, started_at: PASS_STARTED, finished_at: '2026-12-20T16:00:00.000Z' },
    ],
  });
}

/** Her face is in EVERY photo — so only the rule, never the picture, can keep a tagged or removed photo untouched. */
const HER_FACE = [v(0.01)];

test('a retake restarts the look-back, which tags her ONLY in the photos that missed her', async () => {
  const { runFaceRescan } = await import('./face-rescan');
  const { autoTagCapture } = await import('./face-match');
  const w = worldAfterRetake();
  CURRENT.db = w.client;
  const before = JSON.stringify(w.tables.photo_tags);
  const opened: string[] = [];
  await runFaceRescan({
    nowMs: AFTER_END,
    admin: w.client,
    deps: {
      embed: async () => HER_FACE,
      readBytes: async (ref: string) => (opened.push(/\/(\w+)\.jpg$/.exec(ref)?.[1] ?? ref), new Uint8Array([1])),
      ready: async () => true,
      privacyOn: async () => true,
      match: autoTagCapture,
    },
  });

  const progress = w.tables.papic_face_rescan_progress?.[0] ?? {};
  assert.ok(progress.finished_at && progress.started_at !== PASS_STARTED, 'the retake did not restart the look-back');

  // Not even opened: p1, p2, p3 — every searched guest already has a row there (live or tombstoned).
  console.log(`  photos opened after the retake: ${opened.sort().join(' · ')}`);
  assert.deepEqual(opened.sort(), ['c5', 'p4', 'p6'], 'a photo where everyone already has a row was opened again');

  const rowsFor = (photo: string) => (w.tables.photo_tags ?? []).filter((t) => t.source_id === photo && t.guest_id === RETOOK);
  // The photos that missed her get her tag — once.
  for (const photo of ['p4', 'c5']) {
    const r = rowsFor(photo);
    assert.equal(r.length, 1, `${photo}: she was not added from a photo that missed her`);
    assert.equal(r[0]?.source, 'auto_face');
    assert.equal(r[0]?.removed_at ?? null, null);
  }
  // Already tagged, or removed by anyone: exactly the one row that was there, unchanged.
  const original = JSON.parse(before) as Row[];
  for (const photo of ['p1', 'p2', 'p3', 'p6']) {
    const r = rowsFor(photo);
    assert.equal(r.length, 1, `${photo}: a second row for her — a tagged or removed photo was tagged again`);
    const was = original.find((t) => t.source_id === photo && t.guest_id === RETOOK);
    assert.deepEqual(r[0], was, `${photo}: her existing row (tag or tombstone) was changed`);
  }
  // Nothing was ever written but the two new tags and the progress row.
  const tagWrites = w.writes.filter((x) => x.table === 'photo_tags');
  assert.ok(tagWrites.every((x) => x.verb === 'insert'), 'the look-back updated an existing photo_tags row');
  assert.equal((w.tables.photo_tags ?? []).length, original.length + 2, 'the look-back wrote more than the two missed photos');
});

test('the matcher alone: a tombstone is never re-tagged even when her face is in the photo', async () => {
  const { autoTagCapture } = await import('./face-match');
  for (const removed_by of ['guest', 'couple', 'admin']) {
    const w = worldAfterRetake();
    w.tables.photo_tags = [tag('p9', RETOOK, { removed_at: '2026-12-20T12:00:00Z', removed_by })];
    CURRENT.db = w.client;
    const { autoTagged } = await autoTagCapture({ eventId: EV, sourceTable: 'papic_photos', photoId: 'p9', faceVectors: HER_FACE });
    assert.equal(autoTagged, 0, `a "${removed_by}" tombstone was re-tagged`);
    assert.equal(w.tables.photo_tags.length, 1);
    assert.equal(w.tables.photo_tags[0]?.removed_by, removed_by, 'the tombstone was changed');
  }
});

test('the matcher: an UNREAD tag list writes nothing (it is not an empty one)', async () => {
  const { autoTagCapture } = await import('./face-match');
  const w = fakeDb(worldAfterRetake().tables, 'photo_tags');
  CURRENT.db = w.client;
  const { autoTagged } = await autoTagCapture({ eventId: EV, sourceTable: 'papic_photos', photoId: 'p2', faceVectors: HER_FACE });
  assert.equal(autoTagged, 0, 'a failed read of the photo’s tags let the matcher write');
  assert.equal(w.writes.filter((x) => x.table === 'photo_tags').length, 0);
});

test('the look-back: an unread page of tags stops the pass there — it does not treat the page as untagged', async () => {
  const { runFaceRescan } = await import('./face-rescan');
  const w = fakeDb(worldAfterRetake().tables, 'photo_tags');
  CURRENT.db = w.client;
  const opened: string[] = [];
  await runFaceRescan({
    nowMs: AFTER_END,
    admin: w.client,
    deps: {
      embed: async () => HER_FACE,
      readBytes: async (ref: string) => (opened.push(ref), new Uint8Array([1])),
      ready: async () => true,
      privacyOn: async () => true,
      match: async () => ({ autoTagged: 1 }),
    },
  });
  assert.deepEqual(opened, [], 'photos were opened although their tags could not be read');
  assert.equal(w.tables.papic_face_rescan_progress?.[0]?.finished_at ?? null, null, 'a pass that could not read the tags called itself finished');
});

test('the retake itself never touches photo_tags — no tag is removed, none is added', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/papic/face-enroll-actions.ts'), 'utf8'));
  assert.ok(src.includes('export async function enrollGuestFace'), 'precondition: the enrol action');
  assert.doesNotMatch(src, /photo_tags/, 'the selfie (re)take writes or reads photo_tags');
});
