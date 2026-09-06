/**
 * live-studio-ingest-health.test.ts
 *
 * Pins two things: the pure decision in lib/live-studio-ingest-health.ts, and
 * that the state it produces actually reaches the controller's render — a
 * constant nobody renders is not a warning (the same shape
 * live-studio-lead-time.test.ts pins for LEAD_TIME_NOTICE).
 *
 * Its own file so it cannot conflict with a concurrent PR.
 *
 * Run: `pnpm test:unit`
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  decideIngestHealth,
  POLL_INTERVAL_MS,
  STALE_AFTER_MS,
  LOCAL_PREEMPT_MS,
  type EncoderHealthInput,
} from '@/lib/live-studio-ingest-health';

const encoder = (partial: Partial<EncoderHealthInput>): EncoderHealthInput => ({
  rtmp: 'publishing',
  reconnectingForMs: 0,
  droppedFrames: 0,
  bitrateRung: 0,
  recording: true,
  ...partial,
});

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ─────────────────────────────────────────────────────────────────────────
// THE DECISION — every named state, and both traps.
// ─────────────────────────────────────────────────────────────────────────

test('not live yet → waiting_for_encoder, regardless of any stale/odd fields', () => {
  const d = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'good',
    live: false,
    lastOkAt: 999_999_999,
  });
  assert.equal(d.state, 'waiting_for_encoder');
  assert.match(d.sentence, /not live yet/i);
});

test('⚠ TRAP 2 — a read that has never once succeeded says "cannot tell", never "receiving"', () => {
  const d = decideIngestHealth({
    streamStatus: null,
    healthStatus: null,
    live: true,
    lastOkAt: null,
  });
  assert.equal(d.state, 'no_data');
  assert.doesNotMatch(d.sentence, /receiving/i);
});

test('⚠ TRAP 2, isolated — streamStatus:null must say "cannot confirm" even with a FRESH lastOkAt (not the staleness path)', () => {
  // lastOkAt: 0 is deliberately NOT stale, so this can only pass through the
  // `streamStatus === null` branch specifically — not the staleness fallback,
  // which the previous test alone cannot tell apart (both branches return
  // `no_data` and neither happens to say "receiving"). Delete the
  // `streamStatus === null` check and this must fail, even though the test
  // above still passes.
  const d = decideIngestHealth({
    streamStatus: null,
    healthStatus: null,
    live: true,
    lastOkAt: 0,
  });
  assert.equal(d.state, 'no_data');
  assert.match(d.sentence, /can't confirm/i);
  assert.doesNotMatch(d.sentence, /not sending/i);
});

test('⚠ TRAP 1 — a STALE cached "active" reading must not render as still fine', () => {
  // The cache says 'active' — this is EXACTLY the shape a poll loop that died
  // three ticks ago would keep re-sending forever if staleness were not
  // checked. Delete the `lastOkAt > STALE_AFTER_MS` branch in
  // decideIngestHealth and this test must fail.
  const d = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'good',
    live: true,
    lastOkAt: STALE_AFTER_MS + 1,
  });
  assert.equal(d.state, 'no_data');
  assert.notEqual(d.state, 'receiving');
});

test('a FRESH "active" reading is receiving', () => {
  const d = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'good',
    live: true,
    lastOkAt: 0,
  });
  assert.equal(d.state, 'receiving');
});

test('fresh + active + null healthStatus is still receiving (YouTube omits it before any data)', () => {
  const d = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: null,
    live: true,
    lastOkAt: POLL_INTERVAL_MS,
  });
  assert.equal(d.state, 'receiving');
});

test('fresh + active + bad health → degraded, not receiving', () => {
  for (const bad of ['bad', 'noData']) {
    const d = decideIngestHealth({
      streamStatus: 'active',
      healthStatus: bad,
      live: true,
      lastOkAt: 0,
    });
    assert.equal(d.state, 'degraded', `healthStatus=${bad} must degrade`);
  }
});

test('fresh + NOT active (inactive/ready/created/error) while live → no_data, the encoder is dead', () => {
  for (const status of ['inactive', 'ready', 'created', 'error']) {
    const d = decideIngestHealth({
      streamStatus: status,
      healthStatus: null,
      live: true,
      lastOkAt: 0,
    });
    assert.equal(d.state, 'no_data', `streamStatus=${status} must be no_data`);
  }
});

test('every state carries a non-empty operator sentence — never rendered nothing', () => {
  const cases: Parameters<typeof decideIngestHealth>[0][] = [
    { streamStatus: null, healthStatus: null, live: false, lastOkAt: null },
    { streamStatus: null, healthStatus: null, live: true, lastOkAt: null },
    { streamStatus: 'active', healthStatus: 'good', live: true, lastOkAt: 0 },
    { streamStatus: 'active', healthStatus: 'bad', live: true, lastOkAt: 0 },
    { streamStatus: 'inactive', healthStatus: null, live: true, lastOkAt: 0 },
  ];
  for (const input of cases) {
    const d = decideIngestHealth(input);
    assert.ok(d.sentence.length > 10, `no sentence for ${JSON.stringify(input)}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// S5 — THE DESKTOP TRANSPORT ANNOTATION. Informational only: must NEVER
// change `state`, in either direction, for any envelope value — including
// `base64`/`json_array`, the EXPECTED path today (owner decision 2026-09-06).
// A guard that turned "not raw" into a degradation would flag every macOS
// user as broken; see the module docblock and `Envelope::is_zero_copy`'s
// Rust comment for the exact mistake this must not repeat.
// ─────────────────────────────────────────────────────────────────────────

test('transportEnvelope never changes `state`, for any envelope value, in any base state', () => {
  const bases: Array<Parameters<typeof decideIngestHealth>[0]> = [
    { streamStatus: null, healthStatus: null, live: false, lastOkAt: null },
    { streamStatus: null, healthStatus: null, live: true, lastOkAt: null },
    { streamStatus: 'active', healthStatus: 'good', live: true, lastOkAt: 0 },
    { streamStatus: 'active', healthStatus: 'bad', live: true, lastOkAt: 0 },
    { streamStatus: 'inactive', healthStatus: null, live: true, lastOkAt: 0 },
  ];
  for (const base of bases) {
    const without = decideIngestHealth(base);
    for (const envelope of ['raw', 'json_array', 'base64', 'loopback']) {
      const withEnvelope = decideIngestHealth({ ...base, transportEnvelope: envelope });
      assert.equal(
        withEnvelope.state,
        without.state,
        `transportEnvelope=${envelope} must not change state from ${without.state} (base=${JSON.stringify(base)})`,
      );
      assert.equal(
        withEnvelope.sentence,
        without.sentence,
        `transportEnvelope=${envelope} must not change the operator sentence`,
      );
    }
  }
});

test('REGRESSION GUARD — being on base64/json_array specifically must not degrade a healthy receive', () => {
  // The literal shape of the mistake this exists to prevent: refusing/degrading
  // merely because the envelope answer is not "raw".
  const receiving = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'good',
    live: true,
    lastOkAt: 0,
    transportEnvelope: 'base64',
  });
  assert.equal(receiving.state, 'receiving');
});

test('transportEnvelope present → a non-empty, non-alarming transportNote', () => {
  const d = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'good',
    live: true,
    lastOkAt: 0,
    transportEnvelope: 'base64',
  });
  assert.equal(d.transportNote, 'Desktop transport: base64.');
  assert.doesNotMatch(d.transportNote ?? '', /degrad|unstable|refus|fail/i);
});

test('transportEnvelope omitted or null → transportNote is null, not an empty string or "undefined"', () => {
  const d1 = decideIngestHealth({ streamStatus: 'active', healthStatus: 'good', live: true, lastOkAt: 0 });
  assert.equal(d1.transportNote, null);
  const d2 = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'good',
    live: true,
    lastOkAt: 0,
    transportEnvelope: null,
  });
  assert.equal(d2.transportNote, null);
});

// ─────────────────────────────────────────────────────────────────────────
// S9 — the encoder's own reading, and the precedence between it and YouTube.
// ─────────────────────────────────────────────────────────────────────────

test('no encoder reading at all → behaves exactly as before (backward compatible)', () => {
  const withNull = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'good',
    live: true,
    lastOkAt: 0,
    encoder: null,
  });
  const withUndefined = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'good',
    live: true,
    lastOkAt: 0,
  });
  assert.deepEqual(withNull, withUndefined);
  assert.equal(withNull.state, 'receiving');
});

test('⚠ PRECEDENCE 1 — NO local encoder reading, however loud, can make a YouTube no_data reading greener', () => {
  const youtubeNoData = { streamStatus: null, healthStatus: null, live: true, lastOkAt: null } as const;
  for (const enc of [
    encoder({ rtmp: 'publishing' }),
    encoder({ rtmp: 'publishing', bitrateRung: 2 }),
    // Even a LOCAL encoder reading that would itself be an escalation
    // (down/reconnecting) must not be checked at all once YouTube itself
    // has nothing to report — delete the no_data short-circuit and THESE
    // two specifically start returning 'encoder_down'/'reconnecting'
    // instead of the YouTube-reported 'no_data'.
    encoder({ rtmp: 'down' }),
    encoder({ rtmp: 'reconnecting', reconnectingForMs: LOCAL_PREEMPT_MS }),
  ]) {
    const d = decideIngestHealth({ ...youtubeNoData, encoder: enc });
    assert.equal(d.state, 'no_data', `encoder=${JSON.stringify(enc)} must not override a YouTube no_data`);
  }

  for (const input of [
    { streamStatus: 'active', healthStatus: 'good', live: true, lastOkAt: STALE_AFTER_MS + 1 },
    { streamStatus: 'inactive', healthStatus: null, live: true, lastOkAt: 0 },
  ] as const) {
    const d = decideIngestHealth({ ...input, encoder: encoder({ rtmp: 'publishing' }) });
    assert.equal(d.state, 'no_data', `local publishing must not override ${JSON.stringify(input)}`);
  }
});

test('⚠ PRECEDENCE 2 — local `down` pre-empts an otherwise-fine YouTube `receiving` reading immediately', () => {
  const d = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'good',
    live: true,
    lastOkAt: 0,
    encoder: encoder({ rtmp: 'down', reconnectingForMs: 0 }),
  });
  assert.equal(d.state, 'encoder_down');
});

test('⚠ PRECEDENCE 2 — local `reconnecting` under LOCAL_PREEMPT_MS does NOT yet pre-empt a fine YouTube reading', () => {
  const d = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'good',
    live: true,
    lastOkAt: 0,
    encoder: encoder({ rtmp: 'reconnecting', reconnectingForMs: LOCAL_PREEMPT_MS - 1 }),
  });
  assert.equal(d.state, 'receiving', 'a sub-1s blip must not alarm yet');
});

test('⚠ PRECEDENCE 2 — local `reconnecting` AT/OVER LOCAL_PREEMPT_MS pre-empts a fine YouTube `degraded` reading too', () => {
  const d = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'bad',
    live: true,
    lastOkAt: 0,
    encoder: encoder({ rtmp: 'reconnecting', reconnectingForMs: LOCAL_PREEMPT_MS }),
  });
  assert.equal(d.state, 'reconnecting');
});

test('PRECEDENCE 3 — a non-zero bitrate rung is a SUB-state: stays `receiving`, sentence notes reduced quality', () => {
  const clean = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'good',
    live: true,
    lastOkAt: 0,
    encoder: encoder({ bitrateRung: 0 }),
  });
  const reduced = decideIngestHealth({
    streamStatus: 'active',
    healthStatus: 'good',
    live: true,
    lastOkAt: 0,
    encoder: encoder({ bitrateRung: 2 }),
  });
  assert.equal(reduced.state, 'receiving', 'a reduced rung must not become its own alarm state');
  assert.equal(clean.state, 'receiving');
  assert.match(reduced.sentence, /reduced quality/i);
  assert.doesNotMatch(clean.sentence, /reduced quality/i);
});

test('own-channel (not `live`) with an idle encoder → waiting, own-channel note included', () => {
  const d = decideIngestHealth({
    streamStatus: null,
    healthStatus: null,
    live: false,
    lastOkAt: null,
    encoder: encoder({ rtmp: 'idle' }),
  });
  assert.equal(d.state, 'waiting_for_encoder');
  assert.match(d.sentence, /own channel/i);
});

test('own-channel (not `live`) with a publishing encoder → receiving, not "nothing"', () => {
  const d = decideIngestHealth({
    streamStatus: null,
    healthStatus: null,
    live: false,
    lastOkAt: null,
    encoder: encoder({ rtmp: 'publishing' }),
  });
  assert.equal(d.state, 'receiving');
  assert.match(d.sentence, /own channel/i, 'must explain why there is no YouTube reading, not show nothing');
});

test('own-channel (not `live`) with a down encoder → encoder_down, not the generic "not live yet"', () => {
  const d = decideIngestHealth({
    streamStatus: null,
    healthStatus: null,
    live: false,
    lastOkAt: null,
    encoder: encoder({ rtmp: 'down' }),
  });
  assert.equal(d.state, 'encoder_down');
});

test('own-channel (not `live`) with NO encoder reading at all → unchanged legacy waiting_for_encoder, no own-channel note', () => {
  const d = decideIngestHealth({ streamStatus: null, healthStatus: null, live: false, lastOkAt: null });
  assert.equal(d.state, 'waiting_for_encoder');
  assert.doesNotMatch(d.sentence, /own channel/i);
});

test('every new S9 state carries a non-empty operator sentence', () => {
  const cases: Parameters<typeof decideIngestHealth>[0][] = [
    { streamStatus: 'active', healthStatus: 'good', live: true, lastOkAt: 0, encoder: encoder({ rtmp: 'down' }) },
    {
      streamStatus: 'active',
      healthStatus: 'good',
      live: true,
      lastOkAt: 0,
      encoder: encoder({ rtmp: 'reconnecting', reconnectingForMs: LOCAL_PREEMPT_MS }),
    },
    { streamStatus: null, healthStatus: null, live: false, lastOkAt: null, encoder: encoder({ rtmp: 'connecting' }) },
  ];
  for (const input of cases) {
    const d = decideIngestHealth(input);
    assert.ok(d.sentence.length > 10, `no sentence for ${JSON.stringify(input)}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// QUOTA ARITHMETIC — pin the numbers the comment derives, not just the comment.
// ─────────────────────────────────────────────────────────────────────────

test('poll interval fits the documented worst-case quota budget (15 weddings × 12h, reserving half of 10,000/day)', () => {
  const WORST_CASE_WEDDINGS = 15;
  const WORST_CASE_HOURS = 12;
  const RESERVED_BUDGET_UNITS = 5000;
  const worstCaseUnitsPerDay =
    WORST_CASE_WEDDINGS * WORST_CASE_HOURS * (3600 / (POLL_INTERVAL_MS / 1000));
  assert.ok(
    worstCaseUnitsPerDay <= RESERVED_BUDGET_UNITS,
    `POLL_INTERVAL_MS=${POLL_INTERVAL_MS} costs ${worstCaseUnitsPerDay} units/day worst-case, over the ${RESERVED_BUDGET_UNITS} reserve`,
  );
});

test('STALE_AFTER_MS tolerates one missed poll but not two', () => {
  assert.ok(STALE_AFTER_MS > POLL_INTERVAL_MS, 'one missed poll must not alarm');
  assert.ok(STALE_AFTER_MS <= 3 * POLL_INTERVAL_MS, 'must alarm well before three misses');
});

// ─────────────────────────────────────────────────────────────────────────
// ⭐ THE STATE ACTUALLY REACHES THE RENDER — a constant nobody renders is not
// a warning. Same shape as live-studio-lead-time.test.ts's pin on the buy page.
// ─────────────────────────────────────────────────────────────────────────

const CONTROLLER_PAGE = 'app/panood/control/[eventId]/page.tsx';
const STRIP_COMPONENT = "app/panood/control/[eventId]/_components/ingest-health-strip.tsx";
const SERVER_READ = 'lib/live-studio-ingest-health-server.ts';

test('⭐ the controller page actually mounts IngestHealthStrip', () => {
  const page = read(CONTROLLER_PAGE);
  assert.match(
    page,
    /<IngestHealthStrip\b/,
    'a decideIngestHealth state that is never rendered is not a warning',
  );
  assert.match(
    page,
    /from '\.\/_components\/ingest-health-strip'/,
    'not imported at all',
  );
});

test('⭐ the strip only mounts for a Setnayan-managed broadcast (the by-hand route has no stream_id)', () => {
  const page = read(CONTROLLER_PAGE);
  const mountAt = page.indexOf('<IngestHealthStrip');
  const before = page.slice(Math.max(0, mountAt - 400), mountAt);
  assert.match(
    before,
    /liveAir\.source === 'broadcast'/,
    'mounting unconditionally would poll for a stream_id that does not exist on the by-hand route',
  );
});

test('the poller never overwrites its cache on a failed tick — trap 1, pinned at the source', () => {
  const src = read(STRIP_COMPONENT);
  const fn = src.slice(src.indexOf('const tick = async'));
  const body = fn.slice(0, fn.indexOf('\n    tick();'));
  assert.match(
    body,
    /if \(data\.streamStatus !== null\)/,
    'a failed read must not silently refresh the cache with a guess',
  );
  // The catch block (network blip to our own endpoint) must contain no write
  // to cachedRef.current — only the success branch above may write it.
  const catchBlock = body.slice(body.indexOf('} catch {'), body.indexOf('} finally {'));
  assert.doesNotMatch(
    catchBlock,
    /cachedRef\.current\s*=/,
    'a failed fetch must never touch the cached reading',
  );
});

test('the server read degrades every failure to streamStatus: null, never a guessed status', () => {
  const src = read(SERVER_READ);
  // Every catch block in this file must return an object whose streamStatus
  // is null — never `streamStatus` copied from a partial/guessed value.
  const catchReturns = [...src.matchAll(/catch\s*\{[^}]*return\s*(\{[^}]*\}|NOT_POLLABLE)/gs)];
  assert.ok(catchReturns.length >= 2, 'expected multiple fail-honest catch blocks');
  for (const m of catchReturns) {
    const captured = m[1] ?? '';
    if (captured === 'NOT_POLLABLE') continue;
    assert.match(
      captured,
      /streamStatus:\s*null/,
      `a catch block must degrade to streamStatus: null — found: ${captured}`,
    );
  }
});
