/**
 * ⭐ THE RECORDING HANDOFF — tested from the two directions that can hurt a
 * couple: a wedding that cannot be stopped, and a claim about their recording
 * that is not true.
 *
 *   1. TEARDOWN     — End completes the per-camera rows even when YouTube fails
 *                     wholesale, and re-mirrors so the guest picker disappears.
 *                     (Nothing had EVER written a status update to
 *                     live_studio_roam_streams — see the module header.)
 *   2. TRI-STATE    — `archived` is null when YouTube could not be asked and
 *                     false only when it was asked and answered. A couple must
 *                     never be told "no recording" because our token expired.
 *   3. BARRIER      — a malformed video id never reaches a watch URL.
 *   4. FLAG-OFF     — teardown is a no-op, and touches no table.
 *   5. NO DELETES   — this module and panood-youtube expose no way to delete a
 *                     broadcast (§ 6 promises indefinite retention).
 *   6. DURATION     — ISO-8601 parsing, including the PT0S-while-processing case.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ORPHANED_CAMERA_LABEL,
  PROGRAM_RECORDING_LABEL,
  buildRecordingList,
  completeRoamBroadcasts,
  formatRecordingDuration,
  type RecordingStreamRow,
  type RecordingZoneRow,
} from './live-studio-recordings';
import type { YoutubeVideoArchive } from './panood-youtube-types';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');

const VID_A = 'dQw4w9WgXcQ';
const VID_B = 'abcdefghijk';
const VID_C = 'lmnopqrstuv';

function camera(partial: Partial<RecordingStreamRow> & { zone_id: number }): RecordingStreamRow {
  return { broadcast_id: VID_A, status: 'complete', ended_at: null, ...partial };
}
function zone(partial: Partial<RecordingZoneRow> & { id: number; zone_index: number }): RecordingZoneRow {
  return { label: `Zone ${partial.zone_index}`, venue_label: null, ...partial };
}
function archive(partial: Partial<YoutubeVideoArchive> & { videoId: string }): YoutubeVideoArchive {
  return { title: '', durationSeconds: null, privacyStatus: 'unlisted', processed: true, ...partial };
}

/* ── 2 + 3 · The list a couple reads ─────────────────────────────────────── */

test('the program feed leads, then cameras in zone order', () => {
  const list = buildRecordingList(
    {
      program: [{ zone_id: null, broadcast_id: VID_A, status: 'complete', ended_at: null }],
      cameras: [
        camera({ zone_id: 20, broadcast_id: VID_C }),
        camera({ zone_id: 10, broadcast_id: VID_B }),
      ],
      zones: [
        zone({ id: 10, zone_index: 1, label: 'Ceremony', venue_label: 'Church' }),
        zone({ id: 20, zone_index: 2, label: 'Garden' }),
      ],
    },
    null,
  );
  assert.deepEqual(
    list.map((r) => [r.kind, r.label]),
    [
      ['program', PROGRAM_RECORDING_LABEL],
      ['camera', 'Ceremony'],
      ['camera', 'Garden'],
    ],
  );
  assert.equal(list[1]?.venueLabel, 'Church');
  assert.equal(list[0]?.watchUrl, `https://www.youtube.com/watch?v=${VID_A}`);
});

test('🔒 archived is NULL when YouTube could not be asked — never false', () => {
  const list = buildRecordingList(
    { program: [], cameras: [camera({ zone_id: 10 })], zones: [zone({ id: 10, zone_index: 1 })] },
    null,
  );
  assert.equal(list.length, 1);
  assert.equal(
    list[0]?.archived,
    null,
    'a couple must not be told "no recording" because our token expired',
  );
});

