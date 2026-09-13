import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { YOUTUBE_RTMPS_PRIMARY_LABEL } from './live-studio-encoder-ingest-default';

/**
 * The address shown to the couple must be the address Rust actually publishes to
 * when they give none. These are two files in two languages; nothing but this
 * test connects them.
 *
 * It reads the Rust source rather than trusting a comment, because a comment
 * cannot fail — the bug DSK-1 fixed was itself a comment ("S5's encoder takes
 * the server URL as its own separate argument") that described an argument
 * nobody ever built.
 */
const RUST_SOURCE = join(process.cwd(), '..', '..', 'src-tauri', 'src', 'stream_key.rs');

test('the displayed default is the address Rust really holds a keyless paste against', () => {
  const source = readFileSync(RUST_SOURCE, 'utf8');
  const match = source.match(/const YOUTUBE_RTMPS_PRIMARY: &str = "([^"]+)";/);
  assert.ok(
    match,
    `YOUTUBE_RTMPS_PRIMARY not found in ${RUST_SOURCE} — if it was renamed, this ` +
      'guard must be pointed at the new name, never deleted',
  );
  assert.equal(
    match[1],
    YOUTUBE_RTMPS_PRIMARY_LABEL,
    'the address shown to the couple has drifted from the one the encoder uses',
  );
});

test('the displayed default is a usable rtmps address, not a hostname', () => {
  // A bare host would parse as MissingApp in Rust and refuse at paste time.
  assert.match(YOUTUBE_RTMPS_PRIMARY_LABEL, /^rtmps:\/\/[^/]+\/.+/);
});
