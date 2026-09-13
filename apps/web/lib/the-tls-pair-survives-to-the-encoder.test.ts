import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

/**
 * DSK-3 · THE CHAIN, NOT THE LINKS.
 *
 * `resolveEncoderIngest` is tested directly and the Rust side is tested in
 * `stream_key.rs`. Neither can see whether the addresses actually TRAVEL: YouTube
 * hands them over exactly once, at stream creation, and every step between there
 * and the encoder is a place they can be silently dropped — a `select` list that
 * omits a column returns `undefined`, which writes as NULL, which reads as "this
 * broadcast has no TLS address" and downgrades a wedding to plain RTMP with
 * nothing on screen to say so.
 *
 * That is the whole defect class DSK-3 fixes: every piece built, nothing joined.
 * So each link is pinned here, against source text with the ONE canonical
 * stripper (`lib/strip-comments.ts`) — these files carry docblocks naming every
 * symbol below, and without stripping every negative assertion would pass on
 * prose.
 */

const WEB = process.cwd();
const BROADCAST = join(WEB, 'lib/panood-broadcast.ts');
const CLAIMS = join(WEB, 'lib/live-studio-encoder-claims.ts');
const GOLIVE = join(WEB, 'app/dashboard/[eventId]/studio/panood/setup/actions.ts');
const REBIND = join(WEB, 'app/api/live-studio/encoder/broadcast-ended/route.ts');

function code(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const stripped = stripComments(raw);
  assert.ok(
    stripped.length > raw.length * 0.2,
    `stripping ${path} removed too much (${raw.length} -> ${stripped.length}); ` +
      'the assertions below would be running against a near-empty string',
  );
  return stripped;
}

test('the row is INSERTED with both TLS columns', () => {
  const src = code(BROADCAST);
  assert.match(src, /rtmps_ingestion_url: input\.rtmpsIngestionUrl \?\? null/);
  assert.match(src, /rtmps_backup_ingestion_url: input\.rtmpsBackupIngestionUrl \?\? null/);
});

test('EVERY select on panood_broadcasts reads the TLS columns back', () => {
  // A select list that omits them returns undefined, which the rebind then
  // writes as NULL — a wedding downgraded to plain RTMP while recovering.
  const src = code(BROADCAST);
  const selects = src.match(/'id, broadcast_id, stream_id, ingestion_url[^']*'/g) ?? [];
  assert.ok(selects.length >= 2, `expected the row select lists, found ${selects.length}`);
  for (const sel of selects) {
    assert.match(sel, /rtmps_ingestion_url/, `select omits the TLS primary: ${sel}`);
    assert.match(sel, /rtmps_backup_ingestion_url/, `select omits the TLS backup: ${sel}`);
  }
});

test('go-live persists what YouTube returned — the only moment it exists', () => {
  const src = code(GOLIVE);
  assert.match(src, /rtmpsIngestionUrl: stream\.rtmpsIngestionAddress/);
  assert.match(src, /rtmpsBackupIngestionUrl: stream\.rtmpsBackupIngestionAddress/);
});

test('the reconnect rebind CARRIES the pair forward', () => {
  // It reuses the SAME YouTube stream, so these are not re-fetchable. Dropping
  // them here downgrades a wedding at the moment it is recovering from a drop.
  const src = code(REBIND);
  assert.match(src, /rtmpsIngestionUrl: active\.rtmps_ingestion_url/);
  assert.match(src, /rtmpsBackupIngestionUrl: active\.rtmps_backup_ingestion_url/);
});

test('the exchange resolves through the tested resolver, not an inline fallback', () => {
  const src = code(CLAIMS);
  assert.match(src, /resolveEncoderIngest\(b\)/);
  assert.match(src, /rtmpsUrl: ingest\.rtmpsUrl/);
  assert.match(src, /rtmpsBackupUrl: ingest\.rtmpsBackupUrl/);
  // The two shapes this replaced, either of which silently un-does DSK-3.
  assert.doesNotMatch(
    src,
    /rtmpsUrl: b\.ingestion_url/,
    'the exchange is handing the encoder the plain-RTMP address again',
  );
  assert.doesNotMatch(
    src,
    /rtmpsBackupUrl: null/,
    'the backup was hard-coded back to null',
  );
});

test('the exchange SELECTS the columns it resolves', () => {
  // Resolving a column you never selected yields undefined -> always the
  // fallback -> plain RTMP forever, with every other test here still green.
  //
  // ⚠ THIS GUARD WAS INERT WHEN FIRST WRITTEN, and a mutation run caught it: it
  // sliced 400 characters after `.from('panood_broadcasts')` and asserted the
  // column names appeared somewhere in that window. They did — in the `as {...}`
  // TYPE ANNOTATION a few lines below the select. Deleting the columns from the
  // select list left the annotation untouched, so the window still matched and
  // the guard passed through its own sabotage. Assert the SELECT STRING itself.
  const src = code(CLAIMS);
  const at = src.indexOf(".from('panood_broadcasts')");
  assert.ok(at > -1, 'the exchange no longer reads panood_broadcasts — re-aim this guard');

  // The quoted column list inside the `.select( … )` that follows.
  const selectAt = src.indexOf('.select(', at);
  assert.ok(selectAt > at, 'no .select() after the exchange read — re-aim this guard');
  const literal = src.slice(selectAt).match(/'([^']*)'/);
  assert.ok(literal, 'the exchange select is no longer a quoted column list');
  const columns = literal[1].split(',').map((c) => c.trim());

  assert.ok(
    columns.includes('rtmps_ingestion_url'),
    `the exchange select omits the TLS primary — columns were: ${columns.join(' | ')}`,
  );
  assert.ok(
    columns.includes('rtmps_backup_ingestion_url'),
    `the exchange select omits the TLS backup — columns were: ${columns.join(' | ')}`,
  );
  assert.ok(columns.includes('stream_key'), 'the exchange stopped selecting the key itself');
});

test('the OBS route keeps its plain-RTMP address, untouched', () => {
  // A human pasting into OBS still needs 1935; DSK-3 must not move that.
  const src = code(BROADCAST);
  assert.match(src, /ingestion_url: input\.ingestionUrl/);
  const control = code(join(WEB, 'app/panood/control/[eventId]/page.tsx'));
  assert.match(
    control,
    /activeBroadcast\.ingestion_url/,
    'the copy-to-OBS control must keep showing the plain-RTMP address',
  );
});

test('go-live never feeds the PLAIN address into the TLS fields', () => {
  // The compiler's own suggestion for a narrowed `stream` annotation is to
  // rename these reads to `ingestionAddress`. That compiles, ships plain RTMP on
  // 1935, and makes a green check certify the defect this row removes.
  const src = code(GOLIVE);
  assert.doesNotMatch(
    src,
    /rtmpsIngestionUrl: stream\.ingestionAddress/,
    'the TLS primary is being fed the plain-RTMP address',
  );
  assert.doesNotMatch(
    src,
    /rtmpsBackupIngestionUrl: stream\.(ingestionAddress|backupIngestionAddress)/,
    'the TLS backup is being fed a plain-RTMP address',
  );
});

test('the stream variable is typed by its producer, not a hand-listed subset', () => {
  // A structural annotation narrower than its initialiser throws fields away
  // silently — that is how the RTMPS pair became invisible at the one moment it
  // exists, and re-listing fields would let it happen again.
  const src = code(GOLIVE);
  assert.match(src, /let stream: YoutubeStream;/);
  assert.doesNotMatch(
    src,
    /let stream: \{[^}]*ingestionAddress[^}]*\}/,
    'the annotation re-lists fields again; use the exported return type',
  );
});