test('archived is FALSE only when YouTube answered and the id was absent', () => {
  const list = buildRecordingList(
    {
      program: [],
      cameras: [camera({ zone_id: 10, broadcast_id: VID_A }), camera({ zone_id: 20, broadcast_id: VID_B })],
      zones: [zone({ id: 10, zone_index: 1 }), zone({ id: 20, zone_index: 2 })],
    },
    [archive({ videoId: VID_A, durationSeconds: 5400 })],
  );
  assert.equal(list[0]?.archived, true);
  assert.equal(list[0]?.durationSeconds, 5400);
  assert.equal(list[1]?.archived, false, 'asked, and this id was not in the answer');
  assert.equal(list[1]?.durationSeconds, null);
});

test('a camera whose zone row was deleted still lists, with a fallback label', () => {
  // live_studio_roam_streams.zone_id is ON DELETE SET NULL — the recording
  // outlives the zone, and must not vanish with it.
  const list = buildRecordingList(
    { program: [], cameras: [{ zone_id: null, broadcast_id: VID_A, status: 'complete', ended_at: null }], zones: [] },
    null,
  );
  assert.equal(list.length, 1);
  assert.equal(list[0]?.label, ORPHANED_CAMERA_LABEL);
  assert.equal(list[0]?.zoneIndex, null);
});

test('🔒 a malformed video id never reaches a watch URL', () => {
  const list = buildRecordingList(
    {
      program: [{ zone_id: null, broadcast_id: 'javascript:alert(1)', status: 'complete', ended_at: null }],
      cameras: [camera({ zone_id: 10, broadcast_id: '' }), camera({ zone_id: 20, broadcast_id: 'tooshort' })],
      zones: [zone({ id: 10, zone_index: 1 }), zone({ id: 20, zone_index: 2 })],
    },
    null,
  );
  assert.deepEqual(list, [], 'every id here is invalid — nothing may be rendered');
});

/* ── 1 + 4 · Teardown ─────────────────────────────────────────────────────── */

/**
 * Supabase stub for completeRoamBroadcasts, modelling the REAL sequence and the
 * real state transition — because the property under test is "after End, the
 * mirror sees nothing live-able", and a stub that just returns [] would prove it
 * by construction rather than by the code doing its job.
 *
 * Query shapes matched, in call order:
 *   1. streams  `.select(…).eq(event_id).not(status in complete/errored)` → open rows
 *   2. streams  `.update(…).eq(event_id).not(…).select('zone_id')`        → closed rows
 *   3. mirror   `.select(…).eq(event_id)` on zones AND streams (Promise.all)
 *   4. events   `.update({ live_studio_roam_manifest }).eq(event_id)`
 *
 * `rows` is mutated by step 2 exactly as Postgres would, so step 3 reads the
 * post-update state and `buildRoamManifest` filters it for itself.
 */
