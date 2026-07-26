/**
 * Structural guard for the dual-stream watch block.
 *
 * The RENDER-shape contract (both links when both are set, one when one is set,
 * nothing when neither) is proven on the pure reduction that feeds this
 * component — lib/watch-live-links.test.ts. What CANNOT be proven there, and is
 * the part that would actually hurt, is the embed rule:
 *
 *   ⚠ FACEBOOK IS A LINK, NEVER AN IFRAME.
 *
 * Embedding Meta's plugin would put third-party Meta cookies on a public wedding
 * page — the exact thing the youtube-nocookie choice exists to avoid — and
 * next.config.ts deliberately keeps facebook.com off `frame-src`, so it would
 * also be CSP-blocked and simply render a broken box at a wedding. This file
 * pins all three halves of that: the component, the whole app tree, and the CSP.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** app/[slug]/_components → apps/web */
const WEB_ROOT = join(HERE, '..', '..', '..');

const BLOCK = readFileSync(join(HERE, 'watch-live-block.tsx'), 'utf8');

test('both doors are offered, and the YouTube one is untouched', () => {
  assert.match(BLOCK, /Open on YouTube/, 'the existing YouTube link-out was removed');
  assert.match(BLOCK, /Watch on Facebook/, 'there is no Facebook link-out');
});

test('a Facebook-only event still renders something', () => {
  // Without this branch, a couple who published ONLY to Facebook would get a
  // blank space where the livestream should be.
  assert.match(
    BLOCK,
    /if \(!watchLive\.embedUrl\)/,
    'no embed-less branch — a Facebook-only event would render nothing',
  );
});

test('the only iframe in the block is the YouTube embed', () => {
  const iframes = BLOCK.match(/<iframe/g) ?? [];
  assert.equal(iframes.length, 1, `expected exactly one iframe, found ${iframes.length}`);
  assert.match(
    BLOCK,
    /<iframe[\s\S]*?src=\{watchLive\.embedUrl\}/,
    'the iframe src is not watchLive.embedUrl — only the validated YouTube embed may be framed',
  );
  assert.doesNotMatch(
    BLOCK,
    /src=\{[^}]*facebook/i,
    'a Facebook value reached an iframe src',
  );
});

test('nothing anywhere in the app embeds Facebook', () => {
  // Repo-wide, so a future surface cannot quietly add the Meta video plugin.
  let hits = '';
  try {
    hits = execFileSync(
      'git',
      ['grep', '-lI', '-e', 'facebook.com/plugins', '--', 'app', 'lib', 'components'],
      { cwd: WEB_ROOT, encoding: 'utf8' },
    );
  } catch {
    hits = ''; // git grep exits 1 when there are no matches — that is the pass case.
  }
  assert.equal(
    hits.trim(),
    '',
    `facebook.com/plugins (the Meta video embed) appears in:\n${hits}`,
  );
});

test('the CSP still refuses to frame facebook.com', () => {
  const config = readFileSync(join(WEB_ROOT, 'next.config.ts'), 'utf8');
  // Anchored on the directive itself — a bare /frame-src/ also matches the
  // prose comment above the header and would make this test vacuous.
  const frameSrc = /frame-src 'self'[^"']*/.exec(config)?.[0] ?? '';
  assert.notEqual(frameSrc, '', 'no frame-src directive found in next.config.ts');
  assert.ok(
    !/facebook/i.test(frameSrc),
    `facebook was added to frame-src — the "link, never an embed" rule is the reason it is absent:\n${frameSrc}`,
  );
  assert.match(frameSrc, /youtube-nocookie/, 'the YouTube embed host fell out of frame-src');
});
