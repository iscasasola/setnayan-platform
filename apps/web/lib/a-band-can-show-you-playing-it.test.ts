/**
 * a-band-can-show-you-playing-it.test.ts
 *
 * Owner 2026-08-18: *"we have a song bank of all music. bands/musicians can pick
 * the song they can do. and they can link videos of them performing that song
 * via youtube link."*
 *
 * The first half shipped; the second had nowhere to live. A band could say "I
 * can play this" and could not show it — so a couple choosing between three
 * bands who all claim Forevermore had nothing to compare.
 *
 * 🔑 AND NOTHING PUBLIC READ THE REPERTOIRE AT ALL. It existed only to match
 * requests on the day. Storing a video with no viewer would have been a gate
 * with no handle — built on the day three of them were removed — so the public
 * section ships in the same change as the column.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { parseVideoLink } from '@/lib/video-embed';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the link is validated by the app’s existing parser, not a new one', () => {
  // RULE 0 — parseVideoLink already accepts the hosts this feature needs.
  assert.ok(parseVideoLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'YouTube must parse');
  assert.ok(parseVideoLink('https://youtu.be/dQw4w9WgXcQ'), 'the short form must parse');
  assert.equal(parseVideoLink('not a link'), null, 'junk must be refused');

  const src = read('app/vendor-dashboard/repertoire/actions.ts');
  assert.match(src, /parseVideoLink\(/, 'the action must validate with the shared parser');
  assert.doesNotMatch(
    src,
    /youtube\\.com|youtu\\.be/,
    'the action must not hand-roll its own host list — that is what the parser is for',
  );
});

test('the band can CLEAR a link, not only set one', () => {
  const src = read('app/vendor-dashboard/repertoire/actions.ts');
  const fn = /export async function setPerformanceLink\([\s\S]*?\n}/.exec(src);
  assert.ok(fn, 'setPerformanceLink should exist');
  // Taking a video down must be as easy as putting one up: empty clears.
  assert.match(
    fn[0],
    /let value: string \| null = null;/,
    'an empty box must clear the link rather than being refused as invalid',
  );
});

test('a refused save is reported, never shown as success', () => {
  const fn = /export async function setPerformanceLink\([\s\S]*?\n}/.exec(
    read('app/vendor-dashboard/repertoire/actions.ts'),
  );
  assert.ok(fn);
  // Supabase resolves rather than throwing: an RLS filter and a successful
  // no-op are the same value. Without the read-back, saving a link onto
  // somebody else's song would report success.
  assert.match(
    fn[0],
    /data\.length === 0/,
    'a zero-row update must be reported — otherwise a refusal looks like a save',
  );
});

test('a couple can actually SEE the set list — the column has a viewer', () => {
  /*
    🔑 THE ASSERTION THAT STOPS THIS BEING A GATE WITH NO HANDLE. Before this
    change nothing public read vendor_songs. A stored link nobody can reach is
    the exact shape this codebase has shipped six times.
  */
  const pub = read('app/v/[slug]/page.tsx');
  assert.match(pub, /fetchVendorSongs\(/, 'the public shop page must read the repertoire');
  assert.match(pub, /Songs they play/, 'it must render the set list');
  assert.match(
    pub,
    /performance_url/,
    'it must offer the video where the band put one',
  );
  // An empty set list must not render as "this band plays nothing".
  assert.match(
    pub,
    /repertoire\.length > 0 \?/,
    'an empty repertoire must render nothing at all, not an empty section — the ' +
      'band simply has not filled it in yet',
  );
});

test('the fetch carries the link through, or the viewer has nothing to show', () => {
  const src = read('lib/songs.ts');
  const fn = /export async function fetchVendorSongs\([\s\S]*?\n}/.exec(src);
  assert.ok(fn, 'fetchVendorSongs should exist');
  assert.match(
    fn[0],
    /\.select\('[^']*\bperformance_url\b[^']*'\)/,
    'the select must ASK for the column — a phantom column is rejected silently ' +
      'and the only symptom is that no video ever appears',
  );
});