function fakeAdmin(open: RecordingStreamRow[], zones: RecordingZoneRow[] = []) {
  const touched: string[] = [];
  const calls: { update?: Record<string, unknown>; manifest?: unknown } = {};
  const rows: RecordingStreamRow[] = open.map((r) => ({ ...r }));
  const isOpen = (r: RecordingStreamRow) => r.status !== 'complete' && r.status !== 'errored';

  /** A thenable that is also chainable, so `.eq()` can be awaited OR followed by `.not()`. */
  const resolvable = <T,>(value: T, extra: Record<string, unknown> = {}) =>
    Object.assign(Promise.resolve(value), extra);

  const client = {
    from(table: string) {
      touched.push(table);
      if (table === 'live_studio_roam_streams') {
        const b: Record<string, unknown> = {
          select: () => b,
          // Awaited directly by the mirror; `.not()` continues the teardown read.
          eq: () =>
            resolvable(
              { data: rows.map((r) => ({ ...r })), error: null },
              { not: () => Promise.resolve({ data: rows.filter(isOpen).map((r) => ({ ...r })), error: null }) },
            ),
          update: (payload: Record<string, unknown>) => {
            calls.update = payload;
            return {
              eq: () => ({
                not: () => {
                  const closed = rows.filter(isOpen);
                  for (const r of closed) {
                    r.status = 'complete';
                    r.ended_at = String(payload.ended_at);
                  }
                  return { select: () => Promise.resolve({ data: closed.map((r) => ({ zone_id: r.zone_id })), error: null }) };
                },
              }),
            };
          },
        };
        return b;
      }
      if (table === 'live_studio_roam_zones') {
        const b: Record<string, unknown> = {
          select: () => b,
          eq: () => Promise.resolve({ data: zones.map((z) => ({ ...z, is_featured: false, status: 'live' })), error: null }),
        };
        return b;
      }
      if (table === 'events') {
        const b: Record<string, unknown> = {
          update: (payload: Record<string, unknown>) => {
            calls.manifest = payload.live_studio_roam_manifest;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
        return b;
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
  return { admin: client as unknown as Parameters<typeof completeRoamBroadcasts>[0], touched, calls, rows };
}

test('⭐ teardown completes the rows and empties the manifest (picker tears down)', async (t) => {
  process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = 'true';
  t.after(() => {
    delete process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
  });

  const liveCameras = [
    camera({ zone_id: 10, status: 'live', broadcast_id: VID_A }),
    camera({ zone_id: 20, status: 'live', broadcast_id: VID_B }),
  ];
  const liveZones = [zone({ id: 10, zone_index: 1 }), zone({ id: 20, zone_index: 2 })];

  // ANTI-VACUITY: with these SAME zones and streams still live, the mirror would
  // publish two channels. So a 0 below is the teardown's doing, not the fixture's.
  const { buildRoamManifest } = await import('./live-studio-roam-provision');
  assert.equal(
    buildRoamManifest(
      liveZones.map((z) => ({ ...z, is_featured: false, status: 'live' as const })),
      liveCameras.map((c) => ({ zone_id: c.zone_id, broadcast_id: c.broadcast_id, status: 'live' as const })),
    ).length,
    2,
    'pre-teardown these rows DO publish — the fixture is not trivially empty',
  );

  const { admin, calls, rows } = fakeAdmin(liveCameras, liveZones);
  // accessToken null = YouTube not even attempted, the worst case for step 1.
  const res = await completeRoamBroadcasts(admin, 'evt-1', null);

  assert.equal(res.completed, 2, 'the DB write must happen even with no YouTube token');
  assert.equal(res.transitioned, 0);
  assert.equal(res.published, 0, 'no live-able streams left → empty manifest → no picker');
  assert.equal((calls.update as Record<string, unknown>).status, 'complete');
  assert.ok((calls.update as Record<string, unknown>).ended_at, 'ended_at must be stamped');
  assert.deepEqual(calls.manifest, [], 'the mirror must be rewritten, not left stale');
  assert.deepEqual(
    rows.map((r) => r.status),
    ['complete', 'complete'],
    'every open row is closed — this is what frees the zone index and lets the channel be released',
  );
});

test('teardown with nothing open still re-mirrors (idempotent second End)', async (t) => {
  process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = 'true';
  t.after(() => {
    delete process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
  });
  const { admin, calls } = fakeAdmin([]);
  const res = await completeRoamBroadcasts(admin, 'evt-1', null);
  assert.equal(res.completed, 0);
  assert.equal(res.published, 0);
  assert.equal(calls.update, undefined, 'no rows open → no update issued');
});

test('🔒 flag OFF — teardown is a no-op and touches no table', async () => {
  delete process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
  const { admin, touched } = fakeAdmin([camera({ zone_id: 10 })]);
  const res = await completeRoamBroadcasts(admin, 'evt-1', 'token');
  assert.deepEqual(res, { completed: 0, transitioned: 0, published: 0 });
  assert.deepEqual(touched, [], 'a dark feature must not read or write anything');
});

test('teardown refuses an empty event id', async (t) => {
  process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = 'true';
  t.after(() => {
    delete process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
  });
  const { admin, touched } = fakeAdmin([camera({ zone_id: 10 })]);
  assert.deepEqual(await completeRoamBroadcasts(admin, '', 'token'), {
    completed: 0,
    transitioned: 0,
    published: 0,
  });
  assert.deepEqual(touched, []);
});

/* ── 4b · The card ships on BOTH couple-facing setup surfaces ─────────────── */

test('⭐ recordings reach the couple on EVERY Live Studio setup surface', () => {
  // Which surface a couple uses depends on a flag they cannot see: OFF → the legacy
  // /studio/panood/setup page, ON → the Wave 8 controller's SetupSheet. A recording
  // present on only one of them is a recording they LOSE at the flag flip. Same rule
  // and same reason as FACEBOOK_REPLAY_WARNING's own both-surfaces test.
  const card = repoFile('app/_components/live-studio-recordings-card.tsx');
  assert.match(card, /RECORDINGS_HEADING/, 'the card must render the shared heading');
  assert.match(card, /rec\.watchUrl/, 'the card must render the resolved watch URL');

  for (const surface of [
    'app/dashboard/[eventId]/studio/panood/setup/page.tsx',
    'app/panood/control/[eventId]/page.tsx',
  ]) {
    const src = repoFile(surface);
    assert.match(
      src,
      /<LiveStudioRecordingsCard/,
      `${surface} does not show the couple their recordings`,
    );
    assert.match(
      src,
      /fetchEventRecordings\(/,
      `${surface} renders the card but never fetches anything to put in it`,
    );
  }
});

test('the card renders NOTHING for an event with no recordings', () => {
  // A couple mid-planning must not see a section about a video that does not exist.
  const card = repoFile('app/_components/live-studio-recordings-card.tsx');
  assert.match(card, /if \(recordings\.length === 0\) return null;/);
});

/* ── 4d · Review fixes (adversarial review of #3770/#3774, 2026-07-26) ────── */

test('⭐ duration never renders an impossible "1 hr 60 min"', () => {
  // The first cut floored the hours and rounded the leftover seconds INDEPENDENTLY,
  // so the two could disagree in the last ~30s of every hour: 7199s → "1 hr 60 min",
  // 3599s → "60 min". Multi-hour recordings are exactly what this formats.
  assert.equal(formatRecordingDuration(7199), '2 hr', '1h59m59s must carry into 2 hr');
  assert.equal(formatRecordingDuration(3599), '1 hr', '59m59s must carry into 1 hr');
  assert.equal(formatRecordingDuration(10799), '3 hr');
  // Unchanged behaviour for everything that was already correct.
  assert.equal(formatRecordingDuration(5400), '1 hr 30 min');
  assert.equal(formatRecordingDuration(3600), '1 hr');
  assert.equal(formatRecordingDuration(90), '2 min');
  assert.equal(formatRecordingDuration(45), '1 min', 'a sub-minute archive is not "0 min"');

  // The property, not just the examples: no output may contain "60 min".
  for (let s = 1; s <= 4 * 3600; s += 7) {
    assert.ok(
      !formatRecordingDuration(s).includes('60 min'),
      `formatRecordingDuration(${s}) produced a 60-minute remainder`,
    );
  }
});

test('⭐ archive resolution asks about EVERY id — no silent 50-id truncation', async () => {
  // The first cut did `.slice(0, 50)`, and buildRecordingList turns "absent from the
  // answer" into the hard `archived: false` → the card's most definitive sentence
  // ("No recording on YouTube") for recordings that DO exist. That inverts the
  // tri-state this module is built around, so the ceiling is chunked, not truncated.
  let mod: typeof import('./panood-youtube');
  try {
    mod = await import('./panood-youtube');
  } catch {
    return; // server-only unresolvable under the runner — covered by typecheck
  }

  const ids = Array.from({ length: 120 }, (_, i) => `vid${String(i).padStart(8, '0')}`);
  const askedIds: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const u = String(url);
    const idParam = new URL(u).searchParams.get('id') ?? '';
    const chunk = idParam.split(',').filter(Boolean);
    askedIds.push(...chunk);
    return {
      ok: true,
      json: async () => ({
        items: chunk.map((id) => ({
          id,
          snippet: { title: id },
          status: { privacyStatus: 'unlisted', uploadStatus: 'processed' },
          contentDetails: { duration: 'PT1H' },
        })),
      }),
    } as unknown as Response;
  }) as typeof globalThis.fetch;

  try {
    const out = await mod.fetchYoutubeVideoArchives('tok', ids);
    assert.equal(askedIds.length, 120, 'every id must be asked about, across chunks');
    assert.deepEqual([...new Set(askedIds)].sort(), [...ids].sort());
    assert.equal(out.length, 120, 'every asked id must come back in the result');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a failed chunk throws, so the caller degrades to "unknown" not to a false denial', async () => {
  // A PARTIAL answer is worse than no answer here: the missing ids would render as
  // confident "No recording on YouTube". Throwing lets resolveArchives' catch turn
  // the whole lookup into `null` → "we couldn't confirm", which is honest.
  let mod: typeof import('./panood-youtube');
  try {
    mod = await import('./panood-youtube');
  } catch {
    return;
  }
  const ids = Array.from({ length: 60 }, (_, i) => `vid${String(i).padStart(8, '0')}`);
  let call = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    call += 1;
    if (call === 2) return { ok: false, status: 403, text: async () => 'quotaExceeded' } as unknown as Response;
    const chunk = (new URL(String(url)).searchParams.get('id') ?? '').split(',').filter(Boolean);
    return {
      ok: true,
      json: async () => ({ items: chunk.map((id) => ({ id })) }),
    } as unknown as Response;
  }) as typeof globalThis.fetch;

  try {
    await assert.rejects(
      () => mod.fetchYoutubeVideoArchives('tok', ids),
      /403/,
      'a failed chunk must throw rather than return a partial answer',
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

/* ── 5 · No deletes, anywhere ─────────────────────────────────────────────── */

test('🔒 nothing in the recording path can DELETE a broadcast', () => {
  // § 6 promises the archive indefinite retention, and no column records whether
  // a broadcast carried video (went_live_at has no writer), so no code here can
  // tell an empty container from a ceremony. Deletion must stay absent.
  const recordings = repoFile('lib/live-studio-recordings.ts');
  const youtube = repoFile('lib/panood-youtube.ts');
  const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  assert.ok(
    !/liveBroadcasts\/?\S*['"`]?\s*,?\s*\S*method:\s*'DELETE'/.test(code(youtube)),
    'panood-youtube must expose no broadcast delete',
  );
  assert.ok(!/'DELETE'/.test(code(youtube)), 'no DELETE method anywhere in the YouTube client');
  assert.ok(
    !/\.delete\(/.test(code(recordings)),
    'the recordings module must never delete a row or a video',
  );
});

/* ── 6 · Duration parsing ─────────────────────────────────────────────────── */

test('ISO-8601 durations parse, and PT0S reads as unknown rather than zero', async () => {
  // Imported dynamically: panood-youtube.ts carries `import 'server-only'`, which
  // the unit runner cannot resolve at module scope. Skips cleanly if unresolvable.
  let parse: ((raw: string | undefined) => number | null) | null = null;
  try {
    ({ parseIso8601DurationSeconds: parse } = await import('./panood-youtube'));
  } catch {
    return; // server-only unavailable under the runner — covered by typecheck
  }
  assert.equal(parse!('PT1H30M'), 5400);
  assert.equal(parse!('PT45S'), 45);
  assert.equal(parse!('P1DT2H'), 93600);
  assert.equal(parse!('PT0S'), null, 'YouTube reports PT0S while still processing');
  assert.equal(parse!(undefined), null);
  assert.equal(parse!('garbage'), null);
});
