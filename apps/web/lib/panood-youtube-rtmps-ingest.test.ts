/**
 * panood-youtube-rtmps-ingest.test.ts
 *
 * `liveStreams.insert` returns FOUR ingestion addresses and we stored one — the
 * plain-RTMP primary — because the only consumer was a person pasting it into OBS.
 * The native desktop encoder (S6) is not a person: it publishes over TLS on 443,
 * which is the port that survives a venue's Wi-Fi and a hotel's firewall, and when a
 * connection drops mid-reception the reconnect (S7) needs the backup address, which
 * YouTube only ever offers at creation time.
 *
 * Two things are pinned here, and the second matters as much as the first:
 *   1. the RTMPS pair is read off the response and returned;
 *   2. the guard that can fail a go-live still requires only what it always did.
 *      Every route to air goes through this function, and promoting a field we have
 *      never depended on into a required one would be a fresh way for go-live to
 *      break. Production held ZERO `panood_broadcasts` rows for months over one
 *      field on the sibling call (`panood-youtube-embed-omitted.test.ts`) — not a
 *      lesson worth learning twice.
 *
 * ⚠ SOURCE INSPECTION, NOT EXECUTION, AND NOT BY PREFERENCE. `panood-youtube.ts`
 * imports `server-only`, which does not resolve outside Next's compiler, so importing
 * it under `tsx --test` fails before a single assertion runs. That is why its sibling
 * test reads the file too. If this module ever loses that import, rewrite both of
 * these as real calls against a stubbed `fetch` — that would be strictly better.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = stripComments(readFileSync(join(WEB, 'lib/panood-youtube.ts'), 'utf8'));

function createStreamBody(): string {
  const start = src.indexOf('export async function createYoutubeStream');
  assert.ok(start > -1, 'createYoutubeStream must exist');
  return src.slice(start, src.indexOf('\nexport', start + 1));
}

test('YoutubeStream carries the RTMPS pair, and carries it optionally', () => {
  const typeStart = src.indexOf('export type YoutubeStream = {');
  assert.ok(typeStart > -1, 'the YoutubeStream type must exist');
  const type = src.slice(typeStart, src.indexOf('};', typeStart));

  for (const field of [
    'rtmpsIngestionAddress',
    'rtmpsBackupIngestionAddress',
    'backupIngestionAddress',
  ]) {
    assert.match(
      type,
      new RegExp(`${field}\\?:\\s*string;`),
      `${field} must be declared, and OPTIONAL — a stream row created before this ` +
        'shipped has none of them, and the OBS route must keep working untouched',
    );
  }
  // The two the whole platform already depends on stay required.
  assert.match(type, /\n\s*ingestionAddress:\s*string;/);
  assert.match(type, /\n\s*streamName:\s*string;/);
});

test('createYoutubeStream reads the RTMPS pair off the response and returns it', () => {
  const body = createStreamBody();

  // Declared on the response shape, or TypeScript would not let us read it.
  assert.match(body, /rtmpsIngestionAddress\?:\s*string;/);
  assert.match(body, /rtmpsBackupIngestionAddress\?:\s*string;/);
  assert.match(body, /backupIngestionAddress\?:\s*string;/);

  // And actually returned, from `info` — not invented, not defaulted.
  const returnStart = body.indexOf('return {');
  assert.ok(returnStart > -1, 'createYoutubeStream must return an object literal');
  const returned = body.slice(returnStart);
  assert.match(returned, /rtmpsIngestionAddress:\s*info\.rtmpsIngestionAddress/);
  assert.match(returned, /rtmpsBackupIngestionAddress:\s*info\.rtmpsBackupIngestionAddress/);
  assert.match(returned, /backupIngestionAddress:\s*info\.backupIngestionAddress/);
});

test('the go-live guard still requires only the address and key it always did', () => {
  const body = createStreamBody();
  const guardStart = body.indexOf('if (!info?.ingestionAddress');
  assert.ok(guardStart > -1, 'the ingestion-info guard must still be there');
  const guard = body.slice(guardStart, body.indexOf('}', guardStart));

  assert.match(guard, /!info\?\.ingestionAddress/);
  assert.match(guard, /!info\?\.streamName/);
  assert.doesNotMatch(
    guard,
    /rtmps/i,
    'requiring an RTMPS address here would fail go-live for any channel or API ' +
      'response that does not return one — the encoder can fall back to :1935, the ' +
      'couple cannot fall back to a broadcast that was never created',
  );
});
