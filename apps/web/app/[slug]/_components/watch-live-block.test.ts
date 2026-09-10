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
 *
 * W1 moved the plain-embed branch's `<a href>` + `<iframe>` out of this file
 * into watch-live-embed.tsx (a client component — the poll that keeps them
 * pointed at a broadcast that reconnected needs client state; the Roam-picker
 * and Facebook-only branches here do not). The doors/iframe assertions below
 * now read that file instead of this one.
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
const EMBED = readFileSync(join(HERE, 'watch-live-embed.tsx'), 'utf8');

test('both doors are offered, and the YouTube one is untouched', () => {
  assert.match(EMBED, /Open on YouTube/, 'the existing YouTube link-out was removed');
  assert.match(BLOCK, /Watch on Facebook/, 'there is no Facebook link-out');
  assert.match(EMBED, /Watch on Facebook/, 'the plain-embed branch lost its Facebook link-out');
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

test('the only iframe in the feature is the YouTube embed, and it is client-polled', () => {
  const iframes = (BLOCK.match(/<iframe/g) ?? []).length + (EMBED.match(/<iframe/g) ?? []).length;
  assert.equal(iframes, 1, `expected exactly one iframe across both files, found ${iframes}`);
  assert.doesNotMatch(BLOCK, /<iframe/, 'watch-live-block.tsx should delegate the embed, not render it');
  assert.match(
    EMBED,
    /<iframe[\s\S]*?src=\{embedUrl\}/,
    'the iframe src is not the polled embedUrl state — a reconnect could not update it',
  );
  assert.doesNotMatch(
    EMBED,
    /src=\{[^}]*facebook/i,
    'a Facebook value reached an iframe src',
  );
});

/** This file — a guard must not flag the patterns it is written to look for. */
const SELF = 'app/[slug]/_components/watch-live-block.test.ts:';

/** `git grep -nI` over apps/web, as `file:line:code` rows. Empty on no match. */
function grepWeb(pattern: string): string[] {
  try {
    return execFileSync('git', ['grep', '-nI', '-e', pattern, '--', 'app', 'lib', 'components'], {
      cwd: WEB_ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .filter((row) => !row.startsWith(SELF));
  } catch {
    return []; // git grep exits 1 when there are no matches — that is the pass case.
  }
}

/** True when the matched line is prose (a comment), not code. */
function isComment(row: string): boolean {
  const code = row.replace(/^.*?:\d+:/, '').trim();
  return (
    code.startsWith('//') || code.startsWith('*') || code.startsWith('/*') || code.startsWith('{/*')
  );
}

test('nothing anywhere in the app embeds Facebook', () => {
  // POSITIVE CONTROL first: a silent `git grep` failure (no git dir, wrong cwd)
  // would make every assertion below pass for the wrong reason.
  assert.ok(
    grepWeb('youtube-nocookie').length > 0,
    'git grep found no youtube-nocookie — the search itself is broken, so this guard proves nothing',
  );

  // (a) The Meta video plugin URL, anywhere it could be CONSTRUCTED. Comment
  //     lines are excluded — several files explain WHY we do not embed Facebook.
  const plugin = grepWeb('facebook.com/plugins').filter((row) => !isComment(row));
  assert.deepEqual(plugin, [], `facebook.com/plugins (the Meta video embed) is referenced in code`);

  // (b) Any `src` attribute pointing at Facebook — the shape an embed actually
  //     takes, whether or not it goes through the plugin URL.
  const srcs = grepWeb('src=[^>]*facebook').filter((row) => !isComment(row));
  assert.deepEqual(srcs, [], 'a Facebook URL reached a src attribute — Facebook is a link, never an embed');
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
