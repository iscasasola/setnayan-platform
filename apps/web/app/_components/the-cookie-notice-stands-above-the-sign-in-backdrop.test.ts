/**
 * THE COOKIE NOTICE CAN BE ANSWERED WHILE THE SIGN-IN CARD IS OPEN.
 *
 * WHAT WAS WRONG (live re-walk of d2e38b7, 2026-10-12). On `/login` a first-time
 * visitor saw the cookie notice drawn UNDER the sign-in card's dimmed, blurred
 * backdrop: the notice is `z-[70]`, the `.home-reskin-ov` backdrop is 200, and a
 * press on Accept all / Essential only / Manage landed on the backdrop. The same
 * backdrop wraps /signup, /signup/you, the top-nav overlays and the sign-in-here
 * panel, so all of them did it.
 *
 * WHAT HOLDS IT. Both numbers are READ from the sources, never re-typed: the
 * notice's own z from its class list, the backdrop's from `home-reskin.css`, and
 * the lift rule's from the same file. If the backdrop is ever raised past the
 * lift, or the notice loses the attribute the lift selects on, this goes red.
 * And the backdrop keeps its own bottom clear of the notice by the height the
 * notice publishes (`--cookie-banner-top`), so lifting it never hides the
 * card's last line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const BANNER = stripComments(readFileSync(join(HERE, 'cookie-consent-banner.tsx'), 'utf8'));
const CSS = stripComments(readFileSync(join(HERE, 'home/home-reskin.css'), 'utf8'));

function zOf(selectorSource: string): number {
  const re = new RegExp(`(?:^|\\n)${selectorSource}\\s*\\{([^}]*)\\}`, 'g');
  for (let m = re.exec(CSS); m; m = re.exec(CSS)) {
    const z = /z-index:\s*(\d+)/.exec(m[1] ?? '');
    if (z) return Number(z[1]);
  }
  return NaN;
}

test('the notice carries the attribute the lift selects on', () => {
  assert.match(BANNER, /data-cookie-consent=""/, 'the notice lost `data-cookie-consent` — the lift above the sign-in backdrop no longer reaches it');
});

test('while a sign-in backdrop is open, the notice is drawn ABOVE it', () => {
  const own = Number(/\bz-\[(\d+)\]/.exec(BANNER)?.[1]);
  const backdrop = zOf('\\.home-reskin-ov');
  const lifted = zOf('html:has\\(\\.home-reskin-ov\\) \\[data-cookie-consent\\]');
  assert.ok(Number.isFinite(own) && Number.isFinite(backdrop), `could not read the two layers (notice ${own}, backdrop ${backdrop})`);
  assert.ok(Number.isFinite(lifted), 'the rule that lifts the notice over `.home-reskin-ov` is gone');
  assert.ok(
    lifted > backdrop,
    `the notice is lifted to ${lifted} but the backdrop is ${backdrop} — a press on Accept / Essential only lands on the backdrop again`,
  );
});

test('the backdrop keeps its bottom clear of the notice, by the height the notice publishes', () => {
  assert.match(
    CSS,
    /\.home-reskin-ov\s*\{[^}]*padding-bottom:[^;]*var\(--cookie-banner-top/,
    'the backdrop no longer pads its bottom by `--cookie-banner-top` — the lifted notice would cover the card\'s last line',
  );
  assert.match(BANNER, /'--cookie-banner-top'/, 'the notice stopped publishing `--cookie-banner-top`');
});
